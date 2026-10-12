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
  // The bundle is loaded and the React tree rendered the app frame.
  await expect(page.getByRole('heading', { name: 'Watchbug' })).toBeVisible();
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
