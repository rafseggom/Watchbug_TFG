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
  captureStubTier,
  collectHeadlines,
  forcePngEncode,
  installCaptureStub,
  probeHost,
  probeWidget,
  readHeadlines,
  readOutgoingImage,
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

test('CAP-01: one gesture drives the engine capture tier to a non-blank frame and a real 201', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

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

  // Which tier actually ran: `captureStream` fake on chromium/firefox, the
  // CaptureSource seam on webkit (Pitfall 2) — observed at invocation, not
  // assumed from the browser name alone.
  const observationRaw = await page.locator('html').getAttribute('data-wb-stub-observation');
  expect(observationRaw, 'the capture tier must have been invoked').not.toBeNull();
  const observation = JSON.parse(observationRaw ?? '{}') as { tier?: string };
  expect(observation.tier).toBe(captureStubTier(browserName));

  // The report's image part decodes to a genuinely captured, non-blank frame
  // (read at the fetch boundary — postDataBuffer() drops blob parts on WebKit).
  const image = await readOutgoingImage(page);
  const analysis = await analyzeImagePixels(page, image);
  expect(analysis.width).toBe(640);
  expect(analysis.height).toBe(360);
  expect(analysis.sampledDistinct).toBeGreaterThan(4);
});

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
  // Wire shape: the image part header is present on every engine (WebKit
  // exposes the part's headers but not its payload — hence the
  // fetch-boundary recorder for the actual bytes).
  expect(call.headers['content-type']).toContain('multipart/form-data; boundary=');
  expect(call.body).toContain('name="image"');

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
  expect(observation.tier).toBe(captureStubTier(browserName));
  expect(observation.display).toBe('none');
  expect(observation.inlineHidden).toBe(true);
  expect(observation.inline).toContain('display: none');

  // (b) The bytes that left the browser decode to an image containing zero
  // widget-accent pixels (CAP-04 — the widget is provably not in its own shot).
  // Read at the fetch boundary: WebKit's postDataBuffer() omits blob payloads.
  const image = await readOutgoingImage(page);
  const analysis = await analyzeImagePixels(page, image);
  expect(analysis.accentCount).toBe(0);
  expect(analysis.sampledDistinct).toBeGreaterThan(4);
});

/* ------------------------------------------------------------------------- */
/* Capture-fidelity rows — 02-03 Task 2 (CAP-05, M-3)                         */
/* ------------------------------------------------------------------------- */

test('CAP-05: a frame wider than MAX_IMAGE_DIM is scaled to 8192 px before encode', async ({ page, browserName }) => {
  test.setTimeout(60_000);
  // The seam tier on every engine: the frame width is the variable under test,
  // not which tier delivers it (CAP-01 already covers the media tier end to
  // end on chromium/firefox). 9000 px wide × 1000 px = 9 MP — inside
  // MAX_IMAGE_PIXELS, but over MAX_IMAGE_DIM (8192), so only the per-side
  // clamp can bring it into contract.
  await installCaptureStub(page, browserName, {
    tier: 'seam',
    frame: { width: 9000, height: 1000 },
  });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 45_000);
  expect(calls).toHaveLength(1);

  const image = await readOutgoingImage(page);
  expect(image.length).toBeLessThanOrEqual(2_097_152);
  const analysis = await analyzeImagePixels(page, image);
  // CAP-05: no side may exceed MAX_IMAGE_DIM (8192) …
  expect(analysis.width).toBeLessThanOrEqual(8192);
  // … and the total area stays within MAX_IMAGE_PIXELS (16,777,216).
  expect(analysis.width * analysis.height).toBeLessThanOrEqual(16_777_216);
  expect(analysis.sampledDistinct).toBeGreaterThan(4);
});

