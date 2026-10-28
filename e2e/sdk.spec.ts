import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAX_TITLE_CHARS } from '@watchbug/contracts/constants';
import { reportSchema } from '@watchbug/contracts/schema';
import {
  addedNames,
  FIXTURE_ORIGIN,
  HOSTILE_URL,
  openHostFixture,
  openHostileFixture,
  projectKey,
  readSnapshot,
  snapshotGlobals,
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
import {
  attachImage,
  clickComposerReview,
  clickContinueTextOnly,
  clickReviewEdit,
  clickReviewSend,
  clickVisibleAttach,
  expectZoneState,
  reviewAndSend,
  setLocaleToggle,
  setNote,
  setTitle,
  setType,
  waitForComposer,
  waitForReview,
} from './helpers/composer';
import {
  analyzeInk,
  canvasBox,
  clickOnBitmap,
  done,
  dragOnBitmap,
  openEditor,
  selectTool,
  typeLabel,
  undo,
  undoKey,
  waitForEditor,
  type BitmapPoint,
} from './helpers/editor';

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
  /**
   * The complete header map from `request.allHeaders()` — unlike `headers()`
   * this surfaces every browser-composed header, including `referer`
   * (CR-01's PRV-06 assertion reads it here so the referrer check can never
   * pass by silently reading a map that omits the header).
   */
  allHeaders: Record<string, string>;
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
      allHeaders: await request.allHeaders(),
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

test('WDG-06: .wrap lang matches the resolved locale — English copy and lang="en" under the default locale', async ({ page }) => {
  // Replaces the Phase 2 F-08 row (03-03 Task 3): the hard-coded `en` literal
  // is gone — the attribute now comes from the resolved locale, which must
  // agree with the dictionary actually rendered. `all: initial` clears the
  // inherited `lang`, so assistive tech would otherwise read the copy in the
  // host page's language.
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });

  const languages = await page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const wrap = root?.querySelector('.wrap') as HTMLElement | null;
    const launcher = root?.querySelector('button.launcher') as HTMLElement | null;
    return {
      content: wrap?.getAttribute('lang') ?? null,
      // What assistive tech actually resolves for the launcher: the nearest
      // ancestor in the shadow tree that declares a language.
      launcher: launcher?.closest('[lang]')?.getAttribute('lang') ?? null,
      // The declared locale must agree with the dictionary the launcher read.
      launcherLabel: launcher?.getAttribute('aria-label') ?? '',
    };
  });

  expect(languages.content).toBe('en');
  expect(languages.launcher).toBe('en');
  expect(languages.launcherLabel).toBe('Report a bug');
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

test('CAP-03: a blank capture never posts before the user chooses', async ({ page, browserName }) => {
  // Re-pointed from the P2-D-12 blank row by 03-04 Task 3 (the plan's chosen
  // migration, not a duplicate): a uniform frame now opens the DEGRADED
  // composer instead of the Phase-2 panel — the blank diagnosis survives as
  // the notice hint (F6) and nothing posts until an action is chosen.
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
  await expectZoneState(page, 'degraded');

  const failed = await probeWidget(page);
  expect(failed.composerState).toBe('degraded');
  expect(failed.composerNoticeHeading).toBe('Capture unavailable');
  expect(failed.composerNoticeHint, 'the blank diagnosis keeps its distinct hint (F6)').toBe(
    BLANK_HINT,
  );
  // Two real exits, never a dead panel (P3-D-13).
  expect(failed.composerAttachVisible).toBe(true);
  expect(failed.composerContinueVisible).toBe(true);

  // The Review action is inert in the degraded state — choosing an action is
  // the only way forward, and an inert click still posts nothing (T-03-01).
  await clickComposerReview(page);
  await page.waitForTimeout(300);
  const inert = await probeWidget(page);
  expect(inert.screen, 'Review from the degraded state does not navigate').toBe('composer');
  expect(inert.composerState).toBe('degraded');

  // Exit 1 works from this state: the notice's Attach image reaches the same
  // preview flow as a replace from the image state (Task 1's lane).
  if (browserName === 'chromium') {
    const chooserPromise = page.waitForEvent('filechooser');
    await clickVisibleAttach(page);
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: 'valid-64x64.png', mimeType: 'image/png', buffer: png64 });
  } else {
    await attachImage(page, { name: 'valid-64x64.png', mimeType: 'image/png', buffer: png64 });
  }
  await expectZoneState(page, 'image');
  const recovered = await probeWidget(page);
  expect(recovered.composerPreviewWidth, 'attach from degraded yields the Task-1 preview').toBe(64);
  expect(recovered.composerPreviewHeight).toBe(64);

  // Still nothing posted — the user never pressed Send.
  await expectNoRequest(page, calls);
});

test('P2-D-12: a sparse but real page (white with one corner detail) is not blank — the report is sent', async ({ page, browserName }) => {
  // Seam tier on every engine: the frame is white except a 4x4 block at (2,2),
  // deliberately outside the old 25/50/75 % sample points. The dense uniformity
  // scan must find it and let the report through; a fixed-grid probe called this
  // frame blank and blocked a legitimate page (manual UAT, 2026-10-25).
  await installCaptureStub(page, browserName, { tier: 'seam', sparse: true });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 20_000);
  expect(calls).toHaveLength(1);
});

test('P2-D-12: a frame beyond the supported canvas cap aborts to the blank bucket of the degraded composer', async ({ page, browserName }) => {
  // Seam tier on every engine: the 16,920,000 px frame is allocated
  // canvas-free, so the pipeline's area probe — not an engine canvas limit —
  // is what rejects it. Re-pointed by 03-04: `oversize` shares the blank
  // hint bucket in the degraded composer (F6), never the Phase-2 panel.
  await installCaptureStub(page, browserName, { tier: 'seam', failure: 'beyond-cap' });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await expectZoneState(page, 'degraded');

  const failed = await probeWidget(page);
  expect(failed.composerNoticeHeading).toBe('Capture unavailable');
  expect(failed.composerNoticeHint).toBe(BLANK_HINT);
  expect(failed.composerAttachVisible).toBe(true);
  expect(failed.composerContinueVisible).toBe(true);
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

  // Re-pointed by 03-04: the refusal is now the degraded composer (P3-D-13) —
  // still loud, still request-free, still the surface policy answering.
  await clickLauncher(page);
  await expectZoneState(page, 'degraded');

  // The fake ran and the SDK refused IT — not a missing-API shortcut — so the
  // refusal is the surface policy (browser/window/screen comparison) itself.
  expect(await page.locator('html').getAttribute('data-wb-stub-invoked')).toBe('non-tab-surface');

  const failed = await probeWidget(page);
  expect(failed.composerNoticeHeading).toBe('Capture unavailable');
  expect(failed.composerNoticeHint).toBe(CAPTURE_HINT);
  expect(failed.composerAttachVisible).toBe(true);
  expect(failed.composerContinueVisible).toBe(true);
  await expectNoRequest(page, calls);
});

test('CAP-01: a rejected capture prompt opens the degraded composer with its hint and both actions', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName, { failure: 'prompt-rejected' });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  // Re-pointed by 03-04: the loud state for a denied prompt is now the
  // degraded composer (P3-D-13) — never the dead failure panel, never a
  // silent file dialog. The locked diagnostic copy still surfaces (M-6).
  await clickLauncher(page);
  await expectZoneState(page, 'degraded');

  expect(await page.locator('html').getAttribute('data-wb-stub-invoked')).toBe('prompt-rejected');

  const failed = await probeWidget(page);
  expect(failed.composerNoticeHeading, 'the notice heading (strings.ts)').toBe(
    'Capture unavailable',
  );
  expect(failed.composerNoticeHint, 'the denied diagnosis keeps its hint (F6)').toBe(CAPTURE_HINT);
  expect(failed.composerAttachVisible, 'exit 1: Attach image').toBe(true);
  expect(failed.composerContinueVisible, 'exit 2: Continue with text only').toBe(true);
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
  //
  // IN-03: `postDataBuffer()` omits blob-backed FormData payload BYTES on
  // Playwright's WebKit (deviation 2) — there the part headers are present but
  // the bodies may be empty, so "the same bytes are sent twice" is only
  // observable on chromium/firefox. Guard the non-vacuity there explicitly and
  // say so here, instead of letting an `toEqual` over two empty bodies look
  // cross-engine. The shared `idempotency-key` header and the `meta` part below
  // carry the claim on all three engines.
  const image0 = multipartPart(calls[0].buffer, 'image');
  const image1 = multipartPart(calls[1].buffer, 'image');
  expect(image0).not.toBeNull();
  expect(image1).not.toBeNull();
  if (browserName !== 'webkit') {
    expect(image0?.length ?? 0, 'the encoded image must actually be in the payload').toBeGreaterThan(0);
  }
  expect(image1, 'the resent part must be byte-identical').toEqual(image0);
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

/** Where a secret attaches. `shadow`/`iframe` are the S-7 scanner-reach rows. */
type SecretRoot = 'light' | 'shadow' | 'iframe';

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
  /** Defaults to `light`. See `installSecrets` for what `shadow`/`iframe` do. */
  root?: SecretRoot;
}

/**
 * Attach one secret to its root and return the translation from that root's
 * client coordinates to the TOP document's viewport.
 *
 * A shadow root shares its host document's coordinate space (shift 0). A
 * same-origin frame document does not: its `getBoundingClientRect()` values are
 * relative to the frame's own viewport, so the frame's content-box origin is
 * added. This mapping is written out here **independently of `redactor.ts`**,
 * which is what lets the S-7 row catch a wrong-side frame shift instead of
 * passing vacuously.
 */
