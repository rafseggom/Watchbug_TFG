import { expect, test, type Page } from '@playwright/test';
import {
  addedNames,
  FIXTURE_ORIGIN,
  openHostFixture,
  projectKey,
  readSnapshot,
  waitForSnapshot,
} from './helpers/host-fixtures';
import {
  clickLauncher,
  collectHeadlines,
  installCaptureStub,
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
    const call: PostCall = {
      headers: request.headers(),
      body: (request.postDataBuffer() ?? Buffer.alloc(0)).toString('utf8'),
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
  let responseStatus = 0;
  let responseBody = '';

  // Real compose stack: inspect the outgoing request, then let it through with
  // `route.fetch()` — the 201 comes from Fastify, not from this test.
  await page.route(INCIDENT_POST_RE, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const request = route.request();
    captured = {
      headers: request.headers(),
      body: (request.postDataBuffer() ?? Buffer.alloc(0)).toString('utf8'),
    };
    const response = await route.fetch();
    responseStatus = response.status();
    responseBody = await response.text();
    await route.fulfill({ response });
  });

  await clickLauncher(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);

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
