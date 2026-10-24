import { expect, test, type Page } from '@playwright/test';
import {
  addedNames,
  FIXTURE_ORIGIN,
  openHostFixture,
  openHostileFixture,
  projectKey,
  readSnapshot,
  waitForSnapshot,
  type HostileVariant,
} from './helpers/host-fixtures';
import {
  clickLauncher,
  collectHeadlines,
  installCaptureStub,
  probeHost,
  probeWidget,
  readHeadlines,
  waitForHeadline,
  waitForWidget,
} from './helpers/capture-stubs';

/**
 * The SDK post endpoint, matched by **one shared RegExp**. `page.unroute`
 * removes a route by source+flags equality, so an inline duplicate would not
 * unregister and the next row's mock would leak into this one (the same
 * convention `e2e/ingest.spec.ts` adopted for the list route).
 */
const INCIDENT_POST_RE = /\/api\/incidents$/;
const INTERCEPTED_ID = '11111111-1111-4111-8111-111111111111';

interface PostCall {
  headers: Record<string, string>;
  body: string;
  /** The raw request bytes — multipart parts are binary, never utf8-safe. */
  buffer: Buffer;
}

/**
 * Extract one multipart part's payload bytes from a raw request body. Used to
 * prove a retry resends the *same* encoded image (P2-D-03), not a re-encode.
 */
function multipartPart(buffer: Buffer, name: string): Buffer | null {
  const marker = Buffer.from(`name="${name}"`);
  const at = buffer.indexOf(marker);
  if (at < 0) return null;
  const headerEnd = buffer.indexOf('\r\n\r\n', at);
  if (headerEnd < 0) return null;
  const nextBoundary = buffer.indexOf('\r\n--', headerEnd + 4);
  if (nextBoundary < 0) return null;
  return buffer.subarray(headerEnd + 4, nextBoundary);
}

/** What `analyzeImagePixels` reports about one decoded outgoing image. */
interface ImageAnalysis {
  width: number;
  height: number;
  /** Pixels whose RGB is exactly the launcher accent `#2f6feb` (CAP-04). */
  accentCount: number;
  /** Distinct colours among every 100th pixel — a blank frame scores 1. */
  sampledDistinct: number;
}

/**
 * Decode the bytes that left the browser **inside the page**, so the engine
 * that produced the image is also the engine that decodes it (no Node-side
 * image dependency, R-12). Used by the CAP-01/CAP-04/CAP-05 rows.
 */
async function analyzeImagePixels(page: Page, bytes: Buffer): Promise<ImageAnalysis> {
  const base64 = bytes.toString('base64');
  return page.evaluate(async (payload) => {
    const binary = atob(payload);
    const raw = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) raw[index] = binary.charCodeAt(index);
    const bitmap = await createImageBitmap(new Blob([raw.buffer]));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('analyzeImagePixels: a 2D canvas is unavailable');
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let accentCount = 0;
    const distinct = new Set<number>();
    for (let at = 0; at < data.length; at += 4) {
      if (data[at] === 0x2f && data[at + 1] === 0x6f && data[at + 2] === 0xeb) accentCount += 1;
      if ((at / 4) % 100 === 0) distinct.add((data[at] << 16) | (data[at + 1] << 8) | data[at + 2]);
    }
    return {
      width: bitmap.width,
      height: bitmap.height,
      accentCount,
      sampledDistinct: distinct.size,
    };
  }, base64);
}

/** Intercept SDK reports, letting each row decide the reply per attempt. */
async function interceptIncidentPosts(
  page: Page,
  reply: (call: PostCall, index: number) => Promise<{ status: number; body: string }>,
): Promise<PostCall[]> {
  const calls: PostCall[] = [];
  await page.route(INCIDENT_POST_RE, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const request = route.request();
    const buffer = request.postDataBuffer() ?? Buffer.alloc(0);
    const call: PostCall = {
      headers: request.headers(),
      body: buffer.toString('utf8'),
      buffer,
    };
    calls.push(call);
    const { status, body } = await reply(call, calls.length - 1);
    await route.fulfill({ status, contentType: 'application/json', body });
  });
  return calls;
}