async function installSecrets(page: Page, secrets: SecretSpec[]): Promise<void> {
  await page.evaluate((specs) => {
    function attachSecret(spec: SecretSpec): void {
      const element = document.createElement(spec.tag ?? 'div');
      element.id = spec.id;
      if (spec.text !== undefined) element.textContent = spec.text;
      if (spec.value !== undefined) (element as HTMLInputElement).value = spec.value;
      for (const [name, value] of Object.entries(spec.attrs ?? {})) {
        element.setAttribute(name, value);
      }
      element.style.cssText =
        `position:absolute;left:${spec.left}px;top:${spec.top}px;` +
        'white-space:nowrap;font:600 16px/1 ui-monospace,SFMono-Regular,Consolas,monospace;color:#0b0b0b;' +
        (spec.style ?? '');

      const root = spec.root ?? 'light';
      if (root === 'light') {
        if (spec.marker === true) element.setAttribute('data-capture-marker', '');
        document.body.appendChild(element);
        return;
      }

      let dx = 0;
      let dy = 0;
      if (root === 'shadow') {
        let host = document.getElementById('wb-shadow-host');
        if (host === null) {
          host = document.createElement('div');
          host.id = 'wb-shadow-host';
          host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;';
          document.body.appendChild(host);
          host.attachShadow({ mode: 'open' });
        }
        (host.shadowRoot as ShadowRoot).appendChild(element);
      } else {
        let frame = document.getElementById('wb-iframe-host') as HTMLIFrameElement | null;
        if (frame === null) {
          frame = document.createElement('iframe');
          frame.id = 'wb-iframe-host';
          frame.style.cssText = 'position:absolute;left:40px;top:60px;width:1100px;height:420px;border:0;margin:0;';
          document.body.appendChild(frame);
          const inner = frame.contentDocument;
          if (inner === null) throw new Error('installSecrets: the fixture iframe is not same-origin');
          inner.documentElement.style.margin = '0';
          inner.body.style.cssText = 'margin:0;';
        }
        const box = frame.getBoundingClientRect();
        dx = box.left + frame.clientLeft;
        dy = box.top + frame.clientTop;
        (frame.contentDocument as Document).body.appendChild(element);
      }

      if (spec.marker !== true) return;
      // The capture stub paints `[data-capture-marker]` from the TOP document
      // only, so for a nested root the marker is a separate light-DOM element
      // sized and placed at the secret's real laid-out rect -- measured by the
      // browser, not by the code under test.
      const box = element.getBoundingClientRect();
      const marker = document.createElement('div');
      marker.setAttribute('data-capture-marker', '');
      marker.style.cssText =
        `position:absolute;left:${box.left + dx}px;top:${box.top + dy}px;` +
        `width:${box.width}px;height:${box.height}px;`;
      document.body.appendChild(marker);
    }

    for (const spec of specs) attachSecret(spec);
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
async function readMaskRect(
  page: Page,
  id: string,
  source: MaskSource,
  root: SecretRoot = 'light',
): Promise<CssRect> {
  const rect = await page.evaluate(
    ({ elementId, mode, root }) => {
      // The expected client-to-top-viewport mapping, written out independently
      // of `redactor.ts`: a shadow root shares its host document's coordinate
      // space, while a same-origin frame document needs the frame's content-box
      // origin added. A wrong-side shift in the SDK shows up as surviving marker
      // pixels here.
      let scope: Document | ShadowRoot = document;
      let dx = 0;
      let dy = 0;
      if (root === 'shadow') {
        scope = document.getElementById('wb-shadow-host')?.shadowRoot ?? document;
      } else if (root === 'iframe') {
        const frame = document.getElementById('wb-iframe-host') as HTMLIFrameElement | null;
        if (frame === null || frame.contentDocument === null) {
          throw new Error('readMaskRect: the fixture iframe was not injected');
        }
        scope = frame.contentDocument;
        const box = frame.getBoundingClientRect();
        dx = box.left + frame.clientLeft;
        dy = box.top + frame.clientTop;
      }

      const element = scope.querySelector(`#${elementId}`) as HTMLElement | null;
      if (element === null) throw new Error(`readMaskRect: #${elementId} was not injected`);
      if (mode === 'element') {
        const box = element.getBoundingClientRect();
        return {
          left: box.left + dx,
          top: box.top + dy,
          right: box.right + dx,
          bottom: box.bottom + dy,
        };
      }
      const owner = (scope as ShadowRoot).ownerDocument ?? (scope as Document);
      const range = owner.createRange();
      range.selectNodeContents(element);
      let left = Number.POSITIVE_INFINITY;
      let top = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      for (const box of Array.from(range.getClientRects())) {
        left = Math.min(left, box.left + dx);
        top = Math.min(top, box.top + dy);
        right = Math.max(right, box.right + dx);
        bottom = Math.max(bottom, box.bottom + dy);
      }
      return { left, top, right, bottom };
    },
    { elementId: id, mode: source, root },
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
): Promise<{
  report: RedactionReport;
  masked: CssRect;
  viewport: CssRect;
  calls: PostCall[];
  image: Buffer;
}> {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);
  await installSecrets(page, secrets);

  const first = secrets[0];
  if (first === undefined) throw new Error('runRedactionRow: no secret injected');
  const masked = await readMaskRect(
    page,
    first.id,
    first.tag === 'input' || (first.attrs !== undefined && 'data-watchbug-sensitive' in first.attrs)
      ? 'element'
      : 'text-node',
    first.root,
  );

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
  return { report, masked, viewport, calls, image };
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
        text: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.Um9ja2V0U2lnbmF0dXJlMTIzNDU2Nzg5',  // gitleaks:allow
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
        text: "const auth = { headers: { Authorization: 'Bearer sk_live_51AbCdEfGhIjKlMn' } };",  // gitleaks:allow
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
        text: "const login = { password: correctHorseBattery9, api_key: wbt_live_7f3a9c21 }",  // gitleaks:allow
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

test('PRV-02: two Luhn-valid cards glued in one text node mask the whole node — zero original pixels in the rect on the decoded bytes', async ({
  page,
  browserName,
}) => {
  const { report } = await runRedactionRow(
    page,
    browserName,
    [
      {
        id: 'wb-cards-glued',
        // Review CR-02: the greedy CARD_SHAPE match glues both cards into one
        // run, and validating that glued core as a single Luhn run failed —
        // so nothing was masked. The group/adjacent-join validation accepts
        // the first card's digit group and the whole text node masks (P2-D-08).
        text: '4111111111111111 4242424242424242',
        left: 80,
        top: 140,
        marker: true,
      },
    ],
  );
  expect(report.width).toBe(640);
  // The stub painted #ff00ff over the element's rect; expectMaskedAndTargeted
  // requires zero marker pixels inside the rect and its 1-px ring, so this
  // fails whenever the glued run is left unmasked.
  expectMaskedAndTargeted(report);
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

/* ------------------------------------------------------------------------- */
/* S-7 / CR-03 — scanner reach: open shadow roots and same-origin frames        */
/* ------------------------------------------------------------------------- */

/**
 * The rect collection visits every root reachable from `document`: light DOM,
 * OPEN shadow roots and same-origin frame documents. Closed shadow roots and
 * cross-origin frames stay unreachable by construction (T-02-14 / AR-01) and
 * are documented as integration limits.
 *
 * Both secrets ride ONE report. Each carries its own marker element in the
 * light DOM, sized and placed at the secret's real laid-out rect (see
 * `installSecrets`), so "zero original pixels inside the rect" is a real
 * assertion here and not a tautology.
 */
test('S-7 / PRV-02: secrets inside an OPEN shadow root and a same-origin iframe mask in the decoded bytes — the scan visits every reachable root', async ({
  page,
  browserName,
}) => {
  const { report, image, viewport, calls } = await runRedactionRow(
    page,
    browserName,
    [
      {
        id: 'wb-shadow-secret',
        text: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.Um9ja2V0U2lnbmF0dXJlMTIzNDU2Nzg5',  // gitleaks:allow
        left: 80,
        top: 140,
        marker: true,
        root: 'shadow',
      },
      {
        id: 'wb-frame-secret',
        text: '4111 1111 1111 1111',
        left: 120,
        top: 300,
        marker: true,
        root: 'iframe',
      },
    ],
  );
  expect(calls, 'the gesture must send exactly one report').toHaveLength(1);

  // `runRedactionRow` asserted the shadow secret; the frame secret rides the
  // same encoded bytes and needs its own rect — measured in TOP-document space,
  // i.e. including the fixture iframe's 40 x 60 content-box origin.
  expect(report.width).toBe(640);
  expectMaskedAndTargeted(report);

  const frameRect = await readMaskRect(page, 'wb-frame-secret', 'text-node', 'iframe');
  expect(
    frameRect.left,
    'the expected frame rect must be shifted into the top viewport',
  ).toBeGreaterThanOrEqual(150);
  expectMaskedAndTargeted(await analyzeRedaction(page, image, { viewport, masked: frameRect }));
});

/**
 * FX-02: the frame map is a pure translation only when the frame path carries
 * no CSS transform. A rotated/scaled frame would put the mask on the wrong
 * pixels, so the scan REFUSES it and the flow fails closed -- the same policy
 * `capture-source.ts` applies to a window/screen capture whose DOM-to-bitmap
 * registration cannot be verified (OQ-1 / T-02-05).
 */
test('S-7 guard: a transformed same-origin frame is refused loudly — nothing is sent rather than masked at the wrong pixels (FX-02)', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'wb-transformed-frame';
    frame.style.cssText =
      'position:absolute;left:40px;top:60px;width:1100px;height:420px;border:0;margin:0;' +
      'transform:rotate(4deg);';
    document.body.appendChild(frame);
    const inner = frame.contentDocument;
    if (inner === null) throw new Error('S-7 guard: the fixture frame is not same-origin');
    inner.documentElement.style.margin = '0';
    inner.body.style.cssText = 'margin:0;';
    const secret = inner.createElement('div');
    secret.id = 'wb-transformed-secret';
    secret.textContent = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.Um9ja2V0U2lnbmF0dXJlMTIzNDU2Nzg5';  // gitleaks:allow
    secret.style.cssText =
      'position:absolute;left:80px;top:140px;white-space:nowrap;font:600 16px/1 monospace;';
    inner.body.appendChild(secret);
  });

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  // Re-pointed by 03-04: "refused loudly" is now the degraded composer — the
  // transformed frame never becomes a draft and nothing is sent (FX-02).
  await clickLauncher(page);
  await expectZoneState(page, 'degraded');
  await expectNoRequest(page, calls);
});

/**
 * FX-01: the no-CSPRNG exit is a new path created by the WR-03 fix. The
 * launcher hides the host in its OWN click handler, so a failure state
 * rendered without restoring it is invisible and kills the widget -- the one
 * thing M-6 forbids. Nothing else covered this path.
 */
test('WR-03 guard: with no CSPRNG the flow fails visibly and leaves the widget usable — never a guessable key (FX-01)', async ({
  page,
  browserName,
}) => {
  await page.addInitScript({
    content: `(() => {
  const c = globalThis.crypto;
  if (c === undefined) return;
  Object.defineProperty(c, 'randomUUID', { value: undefined, configurable: true });
  Object.defineProperty(c, 'getRandomValues', { value: undefined, configurable: true });
})();`,
  });
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, "Couldn't capture the screen.", 10_000);

  const failed = await probeWidget(page);
  expect(failed.headlineRole).toBe('alert');
  expect(failed.hint).toBe(CAPTURE_HINT);

  // The host must be visible again, or the "loud terminal state" is invisible.
  const hostDisplay = await page.evaluate(() => {
    const host = document.querySelector('watchbug-host');
    return host === null ? 'missing' : getComputedStyle(host).display;
  });
  expect(hostDisplay, 'the widget host must be restored after a failure (FX-01)').not.toBe('none');

  await expectNoRequest(page, calls);
});

/* ------------------------------------------------------------------------- */
/* H-1 / P2-D-08 geometry rows — 02-04 Task 3                                   */
/* ------------------------------------------------------------------------- */

/** The same known secret, so every DPR row masks the identical DOM rect. */
const HIDPI_SECRET_TEXT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.Um9ja2V0U2lnbmF0dXJlMTIzNDU2Nzg5';  // gitleaks:allow

/**
 * One H-1 row body: capture at an explicit frame of `viewport × dpr` (what a
 * real tab capture of a HiDPI display produces), then assert the masked
 * region — computed from the *decoded output's* own scale — carries zero
 * original pixels inside the rect and on its 1-px boundary ring.
 *
 * At `dpr: 3` the encode ladder clamps the frame to 2× before encoding (the
 * same resample a real 3× display produces), so the interior-fill floor drops
 * to 0.9 for the resampled boundary; the magenta/leak assertions stay
 * identical at every scale.
 */
async function runHidpiMaskRow(
  page: Page,
  browserName: string,
  expectedDpr: number,
  frame: { width: number; height: number },
  expectedWidth: number,
  minInteriorBlack = 0.98,
): Promise<void> {
  // Non-vacuity: the context really runs at this device pixel ratio first.
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(expectedDpr);

  await installCaptureStub(page, browserName, { frame });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);
  await installSecrets(page, [
    { id: 'wb-hidpi-secret', text: HIDPI_SECRET_TEXT, left: 80, top: 140, marker: true },
  ]);
  const masked = await readMaskRect(page, 'wb-hidpi-secret', 'text-node');
  const size = page.viewportSize();
  if (size === null) throw new Error('H-1 row: no viewport');
  const viewport: CssRect = { left: 0, top: 0, right: size.width, bottom: size.height };

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));
  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 30_000);
  expect(calls, 'the gesture must send exactly one report').toHaveLength(1);

  const image = await readOutgoingImage(page);
  const report = await analyzeRedaction(page, image, { viewport, masked });
  // The output scale pins which frame geometry was actually exercised.
  expect(report.width).toBe(expectedWidth);
  expectMaskedAndTargeted(report, minInteriorBlack);
}

