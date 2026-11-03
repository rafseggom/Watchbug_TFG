import { defineConfig, devices } from '@playwright/test';

/**
 * R-19 type 4 — visual regression (VRT). A **separate** Playwright config on
 * purpose.
 *
 * `npm run verify` is the functional CA-01..CA-05 suite (R-12's contract
 * half). Appearance is a different question with a different failure mode: a
 * one-pixel antialiasing drift is a real VRT signal, but it must never turn a
 * functional run red by accident, and a functional failure must never be
 * mistaken for a broken baseline. So VRT keeps its own config, its own
 * command (`npm run test:vrt`) and its own baselines. `npm run test:all` runs
 * both, so the full matrix still covers appearance.
 *
 * Baselines are committed under `tests/vrt/__screenshots__/<project>/`.
 * `snapshotPathTemplate` **omits `{platform}` deliberately**: a baseline that
 * only matches the machine that minted it is a false gate that either
 * rots silently or forces a re-baseline on every OS. That is only honest
 * because the captured surface is text-free (the launcher's inline-SVG bug
 * glyph) — SVG rasterisation converges across platforms in a way that font
 * rasterisation does not. Any future baseline that contains text must
 * reintroduce platform scoping rather than widen the tolerance.
 */
export default defineConfig({
  testDir: 'tests/vrt',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // CSS animations/transitions settle to their end frame and infinite
      // animations are cancelled, so a spinner can never make this flaky.
      animations: 'disabled',
      caret: 'hide',
      // 2% of a 64x64 clip = ~82 px. Large enough to absorb sub-pixel
      // compositing differences between machines, far too small to hide a
      // layout or colour regression on a 48x48 control.
      maxDiffPixelRatio: 0.02,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Pinned: the clip below is expressed in these coordinates, so a
        // device-profile change must be a deliberate edit here, not a silent
        // re-frame of every baseline.
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
    },
    // webkit is intentionally absent. It is added for a canvas-rendering
    // surface (J-05/J-06 capture + mask) only once those baselines are proven
    // stable; a second project whose baselines churn is worse than no VRT.
  ],
});