test('CAP-05: an oversized 16 MP synthetic frame is delivered inside the 16 MP and 2 MB contract', async ({ page, browserName }) => {
  test.setTimeout(60_000);
  // A frame AT the ceiling (4000×4000 = 16,000,000 px, both sides ≤ 4096 so
  // every engine's canvas can hold it) — the largest capture the pipeline
  // accepts (P2-D-12 refuses anything over the cap). Seam tier on every
  // engine: the encode ladder is what this row exercises.
  await installCaptureStub(page, browserName, {
    tier: 'seam',
    frame: { width: 4000, height: 4000 },
  });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 45_000);
  expect(calls).toHaveLength(1);

  const image = await readOutgoingImage(page);
  // CAP-05 hard ceilings: ≤ MAX_ENCODED_IMAGE_BYTES (2,097,152) on the wire …
  expect(image.length).toBeLessThanOrEqual(2_097_152);
  const analysis = await analyzeImagePixels(page, image);
  // … and the decoded output inside MAX_IMAGE_PIXELS (16,777,216), at the
  // frame's own dimensions (no clamp was needed at exactly this size).
  expect(analysis.width).toBe(4000);
  expect(analysis.height).toBe(4000);
  expect(analysis.width * analysis.height).toBeLessThanOrEqual(16_777_216);
  expect(analysis.sampledDistinct).toBeGreaterThan(4);
});

test.describe('CAP-05 HiDPI (deviceScaleFactor: 2)', () => {
  test.use({ deviceScaleFactor: 2 });

  test('CAP-05: a deviceScaleFactor: 2 capture decodes non-blank at the expected dimensions', async ({ page, browserName }) => {
    await installCaptureStub(page, browserName);
    await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
    await waitForWidget(page);

    // Non-vacuity: the context really is HiDPI before anything is asserted.
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);

    const calls = await interceptIncidentPosts(page, async () => ({
      status: 201,
      body: JSON.stringify({ id: INTERCEPTED_ID }),
    }));

    await clickLauncher(page);
    await waitForHeadline(page, 'Report sent ✓', 20_000);
    expect(calls).toHaveLength(1);

    const image = await readOutgoingImage(page);
    expect(image.length).toBeLessThanOrEqual(2_097_152);
    const analysis = await analyzeImagePixels(page, image);
    // The stub frame at DPR 2: still 640×360 (DPR is clamped at 2, not doubled)
    // and genuinely non-blank — the known HiDPI blank-capture failure is absent.
    expect(analysis.width).toBe(640);
    expect(analysis.height).toBe(360);
    expect(analysis.sampledDistinct).toBeGreaterThan(4);
  });
});

test.describe('CAP-05 DPR clamp (deviceScaleFactor: 3)', () => {
  test.use({ deviceScaleFactor: 3 });

  test('CAP-05: a devicePixelRatio above the clamp of 2 is reduced before encode', async ({ page, browserName }) => {
    await installCaptureStub(page, browserName);
    await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
    await waitForWidget(page);

    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(3);

    const calls = await interceptIncidentPosts(page, async () => ({
      status: 201,
      body: JSON.stringify({ id: INTERCEPTED_ID }),
    }));

    await clickLauncher(page);
    await waitForHeadline(page, 'Report sent ✓', 20_000);
    expect(calls).toHaveLength(1);

    const image = await readOutgoingImage(page);
    const analysis = await analyzeImagePixels(page, image);
    // DPR 3 on a 640×360 frame → clamped to 2× → round(640·2/3) × round(360·2/3).
    expect(analysis.width).toBe(427);
    expect(analysis.height).toBe(240);
    expect(analysis.sampledDistinct).toBeGreaterThan(4);
  });
});

