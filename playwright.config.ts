import { defineConfig, devices } from '@playwright/test';

/**
 * The single verify suite's config (R-12: one Playwright suite, no unit tests).
 *
 * Three browser projects, three real code paths:
 *   chromium — the WebP encode path
 *   webkit   — the silent WebP→PNG fallback (R-11) — never optional
 *   firefox  — the no-`ImageCapture` capture path (Q-9)
 *
 * The suite runs against the **compose stack** (INV-03): `globalSetup` fails
 * loud if `/api/health` is not answering on 127.0.0.1:8080 (same-origin through
 * the nginx proxy, A-10).
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: 'e2e/global-setup.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1, // the ingest suite asserts row counts; parallel writers would race them
  retries: 0,
  reporter: [['list']],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:8080' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], baseURL: 'http://127.0.0.1:8080' } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], baseURL: 'http://127.0.0.1:8080' } },
  ],
});