// Explicit DSF: the `Desktop Safari` project descriptor defaults to
// deviceScaleFactor 2, so "dpr 1" must be pinned per-row rather than assumed
// from the project default (webkit failed exactly that assumption first).
test.describe('H-1 baseline (deviceScaleFactor: 1)', () => {
  test.use({ deviceScaleFactor: 1 });

  test('H-1: devicePixelRatio 1 masks in bitmap space — zero original pixels in the rect and its 1-px boundary ring', async ({
    page,
    browserName,
  }) => {
    await runHidpiMaskRow(page, browserName, 1, { width: 1280, height: 720 }, 1280);
  });
});

test.describe('H-1 HiDPI (deviceScaleFactor: 1.25)', () => {
  test.use({ deviceScaleFactor: 1.25 });

  test('H-1: devicePixelRatio 1.25 (non-integer scale) masks in bitmap space — zero original pixels in the rect and its 1-px boundary ring', async ({
    page,
    browserName,
  }) => {
    await runHidpiMaskRow(page, browserName, 1.25, { width: 1600, height: 900 }, 1600);
  });
});

test.describe('H-1 HiDPI (deviceScaleFactor: 2)', () => {
  test.use({ deviceScaleFactor: 2 });

  test('H-1: devicePixelRatio 2 masks in bitmap space — zero original pixels in the rect and its 1-px boundary ring', async ({
    page,
    browserName,
  }) => {
    await runHidpiMaskRow(page, browserName, 2, { width: 2560, height: 1440 }, 2560);
  });
});

test.describe('H-1 HiDPI (deviceScaleFactor: 3)', () => {
  test.use({ deviceScaleFactor: 3 });

  test('H-1: devicePixelRatio 3 masks before the DPR-2 encode clamp — zero original pixels in the rect and its 1-px boundary ring', async ({
    page,
    browserName,
  }) => {
    // Frame at 3× (3840×2160), clamped to 2560×1440 by initialDimensions —
    // the mask is burned in BEFORE that resample, which is what makes the
    // leak assertion meaningful at a clamped DPR.
    await runHidpiMaskRow(page, browserName, 3, { width: 3840, height: 2160 }, 2560, 0.9);
  });
});

test('P2-D-08: a partially-matching text node masks its whole rect — the unmatched substring pixels are gone too', async ({
  page,
  browserName,
}) => {
  // One text node: prose before and after the matched token. The stub paints
  // the marker across the WHOLE element, so "zero original pixels inside the
  // text-node rect" can only hold if the mask covered the unmatched
  // substrings as well (whole-node granularity — never the token alone).
  const { report } = await runRedactionRow(
    page,
    browserName,
    [
      {
        id: 'wb-granularity-node',
        text: `deploy notes ${HIDPI_SECRET_TEXT} trailing prose stays in the node`,
        left: 80,
        top: 140,
        marker: true,
      },
    ],
  );
  expect(report.width).toBe(640);
  expectMaskedAndTargeted(report);
});

/* ------------------------------------------------------------------------- */
/* Fail-closed redaction — 02-04 Task 3 (T-02-10)                               */
/* ------------------------------------------------------------------------- */

/**
 * The e2e seam for a hostile/broken DOM scan: the redactor's `TreeWalker` is
 * the only `createTreeWalker` caller in the SDK, so overriding it makes the
 * redaction pass throw exactly where a real scan/geometry failure would.
 * Nothing else in the widget, harness or Playwright's own page utilities
 * touches that API.
 */
const BREAK_DOM_SCAN = String.raw`(() => {
  const original = document.createTreeWalker;
  if (typeof original !== 'function') return;
  document.createTreeWalker = function () {
    document.documentElement.setAttribute('data-wb-stub-invoked', 'redaction-scan-failure');
    throw new Error('e2e: simulated redaction DOM-scan failure');
  };
})();`;

test('fail-closed: a redaction scan error lands in the loud capture-failed state with zero POST attempts', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await page.addInitScript({ content: BREAK_DOM_SCAN });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  // Re-pointed by 03-04: the fail-closed loud state for a broken redaction
  // scan is the degraded composer (P3-D-13), not the Phase-2 panel.
  await clickLauncher(page);
  await expectZoneState(page, 'degraded');

  const failed = await probeWidget(page);
  expect(failed.composerNoticeHint, 'the fail-closed note rides the denied hint (F6)').toBe(
    CAPTURE_HINT,
  );
  expect(failed.composerAttachVisible).toBe(true);
  expect(failed.composerContinueVisible).toBe(true);

  // Non-vacuity: the scan provocation really fired -- so the failure is
  // redaction's, not capture's -- and the flow short-circuited before
  // encode/send.
  //
  // WR-01 moved rect collection into `beforeRead`, the same instant the pixels
  // are read. On the SEAM tier that means a broken scan now fails BEFORE the
  // stub's frame provider is ever reached: strictly earlier than before, never
  // later. The `observation` probe is therefore tier-conditional, and the
  // branches below state the ordering each tier now has instead of letting one
  // of them silently stop meaning anything. On the media tier the stream has
  // already produced a frame when `beforeRead` runs, so the probe still fires.
  expect(await page.locator('html').getAttribute('data-wb-stub-invoked')).toBe(
    'redaction-scan-failure',
  );
  const observation = await page.locator('html').getAttribute('data-wb-stub-observation');
  if (captureStubTier(browserName) === 'seam') {
    expect(
      observation,
      'the scan must fail before the seam frame provider runs (WR-01 ordering)',
    ).toBeNull();
  } else {
    expect(observation, 'the capture stub must have run before the scan failed').not.toBeNull();
  }
  await expectNoRequest(page, calls);
});

/* ------------------------------------------------------------------ */
/* PRV-05 — the outgoing report carries no host credential material     */
/* (SEC-03 by payload, C-5 groundwork)                                  */
/* ------------------------------------------------------------------ */

/**
 * Four distinct sentinel strings, one per host-credential surface PRV-05
 * names: a cookie, `localStorage`, `sessionStorage` and an authorization-style
 * request header. They are long and random enough that a hit anywhere in the
 * request — header name, header value, multipart framing, `meta` JSON or the
 * encoded image bytes — is a leak, never a coincidence.
 */