test('M-3: a forced PNG encode ships as a .png / image/png part and the real API returns 201', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  // The silent fallback, provoked deliberately: WebP requests answer PNG.
  await forcePngEncode(page);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

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

  // The sniff — not the requested type — chose the part's name and MIME …
  expect(captured.body).toContain('filename="screenshot.png"');
  expect(captured.body).toMatch(/content-type: image\/png/i);
  expect(captured.body).not.toContain('screenshot.webp');

  // … and those bytes really are PNG (magic, not label).
  const image = await readOutgoingImage(page);
  expect(Array.from(image.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

/* ------------------------------------------------------------------------- */
/* Failure-state rows — 02-03 Task 3 (P2-D-12, OQ-1, M-6)                     */
/* ------------------------------------------------------------------------- */

const BLANK_HINT =
  'Nothing was sent. Try again — if it keeps failing, the page may be too large to capture.';
const CAPTURE_HINT = 'Nothing was sent. Allow screen sharing, then try again.';

/** One shared shape for every loud-failure row: copy first, zero POSTs after. */
async function expectNoRequest(page: Page, calls: PostCall[]): Promise<void> {
  // Give a would-be request time to land before counting attempts — "nothing
  // was sent" is an assertion, not a race we hope to win.
  await page.waitForTimeout(600);
  expect(calls, 'no POST /api/incidents attempt may be made').toHaveLength(0);
}

test('P2-D-12: a uniform capture aborts to the blank state before any request', async ({ page, browserName }) => {
  // Default tier per engine: chromium/firefox probe a solid frame straight
  // out of the real <video> path, webkit out of the seam.
  await installCaptureStub(page, browserName, { uniform: true });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'The capture came back blank.', 10_000);

  const failed = await probeWidget(page);
  expect(failed.hint).toBe(BLANK_HINT);
  expect(failed.headlineRole).toBe('alert');
  expect(failed.actionsVisible).toBe(true);
  expect(failed.retryVisible).toBe(true);
  expect(failed.dismissVisible).toBe(true);
  await expectNoRequest(page, calls);
});

test('P2-D-12: a frame beyond the supported canvas cap aborts to the blank state', async ({ page, browserName }) => {
  // Seam tier on every engine: the 16,920,000 px frame is allocated
  // canvas-free, so the pipeline's area probe — not an engine canvas limit —
  // is what rejects it.
  await installCaptureStub(page, browserName, { tier: 'seam', failure: 'beyond-cap' });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'The capture came back blank.', 10_000);

  const failed = await probeWidget(page);
  expect(failed.hint).toBe(BLANK_HINT);
  expect(failed.headlineRole).toBe('alert');
  await expectNoRequest(page, calls);
});

test('OQ-1: a non-tab capture surface is refused loudly and nothing is sent', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName, { failure: 'non-tab-surface' });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, "Couldn't capture the screen.", 10_000);

  // The fake ran and the SDK refused IT — not a missing-API shortcut — so the
  // refusal is the surface policy (browser/window/screen comparison) itself.
  expect(await page.locator('html').getAttribute('data-wb-stub-invoked')).toBe('non-tab-surface');

  const failed = await probeWidget(page);
  expect(failed.hint).toBe(CAPTURE_HINT);
  expect(failed.headlineRole).toBe('alert');
  await expectNoRequest(page, calls);
});

test('CAP-01: a rejected capture prompt renders the capture-failed state with its hint and both actions', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName, { failure: 'prompt-rejected' });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, "Couldn't capture the screen.", 10_000);

  expect(await page.locator('html').getAttribute('data-wb-stub-invoked')).toBe('prompt-rejected');

  const failed = await probeWidget(page);
  // The locked copy (strings.ts) — hint present, never a silent no-op (M-6).
  expect(failed.hint).toBe(CAPTURE_HINT);
  expect(failed.actionsVisible).toBe(true);
  expect(failed.retryVisible).toBe(true);
  expect(failed.dismissVisible).toBe(true);
  await expectNoRequest(page, calls);
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

/* ------------------------------------------------------------------------- */
/* Auto-redaction artifact rows — 02-04 (PRV-01/02/03, H-1, P2-D-08, fail-closed) */
/* ------------------------------------------------------------------------- */

/**
 * The CA-02-style proof for the auto-redaction families (02-04): decode the
 * bytes that left the browser **in the page that produced them** and check the
 * expected mask rect against the original pixels the capture stub painted
 * there.
 *
 * Non-vacuity comes from the stubs' marker paint: both capture tiers paint
 * `#ff00ff` over `[data-capture-marker]`'s viewport rect with the same
 * outward rounding the redactor uses. A masked row therefore proves
 * destruction ("zero marker-coloured pixels inside the expected rect"), and
 * the lookalike/negative-control rows prove the marker survives — and is found
 * by this very analysis — when no family matches. Secret elements are styled
 * `line-height: 1` so the element rect the stub paints sits **inside** the
 * text-node rect the redactor masks (probe-verified on all three engines);
 * with `line-height: 1.5` the line box is taller than the text rect and
 * legitimate marker pixels would survive outside the mask.
 */