/**
 * INT-01 / WDG-04 — the boot and global-surface group.
 *
 * These are the first rows of the one suite (R-12: e2e only, no unit tests) and
 * they exist to make the two architecture-loaded SDK promises observable:
 *
 *  - **INT-01** — a host page adds Watchbug with a single async script tag and
 *    the widget boots, with no bundler and no build step.
 *  - **WDG-04** — the IIFE lane adds exactly one global (`Watchbug`), the ESM
 *    lane adds none, and the four native prototypes are never patched.
 *
 * Isolation is asserted where it is observable: the production bundle runs
 * with a **closed** shadow root, so the row proves the page cannot pierce it
 * and that nothing was injected into the host document. The open-mode artifact
 * (`watchbug.e2e.js`, R-14) is used only where the root must be entered to see
 * the launcher — it differs from production by the `SHADOW_MODE` constant and
 * nothing else.
 *
 * Fixtures are served by `page.route` at the panel origin, never from the
 * nginx-served root (Pitfall 4: that location's CSP would block the fixture's
 * own inline instrumentation and the rows would pass on nothing).
 */

test('INT-01: one async script tag boots the widget — window.Watchbug plus the isolated host in the closed production bundle', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await openHostFixture(page, { bundle: 'watchbug.js', mode: 'iife' });

  const booted = await page.evaluate(() => {
    const api = (window as unknown as {
      Watchbug?: { init?: unknown; WATCHBUG_VERSION?: unknown };
    }).Watchbug;
    const host = document.querySelector('watchbug-host');
    return {
      hasApi: typeof api === 'object' && api !== null,
      initType: typeof api?.init,
      version: api?.WATCHBUG_VERSION,
      hostPresent: host !== null,
      hostIsLastChild: host !== null && document.documentElement.lastElementChild === host,
      // INV-01: production root is closed — `shadowRoot` must stay null.
      shadowRoot: host?.shadowRoot ?? null,
      hostStyle: host?.getAttribute('style') ?? '',
      injectedStyleSheets: document.querySelectorAll('style, link[rel="stylesheet"]').length,
    };
  });

  expect(pageErrors).toEqual([]);
  expect(booted.hasApi).toBe(true);
  expect(booted.initType).toBe('function');
  expect(booted.version).toBe('0.1.0');
  expect(booted.hostPresent).toBe(true);
  expect(booted.hostIsLastChild).toBe(true);
  expect(booted.shadowRoot).toBeNull();
  expect(booted.hostStyle).toContain('position: fixed !important');
  expect(booted.hostStyle).toContain('z-index: 2147483647 !important');
  expect(booted.hostStyle).toContain('pointer-events: none !important');
  // WDG-03: no stylesheet or class leaked into the host document.
  expect(booted.injectedStyleSheets).toBe(0);
});

test('INT-01: the one-gesture launcher renders 48x48 inside the open-mode shadow root', async ({ page }) => {
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });

  const rendered = await page.evaluate(() => {
    const host = document.querySelector('watchbug-host');
    const root = host?.shadowRoot ?? null;
    const button = root?.querySelector('button.launcher') as HTMLButtonElement | null;
    const panel = root?.querySelector('.panel') as HTMLElement | null;
    const text = root?.querySelector('.text') ?? null;
    if (button === null) {
      return { found: false as const };
    }
    const rect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      found: true as const,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      rightInset: Math.round(window.innerWidth - rect.right),
      bottomInset: Math.round(window.innerHeight - rect.bottom),
      radius: style.borderRadius,
      position: style.position,
      ariaLabel: button.getAttribute('aria-label'),
      disabled: button.disabled,
      panelHidden: panel?.getAttribute('data-hidden'),
      liveRole: text?.getAttribute('role'),
      liveMode: text?.getAttribute('aria-live'),
    };
  });

  expect(rendered.found).toBe(true);
  if (!rendered.found) return;
  expect(rendered.width).toBe(48);
  expect(rendered.height).toBe(48);
  expect(rendered.radius).toBe('24px');
  expect(rendered.position).toBe('fixed');
  expect(rendered.rightInset).toBe(24);
  expect(rendered.bottomInset).toBe(24);
  expect(rendered.ariaLabel).toBe('Report a bug');
  expect(rendered.disabled).toBe(false);
  // The status panel is mounted but idle: launcher only until the flow runs.
  expect(rendered.panelHidden).toBe('true');
  expect(rendered.liveRole).toBe('status');
  expect(rendered.liveMode).toBe('polite');
});