const SENTINELS = {
  cookie: 'SENTINEL-COOKIE-9a4f21c7e05b',
  local: 'SENTINEL-LOCAL-5c8be03317da',
  session: 'SENTINEL-SESSION-e17d4a9684fc',
  auth: 'SENTINEL-AUTH-b30f6e52a19c',
} as const;

/**
 * Headers the browser itself sets on a `fetch` POST. Anything **not** in this
 * set was put on the request by page or SDK code, so PRV-05 requires that the
 * remainder is exactly the two contract headers. `cookie` and `authorization`
 * are deliberately absent from the set: their mere presence fails the row.
 *
 * `referer` is deliberately absent too (review CR-01): it is browser-composed,
 * but the SDK pins `referrerPolicy: 'no-referrer'` on the report POST, so its
 * mere presence on the intercepted report now fails the row below — the host
 * page's URL (and its query string) must not ride the request either (R-08).
 */
const BROWSER_STANDARD_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'host',
  'origin',
  'pragma',
  'priority',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'upgrade-insecure-requests',
  'user-agent',
]);

test('PRV-05: the intercepted report carries no host cookie, storage or auth material — zero sentinels across every header and every request byte', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);

  // Seed the host cookie before the fixture document loads.
  await page.context().addCookies([
    { name: 'wb_session', value: SENTINELS.cookie, url: FIXTURE_ORIGIN },
  ]);

  // Non-vacuity for the two network provocations: this route records the host
  // page's OWN requests, so the row proves the sentinels really do ride the
  // page's traffic (Authorization attempt, and the cookie on a default
  // same-origin request) before checking that the widget's report carries none.
  const hostCalls: { headers: Record<string, string> }[] = [];
  await page.route(/\/api\/health$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    hostCalls.push({ headers: await route.request().allHeaders() });
    await route.continue();
  });

  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const seeded = await page.evaluate(async (sentinels) => {
    localStorage.setItem('wb_local_token', sentinels.local);
    sessionStorage.setItem('wb_session_token', sentinels.session);
    document.cookie = 'wb_page_cookie=' + sentinels.cookie;
    // The authorization-style header attempt: the host app's own authenticated
    // call, carrying the sentinel on the wire.
    await fetch('/api/health', { headers: { Authorization: 'Bearer ' + sentinels.auth } });
    // And a default same-origin request, which the browser will attach the
    // seeded cookie to — the provocation the SDK's `credentials: 'omit'` must
    // neutralise for the report.
    await fetch('/api/health', { credentials: 'include' });
    return {
      cookie: document.cookie,
      local: localStorage.getItem('wb_local_token'),
      session: sessionStorage.getItem('wb_session_token'),
    };
  }, SENTINELS);
  expect(seeded.local, 'localStorage sentinel must be seeded').toBe(SENTINELS.local);
  expect(seeded.session, 'sessionStorage sentinel must be seeded').toBe(SENTINELS.session);
  expect(seeded.cookie, 'cookie sentinel must be seeded').toContain(SENTINELS.cookie);

  expect(hostCalls, 'the host page must have made both provocation requests').toHaveLength(2);
  expect(
    hostCalls[0].headers['authorization'] ?? '',
    'the Authorization attempt must ride the host request',
  ).toContain(SENTINELS.auth);
  if (browserName !== 'webkit') {
    expect(
      hostCalls[1].headers['cookie'] ?? '',
      'the seeded cookie must ride a default same-origin request',
    ).toContain(SENTINELS.cookie);
  }
  // webkit: Playwright's WebKit exposes NO cookie header on intercepted
  // requests at all — `headerValue('cookie')` is null even with seeded cookies
  // and `credentials: 'include'` (probe 2026-10-24, this host). The cookie
  // provocation is therefore asserted on chromium/firefox only; the SDK-side
  // guarantee (`credentials: 'omit'` in lane1) is source-asserted by
  // `gate.mjs sdk-no-host-storage`'s credentials rule.

  // Intercept the outgoing report: full headers plus the raw bytes Node sees.
  // Fulfilled with 201 — the real-stack path is INT-02's; this row's subject is
  // the request itself.
  let report: { headers: Record<string, string>; buffer: Buffer } | null = null;
  await page.route(INCIDENT_POST_RE, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const request = route.request();
    report = {
      headers: await request.allHeaders(),
      buffer: request.postDataBuffer() ?? Buffer.alloc(0),
    };
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: INTERCEPTED_ID }),
    });
  });

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);

  expect(report, 'the gesture must have sent a report').not.toBeNull();
  if (report === null) return;
  const sent = report;

  // Non-vacuity: a real multipart request was inspected (meta part present on
  // every engine — WebKit drops only the blob-backed image part, 02-02 dev. 2).
  expect(sent.buffer.toString('utf8')).toContain('name="meta"');

  // (1) Zero sentinel occurrences in every header name and value.
  for (const [name, value] of Object.entries(sent.headers)) {
    const haystack = `${name}\n${value}`;
    for (const [surface, sentinel] of Object.entries(SENTINELS)) {
      expect(
        haystack.includes(sentinel),
        `the ${surface} sentinel must not appear in request header "${name}"`,
      ).toBe(false);
    }
  }

  // (2) No credential header of any kind — not even an empty one. On webkit
  // the cookie half is trivially satisfied (that engine exposes no cookie
  // header at all, see the provocation comment above); the Authorization half
  // is observable on every engine.
  expect(sent.headers['authorization']).toBeUndefined();
  expect(sent.headers['cookie']).toBeUndefined();

  // (2b) No Referer either (review CR-01): `referrerPolicy: 'no-referrer'`
  // pins the report's referrer at the fetch init, so the host page's URL —
  // and any `?token=` query it carries — never rides the request in a header.
  // `sent.headers` comes from `request.allHeaders()`, which does surface
  // browser-composed headers, so this proves absence rather than merely
  // screening the value: a regression to the browser default
  // (`strict-origin-when-cross-origin`, full URL on same-origin) fails here,
  // in the header allowlist (3), and in PRV-06's query-string assertion.
  expect(
    sent.headers['referer'],
    'the report POST must carry no referer header at all (R-08 / CR-01)',
  ).toBeUndefined();

  // (3) Beyond the browser's own headers, exactly the two contract headers ride.
  const nonBrowserHeaders = Object.keys(sent.headers)
    .filter((name) => !BROWSER_STANDARD_HEADERS.has(name))
    .sort();
  expect(nonBrowserHeaders).toEqual(['idempotency-key', 'x-project-key']);
  expect(sent.headers['x-project-key']).toBe(projectKey());
  expect(sent.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);

  // (4) Zero sentinel occurrences in the raw multipart bytes Node received.
  const rawBody = sent.buffer.toString('latin1');
  for (const [surface, sentinel] of Object.entries(SENTINELS)) {
    expect(
      rawBody.includes(sentinel),
      `the ${surface} sentinel must not appear in the raw request body`,
    ).toBe(false);
  }

  // (5) …and in the image bytes read at the fetch boundary: WebKit's
  // `postDataBuffer()` reports 0 bytes for blob-backed parts, so the
  // intercepted buffer alone cannot cover the image on that engine.
  const image = await readOutgoingImage(page);
  const imageText = image.toString('latin1');
  for (const [surface, sentinel] of Object.entries(SENTINELS)) {
    expect(
      imageText.includes(sentinel),
      `the ${surface} sentinel must not appear in the outgoing image bytes`,
    ).toBe(false);
  }
});

/* ------------------------------------------------------------------ */
/* PRV-06 / P2-D-01 — path-only URL and the capped auto-title on the wire */
/* ------------------------------------------------------------------ */

/**
 * The `meta` JSON part exactly as it left the browser, parsed from the raw
 * intercepted bytes (the meta part survives on every engine — WebKit drops
 * only the blob-backed image part). Assertions target the RAW value, before
 * the contract's own `stripQueryFragment` transform, so the row proves the SDK
 * sends path-only rather than relying on defence in depth.
 */
function interceptedMeta(call: PostCall): Record<string, unknown> {
  const part = multipartPart(call.buffer, 'meta');
  if (part === null) throw new Error('intercepted request has no meta part');
  return JSON.parse(part.toString('utf8')) as Record<string, unknown>;
}

test('PRV-06: meta.url is path-only — the query string and fragment never enter the report', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostileFixture(page, { variant: 'clean', bundle: 'watchbug.e2e.js', mode: 'iife' });
  // Navigate to a URL carrying a query secret and a fragment. The hostile
  // fixture's route regex is unanchored (host-fixtures.ts), so the same
  // document serves this URL — unlike the plain fixture route, which is
  // anchored to the bare path and would fall through to nginx's 404.
  await page.goto(`${HOSTILE_URL}?variant=clean&token=secret#frag`, { waitUntil: 'load' });
  await waitForWidget(page);

  // Non-vacuity: the document really is addressed with a query and a fragment.
  const location = await page.evaluate(() => ({
    href: location.href,
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
  }));
  expect(location.pathname).toBe('/__e2e/hostile-host.html');
  expect(location.search).toBe('?variant=clean&token=secret');
  expect(location.hash).toBe('#frag');
  expect(location.href).toContain('token=secret');

  // A short title passes through unchanged (the truncation row owns the cap).
  await page.evaluate(() => {
    document.title = 'PRV-06 path-only report';
  });

  // Non-vacuity for the CR-01 header assertion: this document's URL carries
  // `?token=secret`, and a plain same-origin fetch under the browser's DEFAULT
  // referrer policy does put that full URL in `referer` — proving both that
  // the query string really would leave in a header without the SDK's
  // `referrerPolicy: 'no-referrer'` pin, and that the route handler can
  // observe the header on this engine. If this probe passed vacuously (header
  // unobservable), the report assertion below would prove nothing.
  const probe: { headers: Record<string, string> }[] = [];
  await page.route(/\/api\/health$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    probe.push({ headers: await route.request().allHeaders() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' });
  });
  const probeBody = await page.evaluate(() => fetch('/api/health').then((r) => r.json()));
  expect(probeBody).toEqual({ status: 'ok' });
  expect(probe, 'the referrer probe request must have been intercepted').toHaveLength(1);
  expect(
    probe[0].headers['referer'] ?? '',
    'non-vacuity: a browser-default same-origin request must leak ?token=secret in its referer, so the header is observable here',
  ).toContain('token=secret');
  await page.unroute(/\/api\/health$/);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
  expect(calls, 'the gesture must send exactly one report').toHaveLength(1);

  // CR-01: with the same document URL and the same same-origin destination,
  // the SDK's report must carry NO referer header at all — the query string
  // must not leave the browser in a header (R-08). `allHeaders()` surfaces
  // browser-composed headers, so an absent entry is genuine absence.
  const reportReferer = calls[0].allHeaders['referer'];
  expect(reportReferer, 'the report POST must send no referer header (R-08 / CR-01)').toBeUndefined();
  expect(reportReferer ?? '').not.toContain('token=secret');

  const meta = interceptedMeta(calls[0]);
  // The raw wire value: path only — no query, no fragment, no origin.
  expect(meta.url).toBe('/__e2e/hostile-host.html');
  expect(String(meta.url)).not.toContain('?');
  expect(String(meta.url)).not.toContain('#');
  expect(String(meta.url)).not.toContain('://');
  expect(String(meta.url)).not.toContain('token=secret');
  // Short title untouched.
  expect(meta.title).toBe('PRV-06 path-only report');
  expect(meta.type).toBe('bug');
  // And the meta as sent satisfies the published closed contract.
  const parsed = reportSchema.parse(meta);
  expect(parsed.url).toBe('/__e2e/hostile-host.html');
});

