import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * J-02 / J-07 — the two e2e journey rows that require a real browser.
 *
 * All other ingest tests (schema validation, idempotency, format checks,
 * auth gates, text-only API, onboarding API) have been re-homed to
 * `tests/integration/` where they run against the API directly via Fastify
 * `inject` / `fetch` without browser overhead. See 03-08-CONVERSION-LEDGER.md.
 */

const repoRoot = resolve(__dirname, '..');

const INCIDENTS_LIST_RE = /\/api\/incidents(\?.*)?$/;

const png = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'));

// The e2e project key: the deploy stack seeds from WATCHBUG_PROJECT_KEY in
// .env. Read the same file the api container reads so the suite and the stack
// agree on the key without hardcoding a secret in the repo.
function projectKey(): string {
  const envFile = readFileSync(resolve(repoRoot, '.env'), 'utf8');
  const match = /^WATCHBUG_PROJECT_KEY=(.+)$/m.exec(envFile);
  if (!match) throw new Error('.env has no WATCHBUG_PROJECT_KEY — copy .env.example and run npm run key:gen');
  const key = match[1].trim();
  if (key === 'wkbt_00000000000000000000000000000000') {
    throw new Error('.env still holds the placeholder key — generate a real one with npm run key:gen');
  }
  return key;
}

const KEY = projectKey();
const META = {
  type: 'bug' as const,
  title: 'Checkout button unresponsive on Safari',
  note: 'Tap does nothing; console shows no errors.',
  url: '/checkout',
  user: { id: null, name: null, email: null },
};

async function postIncident(
  request: import('@playwright/test').APIRequestContext,
  opts: {
    key: string;
    idempotencyKey: string | null;
    meta: unknown;
    bytes?: Buffer;
    filename?: string;
    mime?: string;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const form = {
    meta: JSON.stringify(opts.meta),
    ...(opts.bytes === undefined
      ? {}
      : {
          image: {
            name: opts.filename ?? 'shot.png',
            mimeType: opts.mime ?? 'image/png',
            buffer: opts.bytes,
          },
        }),
  };
  const headers: Record<string, string> = { 'X-Project-Key': opts.key };
  if (opts.idempotencyKey !== null) headers['Idempotency-Key'] = opts.idempotencyKey;
  const res = await request.post('/api/incidents', { multipart: form, headers });
  return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
}

/**
 * J-02: Golden path — widget → capture → composer → review → send → visible in panel.
 *
 * This is the *browser* verification of the golden path: the panel renders the
 * sanitized title as a text node (SEC-05 pass 2) and displays the screenshot
 * served from the blob route with hardened headers. The server-side ingest
 * validation (ING-01, ENR-06) and format checks are covered in integration.
 */
test('J-02 panel renders the row and its screenshot (P1-D-04, SEC-05 pass 2)', async ({ page, request }) => {
  const probe = `Panel render probe ${randomUUID().slice(0, 8)}`;
  const created = await postIncident(request, {
    key: KEY,
    idempotencyKey: `e2e-panel-${randomUUID()}`,
    meta: { ...META, title: `${probe} <script>x</script>` },
    bytes: png,
  });
  expect(created.status).toBe(201);

  // The stored row no longer contains markup (pass 1). sanitize-html drops
  // the tag but leaves the whitespace around it, so compare trimmed.
  const list = await (await request.get('/api/incidents')).json() as Array<{ id: string; title: string }>;
  const stored = list.find((r) => r.id === created.body.id);
  expect(stored?.title.trim()).toBe(probe);
  expect(stored?.title).not.toContain('<script>');

  // … and the panel renders the remainder as a TEXT NODE (pass 2) — in both
  // the list row and the auto-selected detail heading.
  await page.goto('/');
  await expect(page.getByText(probe, { exact: true })).toHaveCount(2);
  expect(await page.locator('script:not([src])').count()).toBe(0);

  // Open the detail pane and assert the screenshot rendered from the blob route.
  await page.getByRole('button', { name: new RegExp(probe) }).click();
  const img = page.getByAltText(new RegExp(`Screenshot for report: ${probe}`));
  await expect(img).toBeVisible();
  await expect.poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(64);
});

/**
 * J-07: Degraded capture — CAP-03 text-only degraded composer visible in panel.
 *
 * This is the *browser* verification that a text-only report (no screenshot)
 * appears in the panel list and detail pane without a broken image element.
 * The API-level text-only tests (CAP-03 meta-only submission, concurrent,
 * blob route 404) are covered in integration.
 */
test('J-07 CAP-03 text-only: the panel lists it', async ({ page, request }) => {
  const probe = `Text-only panel probe ${randomUUID().slice(0, 8)}`;
  const created = await postIncident(request, {
    key: KEY,
    idempotencyKey: `e2e-textonly-panel-${randomUUID()}`,
    meta: { ...META, title: probe },
  });
  expect(created.status).toBe(201);

  await page.goto('/');
  // Title renders as list text plus the auto-selected detail heading.
  await expect(page.getByText(probe, { exact: true })).toHaveCount(2);

  // Open the detail pane: NO screenshot element exists for the imageless
  // report — ReportDetail gates the img on a non-null content type, so a
  // broken-image element is never emitted.
  await page.getByRole('button', { name: new RegExp(probe) }).click();
  await expect(page.getByAltText(new RegExp(`Screenshot for report: ${probe}`))).toHaveCount(0);
  await expect(page.locator('img')).toHaveCount(0);
});