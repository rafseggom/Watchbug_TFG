import { expect, test } from '@playwright/test';
import {
  addedNames,
  openHostFixture,
  readSnapshot,
  waitForSnapshot,
} from './helpers/host-fixtures';

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