test('P2-D-01: the auto-title is document.title truncated to the first 200 code points and type is bug', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  // 300 characters = 300 code points but 500 UTF-16 units: the cap must count
  // code points, matching the Zod `.max(MAX_TITLE_CHARS)` semantics the server
  // validates against (100 ASCII + 200 non-BMP emoji).
  const longTitle = `${'A'.repeat(100)}${'\u{1F600}'.repeat(200)}`;
  expect([...longTitle].length).toBe(300);
  await page.evaluate((title) => {
    document.title = title;
  }, longTitle);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
  expect(calls, 'the gesture must send exactly one report').toHaveLength(1);

  const meta = interceptedMeta(calls[0]);
  expect(meta.type).toBe('bug');

  const expectedTitle = [...longTitle].slice(0, MAX_TITLE_CHARS).join('');
  expect([...expectedTitle].length, 'expected title spans 200 code points').toBe(200);
  expect(typeof meta.title).toBe('string');
  expect(
    [...String(meta.title)].length,
    'the sent title must be exactly MAX_TITLE_CHARS code points',
  ).toBe(MAX_TITLE_CHARS);
  expect(meta.title, 'the sent title must be the first 200 code points of document.title').toBe(
    expectedTitle,
  );
  // The truncated title satisfies the published contract's cap.
  expect(() => reportSchema.parse(meta)).not.toThrow();
});

/* ------------------------------------------------------------------ */
/* Self-hosted promise — the widget opens no third-party destination    */
/* ------------------------------------------------------------------ */

test('self-hosted: the widget makes zero third-party network requests — only the configured Watchbug API base', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);

  // Every request the page makes from the very first navigation, including
  // the fixture document, the bundle and the report POST.
  const destinations: string[] = [];
  page.on('request', (request) => destinations.push(request.url()));

  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);

  // Non-vacuity: the flow really did reach the API on this origin.
  expect(calls, 'the gesture must send exactly one report').toHaveLength(1);
  expect(
    destinations,
    'the report must target the configured API base',
  ).toContain(`${FIXTURE_ORIGIN}/api/incidents`);

  const external = destinations.filter((url) => {
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return false;
    try {
      return new URL(url).origin !== FIXTURE_ORIGIN;
    } catch {
      return true;
    }
  });
  expect(
    external,
    `no request may leave the Watchbug origin — destinations seen: ${destinations.join(', ')}`,
  ).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* S-8 — the report destination is never guessed                       */
/* ------------------------------------------------------------------ */

/**
 * The default endpoint is the DOCUMENT's origin. A bundle served from another
 * origin (a CDN) cannot supply that default: guessing the script's own origin
 * would post captures to a third party, and guessing the document's origin
 * would silently file reports somewhere the integrator never chose. So
 * `init()` refuses and asks for `endpoint` explicitly (S-8 / WR-02).
 */
test('S-8: a cross-origin loading script refuses to init without an explicit endpoint — the report destination is never guessed', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);

  // Every request the page makes, so the refusal can be shown to send nothing
  // and the explicit endpoint can be shown to be the one that is used.
  const destinations: string[] = [];
  page.on('request', (request) => destinations.push(request.url()));

  await openHostFixture(page, {
    bundle: 'watchbug.e2e.js',
    mode: 'iife',
    // The document stays at FIXTURE_ORIGIN while the bundle is served from a
    // DIFFERENT origin — the CDN delivery shape. `page.route` fulfils it, so no
    // real second server is involved.
    scriptOrigin: 'http://localhost:8080',
    autoInit: false,
  });

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  // The bundle booted (the IIFE global exists) but nothing is mounted.
  await page.waitForFunction(
    () => (window as unknown as { Watchbug?: unknown }).Watchbug !== undefined,
    null,
    { timeout: 10_000 },
  );

  const key = projectKey();
  const refusal = await page.evaluate((projectKey) => {
    try {
      (window as unknown as { Watchbug: { init: (o: { projectKey: string }) => void } }).Watchbug.init({
        projectKey,
      });
      return 'no-throw';
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, key);
  expect(refusal, 'init() must refuse rather than default the endpoint to the script origin').toContain(
    'pass `endpoint` explicitly',
  );
  expect(await page.locator('watchbug-host').count(), 'nothing may mount on a refused init').toBe(0);
  await expectNoRequest(page, calls);

  // FX-03: `endpoint: null` (the shape a JSON config produces) is a hard
  // error, NOT "absent". Treated as absent it would slip past the refusal
  // above and silently fall back to the document origin.
  const nullEndpoint = await page.evaluate((projectKey) => {
    try {
      (window as unknown as { Watchbug: { init: (o: Record<string, unknown>) => void } }).Watchbug.init({
        projectKey,
        endpoint: null,
      });
      return 'no-throw';
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, key);
  expect(nullEndpoint, 'endpoint: null must be a hard error (FX-03)').toContain(
    'must be an absolute http(s) URL',
  );
  expect(await page.locator('watchbug-host').count(), 'endpoint: null must not mount').toBe(0);

  // With the destination stated explicitly the very same bundle mounts and
  // files a real report — the refusal is about GUESSING, not about the bundle.
  await page.evaluate(
    (projectKey) => {
      (window as unknown as {
        Watchbug: { init: (o: { projectKey: string; endpoint: string }) => void };
      }).Watchbug.init({ projectKey, endpoint: 'http://127.0.0.1:8080' });
    },
    key,
  );
  await waitForWidget(page);
  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);

  expect(calls, 'the explicit endpoint is honoured').toHaveLength(1);
  expect(
    destinations,
    'the report must go to the explicitly configured API base',
  ).toContain('http://127.0.0.1:8080/api/incidents');
  expect(
    destinations,
    'the report must never be posted to the loading script origin',
  ).not.toContain('http://localhost:8080/api/incidents');
});

/* ------------------------------------------------------------------------- */
/* Composition rows — 03-03 (PRV-07, P3-D-02/03/04, WDG-06)                    */
/* ------------------------------------------------------------------------- */

test('PRV-07: review shows the flattened artifact and Send posts it exactly once', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);
  await page.evaluate(() => {
    document.title = 'PRV-07 flattened artifact';
  });

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  // One gesture now lands in the COMPOSER with the image, not on the wire.
  await clickLauncher(page);
  await waitForComposer(page);
  const composing = await probeWidget(page);
  expect(composing.screen).toBe('composer');
  expect(composing.composerOpen).toBe(true);
  expect(composing.composerState).toBe('image');
  expect(composing.composerTitle).toBe('PRV-07 flattened artifact');

  // Review entry encodes once and shows the decoded outgoing artifact.
  await clickComposerReview(page);
  await waitForReview(page);
  const reviewed = await probeWidget(page);
  expect(reviewed.reviewOpen).toBe(true);
  expect(reviewed.screen).toBe('review');
  expect(reviewed.reviewImageWidth, 'the review canvas is the encoded artifact').toBeGreaterThan(0);
  expect(reviewed.reviewImageHeight).toBeGreaterThan(0);
  expect(reviewed.reviewTitle).toBe('PRV-07 flattened artifact');
  expect(reviewed.reviewType.toLowerCase()).toBe('bug');

  // Edit report returns to the composer with the draft intact (lossless).
  await clickReviewEdit(page);
  await waitForComposer(page);
  const edited = await probeWidget(page);
  expect(edited.composerOpen).toBe(true);
  expect(edited.composerTitle).toBe('PRV-07 flattened artifact');
  expect(edited.composerState).toBe('image');

  // Back to review, then send exactly once — the reviewed bytes are the sent
  // bytes (T-03-17: no re-encode at send, the intercepted part decodes).
  await clickComposerReview(page);
  await waitForReview(page);
  await clickReviewSend(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
  expect(calls, 'the composer walk posts exactly one report').toHaveLength(1);

  const meta = interceptedMeta(calls[0]);
  expect(meta.type).toBe('bug');
  expect(meta.title).toBe('PRV-07 flattened artifact');
  const image = await readOutgoingImage(page);
  const analysis = await analyzeImagePixels(page, image);
  expect(analysis.width, 'the sent image part decodes').toBeGreaterThan(0);
  expect(analysis.height).toBeGreaterThan(0);
});