test('WDG-04: the IIFE lane adds exactly one global, the ESM lane adds none, and native prototypes are untouched', async ({ page, context }) => {
  // --- IIFE lane: one `Watchbug` property, nothing else -------------------
  await openHostFixture(page, { bundle: 'watchbug.js', mode: 'iife' });
  await waitForSnapshot(page);

  const iifeBefore = await readSnapshot(page, 'before');
  const iifeAfter = await readSnapshot(page, 'after');

  // Guard the measurement itself: the SDK must not be present before it loads,
  // otherwise `addedNames` could pass while proving nothing.
  expect(iifeBefore.w).not.toContain('Watchbug');
  expect(addedNames(iifeAfter.w, iifeBefore.w)).toEqual(['Watchbug']);
  expect(iifeAfter.p).toEqual(iifeBefore.p);

  // --- ESM lane: no global at all, and the widget still mounts ------------
  const esmPage = await context.newPage();
  await openHostFixture(esmPage, { bundle: 'watchbug.mjs', mode: 'esm' });
  await waitForSnapshot(esmPage);

  const esmBefore = await readSnapshot(esmPage, 'before');
  const esmAfter = await readSnapshot(esmPage, 'after');

  expect(esmBefore.w).not.toContain('Watchbug');
  expect(addedNames(esmAfter.w, esmBefore.w)).toEqual([]);
  expect(esmAfter.p).toEqual(esmBefore.p);
  await expect(esmPage.locator('watchbug-host')).toHaveCount(1);

  await esmPage.close();
});

/* ------------------------------------------------------------------------- */
/* Tracer rows — 02-02 Task 1                                                */
/* ------------------------------------------------------------------------- */

test('INT-02: one launcher gesture files a real report that returns 201 and renders in the panel', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  // P2-D-01: the title is read at send time — set it before the gesture.
  await page.evaluate(() => {
    document.title = 'INT-02 tracer report';
  });

  let captured: PostCall | null = null;

  // Real compose stack: inspect the outgoing request, then let the ENGINE send
  // it untouched (`route.continue`). Re-sending it from the intercepted request
  // object (`route.fetch`) would rebuild the multipart body from
  // `postDataBuffer()`, and Playwright's WebKit cannot serialise blob-backed
  // FormData parts into that buffer — the API would receive an empty image and
  // 400 on magic bytes. The 201 below comes from Fastify either way.
  await page.route(INCIDENT_POST_RE, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const request = route.request();
    const buffer = request.postDataBuffer() ?? Buffer.alloc(0);
    captured = {
      headers: request.headers(),
      body: buffer.toString('utf8'),
      buffer,
    };
    await route.continue();
  });

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/incidents') && response.request().method() === 'POST',
  );

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);

  const response = await responsePromise;
  const responseStatus = response.status();
  const responseBody = await response.text();

  expect(captured).not.toBeNull();
  if (captured === null) return;
  const call: PostCall = captured;

  // CA-01 wire shape: two multipart parts, both headers present.
  expect(call.headers['content-type']).toContain('multipart/form-data; boundary=');
  expect(call.headers['x-project-key']).toBe(projectKey());
  expect(call.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
  expect(call.body).toContain('name="meta"');
  expect(call.body).toContain('name="image"');
  expect(call.body).toContain('"type":"bug"');
  expect(call.body).toContain('"title":"INT-02 tracer report"');
  expect(call.body).toContain('"url":"/__e2e/host-fixture.html"');
  expect(call.body).toContain('filename="screenshot.');

  expect(responseStatus).toBe(201);
  const created = JSON.parse(responseBody) as { id?: string };
  expect(created.id).toMatch(/^[0-9a-f-]{36}$/);

  // The report is now a row in the real panel, read through nginx.
  await page.goto(`${FIXTURE_ORIGIN}/`, { waitUntil: 'load' });
  await expect(page.getByText('INT-02 tracer report').first()).toBeVisible({ timeout: 10_000 });
});