interface CssRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** One absolutely-positioned element a redaction row injects pre-gesture. */
interface SecretSpec {
  id: string;
  tag?: 'span' | 'div' | 'input';
  text?: string;
  value?: string;
  attrs?: Record<string, string>;
  left: number;
  top: number;
  marker?: boolean;
  style?: string;
}

async function installSecrets(page: Page, secrets: SecretSpec[]): Promise<void> {
  await page.evaluate((specs) => {
    for (const spec of specs) {
      const element = document.createElement(spec.tag ?? 'div');
      element.id = spec.id;
      if (spec.text !== undefined) element.textContent = spec.text;
      if (spec.value !== undefined) (element as HTMLInputElement).value = spec.value;
      for (const [name, value] of Object.entries(spec.attrs ?? {})) {
        element.setAttribute(name, value);
      }
      if (spec.marker === true) element.setAttribute('data-capture-marker', '');
      element.style.cssText =
        `position:absolute;left:${spec.left}px;top:${spec.top}px;` +
        'white-space:nowrap;font:600 16px/1 ui-monospace,SFMono-Regular,Consolas,monospace;color:#0b0b0b;' +
        (spec.style ?? '');
      document.body.appendChild(element);
    }
  }, secrets);
}

/** Which rect the redactor is expected to mask for `#id`. */
type MaskSource = 'element' | 'text-node';

/**
 * The expected mask rect: `element` for the structural families (password
 * inputs, `data-watchbug-sensitive` — the scan uses `getBoundingClientRect`),
 * `text-node` for pattern families (the union of `range.getClientRects()`,
 * exactly as `redactor.ts` computes it).
 */
async function readMaskRect(page: Page, id: string, source: MaskSource): Promise<CssRect> {
  const rect = await page.evaluate(
    ({ elementId, mode }) => {
      const element = document.getElementById(elementId);
      if (element === null) throw new Error(`installSecrets: #${elementId} was not injected`);
      if (mode === 'element') {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
      }
      const range = document.createRange();
      range.selectNodeContents(element);
      let left = Number.POSITIVE_INFINITY;
      let top = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      for (const box of Array.from(range.getClientRects())) {
        left = Math.min(left, box.left);
        top = Math.min(top, box.top);
        right = Math.max(right, box.right);
        bottom = Math.max(bottom, box.bottom);
      }
      return { left, top, right, bottom };
    },
    { elementId: id, mode: source },
  );
  if (!Number.isFinite(rect.left) || rect.right - rect.left < 8 || rect.bottom - rect.top < 4) {
    throw new Error(`readMaskRect: #${id} has a degenerate rect (${JSON.stringify(rect)})`);
  }
  return rect;
}

/** A region far from every injected secret — it must keep its pixels. */
const REDACTION_CONTROL_RECT: CssRect = { left: 900, top: 110, right: 1120, bottom: 250 };

interface RedactionReport {
  width: number;
  height: number;
  insidePixels: number;
  insideMagenta: number;
  insideBlack: number;
  interiorPixels: number;
  interiorMagenta: number;
  interiorBlack: number;
  ringPixels: number;
  ringMagenta: number;
  ringBlack: number;
  controlPixels: number;
  controlBlack: number;
  controlDistinct: number;
}

/**
 * Decode the outgoing bytes in-page and count, over the expected mask rect,
 * its 1-px-shrunk interior, the 1-px ring outside it, and a control region:
 *
 *  - **magenta** ≈ original `#ff00ff` marker pixels (distance² ≤ 120², lossy
 *    encode tolerant) — zero inside rect+ring is the "original pixel values
 *    are gone" proof (CA-02);
 *  - **black** = flat opaque fill (`max(rgb) ≤ 24`) — present inside proves
 *    the destructive fill landed (R-13), absent outside proves the mask is
 *    targeted, not a wipe.
 */
