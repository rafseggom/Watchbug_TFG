import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * DEP-01 / DEP-02 — the compose deployment contract (type 6: environment /
 * packaging), re-homed from the deleted `e2e/deploy.spec.ts`.
 *
 * Nothing here needs a browser: the assertions are HTTP-surface, build-artifact
 * and process-level. The three live rows target the real three-container stack
 * (INV-03) through the same-origin nginx proxy, exactly like the integration
 * suite targets the published API, so they share its one prerequisite:
 * `docker compose up -d --build`. The four remaining rows are hermetic — they
 * read files and spawn the built API binary.
 *
 * Deliberately NOT a weakened conversion: every assertion of the original spec
 * survives, except the two that required a rendered page (the visible
 * "Watchbug" heading and the console CSP-violation watch). The render half is
 * already exercised by the kept panel journeys (J-02, J-07) in `e2e/`; the
 * CSP-violation half is replaced by its artifact-level cause — the shipped
 * document must carry no inline script or inline style, or the `'self'`-only
 * policy would refuse the panel's own loads. That check can still fail for the
 * right reason.
 */

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const BASE = process.env.WATCHBUG_BASE_URL ?? 'http://127.0.0.1:8080';

describe('Packaging: DEP-01 deployment surface through the nginx proxy', () => {
  beforeAll(async () => {
    // Fail loud and early, like `e2e/global-setup.ts`: without the stack every
    // assertion below would surface as an unhelpful ECONNREFUSED.
    let lastError = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch(`${BASE}/api/health`);
        if (res.ok) return;
        lastError = `health responded ${res.status}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(
      `the compose stack is not reachable at ${BASE} (last error: ${lastError}). ` +
        'Start it with "docker compose up -d --build" and retry.',
    );
  });

  it('panel root returns the SPA shell (DEP-01)', async () => {
    const response = await fetch(`${BASE}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();
    // The mount point the panel bundle renders into …
    expect(html).toContain('id="root"');
    // … and the bundle itself, wired as an external module (never inline).
    expect(html).toMatch(/<script[^>]+src="\/assets\/[^"]+\.js"/);

    // The served document is the built artifact: assert the same shell there,
    // plus the property the CSP depends on. `default-src 'self'` (no
    // 'unsafe-inline') refuses inline script and style, so the shipped
    // index.html must not contain any — this replaces the old browser-side
    // console watch for CSP refusals with its cause, at the artifact level.
    const distHtml = readFileSync(resolve(repoRoot, 'apps/panel/dist/index.html'), 'utf8');
    expect(distHtml).toContain('id="root"');
    const inlineScripts = [...distHtml.matchAll(/<script\b([^>]*)>/gi)].filter(
      (match) => !/\bsrc=/.test(match[1]),
    );
    expect(inlineScripts.map((m) => m[0])).toEqual([]);
    expect(distHtml).not.toMatch(/<style[\s>]/i);
    expect(distHtml).not.toMatch(/\sstyle="/i);
  });

  it('panel document ships the full CSP plus the header pair (S-4)', async () => {
    const response = await fetch(`${BASE}/`);
    expect(response.status).toBe(200);

    // Five directive-level assertions on the document response — not two loose
    // substrings — so a partial or reordered policy cannot satisfy the row.
    const csp = response.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("img-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("frame-ancestors 'none'");

    // nginx add_header inheritance guard: the pair declared at server level is
    // NOT carried into location / once the CSP declares its own add_header —
    // the location block must repeat both, or this assertion fails.
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('same-origin');

    // The server-level pair still reaches proxied API responses while the
    // document policy belongs to SPA responses only.
    const health = await fetch(`${BASE}/api/health`);
    expect(health.status).toBe(200);
    expect(health.headers.get('x-content-type-options')).toBe('nosniff');
    expect(health.headers.get('referrer-policy')).toBe('same-origin');
  });

  it('/api/health returns 200 through the nginx proxy (DEP-01, A-10)', async () => {
    const response = await fetch(`${BASE}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('Packaging: DEP-02 configuration contract', () => {
  it('every env var read by apps/api/src/config.ts is documented in .env.example (DEP-02)', () => {
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
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.stdout.resume();
    const code = await new Promise<number | null>((resolveExit) => child.on('exit', resolveExit));
    return { code, stderr };
  }

  const BASE_ENV = { DATABASE_URL: 'postgres://user:pass@127.0.0.1:5433/watchbug' };

  it('boot with WATCHBUG_PROJECT_KEY unset exits non-zero naming the variable (DEP-02)', async () => {
    const { code, stderr } = await bootWith({ ...BASE_ENV });
    expect(code).not.toBe(0);
    expect(stderr).toContain('WATCHBUG_PROJECT_KEY');
    expect(stderr).toContain('.env');
  });

  it('boot with the documented placeholder key exits non-zero (DEP-02)', async () => {
    const { code, stderr } = await bootWith({
      ...BASE_ENV,
      WATCHBUG_PROJECT_KEY: 'wkbt_00000000000000000000000000000000',
    });
    expect(code).not.toBe(0);
    expect(stderr).toContain('WATCHBUG_PROJECT_KEY');
    expect(stderr).toContain('placeholder');
  });

  it('boot with a malformed key exits non-zero naming the expected format (DEP-02)', async () => {
    const { code, stderr } = await bootWith({ ...BASE_ENV, WATCHBUG_PROJECT_KEY: 'not-a-key' });
    expect(code).not.toBe(0);
    expect(stderr).toContain('32');
    expect(stderr).toContain('base62');
  });
});