test('INT-05: the ESM build boots the same widget and adds zero window properties', async ({ page, context }) => {
  await openHostFixture(page, { bundle: 'watchbug.mjs', mode: 'esm' });
  await waitForSnapshot(page);
  await waitForWidget(page);

  const before = await readSnapshot(page, 'before');
  const after = await readSnapshot(page, 'after');
  expect(before.w).not.toContain('Watchbug');
  expect(addedNames(after.w, before.w)).toEqual([]);
  expect(after.p).toEqual(before.p);

  const esm = await page.evaluate(async () => {
    const host = document.querySelector('watchbug-host');
    const module = (await import('/__e2e/bundles/watchbug.mjs')) as {
      init?: unknown;
      WATCHBUG_VERSION?: unknown;
    };
    return {
      hostPresent: host !== null,
      // Production ESM lane is the closed build: no page-visible shadow root.
      shadowRoot: host?.shadowRoot ?? null,
      hasInit: typeof module.init === 'function',
      version: module.WATCHBUG_VERSION,
      exports: Object.keys(module).sort(),
    };
  });

  expect(esm.hostPresent).toBe(true);
  expect(esm.shadowRoot).toBeNull();
  expect(esm.hasInit).toBe(true);
  expect(esm.version).toBe('0.1.0');

  // One module namespace, two projections: the IIFE global must expose exactly
  // the ESM exports (assumption-delta decision: the module export is primary).
  const iifePage = await context.newPage();
  await openHostFixture(iifePage, { bundle: 'watchbug.js', mode: 'iife' });
  const iifeExports = await iifePage.evaluate(() => {
    const api = (window as unknown as { Watchbug?: Record<string, unknown> }).Watchbug;
    return api === undefined ? [] : Object.keys(api).sort();
  });
  expect(iifeExports).toEqual(esm.exports);
  await iifePage.close();
});

test('WDG-01: the launcher is a 48x48 shadow-root button and renders disabled while the panel is open', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  // Hold the reply so the in-flight `Sending…` panel is observable.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls = await interceptIncidentPosts(page, async () => {
    await held;
    return { status: 201, body: JSON.stringify({ id: INTERCEPTED_ID }) };
  });

  await clickLauncher(page);
  await waitForHeadline(page, 'Sending…', 10_000);

  const inFlight = await probeWidget(page);
  expect(inFlight.launcherWidth).toBe(48);
  expect(inFlight.launcherHeight).toBe(48);
  expect(inFlight.launcherDisabled).toBe(true);
  expect(inFlight.panelHidden).toBe('false');
  expect(inFlight.headline).toBe('Sending…');

  release();
  await waitForHeadline(page, 'Report sent ✓', 10_000);
  expect(calls).toHaveLength(1);
});

/* ------------------------------------------------------------------------- */
/* Capture rows — 02-03 Task 1 (CAP-01, CAP-04)                               */
/* ------------------------------------------------------------------------- */

test('CAP-04: the widget host is hidden when the capture runs and its accent pixels are absent from the sent image', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  // Non-vacuity: the widget's own launcher really is filled with `#2f6feb`, so
  // "zero accent pixels in the decoded frame" is a claim about the widget.
  const launcherFill = await page.evaluate(() => {
    const host = document.querySelector('watchbug-host');
    const launcher = host?.shadowRoot?.querySelector('button.launcher') as HTMLButtonElement | null;
    return launcher === null ? '' : getComputedStyle(launcher).backgroundColor;
  });
  expect(launcherFill).toBe('rgb(47, 111, 235)');

  // Real compose stack: inspect, then `route.continue()` — `route.fetch()`
  // rebuilds multipart bodies and drops WebKit's blob parts (02-02 deviation 2).
  let captured: PostCall | null = null;
  await page.route(INCIDENT_POST_RE, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const request = route.request();
    const buffer = request.postDataBuffer() ?? Buffer.alloc(0);
    captured = { headers: request.headers(), body: buffer.toString('utf8'), buffer };
    await route.continue();
  });
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith('/api/incidents') && response.request().method() === 'POST',
  );

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);

  const response = await responsePromise;
  expect(response.status()).toBe(201);
  expect(captured).not.toBeNull();
  if (captured === null) return;
  const call: PostCall = captured;

  // (a) The stub invocation must have OBSERVED the host already hidden — the
  // inline `display: none` (P2-D-05) that keeps the widget out of its own
  // screenshot, recorded by whichever tier ran (Pitfall 2: media on
  // chromium/firefox, the CaptureSource seam on webkit).
  const observationRaw = await page.locator('html').getAttribute('data-wb-stub-observation');
  expect(observationRaw, 'the capture stub must record the host state it observed').not.toBeNull();
  const observation = JSON.parse(observationRaw ?? '{}') as {
    tier?: string;
    display?: string;
    inline?: string;
    inlineHidden?: boolean;
  };
  expect(observation.tier).toBe(browserName === 'webkit' ? 'seam' : 'media');
  expect(observation.display).toBe('none');
  expect(observation.inlineHidden).toBe(true);
  expect(observation.inline).toContain('display: none');

  // (b) The bytes that left the browser decode to an image containing zero
  // widget-accent pixels (CAP-04 — the widget is provably not in its own shot).
  const image = multipartPart(call.buffer, 'image');
  expect(image).not.toBeNull();
  if (image === null) return;
  const analysis = await analyzeImagePixels(page, image);
  expect(analysis.accentCount).toBe(0);
  expect(analysis.sampledDistinct).toBeGreaterThan(4);
});

