import { expect, test } from '@playwright/test';
import { openHostileFixture } from '../../e2e/helpers/host-fixtures';
import { waitForWidget } from '../../e2e/helpers/capture-stubs';

/**
 * J-14 (WDG-02/03/05, CA-04) — the hostile-CSS widget surface.
 *
 * This is the flagship VRT subject because for this journey **appearance *is*
 * the regression**: CA-04's promise is that a host page shipping `!important`
 * rules cannot move, shrink, hide or re-stack the widget. The functional rows
 * in `e2e/hostile.spec.ts` assert the computed geometry; this baseline asserts
 * the pixels — a green geometry probe plus a visually broken control is
 * exactly the class of failure a property assertion cannot see.
 *
 * Two variants are captured, not one:
 *   `display` — the host forces `display: none` on everything it can reach
 *   `zindex`  — the host stacks a high-z-index element over the corner
 *
 * The bug glyph inside the 48x48 control is expected to be identical in both
 * baselines — hostile CSS does not reach inside the shadow boundary — while the
 * 8 px margin is *not*: the `zindex` overlay is visible around the control,
 * which is precisely the proof that the widget composites **above** hostile
 * content instead of being buried by it. A diff confined to the margin is the
 * hostile page changing; a diff inside the control is isolation breaking.
 *
 * The clip is the launcher's 48x48 control plus an 8 px margin, in the
 * 1280x720 viewport pinned by `playwright.vrt.config.ts`. Nothing else of the
 * host page is in frame, so the baseline carries no host typography — that is
 * what makes it portable across platforms (see the config's note on
 * `{platform}`).
 */

const LAUNCHER_CLIP = { x: 1200, y: 640, width: 64, height: 64 };

/**
 * Two rAFs: the loader inserts the host element, then the launcher mounts
 * inside its shadow root. `waitForWidget` resolves on the host element, which
 * can be one frame ahead of the painted control. Waiting for a paint boundary
 * is what keeps this baseline deterministic without a sleep.
 */
async function settle(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }),
  );
}

for (const variant of ['display', 'zindex'] as const) {
  test(`J-14 hostile-CSS launcher surface — ${variant} variant`, async ({ page }) => {
    await openHostileFixture(page, {
      variant,
      // The production IIFE bundle: this is the artifact a host actually
      // loads, so the baseline covers the shipped control and not a test build.
      bundle: 'watchbug.js',
      mode: 'iife',
    });
    await waitForWidget(page);
    await settle(page);

    await expect(page).toHaveScreenshot(`launcher-${variant}.png`, { clip: LAUNCHER_CLIP });
  });
}