test('P3-D-02: the title prefills from document.title truncated to 200 code points; empty blocks review', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  // 300 code points = 500 UTF-16 units: the prefill must count CODE POINTS
  // (the Zod `.max(MAX_TITLE_CHARS)` semantics the server validates against),
  // and `maxlength` — which counts units — is deliberately absent (Pitfall 13).
  const longTitle = `${'A'.repeat(100)}${'\u{1F600}'.repeat(200)}`;
  expect([...longTitle].length).toBe(300);
  await page.evaluate((title) => {
    document.title = title;
  }, longTitle);

  await clickLauncher(page);
  await waitForComposer(page);

  const composing = await probeWidget(page);
  const expectedPrefill = [...longTitle].slice(0, MAX_TITLE_CHARS).join('');
  expect([...composing.composerTitle].length, 'prefill is exactly 200 code points').toBe(
    MAX_TITLE_CHARS,
  );
  expect(composing.composerTitle).toBe(expectedPrefill);

  // Emptying the field blocks the navigate to review — inline error, not a move.
  await setTitle(page, '   ');
  await clickComposerReview(page);
  await page.waitForTimeout(300);
  const blocked = await probeWidget(page);
  expect(blocked.screen, 'review did not open on an empty title').toBe('composer');
  expect(blocked.composerError).toBe('Add a title to continue.');
  expect(blocked.composerTitleAriaInvalid).toBe('true');
  expect(blocked.titleFocused, 'focus stays in the title field when blocked').toBe(true);

  // Typing a title unblocks — same click now walks into review.
  await setTitle(page, 'P3-D-02 recovered title');
  await clickComposerReview(page);
  await waitForReview(page);
  const recovered = await probeWidget(page);
  expect(recovered.reviewTitle).toBe('P3-D-02 recovered title');
});

test('P3-D-03: the segmented control defaults to bug, switches the heading, and reaches the wire', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);
  await page.evaluate(() => {
    document.title = 'P3-D-03 segmented report';
  });

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForComposer(page);
  const initial = await probeWidget(page);
  expect(initial.composerType, 'the default segment is bug').toBe('bug');
  expect(initial.composerHeading).toBe('Report a bug');

  await setType(page, 'feedback');
  const switched = await probeWidget(page);
  expect(switched.composerType).toBe('feedback');
  expect(switched.composerHeading, 'the heading follows the segment').toBe('Send feedback');

  await reviewAndSend(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
  expect(calls).toHaveLength(1);
  const meta = interceptedMeta(calls[0]);
  expect(meta.type, 'the selected segment value reaches the wire').toBe('feedback');
  expect(meta.title).toBe('P3-D-03 segmented report');
});

test('P3-D-04: the composer is a wide overlay replacing the 320 px panel; Escape returns to idle', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForComposer(page);
  const composing = await probeWidget(page);
  expect(
    composing.composerWidth,
    'the composition surface is wider than the 320 px status panel',
  ).toBeGreaterThan(320);
  expect(composing.panelHidden, 'the panel reports hidden while composing').toBe('true');
  expect(composing.launcherDisabled, 'the launcher is disabled while the overlay is open').toBe(
    true,
  );

  // Escape (and the discard button) drops the draft with no confirmation and
  // re-arms the launcher (UI-SPEC A-4/A-7, P3-D-04).
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      return root?.querySelector('.wrap')?.getAttribute('data-wb-screen') === 'idle';
    },
    null,
    { timeout: 5_000 },
  );
  const idle = await probeWidget(page);
  expect(idle.screen).toBe('idle');
  expect(idle.composerOpen).toBe(false);
  expect(idle.launcherDisabled, 'the launcher is re-enabled after Escape').toBe(false);
  await page.waitForTimeout(400);
  expect(calls, 'Escape discards the draft; nothing was sent').toHaveLength(0);
});

test('P3-D-02 note counter: hidden at 3,999 code points and visible at 4,000', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  await clickLauncher(page);
  await waitForComposer(page);

  await setNote(page, 'a'.repeat(3999));
  const below = await probeWidget(page);
  expect(below.composerCounterShown, 'the counter stays hidden below 4,000').toBe(false);

  await setNote(page, 'a'.repeat(4000));
  const at = await probeWidget(page);
  expect(at.composerCounterShown, 'the counter surfaces at exactly 4,000').toBe(true);
  expect(at.composerCounter).toBe('4000 / 5000');
});

test.describe('WDG-06 es', () => {
  test.use({ locale: 'es-ES' });

  test('WDG-06 es: the whole core surface renders Spanish copy with lang="es"', async ({
    page,
    browserName,
  }) => {
    await installCaptureStub(page, browserName);
    await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
    await waitForWidget(page);
    // The transient `Enviando…` headline is short-lived: record every render.
    await collectHeadlines(page);

    const base = await page.evaluate(() => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      const launcher = root?.querySelector('button.launcher') as HTMLElement | null;
      return {
        lang: root?.querySelector('.wrap')?.getAttribute('lang') ?? null,
        launcherLabel: launcher?.getAttribute('aria-label') ?? '',
      };
    });
    expect(base.lang, 'navigator.language es-ES resolves the Spanish dictionary').toBe('es');
    expect(base.launcherLabel).toBe('Reportar un error');

    const calls = await interceptIncidentPosts(page, async () => ({
      status: 201,
      body: JSON.stringify({ id: INTERCEPTED_ID }),
    }));

    await clickLauncher(page);
    await waitForComposer(page);
    const composing = await probeWidget(page);
    expect(composing.composerHeading).toBe('Reportar un error');
    expect(composing.wrapLang).toBe('es');

    await clickComposerReview(page);
    await waitForReview(page);
    const reviewed = await page.evaluate(() => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      return {
        heading: root?.querySelector('.review-heading')?.textContent ?? '',
        send: root?.querySelector('button.review-send')?.textContent ?? '',
        edit: root?.querySelector('button.review-edit')?.textContent ?? '',
        typeValue: root?.querySelector('[data-wb-summary="type"] .summary-value')?.textContent ?? '',
      };
    });
    expect(reviewed.heading, 'the review heading renders in Spanish').toBe('Listo para enviar');
    expect(reviewed.send).toBe('Enviar informe');
    expect(reviewed.edit).toBe('Editar informe');
    expect(reviewed.typeValue).toBe('Error');

    await clickReviewSend(page);
    await waitForHeadline(page, 'Informe enviado ✓', 15_000);
    const headlines = await readHeadlines(page);
    expect(headlines, 'the in-flight Sending headline renders in Spanish').toContain('Enviando…');
    expect(headlines).toContain('Capturando…');
    expect(calls).toHaveLength(1);
    const after = await probeWidget(page);
    expect(after.wrapLang).toBe('es');
  });
});

test('WDG-06 override: the composer EN/ES pair switches copy and lang in both directions without host storage', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  await clickLauncher(page);
  await waitForComposer(page);
  const en = await probeWidget(page);
  expect(en.composerHeading).toBe('Report a bug');
  expect(en.wrapLang).toBe('en');

  // ES switch: every visible string and the declared language move together.
  await setLocaleToggle(page, 'es');
  const es = await probeWidget(page);
  expect(es.composerHeading).toBe('Reportar un error');
  expect(es.wrapLang).toBe('es');
  expect(es.composerTitle, 'the draft state survives the locale re-render').toBe(en.composerTitle);

  // The override is session-scoped in memory (SEC-03 / T-03-16): the static
  // `sdk-no-host-storage` gate is the structural proof; the zero reads here
  // are the behavioural one on the running bundle.
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage).length,
    session: Object.keys(sessionStorage).length,
  }));
  expect(storage, 'the locale override never touches host storage').toEqual({
    local: 0,
    session: 0,
  });

  // EN switch back within the same session.
  await setLocaleToggle(page, 'en');
  const back = await probeWidget(page);
  expect(back.composerHeading, 'the pair switches in both directions').toBe('Report a bug');
  expect(back.wrapLang).toBe('en');
});

/* ------------------------------------------------------------------ */
/* CAP-02 — attach a picture from the device (03-04, file lane)         */
/* CAP-03 — the degraded composer with two real ways forward (03-04)    */
/* ------------------------------------------------------------------ */

const repoRoot = resolve(__dirname, '..');
const png64 = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'));
const webp64 = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.webp'));
const oversizeJpeg = readFileSync(resolve(repoRoot, 'e2e/fixtures/oversize-64mp.jpg'));
const polyglotGif = readFileSync(resolve(repoRoot, 'e2e/fixtures/polyglot-gif-html.gif'));
const hostileSvg = readFileSync(resolve(repoRoot, 'e2e/fixtures/hostile.svg'));

/** The locked attach-refusal copy (strings.ts — composer.attach.error + hint). */
const ATTACH_ERROR_COPY = "That file can't be attached.";
const ATTACH_HINT_COPY = 'Use a PNG, WebP or JPEG image under 16 MP.';

/**
 * The two container magics a re-encoded outgoing part can carry (R-11/M-3):
 * PNG's signature and `RIFF`+`WEBP`. The picked container never survives the
 * single encode sink — an attached JPEG leaves as WebP or PNG.
 */
function wireContainer(bytes: Buffer): 'png' | 'webp' | 'jpeg' | 'unknown' {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  return 'unknown';
}

