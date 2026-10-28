import { expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * DEP-01 / DEP-02: the compose deployment behaves as documented — the panel
 * serves the SPA shell, the API answers through the same-origin nginx proxy,
 * every server env var is documented, and a missing/placeholder project key
 * fails fast at boot (P1-D-02) instead of serving traffic.
 */

const repoRoot = resolve(__dirname, '..');

test('panel root returns the SPA shell (DEP-01)', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('#root')).toBeAttached();
  // The bundle is loaded and the React tree rendered the app frame. `exact`
  // is load-bearing: the shared stack holds real incidents, and the detail
  // pane's incident-title <h2> also contains "Watchbug" (e.g. the fixture's
  // default title) — a substring match resolves to both elements and fails
  // strict mode (cross-row interference found by the 02-05 full-suite run).
  await expect(page.getByRole('heading', { name: 'Watchbug', exact: true })).toBeVisible();
});

test('panel document ships the full CSP plus the header pair (S-4)', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (message) => consoleMessages.push(message.text()));

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  // Five directive-level assertions on the document response — not two loose
  // substrings — so a partial or reordered policy cannot satisfy the row.
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("img-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'none'");
  expect(csp).toContain("frame-ancestors 'none'");

  // nginx add_header inheritance guard: the pair declared at server level is
  // NOT carried into location / once the CSP declares its own add_header —
  // the location block must repeat both, or this assertion fails.
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['referrer-policy']).toBe('same-origin');

  // The bundle rendered under the policy (exact: see the DEP-01 note above —
  // an incident title in the detail pane must never satisfy this heading).
  await expect(page.getByRole('heading', { name: 'Watchbug', exact: true })).toBeVisible();

  // Self-DoS guard: the policy must not refuse any of the panel's own loads.
  const violations = consoleMessages.filter((text) => /Content Security Policy|Refused to/.test(text));
  expect(violations, `CSP refusals: ${violations.join(' | ')}`).toEqual([]);

  // The server-level pair still reaches proxied API responses while the
  // document policy belongs to SPA responses only.
  const health = await page.request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(health.headers()['x-content-type-options']).toBe('nosniff');
  expect(health.headers()['referrer-policy']).toBe('same-origin');
});

test('/api/health returns 200 through the nginx proxy (DEP-01, A-10)', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});

test('every env var read by apps/api/src/config.ts is documented in .env.example (DEP-02)', () => {
  const configSource = readFileSync(resolve(repoRoot, 'apps/api/src/config.ts'), 'utf8');
  const envExample = readFileSync(resolve(repoRoot, '.env.example'), 'utf8');

  const readVars = new Set<string>();
  for (const match of configSource.matchAll(/env\.([A-Z][A-Z0-9_]+)/g)) readVars.add(match[1]);
  for (const match of configSource.matchAll(/'(WATCHBUG_[A-Z0-9_]+|DATABASE_URL|PORT)'/g)) readVars.add(match[1]);

  expect(readVars.size).toBeGreaterThan(5); // the scan actually found the loader reads
  const undocumented = [...readVars].filter((name) => !envExample.includes(name));
  expect(undocumented, `env vars missing from .env.example: ${undocumented.join(', ')}`).toEqual([]);
});

/** Boot the built API with a hostile env and assert the fail-fast contract. */
async function bootWith(env: Record<string, string | undefined>): Promise<{ code: number | null; stderr: string }> {
  const child = spawn(process.execPath, ['apps/api/dist/index.mjs'], {
    cwd: repoRoot,
    env: { PATH: process.env.PATH, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  child.stdout.resume();
  const code = await new Promise<number | null>((resolveExit) => child.on('exit', resolveExit));
  return { code, stderr };
}

const BASE_ENV = { DATABASE_URL: 'postgres://user:pass@127.0.0.1:5433/watchbug' };

test('boot with WATCHBUG_PROJECT_KEY unset exits non-zero naming the variable (DEP-02)', async () => {
  const { code, stderr } = await bootWith({ ...BASE_ENV });
  expect(code).not.toBe(0);
  expect(stderr).toContain('WATCHBUG_PROJECT_KEY');
  expect(stderr).toContain('.env');
});

test('boot with the documented placeholder key exits non-zero (DEP-02)', async () => {
  const { code, stderr } = await bootWith({
    ...BASE_ENV,
    WATCHBUG_PROJECT_KEY: 'wkbt_00000000000000000000000000000000',
  });
  expect(code).not.toBe(0);
  expect(stderr).toContain('WATCHBUG_PROJECT_KEY');
  expect(stderr).toContain('placeholder');
});

test('boot with a malformed key exits non-zero naming the expected format (DEP-02)', async () => {
  const { code, stderr } = await bootWith({ ...BASE_ENV, WATCHBUG_PROJECT_KEY: 'not-a-key' });
  expect(code).not.toBe(0);
  expect(stderr).toContain('32');
  expect(stderr).toContain('base62');
});