/* ------------------------------------------------------------------------- */
/* Status-machine rows — 02-02 Task 2 (P2-D-03, UI-SPEC loading/error/a11y)   */
/* ------------------------------------------------------------------------- */

test('P2-D-03: a transient 500 retries with the same Idempotency-Key and the same encoded bytes', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);
  // Record every distinct headline: `Capturing…` and `Sending…` can be shorter
  // than a poll interval, and the locked copy progression is an assertion.
  await collectHeadlines(page);

  const calls = await interceptIncidentPosts(page, async (_call, index) =>
    index === 0
      ? {
          status: 500,
          body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'boom' }),
        }
      : { status: 201, body: JSON.stringify({ id: INTERCEPTED_ID }) },
  );

  await clickLauncher(page);

  // The retry window is the observable in-flight state for both the retry copy
  // and the launcher's disabled rendering (UI-SPEC loading lift, WDG-01).
  await waitForHeadline(page, 'Retrying (1 of 3)…', 10_000);
  const duringRetry = await probeWidget(page);
  expect(duringRetry.panelHidden).toBe('false');
  expect(duringRetry.launcherDisabled).toBe(true);
  expect(duringRetry.actionsVisible).toBe(false);

  await waitForHeadline(page, 'Report sent ✓', 15_000);
  expect(calls).toHaveLength(2);

  const firstKey = calls[0].headers['idempotency-key'];
  expect(firstKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(calls[1].headers['idempotency-key']).toBe(firstKey);

  // Same logical submission: the encoded image and the meta part are byte-equal
  // across attempts (only the multipart boundary is regenerated).
  const image0 = multipartPart(calls[0].buffer, 'image');
  const image1 = multipartPart(calls[1].buffer, 'image');
  expect(image0).not.toBeNull();
  expect(image1).not.toBeNull();
  expect(image1).toEqual(image0);
  expect(multipartPart(calls[1].buffer, 'meta')).toEqual(multipartPart(calls[0].buffer, 'meta'));

  const headlines = await readHeadlines(page);
  const sequence = ['Capturing…', 'Sending…', 'Retrying (1 of 3)…', 'Report sent ✓'];
  const positions = sequence.map((headline) => headlines.indexOf(headline));
  expect(positions.every((at) => at >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});

test('P2-D-03: a contract 400 fails immediately, renders the server message and never retries', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const reason = 'Project key not recognised';
  const calls = await interceptIncidentPosts(page, async () => ({
    status: 400,
    body: JSON.stringify({ statusCode: 400, error: 'Bad Request', message: reason }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'The server rejected the report.', 15_000);

  const failed = await probeWidget(page);
  expect(failed.reason).toBe(reason);
  expect(failed.headlineRole).toBe('alert');
  expect(failed.textRole).toBe('status');
  expect(failed.textLive).toBe('polite');
  expect(failed.actionsVisible).toBe(true);
  expect(failed.retryVisible).toBe(true);
  expect(failed.dismissVisible).toBe(true);
  expect(failed.launcherDisabled).toBe(true);

  // No automatic retry for a contract 4xx: one attempt, and still one after a
  // window longer than the first scheduled retry (1 s ±25 %).
  await page.waitForTimeout(1_500);
  expect(calls).toHaveLength(1);
});

test('UI-SPEC backstop: a long server reason renders truncated to 240 chars with an ellipsis inside the 320 px panel', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const longReason =
    'The report was rejected because the project key does not match any active project on this server. ' +
    'Check the key configured in your deployment, then try again once it has been corrected. ' +
    'Nothing has been stored and no attachment was written to disk.';

  await interceptIncidentPosts(page, async () => ({
    status: 403,
    body: JSON.stringify({ statusCode: 403, error: 'Forbidden', message: longReason }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'The server rejected the report.', 15_000);

  const failed = await probeWidget(page);
  expect(longReason.length).toBeGreaterThan(240);
  expect(failed.reasonLength).toBeLessThanOrEqual(240);
  expect(failed.reason.endsWith('…')).toBe(true);
  // Wrapped at a word boundary: no word is cut in half at the truncation.
  expect(failed.reason.startsWith('The report was rejected')).toBe(true);
  expect(failed.reason).not.toContain('…'.repeat(2));
  expect(failed.panelWidth).toBeLessThanOrEqual(320);
});

test('UI-SPEC A-5/A-7: sent auto-dismisses after 5 s and Escape dismisses a terminal failure', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
  const sentAt = Date.now();

  await page.waitForFunction(
    () => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      return root?.querySelector('.panel')?.getAttribute('data-hidden') === 'true';
    },
    null,
    { timeout: 9_000 },
  );
  // A-5: the success panel waits the full 5 s before returning to idle.
  expect(Date.now() - sentAt).toBeGreaterThanOrEqual(4_000);
  const idle = await probeWidget(page);
  expect(idle.launcherDisabled).toBe(false);

  // A-7: Escape dismisses a terminal failure panel and re-arms the launcher.
  await page.unroute(INCIDENT_POST_RE);
  await interceptIncidentPosts(page, async () => ({
    status: 401,
    body: JSON.stringify({ statusCode: 401, error: 'Unauthorized', message: 'Missing project key' }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'The server rejected the report.', 15_000);
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      return root?.querySelector('.panel')?.getAttribute('data-hidden') === 'true';
    },
    null,
    { timeout: 5_000 },
  );
  const dismissed = await probeWidget(page);
  expect(dismissed.launcherDisabled).toBe(false);
});

/* ------------------------------------------------------------------------- */
/* Hostile-CSS isolation rows — 02-02 Task 3 (CA-04, WDG-02/03/05)            */
/* ------------------------------------------------------------------------- */

/**
 * The inline `!important` contract from UI-SPEC § Widget Geometry & Isolation.
 * `display` is the load-bearing one: a hostile
 * `*:not(html):not(body) { display: none !important }` is an author-origin
 * important declaration, so only an inline important declaration on the host
 * element beats it. (The rendering roots are excluded from that selector by the
 * fixture: `display: none` on `html`/`body` removes the document's principal
 * box, and nothing can paint under it.)
 */
const HOST_CONTRACT = [
  'display: block !important',
  'position: fixed !important',
  'z-index: 2147483647 !important',
  'right: 24px !important',
  'bottom: 24px !important',
  'pointer-events: none !important',
];

async function expectHostContract(page: Page): Promise<void> {
  const host = await probeHost(page);
  expect(host.hostPresent).toBe(true);
  expect(host.hostLastChild).toBe(true);
  for (const declaration of HOST_CONTRACT) {
    expect(host.hostStyle).toContain(declaration);
  }
  expect(host.display).toBe('block');
  expect(host.position).toBe('fixed');
  expect(host.zIndex).toBe('2147483647');
  expect(host.pointerEvents).toBe('none');
  // Geometry is read inside the open-mode root: still a 48x48 button inset 24.
  expect(host.launcherFound).toBe(true);
  expect(host.launcherWidth).toBe(48);
  expect(host.launcherHeight).toBe(48);
  expect(host.rightInset).toBe(24);
  expect(host.bottomInset).toBe(24);
}

/** The control-element evidence each hostile rule really applied (CA-04). */
async function readControlProof(page: Page, variant: HostileVariant): Promise<boolean> {
  return page.evaluate((which) => {
    const style = (id: string): CSSStyleDeclaration | null => {
      const node = document.getElementById(id);
      return node === null ? null : getComputedStyle(node);
    };
    switch (which) {
      case 'display': {
        const control = style('control-display');
        return control !== null && control.display === 'none';
      }
      case 'fontsize': {
        const control = style('control-fontsize');
        return control !== null && control.fontSize === '4px';
      }
      case 'unset': {
        const control = style('control-unset');
        // `all: unset` reverts a <strong> to normal weight and inline display.
        return control !== null && control.fontWeight === '400' && control.display === 'inline';
      }
      case 'transform': {
        const node = document.getElementById('control-fixed');
        if (node === null) return false;
        const rect = node.getBoundingClientRect();
        // The transformed ancestor became the containing block for this
        // `position: fixed` control (origin 120/90, not the viewport's 0/0).
        return Math.round(rect.left) === 120 && Math.round(rect.top) === 90;
      }
      case 'zindex': {
        const action = document.getElementById('host-action');
        if (action === null) return false;
        const rect = action.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return hit !== null && hit.id === 'hostile-modal';
      }
      case 'adjacent': {
        const box = document.getElementById('hostile-box');
        if (box === null) return false;
        const rect = box.getBoundingClientRect();
        const computed = getComputedStyle(box);
        return (
          Math.round(window.innerWidth - rect.right) === 24 &&
          Math.round(window.innerHeight - rect.bottom) === 24 &&
          computed.zIndex === '2147483646'
        );
      }
      default:
        return true;
    }
  }, variant);
}

/** Intercept a report and answer 201 — isolation rows are not ingest rows. */
async function answerCreated(page: Page): Promise<void> {
  await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));
}

for (const variant of ['display', 'fontsize', 'unset', 'transform'] as const) {
  test(`WDG-02: hostile host CSS cannot hide, restyle or break the widget — ${variant}`, async ({ page, browserName }) => {
    await installCaptureStub(page, browserName);
    await openHostileFixture(page, { variant, bundle: 'watchbug.e2e.js', mode: 'iife' });
    await waitForWidget(page);

    // Non-vacuous: the hostile rule demonstrably applies to a control element.
    expect(await readControlProof(page, variant), `control for ${variant}`).toBe(true);
    await expectHostContract(page);

    // And one launcher gesture still files a report through the same pipeline.
    await answerCreated(page);
    await clickLauncher(page);
    await waitForHeadline(page, 'Report sent ✓', 15_000);
  });
}

test('WDG-02: the closed production bundle keeps the inline isolation contract under *:not(html):not(body) { display: none !important }', async ({ page }) => {
  await openHostileFixture(page, { variant: 'display', bundle: 'watchbug.js', mode: 'iife' });
  await waitForWidget(page);

  const host = await probeHost(page);
  // Closed root: the page cannot pierce it, but the host geometry is observable.
  expect(host.shadowRootOpen).toBe(false);
  expect(host.display).toBe('block');
  expect(host.position).toBe('fixed');
  expect(host.zIndex).toBe('2147483647');
  expect(host.pointerEvents).toBe('none');
  expect(host.documentHitsHost).toBe(true);
  expect(host.documentHitTag).toBe('watchbug-host');
  expect(await readControlProof(page, 'display')).toBe(true);
});

test('CA-04: every hostile rule in the matrix demonstrably applies to its control element', async ({ context }) => {
  const variants: HostileVariant[] = [
    'display',
    'fontsize',
    'unset',
    'transform',
    'zindex',
    'adjacent',
  ];
  for (const variant of variants) {
    const page = await context.newPage();
    await openHostileFixture(page, { variant, bundle: 'watchbug.js', mode: 'iife' });
    await waitForWidget(page);
    expect(await readControlProof(page, variant), `control for ${variant}`).toBe(true);
    await page.close();
  }
});

test('WDG-03: init and a full report flow leak zero styles, classes or custom properties into the host document', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  // `autoInit: false` lets the row measure the document before the widget exists.
  await openHostileFixture(page, {
    variant: 'clean',
    bundle: 'watchbug.e2e.js',
    mode: 'iife',
    autoInit: false,
  });
  await page.waitForFunction(
    () => typeof (window as unknown as { Watchbug?: { init?: unknown } }).Watchbug?.init === 'function',
    null,
    { timeout: 10_000 },
  );

  const scan = () =>
    page.evaluate(() => {
      const headStyles = document.head.querySelectorAll('style, link[rel="stylesheet"]').length;
      // Literal `--wb-` prefix scan over every host-document element (custom
      // properties are enumerable in a computed style on all three engines),
      // the widget host element included — a token set on `:host` would land
      // there first. Shadow-tree elements are out of scope by construction:
      // `querySelectorAll` never pierces a shadow root.
      const leaked: string[] = [];
      for (const element of Array.from(document.querySelectorAll('*'))) {
        const computed = getComputedStyle(element);
        for (let index = 0; index < computed.length; index += 1) {
          const property = computed[index];
          if (property.startsWith('--wb-')) {
            leaked.push(`${element.tagName.toLowerCase()}#${element.id || '-'}:${property}`);
          }
        }
      }
      const widgetClasses = Array.from(
        document.querySelectorAll('.wrap, .launcher, .panel, .headline, .hint, .reason, .actions, .action, .spinner'),
      ).map((element) => element.tagName.toLowerCase());
      return { headStyles, leaked, widgetClasses, hostPresent: document.querySelector('watchbug-host') !== null };
    });

  const before = await scan();
  expect(before.hostPresent).toBe(false);
  expect(before.leaked).toEqual([]);
  expect(before.widgetClasses).toEqual([]);

  await page.evaluate((key) => {
    (window as unknown as { Watchbug: { init: (options: { projectKey: string }) => void } }).Watchbug.init({
      projectKey: key,
    });
  }, projectKey());

  const afterInit = await scan();
  expect(afterInit.hostPresent).toBe(true);
  expect(afterInit.headStyles).toBe(before.headStyles);
  expect(afterInit.leaked).toEqual([]);
  expect(afterInit.widgetClasses).toEqual([]);

  await answerCreated(page);
  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);

  const afterFlow = await scan();
  expect(afterFlow.headStyles).toBe(before.headStyles);
  expect(afterFlow.leaked).toEqual([]);
  expect(afterFlow.widgetClasses).toEqual([]);
});

