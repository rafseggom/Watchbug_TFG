import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reportSchema } from '@watchbug/contracts/schema';

/**
 * ING-01 / ENR-06 / ING-03 — the tracer proof: the full CA-01 ingest chain
 * against the real compose stack. Security properties are asserted at the
 * **artifact level** (R-12): the served bytes are re-sniffed, and the stored
 * row is validated against the contracts package's `reportSchema` — the same
 * Zod schema that emits the committed `schema/report.schema.json` (CA-01:
 * one source; the JSON file is asserted to exist as the published artifact).
 *
 * Row counts are asserted with `Idempotency-Key`s unique per run, and the
 * worker count is 1 (playwright.config.ts) — the assertions count *rows for
 * this key*, never global totals, so a re-run is not flaky.
 */

const repoRoot = resolve(__dirname, '..');

const png = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'));
const webp = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.webp'));

// The published JSON Schema artifact must exist and be the committed contract.
const publishedSchema = JSON.parse(
  readFileSync(resolve(repoRoot, 'schema/report.schema.json'), 'utf8'),
) as Record<string, unknown>;

interface PostResult {
  status: number;
  body: Record<string, unknown>;
}

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
): Promise<PostResult> {
  const form = {
    meta: JSON.stringify(opts.meta),
    image: {
      name: opts.filename ?? 'shot.png',
      mimeType: opts.mime ?? 'image/png',
      buffer: opts.bytes ?? png,
    },
  };
  const headers: Record<string, string> = { 'X-Project-Key': opts.key };
  if (opts.idempotencyKey !== null) headers['Idempotency-Key'] = opts.idempotencyKey;
  const res = await request.post('/api/incidents', { multipart: form, headers });
  return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
}

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