async function analyzeRedaction(
  page: Page,
  bytes: Buffer,
  options: { viewport: CssRect; masked: CssRect; control?: CssRect },
): Promise<RedactionReport> {
  const control = options.control ?? REDACTION_CONTROL_RECT;
  return page.evaluate(
    async ({ payload, viewport, masked, control: controlRect }) => {
      const binary = atob(payload);
      const raw = new Uint8Array(binary.length);
      for (let at = 0; at < binary.length; at += 1) raw[at] = binary.charCodeAt(at);
      const bitmap = await createImageBitmap(new Blob([raw.buffer]));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('analyzeRedaction: a 2D canvas is unavailable');
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const width = bitmap.width;
      const height = bitmap.height;

      const scaleX = width / Math.max(1, viewport.right - viewport.left);
      const scaleY = height / Math.max(1, viewport.bottom - viewport.top);
      const mapRect = (rect: CssRect): { left: number; top: number; right: number; bottom: number } => ({
        left: Math.max(0, Math.floor((rect.left - viewport.left) * scaleX)),
        top: Math.max(0, Math.floor((rect.top - viewport.top) * scaleY)),
        right: Math.min(width, Math.ceil((rect.right - viewport.left) * scaleX)),
        bottom: Math.min(height, Math.ceil((rect.bottom - viewport.top) * scaleY)),
      });
      const inside = mapRect(masked);
      const controlBox = mapRect(controlRect);

      const isMagenta = (at: number): boolean => {
        const dr = 255 - data[at];
        const dg = data[at + 1];
        const db = 255 - data[at + 2];
        return dr * dr + dg * dg + db * db <= 14400;
      };
      const isBlack = (at: number): boolean => Math.max(data[at], data[at + 1], data[at + 2]) <= 24;

      const scan = (
        x0: number,
        y0: number,
        x1: number,
        y1: number,
      ): { pixels: number; magenta: number; black: number } => {
        const stats = { pixels: 0, magenta: 0, black: 0 };
        for (let y = Math.max(0, y0); y < Math.min(height, y1); y += 1) {
          for (let x = Math.max(0, x0); x < Math.min(width, x1); x += 1) {
            const at = (y * width + x) * 4;
            stats.pixels += 1;
            if (isMagenta(at)) stats.magenta += 1;
            if (isBlack(at)) stats.black += 1;
          }
        }
        return stats;
      };

      const core = scan(inside.left, inside.top, inside.right, inside.bottom);
      const expanded = scan(inside.left - 1, inside.top - 1, inside.right + 1, inside.bottom + 1);
      const interior = scan(inside.left + 1, inside.top + 1, inside.right - 1, inside.bottom - 1);
      const controlStats = scan(controlBox.left, controlBox.top, controlBox.right, controlBox.bottom);

      const distinct = new Set<number>();
      for (let y = Math.max(0, controlBox.top); y < Math.min(height, controlBox.bottom); y += 1) {
        for (let x = Math.max(0, controlBox.left); x < Math.min(width, controlBox.right); x += 1) {
          const at = (y * width + x) * 4;
          distinct.add(((data[at] >> 5) << 10) | ((data[at + 1] >> 5) << 5) | (data[at + 2] >> 5));
        }
      }

      return {
        width,
        height,
        insidePixels: core.pixels,
        insideMagenta: core.magenta,
        insideBlack: core.black,
        interiorPixels: interior.pixels,
        interiorMagenta: interior.magenta,
        interiorBlack: interior.black,
        ringPixels: expanded.pixels - core.pixels,
        ringMagenta: expanded.magenta - core.magenta,
        ringBlack: expanded.black - core.black,
        controlPixels: controlStats.pixels,
        controlBlack: controlStats.black,
        controlDistinct: distinct.size,
      };
    },
    { payload: bytes.toString('base64'), viewport: options.viewport, masked: options.masked, control },
  );
}