test('WDG-05: the widget wins the stacking contest over a hostile max-z-index modal and the flow still completes', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostileFixture(page, { variant: 'zindex', bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  // The modal covers the page for a control element …
  expect(await readControlProof(page, 'zindex')).toBe(true);

  // … but not the widget: document hit is the host, and the shadow hit is the
  // launcher button itself (the tie is resolved by DOM order — host last).
  const host = await probeHost(page);
  expect(host.hostLastChild).toBe(true);
  expect(host.documentHitsHost).toBe(true);
  expect(host.documentHitTag).toBe('watchbug-host');
  expect(host.rootHitsLauncher).toBe(true);

  // And a real trusted click at those coordinates drives a real report.
  await answerCreated(page);
  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
});

test('WDG-05: a hostile element painted at the widget coordinates neither captures its hit target nor swallows host clicks', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostileFixture(page, { variant: 'adjacent', bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  // The decoy really is painted exactly where the launcher is.
  expect(await readControlProof(page, 'adjacent')).toBe(true);

  const host = await probeHost(page);
  expect(host.documentHitsHost).toBe(true);
  expect(host.rootHitsLauncher).toBe(true);

  // A click outside the widget's interactive elements still reaches the host
  // page (the host box itself is `pointer-events: none`).
  await page.mouse.click(100, 60);
  await expect(page.locator('html')).toHaveAttribute('data-host-click', 'yes');

  await answerCreated(page);
  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
});

test('WDG-05: an empty host page still renders the launcher at 24 px insets and starts the flow', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostileFixture(page, { variant: 'empty', bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const empty = await page.evaluate(() => ({
    hostContent: document.getElementById('host-content') !== null,
    bodyChildren: document.body.querySelectorAll('div, button, h1').length,
  }));
  expect(empty.hostContent).toBe(false);
  expect(empty.bodyChildren).toBe(0);

  const host = await probeHost(page);
  expect(host.launcherFound).toBe(true);
  expect(host.rightInset).toBe(24);
  expect(host.bottomInset).toBe(24);

  await answerCreated(page);
  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
});

test('WDG-05: a z-index tie stays resolved by DOM order and the host is re-appended after a documentElement replacement', async ({ page }) => {
  await openHostileFixture(page, { variant: 'zindex', bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const before = await probeHost(page);
  expect(before.hostLastChild).toBe(true);
  expect(before.documentHitsHost).toBe(true);

  const lastChildTag = await page.evaluate(async () => {
    // Replace the document element outright: the host observer must re-append
    // the widget as the last child of the NEW documentElement.
    const replacement = document.adoptNode(
      document.implementation.createHTMLDocument('replaced').documentElement,
    );
    document.replaceChild(replacement, document.documentElement);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    return document.documentElement.lastElementChild?.tagName.toLowerCase() ?? '';
  });
  expect(lastChildTag).toBe('watchbug-host');

  const after = await probeHost(page);
  expect(after.hostPresent).toBe(true);
  expect(after.hostLastChild).toBe(true);
  // Still above the replacement document: the widget host wins the hit test.
  expect(after.documentHitsHost).toBe(true);
});