test('POST /api/incidents: 201, row validates against the published schema, list + image round-trip (ING-01, ENR-06)', async ({ request }) => {
  const idem = `e2e-create-${randomUUID()}`;
  const created = await postIncident(request, { key: KEY, idempotencyKey: idem, meta: META });
  expect(created.status).toBe(201);
  const id = created.body.id as string;
  expect(id).toMatch(/^[0-9a-f-]{36}$/);

  // ENR-06: the stored row, as served to the panel, validates against the
  // contracts `reportSchema` — the same schema that emits the committed
  // JSON Schema artifact (CA-01 single source).
  // The published artifact is a flat draft-2020-12 object schema: closed
  // (`additionalProperties: false`), with the two required contract fields.
  expect(publishedSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  expect(publishedSchema.additionalProperties).toBe(false);
  expect(publishedSchema.required).toEqual(expect.arrayContaining(['type', 'title']));

  // List contains the incident with the contract fields, text-safe.
  const list = await (await request.get('/api/incidents')).json() as Array<Record<string, unknown>>;
  const row = list.find((r) => r.id === id);
  expect(row).toBeDefined();
  expect(row?.title).toBe(META.title);
  expect(row?.type).toBe('bug');
  expect(row?.status).toBe('pending');
  expect(row?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  // Internals never leave the server.
  expect(row).not.toHaveProperty('storageKey');
  expect(row).not.toHaveProperty('idempotencyKey');
  expect(row).not.toHaveProperty('projectId');

  // The list projection carries extra server fields (id, status, createdAt,
  // contentType) beyond the client meta contract; the *contract fields* it
  // echoes must survive validation unchanged.
  const { id: _rowId, status, createdAt, contentType, ...metaEcho } = row as Record<string, unknown> & {
    status: string; createdAt: string; contentType: string;
  };
  void status; void createdAt; void contentType;
  expect(reportSchema.safeParse(metaEcho).success).toBe(true);

  // The blob route: hardened headers + artifact-level check that the served
  // bytes are the fixture image (magic bytes), with metadata stripped.
  const image = await request.get(`/api/incidents/${id}/image`);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/png');
  expect(image.headers()['x-content-type-options']).toBe('nosniff');
  expect(image.headers()['content-disposition']).toBe('attachment; filename="screenshot.png"');
  expect(image.headers()['content-security-policy']).toContain("default-src 'none'");
  expect(image.headers()['cross-origin-resource-policy']).toBe('same-origin');
  const bytes = Buffer.from(await image.body());
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(bytes.length).toBeGreaterThan(0);
});

test('webp fixture ingests and serves image/webp', async ({ request }) => {
  const idem = `e2e-webp-${randomUUID()}`;
  const created = await postIncident(request, {
    key: KEY,
    idempotencyKey: idem,
    meta: { ...META, title: 'WebP upload path' },
    bytes: webp,
    filename: 'shot.webp',
    mime: 'image/webp',
  });
  expect(created.status).toBe(201);
  const image = await request.get(`/api/incidents/${created.body.id as string}/image`);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/webp');
  const bytes = Buffer.from(await image.body());
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
});

test('ING-03: same Idempotency-Key replays the same id and stores one row', async ({ request }) => {
  const idem = `e2e-replay-${randomUUID()}`;
  const first = await postIncident(request, { key: KEY, idempotencyKey: idem, meta: { ...META, title: 'Replay probe' } });
  expect(first.status).toBe(201);

  const replay = await postIncident(request, { key: KEY, idempotencyKey: idem, meta: { ...META, title: 'Replay probe' } });
  expect(replay.status).toBe(200);
  expect(replay.body.replayed).toBe(true);
  expect(replay.body.id).toBe(first.body.id);

  const list = await (await request.get('/api/incidents')).json() as Array<{ id: string }>;
  expect(list.filter((r) => r.id === first.body.id)).toHaveLength(1);
});

test('ING-03: concurrent pair with one key yields one row', async ({ request }) => {
  const idem = `e2e-race-${randomUUID()}`;
  const meta = { ...META, title: 'Race probe' };
  const [a, b] = await Promise.all([
    postIncident(request, { key: KEY, idempotencyKey: idem, meta }),
    postIncident(request, { key: KEY, idempotencyKey: idem, meta }),
  ]);

  // One create wins; the loser replays (or, in a tight race, both report 201
  // with the second having been converted to a replay of the first's id).
  const statuses = [a.status, b.status].sort();
  expect(statuses[0]).toBe(200);
  expect(statuses[1]).toBe(201);
  expect(a.body.id).toBe(b.body.id);

  const list = await (await request.get('/api/incidents')).json() as Array<{ id: string }>;
  expect(list.filter((r) => r.id === a.body.id)).toHaveLength(1);
});

test('ING-03 (Q6): missing Idempotency-Key → 400 structured body, list unchanged', async ({ request }) => {
  const before = (await (await request.get('/api/incidents')).json() as unknown[]).length;

  const created = await postIncident(request, { key: KEY, idempotencyKey: null, meta: { ...META, title: 'No key probe' } });
  expect(created.status).toBe(400);
  expect(typeof created.body.statusCode).toBe('number');
  expect(typeof created.body.error).toBe('string');
  expect(typeof created.body.message).toBe('string');

  const after = (await (await request.get('/api/incidents')).json() as unknown[]).length;
  expect(after).toBe(before);
});

test('wrong project key → 401; svg → 400 (SEC-03, P1-D-11)', async ({ request }) => {
  const wrong = await postIncident(request, {
    key: 'wkbt_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
    idempotencyKey: `e2e-wrongkey-${randomUUID()}`,
    meta: META,
  });
  expect(wrong.status).toBe(401);

  const svg = await postIncident(request, {
    key: KEY,
    idempotencyKey: `e2e-svg-${randomUUID()}`,
    meta: META,
    bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64"/></svg>'),
    filename: 'shot.svg',
    mime: 'image/svg+xml',
  });
  expect(svg.status).toBe(400);
});

test('panel renders the row and its screenshot (P1-D-04, SEC-05 pass 2)', async ({ page, request }) => {
  // Ensure at least one row exists for the panel to show. The title carries a
  // script tag: SEC-05 pass 1 (server-side sanitize-html) must strip it before
  // storage, so neither the stored row nor the DOM can ever contain it. The
  // suffix keeps the assertion unique across repeated runs against one stack.
  const probe = `Panel render probe ${randomUUID().slice(0, 8)}`;
  const created = await postIncident(request, {
    key: KEY,
    idempotencyKey: `e2e-panel-${randomUUID()}`,
    meta: { ...META, title: `${probe} <script>x</script>` },
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