test('CAP-02 attach: a picked PNG reaches the preview, the review and the wire', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);
  await page.evaluate(() => {
    document.title = 'CAP-02 attached picture report';
  });

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  // The gesture captures as usual, so the composer opens holding the STUB
  // frame — the attachment must REPLACE it, and the preview dimensions tell
  // the two apart (640-wide frame vs 64-wide picture).
  await clickLauncher(page);
  await waitForComposer(page);
  await expectZoneState(page, 'image');
  const captured = await probeWidget(page);
  expect(captured.composerPreviewWidth, 'the composer first shows the captured frame').toBe(
    640,
  );

  // The real affordance walk on chromium: the visible `Attach image` button
  // opens the hidden picker, and the file chooser receives the fixture bytes.
  // Other engines set the input directly (same change-handler path).
  if (browserName === 'chromium') {
    const chooserPromise = page.waitForEvent('filechooser');
    await clickVisibleAttach(page);
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: 'valid-64x64.png', mimeType: 'image/png', buffer: png64 });
  } else {
    await attachImage(page, { name: 'valid-64x64.png', mimeType: 'image/png', buffer: png64 });
  }
  await expectZoneState(page, 'image');

  // The preview canvas is redrawn from the attachment's pixels (CAP-02).
  const attached = await probeWidget(page);
  expect(attached.composerPreviewWidth, 'the preview is the attached picture').toBe(64);
  expect(attached.composerPreviewHeight).toBe(64);
  expect(attached.composerAttachError, 'a valid attachment shows no refusal').toBe('');

  // Review encodes the attachment through the single sink; Send posts once.
  await clickComposerReview(page);
  await waitForReview(page);
  const reviewed = await probeWidget(page);
  expect(reviewed.reviewImageWidth, 'the review shows a real encoded artifact').toBeGreaterThan(0);
  expect(reviewed.reviewImageHeight).toBeGreaterThan(0);

  await clickReviewSend(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
  expect(calls, 'the attach walk posts exactly one report').toHaveLength(1);

  // P3-D-15 / A-05: the attachment joins the same flow, so its outgoing bytes
  // are the SINK's output — WebP or PNG, never the picked container. The
  // fetch-boundary read is engine-truthful (WebKit drops blob parts from
  // postDataBuffer, deviation 2), and the decode proves the picture survived
  // review: 64×64 and non-blank (the fixture's two-tone square).
  const image = await readOutgoingImage(page);
  expect(
    wireContainer(image),
    'the single encode sink re-encodes every attachment',
  ).toMatch(/^webp|png$/);
  const analysis = await analyzeImagePixels(page, image);
  expect(analysis.width, 'the attached picture decodes at its own dimensions').toBe(64);
  expect(analysis.height).toBe(64);
  expect(analysis.sampledDistinct, 'the attachment is never blanked on the way').toBeGreaterThan(1);
});

test('CAP-02 attach: WebP and JPEG are accepted', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);
  await page.evaluate(() => {
    document.title = 'CAP-02 two containers report';
  });

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForComposer(page);
  await expectZoneState(page, 'image');

  // WebP — the committed fixture.
  await attachImage(page, { name: 'valid-64x64.webp', mimeType: 'image/webp', buffer: webp64 });
  const afterWebp = await probeWidget(page);
  expect(afterWebp.composerPreviewWidth, 'the WebP attachment reaches the preview').toBe(64);
  expect(afterWebp.composerPreviewHeight).toBe(64);
  expect(afterWebp.composerAttachError).toBe('');

  // JPEG — built IN-PAGE (03-02's fixture is same-wave at plan authoring; and
  // JPEG is the one container every engine's canvas encoder produces, unlike
  // WebP). Where an engine cannot encode JPEG from a canvas its silent PNG
  // fallback rides in as PNG bytes — a different container, same acceptance
  // duty; chromium's assertion below proves the JPEG arm really was fed.
  const jpegPayload = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('no 2D canvas for the JPEG payload');
    const gradient = context.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, '#16233a');
    gradient.addColorStop(1, '#c9a227');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = '#1e7a46';
    context.fillRect(4, 4, 24, 24);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });
    if (blob === null) throw new Error('the engine produced no JPEG payload');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let at = 0; at < bytes.length; at += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    }
    return { base64: btoa(binary), type: blob.type };
  });
  if (browserName === 'chromium') {
    expect(jpegPayload.type, 'chromium really encoded a JPEG to attach').toBe('image/jpeg');
  }
  const jpegBytes = Buffer.from(jpegPayload.base64, 'base64');
  await attachImage(page, { name: 'device-photo.jpg', mimeType: 'image/jpeg', buffer: jpegBytes });
  const afterJpeg = await probeWidget(page);
  expect(afterJpeg.composerPreviewWidth, 'the JPEG attachment replaces the WebP preview').toBe(64);
  expect(afterJpeg.composerAttachError, 'an accepted format clears the refusal').toBe('');

  // Review + send — the outgoing part is the sink's output, never JPEG.
  await clickComposerReview(page);
  await waitForReview(page);
  await clickReviewSend(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
  expect(calls, 'the two-attach walk posts exactly one report').toHaveLength(1);

  const image = await readOutgoingImage(page);
  expect(
    wireContainer(image),
    'a picked JPEG leaves as WebP or PNG — the single encode sink is the only producer',
  ).toMatch(/^webp|png$/);
  const analysis = await analyzeImagePixels(page, image);
  expect(analysis.width, 'the second attachment is the one that sent').toBe(64);
  expect(analysis.height).toBe(64);
  expect(analysis.sampledDistinct).toBeGreaterThan(1);
});

test('CAP-02 reject: a non-image is refused with the inline error and no request', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForComposer(page);
  await expectZoneState(page, 'image');
  const before = await probeWidget(page);

  // The picker's `accept` is decoration: a declared MIME type or extension is
  // untrusted, so every one of these is refused on its magic bytes (V12).
  const refusals: Array<{ name: string; mimeType: string; buffer: Buffer }> = [
    {
      name: 'payload.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<!doctype html><html><body>polite hello</body></html>', 'utf8'),
    },
    { name: 'hostile.svg', mimeType: 'image/svg+xml', buffer: hostileSvg },
    { name: 'polyglot.gif', mimeType: 'image/gif', buffer: polyglotGif },
  ];
  for (const payload of refusals) {
    await attachImage(page, payload);
    const refused = await probeWidget(page);
    expect(refused.composerAttachError, `${payload.name}: visible refusal copy`).toBe(
      ATTACH_ERROR_COPY,
    );
    expect(refused.composerAttachErrorHint, `${payload.name}: solution hint`).toBe(
      ATTACH_HINT_COPY,
    );
    // The draft survives the refusal untouched: still the captured frame.
    expect(refused.composerState, `${payload.name}: previous state preserved`).toBe('image');
    expect(refused.composerPreviewWidth).toBe(before.composerPreviewWidth);
    expect(refused.composerPreviewHeight).toBe(before.composerPreviewHeight);
    // The attach action is re-enabled for another try.
    expect(refused.composerAttachVisible, `${payload.name}: attach re-enabled`).toBe(true);
  }
  await expectNoRequest(page, calls);
});

test('CAP-02 reject: an oversized-pixel file is refused', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForComposer(page);
  await expectZoneState(page, 'image');
  const before = await probeWidget(page);

  // The committed 8000×8192-declared JPEG (65.5 MP, over MAX_IMAGE_PIXELS):
  // whichever gate answers — the decoded-bitmap size check, or an engine that
  // refuses the inconsistent scan outright — the file is refused BEFORE a
  // working canvas is allocated, which is the contract (T-03-18).
  await attachImage(page, {
    name: 'oversize.jpg',
    mimeType: 'image/jpeg',
    buffer: oversizeJpeg,
  });
  const refused = await probeWidget(page);
  expect(refused.composerAttachError, 'over-cap dimensions are the same visible refusal').toBe(
    ATTACH_ERROR_COPY,
  );
  expect(refused.composerAttachErrorHint).toBe(ATTACH_HINT_COPY);
  expect(refused.composerState, 'the previous frame is preserved').toBe('image');
  expect(refused.composerPreviewWidth).toBe(before.composerPreviewWidth);
  expect(refused.composerPreviewHeight).toBe(before.composerPreviewHeight);
  await expectNoRequest(page, calls);
});

test('CAP-03: a denied capture opens the degraded composer with both actions and files text-only', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName, { failure: 'prompt-rejected' });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);
  await page.evaluate(() => {
    document.title = 'CAP-03 text-only report';
  });

  // Real compose stack (the plan's chosen proof): inspect the outgoing
  // request, then let the ENGINE send it untouched — the 201 comes from
  // Fastify's imageless branch, not from a mock (03-01's lane).
  const posts: Buffer[] = [];
  await page.route(INCIDENT_POST_RE, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    posts.push(route.request().postDataBuffer() ?? Buffer.alloc(0));
    await route.continue();
  });

  await clickLauncher(page);
  await expectZoneState(page, 'degraded');
  const degraded = await probeWidget(page);
  expect(degraded.composerNoticeHeading).toBe('Capture unavailable');
  expect(degraded.composerNoticeHint).toBe(CAPTURE_HINT);
  expect(degraded.composerAttachVisible).toBe(true);
  expect(degraded.composerContinueVisible).toBe(true);

  // Nothing posts while the diagnosis sits on screen (T-03-01): give a
  // would-be request time to land before counting.
  await page.waitForTimeout(600);
  expect(posts, 'zero POST /api/incidents before the user chooses').toHaveLength(0);

  await clickContinueTextOnly(page);
  await expectZoneState(page, 'text-only');
  const textOnly = await probeWidget(page);
  expect(textOnly.composerZoneVisible, 'the image zone is hidden').toBe(false);
  expect(textOnly.composerAttachVisible, 'the footer keeps Attach image').toBe(true);

  // The prefilled title (document.title) is a real draft title — review now.
  await clickComposerReview(page);
  await waitForReview(page);
  const reviewed = await probeWidget(page);
  expect(reviewed.reviewOpen).toBe(true);
  expect(reviewed.reviewNoImage, 'review shows the No image line (UI-SPEC A-3)').toBe('No image');
  expect(reviewed.reviewTitle).toBe('CAP-03 text-only report');
  expect(reviewed.reviewImageWidth, 'a text-only review displays no canvas').toBe(0);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/incidents') && response.request().method() === 'POST',
  );
  await clickReviewSend(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
  const response = await responsePromise;
  expect(response.status(), 'the meta-only body files a REAL 201').toBe(201);

  expect(posts, 'exactly one request').toHaveLength(1);
  const body = posts[0].toString('utf8');
  expect(body).toContain('name="meta"');
  expect(body, 'a text-only body carries NO image part').not.toContain('name="image"');
  const metaPart = multipartPart(posts[0], 'meta');
  expect(metaPart).not.toBeNull();
  const meta = JSON.parse(metaPart!.toString('utf8')) as Record<string, unknown>;
  expect(meta.type).toBe('bug');
  expect(meta.title).toBe('CAP-03 text-only report');
});