/** The CA-02 destruction proof: original pixels gone in rect + ring, fill burned in, outside untouched. */
function expectMaskedAndTargeted(report: RedactionReport, minInteriorBlack = 0.98): void {
  expect(report.insidePixels, 'the expected mask rect must land inside the captured frame').toBeGreaterThan(
    50,
  );
  expect(report.interiorPixels, 'the mask interior must be non-degenerate').toBeGreaterThan(0);
  expect(report.insideMagenta, 'zero original pixels inside the masked rect (CA-02)').toBe(0);
  expect(report.ringMagenta, 'zero original pixels on the 1-px boundary ring (CA-02)').toBe(0);
  expect(
    report.interiorBlack / report.interiorPixels,
    'the mask interior must be the flat opaque fill',
  ).toBeGreaterThanOrEqual(minInteriorBlack);
  expect(
    report.insideBlack / report.insidePixels,
    'the rect including its boundary pixel row must be filled',
  ).toBeGreaterThanOrEqual(0.9);
  expect(report.ringBlack / report.ringPixels, 'the 1-px ring outside the rect must not be wiped').toBeLessThan(
    0.5,
  );
  expect(report.controlBlack / report.controlPixels, 'the control region must keep its pixels').toBeLessThan(
    0.2,
  );
  expect(report.controlDistinct, 'the control region must keep more than one colour').toBeGreaterThanOrEqual(
    2,
  );
}

/** The non-vacuous twin: an element no family matches keeps every original pixel. */
function expectStillVisible(report: RedactionReport): void {
  expect(report.insidePixels, 'the control rect must land inside the captured frame').toBeGreaterThan(50);
  expect(report.interiorPixels, 'the control interior must be non-degenerate').toBeGreaterThan(0);
  expect(
    report.interiorMagenta / report.interiorPixels,
    'an unmatched element keeps its original marker pixels',
  ).toBeGreaterThanOrEqual(0.9);
  expect(
    report.interiorBlack / report.interiorPixels,
    'an unmatched element must not be flat-filled',
  ).toBeLessThanOrEqual(0.2);
}

/** One shared row body: inject secrets, gesture, decode, analyze. */
async function runRedactionRow(
  page: Page,
  browserName: string,
  secrets: SecretSpec[],
): Promise<{ report: RedactionReport; masked: CssRect; viewport: CssRect; calls: PostCall[] }> {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);
  await installSecrets(page, secrets);

  const first = secrets[0];
  if (first === undefined) throw new Error('runRedactionRow: no secret injected');
  const masked = await readMaskRect(page, first.id, first.tag === 'input' || (first.attrs !== undefined && 'data-watchbug-sensitive' in first.attrs) ? 'element' : 'text-node');

  const size = page.viewportSize();
  if (size === null) throw new Error('runRedactionRow: no viewport');
  const viewport: CssRect = { left: 0, top: 0, right: size.width, bottom: size.height };

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 20_000);
  expect(calls, 'the gesture must send exactly one report').toHaveLength(1);

  const image = await readOutgoingImage(page);
  const report = await analyzeRedaction(page, image, { viewport, masked });
  return { report, masked, viewport, calls };
}

test('PRV-02: JWT shape masks the whole text node — decoded bytes contain zero original pixels inside the rect and its 1-px boundary ring', async ({
  page,
  browserName,
}) => {
  const { report } = await runRedactionRow(
    page,
    browserName,
    [
      {
        id: 'wb-jwt-secret',
        text: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.Um9ja2V0U2lnbmF0dXJlMTIzNDU2Nzg5',
        left: 80,
        top: 140,
        marker: true,
      },
    ],
  );
  // The default tracer frame on both tiers: 640×360 at a 1280×720 viewport.
  expect(report.width).toBe(640);
  expect(report.height).toBe(360);
  expectMaskedAndTargeted(report);
});