test('CAP-03 no-API: a browser without getDisplayMedia can still file text-only feedback', async ({
  page,
  browserName,
}) => {
  // iOS Safari shape: the navigator carries no mediaDevices at all — the
  // capture classification distinguishes `no-api` from a prompt denial, but
  // the composer exit is the same two real choices (P3-D-13, CAP-03).
  await installCaptureStub(page, browserName, { failure: 'no-display-media' });
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);
  await page.evaluate(() => {
    document.title = 'CAP-03 no-API feedback';
  });

  const posts: Buffer[] = [];
  await page.route(INCIDENT_POST_RE, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    posts.push(route.request().postDataBuffer() ?? Buffer.alloc(0));
    await route.continue();
  });

  await clickLauncher(page);
  await expectZoneState(page, 'degraded');

  // Non-vacuity: the provocation ran — the browser really has no capture API
  // in this context, it is not a stubbed denial.
  expect(await page.locator('html').getAttribute('data-wb-stub-invoked')).toBe(
    'no-display-media',
  );
  const degraded = await probeWidget(page);
  expect(degraded.composerNoticeHint, 'the no-api diagnosis keeps the capture-failed hint').toBe(
    CAPTURE_HINT,
  );
  await page.waitForTimeout(600);
  expect(posts, 'nothing posts from the degraded state').toHaveLength(0);

  await clickContinueTextOnly(page);
  await expectZoneState(page, 'text-only');
  await clickComposerReview(page);
  await waitForReview(page);
  const reviewed = await probeWidget(page);
  expect(reviewed.reviewNoImage).toBe('No image');

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/incidents') && response.request().method() === 'POST',
  );
  await clickReviewSend(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
  const response = await responsePromise;
  expect(response.status(), 'text-only feedback files a REAL 201 without any capture API').toBe(
    201,
  );
  expect(posts).toHaveLength(1);
  expect(posts[0].toString('utf8'), 'meta-only multipart body').not.toContain('name="image"');
});


/* ------------------------------------------------------------------------- */
/* Annotation editor rows — 03-05 (ANN-01, PRF-02 lazy, T-03-21 recovery)     */
/* ------------------------------------------------------------------------- */

/**
 * The lazy chunk's route — ONE shared RegExp (S-10): `page.unroute` matches by
 * source+flags, so an inline duplicate would leak the mock into the next row.
 */
const ANNOTATOR_CHUNK_ROUTE = /\/__e2e\/bundles\/watchbug-annotator\.mjs(\?retry=\d+)?$/;

test('ANN-01: freehand ink follows the drag path', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const calls = await interceptIncidentPosts(page, async () => ({
    status: 201,
    body: JSON.stringify({ id: INTERCEPTED_ID }),
  }));

  await clickLauncher(page);
  await waitForComposer(page);

  // The whole path at once: Annotate -> chunk fetch -> editor in the SAME
  // shadow root -> one freehand drag -> Done -> the ink in the decoded
  // outgoing image.
  await openEditor(page);
  const opened = await probeWidget(page);
  expect(opened.screen).toBe('editor');
  expect(opened.editorOpen).toBe(true);
  expect(opened.activeTool, 'the default tool on open is freehand (P3-D-06)').toBe('freehand');
  expect(
    opened.editorCanvasWidth,
    'the editor canvas carries the draft bitmap itself',
  ).toBe(opened.composerPreviewWidth);
  expect(opened.editorCanvasHeight).toBe(opened.composerPreviewHeight);
  const styleCount = await page.evaluate(
    () =>
      document.querySelector('watchbug-host')?.shadowRoot?.querySelectorAll('style').length ?? 0,
  );
  expect(
    styleCount,
    'EDITOR_CSS lands on the core style element — one stylesheet, never adoptedStyleSheets (T-03-22)',
  ).toBe(1);

  // One diagonal drag across the frame, in BITMAP coordinates.
  const from: BitmapPoint = [100, 260];
  const to: BitmapPoint = [540, 60];
  await dragOnBitmap(page, from, to);
  await done(page);

  const back = await probeWidget(page);
  expect(back.screen, 'Done returns to the composer').toBe('composer');
  expect(back.editorOpen, 'the editor unmounts on Done').toBe(false);
  const previewInk = await page.evaluate(() => {
    const canvas = document
      .querySelector('watchbug-host')
      ?.shadowRoot?.querySelector('canvas.composer-preview') as HTMLCanvasElement | null;
    if (canvas === null) return -1;
    const context = canvas.getContext('2d');
    if (context === null) return -2;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let at = 0; at < data.length; at += 4) {
      const dr = data[at] - 0x2f;
      const dg = data[at + 1] - 0x6f;
      const db = data[at + 2] - 0xeb;
      if (dr * dr + dg * dg + db * db <= 14400) count += 1;
    }
    return count;
  });
  expect(
    previewInk,
    'the preview redraws from the buffer the editor returned — the flattened ink is IN the draft (C-2)',
  ).toBeGreaterThan(0);

  await reviewAndSend(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
  expect(calls, 'one annotated report leaves the browser exactly once').toHaveLength(1);

  const image = await readOutgoingImage(page);
  const ink = await analyzeInk(page, image, {
    bands: [{ from, to, halfWidth: 4 }],
    // A sampled region far from the path over the navy side of the gradient:
    // no palette block inside, and d² > 14400 from every frame colour there,
    // so ANY ink-family pixel in it could only come from a bleed.
    boxes: [{ left: 40, top: 40, right: 120, bottom: 120 }],
  });
  expect(
    ink.bands[0],
    'accent ink (squared distance to #2f6feb) exists along the drag path',
  ).toBeGreaterThanOrEqual(50);
  expect(ink.boxes[0], 'a sampled region far from the path carries no ink').toBe(0);
});

test('PRF-02 lazy: the annotator chunk is fetched only on Annotate, exactly once, and adds no global', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const chunkRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/__e2e/bundles/watchbug-annotator')) chunkRequests.push(url);
  });

  await clickLauncher(page);
  await waitForComposer(page);
  expect(
    chunkRequests,
    'zero requests for the annotator chunk while the composer is open (PRF-02, UI-SPEC A-2)',
  ).toHaveLength(0);

  const before = await snapshotGlobals(page);
  await openEditor(page);
  expect(chunkRequests, 'exactly one fetch after Annotate image').toHaveLength(1);
  expect(
    chunkRequests[0],
    'the shipped lazy artifact is the .mjs twin (OQ-5)',
  ).toMatch(/watchbug-annotator\.mjs$/);
  const after = await snapshotGlobals(page);
  expect(addedNames(after.w, before.w), 'the chunk load adds no global (INV-02)').toEqual([]);
  expect(after.p, 'and patches no native prototype').toEqual(before.p);

  // Re-entrancy: close and reopen — the memoised module is reused, so the
  // request count stays exactly one.
  await done(page);
  await openEditor(page);
  expect(chunkRequests, 'reopening reuses the memoised module (no second fetch)').toHaveLength(1);
  await done(page);
});

test('PRF-02 lazy: the fetch shows the loading state, and a failed load re-enables the button with the inline error — a retry then opens the editor', async ({
  page,
  browserName,
}) => {
  await installCaptureStub(page, browserName);
  await openHostFixture(page, { bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  // Fail the FIRST fetch (with a delay that makes the loading state
  // observably visible); serve the retry from dist so the recovery walk is
  // real, not a re-404 (T-03-21: never a dead button).
  let firstAttempt = true;
  await page.route(ANNOTATOR_CHUNK_ROUTE, async (route) => {
    if (firstAttempt) {
      firstAttempt = false;
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: readFileSync(resolve(repoRoot, 'packages/sdk/dist/watchbug-annotator.mjs')),
    });
  });

  await clickLauncher(page);
  await waitForComposer(page);

  await page.evaluate(() => {
    const button = document
      .querySelector('watchbug-host')
      ?.shadowRoot?.querySelector('button.composer-annotate') as HTMLButtonElement;
    button.click();
  });
  const loading = await probeWidget(page);
  expect(
    loading.editorLoading,
    '12 px spinner + editor.loading on the disabled button while the chunk fetches',
  ).toBe(true);
  expect(loading.annotateDisabled, 'the button is disabled mid-fetch').toBe(true);

  await page.waitForFunction(
    () => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      return (
        root?.querySelector('span.field-error[data-wb-error="editor"][data-shown="true"]') !==
        null
      );
    },
    null,
    { timeout: 10_000 },
  );
  const failed = await probeWidget(page);
  expect(failed.editorError, 'the locked load-error copy renders inline (OQ-4)').toBe(
    "Couldn't load the editor.",
  );
  expect(failed.editorLoading, 'the loading state ends on failure').toBe(false);
  expect(failed.annotateDisabled, 'never a dead button — the action re-enables (T-03-21)').toBe(
    false,
  );
  expect(failed.editorOpen, 'no editor mounted from a failed fetch').toBe(false);
  const hintText = await page.evaluate(
    () =>
      document
        .querySelector('watchbug-host')
        ?.shadowRoot?.querySelector(
          'span.field-error[data-wb-error="editor-hint"][data-shown="true"]',
        )
        ?.textContent ?? '',
  );
  expect(hintText, 'with the solution hint beside it').toBe(
    'Nothing was changed. Check your connection, then try again.',
  );

  // The retry: the memoised rejection was cleared, and the editor opens.
  await openEditor(page);
  const opened = await probeWidget(page);
  expect(opened.editorOpen, 'a retry after a failed load succeeds (retryable memo)').toBe(true);
  expect(opened.editorError).toBe('');
});