test('PRV-02: a JWT lookalike outside the eyJ shape stays visible — its original pixels survive in the decoded bytes', async ({
  page,
  browserName,
}) => {
  const { report } = await runRedactionRow(
    page,
    browserName,
    [
      {
        id: 'wb-jwt-lookalike',
        text: 'xJhdXRv.NExhbWVfaWRlbnRpdHlfOTk5OTk5.SGNyZWRzX3NpZ25hdHVyZV8xMjM0',
        left: 80,
        top: 140,
        marker: true,
      },
    ],
  );
  expect(report.width).toBe(640);
  expectStillVisible(report);
});

test('PRV-01: an input[type=password] value masks at the full element rect — decoded bytes carry zero original pixels inside the rect and its 1-px ring', async ({
  page,
  browserName,
}) => {
  const { report } = await runRedactionRow(
    page,
    browserName,
    [
      {
        id: 'wb-password-input',
        tag: 'input',
        attrs: { type: 'password' },
        value: 'hunter2-super-secret-value',
        left: 80,
        top: 140,
        marker: true,
        style: 'width:320px;height:34px;box-sizing:border-box;',
      },
    ],
  );
  expect(report.width).toBe(640);
  expectMaskedAndTargeted(report);
});

test('PRV-02: a bearer-token shape masks the containing text node in the decoded bytes', async ({
  page,
  browserName,
}) => {
  const { report } = await runRedactionRow(
    page,
    browserName,
    [
      {
        id: 'wb-bearer-secret',
        text: "const auth = { headers: { Authorization: 'Bearer sk_live_51AbCdEfGhIjKlMn' } };",
        left: 80,
        top: 140,
        marker: true,
      },
    ],
  );
  expect(report.width).toBe(640);
  expectMaskedAndTargeted(report);
});

test('PRV-02: key=/token=/secret=/password= assignments mask the containing text node in the decoded bytes', async ({
  page,
  browserName,
}) => {
  const { report } = await runRedactionRow(
    page,
    browserName,
    [
      {
        id: 'wb-assignment-secret',
        text: "const login = { password: correctHorseBattery9, api_key: wbt_live_7f3a9c21 }",
        left: 80,
        top: 140,
        marker: true,
      },
    ],
  );
  expect(report.width).toBe(640);
  expectMaskedAndTargeted(report);
});

test('PRV-02: a Luhn-valid card sequence masks while its Luhn-invalid lookalike stays visible in the decoded bytes', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);
  await installSecrets(page, [
    { id: 'wb-card-valid', text: '4111111111111111', left: 80, top: 140 },
    // The negative sub-assertion (P2-D-07): the same shape, one digit off the
    // Luhn checksum — deliberately NOT masked, and the marker proves its
    // pixels survive through the decode.
    { id: 'wb-card-invalid', text: '4242424242424241', left: 80, top: 200, marker: true },
  ]);
  const validRect = await readMaskRect(page, 'wb-card-valid', 'text-node');
  const invalidRect = await readMaskRect(page, 'wb-card-invalid', 'text-node');
  const size = page.viewportSize();
  if (size === null) throw new Error('card row: no viewport');
  const viewport: CssRect = { left: 0, top: 0, right: size.width, bottom: size.height };

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));
  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 20_000);
  expect(calls, 'the gesture must send exactly one report').toHaveLength(1);

  const image = await readOutgoingImage(page);
  const maskedReport = await analyzeRedaction(page, image, { viewport, masked: validRect });
  expect(maskedReport.width).toBe(640);
  expectMaskedAndTargeted(maskedReport);

  const controlReport = await analyzeRedaction(page, image, { viewport, masked: invalidRect });
  expectStillVisible(controlReport);
});

test('PRV-03: a data-watchbug-sensitive element masks at the full element rect in the decoded bytes', async ({
  page,
  browserName,
}) => {
  const { report } = await runRedactionRow(
    page,
    browserName,
    [
      {
        id: 'wb-sensitive-element',
        attrs: { 'data-watchbug-sensitive': '' },
        text: 'SSN 123-45-6789 (internal)',
        left: 80,
        top: 140,
        marker: true,
      },
    ],
  );
  expect(report.width).toBe(640);
  expectMaskedAndTargeted(report);
});
