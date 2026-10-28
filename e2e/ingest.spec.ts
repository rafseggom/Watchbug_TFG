import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

/**
 * The list route, tolerating the `?limit=`/`?cursor=` query string the panel now
 * always appends (261014-m3w's read contract). Playwright anchors regexes to the
 * full URL, so a bare glob matching only `/api/incidents` no longer matches a
 * request that carries a query string. One shared reference is required —
 * `page.unroute` removes a regex route by source+flags equality, so an inline
 * duplicate would not unregister and the second mock row would leak into the
 * next test. The pattern deliberately does not match `/api/incidents/:id/image`.
 */
const INCIDENTS_LIST_RE = /\/api\/incidents(\?.*)?$/;

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
    // CAP-03: `bytes === undefined` now means "send no `image` part at all" —
    // the old `opts.bytes ?? png` default silently uploaded the PNG fixture on
    // every call, which made the route's imageless branch unreachable from
    // this helper. Callers that intend an image pass `bytes: png` explicitly.
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
 * CAP-03 artifact-level blob counter: the number of files in the api
 * container's attachments volume (`blobs/…` plus in-flight `tmp/…`). The suite
 * already hard-requires the compose stack (global-setup fails without
 * `/api/health`), so the very docker CLI that runs it is a legitimate
 * assertion surface; `compose exec` resolves the container by service name and
 * the volume root comes from the container's own `WATCHBUG_DATA_DIR`, so no
 * host secret is read. With `workers: 1` and no parallel tests, a before/after
 * diff inside one row counts exactly this row's volume writes.
 */
function blobCount(): number {
  const run = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'api', 'sh', '-c', 'find "${WATCHBUG_DATA_DIR:-/data}" -type f | wc -l'],
    { cwd: repoRoot, encoding: 'utf8', timeout: 20_000 },
  );
  if (run.error) throw new Error(`docker compose exec failed: ${String(run.error)}`);
  if (run.status !== 0) throw new Error(`docker compose exec exited ${String(run.status)}: ${run.stderr}`);
  const count = Number.parseInt(run.stdout.trim(), 10);
  if (Number.isNaN(count)) throw new Error(`could not parse a blob count from ${JSON.stringify(run.stdout)}`);
  return count;
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
  const created = await postIncident(request, { key: KEY, idempotencyKey: idem, meta: META, bytes: png });
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
  const first = await postIncident(request, { key: KEY, idempotencyKey: idem, meta: { ...META, title: 'Replay probe' }, bytes: png });
  expect(first.status).toBe(201);

  const replay = await postIncident(request, { key: KEY, idempotencyKey: idem, meta: { ...META, title: 'Replay probe' }, bytes: png });
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
    postIncident(request, { key: KEY, idempotencyKey: idem, meta, bytes: png }),
    postIncident(request, { key: KEY, idempotencyKey: idem, meta, bytes: png }),
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

  const created = await postIncident(request, { key: KEY, idempotencyKey: null, meta: { ...META, title: 'No key probe' }, bytes: png });
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
    bytes: png,
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

test('CAP-03 text-only: a meta-only submission stores a row with no screenshot', async ({ request }) => {
  // The helper omits the `image` multipart part entirely when `bytes` is
  // undefined, so this request is genuinely meta-only and reaches the route's
  // imageless branch — the same meta pipeline, no screenshot.
  const idem = `e2e-textonly-${randomUUID()}`;
  const title = 'Text-only report probe';
  const before = blobCount();
  const created = await postIncident(request, { key: KEY, idempotencyKey: idem, meta: { ...META, title } });
  expect(created.status).toBe(201);
  const id = created.body.id as string;
  expect(id).toMatch(/^[0-9a-f-]{36}$/);

  // Artifact-level: no blob was written for a screenshot this reporter never
  // took (before/after file count of the attachments volume, workers=1).
  expect(blobCount()).toBe(before);

  // The list projection carries the row with a null content type — the read
  // surface shows exactly what the reporter captured, including nothing.
  const list = await (await request.get('/api/incidents')).json() as Array<Record<string, unknown>>;
  const row = list.find((r) => r.id === id);
  expect(row).toBeDefined();
  expect(row?.title).toBe(title);
  expect(row?.contentType).toBeNull();

  // The blob route answers the structured 404 — never 500, never an empty 200
  // stream, and never a fabricated image.
  const image = await request.get(`/api/incidents/${id}/image`);
  expect(image.status()).toBe(404);
  const body = (await image.json()) as Record<string, unknown>;
  expect(typeof body.message).toBe('string');
});

test('CAP-03 text-only concurrent: one idempotency key, one row, no blob', async ({ request }) => {
  // Same helper pair as the image-bearing race row above, minus the `image`
  // part: the uniqueness index, not application code, is the dedupe guarantee,
  // and the imageless path must not change that (ING-03 holds either way).
  const idem = `e2e-textonly-race-${randomUUID()}`;
  const meta = { ...META, title: 'Text-only race probe' };
  const before = blobCount();
  const [a, b] = await Promise.all([
    postIncident(request, { key: KEY, idempotencyKey: idem, meta }),
    postIncident(request, { key: KEY, idempotencyKey: idem, meta }),
  ]);

  // One create wins; the loser replays — with the same id, exactly as the
  // image-bearing race row proves.
  const statuses = [a.status, b.status].sort();
  expect(statuses[0]).toBe(200);
  expect(statuses[1]).toBe(201);
  expect(a.body.id).toBe(b.body.id);

  const list = await (await request.get('/api/incidents')).json() as Array<Record<string, unknown>>;
  const rows = list.filter((r) => r.id === a.body.id);
  expect(rows).toHaveLength(1);
  expect(rows[0].contentType).toBeNull();

  // Neither attempt wrote a blob.
  expect(blobCount()).toBe(before);
});

test('CAP-03 text-only: the blob route never 500s', async ({ request }) => {
  const idem = `e2e-textonly-404-${randomUUID()}`;
  const created = await postIncident(request, {
    key: KEY,
    idempotencyKey: idem,
    meta: { ...META, title: 'Imageless 404 probe' },
  });
  expect(created.status).toBe(201);

  const res = await request.get(`/api/incidents/${created.body.id as string}/image`);
  expect(res.status()).toBe(404);
  const body = (await res.json()) as Record<string, unknown>;
  expect(typeof body.message).toBe('string');
  // A JSON error body: the response carries no `image/*` content type and the
  // route never opens the volume for a null key (T-03-08's read-side mirror).
  expect(res.headers()['content-type']).toContain('application/json');
  expect(String(res.headers()['content-type'])).not.toMatch(/^image\//);
});

test('CAP-03 text-only: the panel lists it', async ({ page, request }) => {
  const probe = `Text-only panel probe ${randomUUID().slice(0, 8)}`;
  // Deliberate asymmetry with the existing panel row above: that one passes
  // `bytes: png` because it asserts a RENDERED screenshot; this one omits
  // `bytes` because it asserts the ABSENCE of one. Neither row's assertions
  // nor `bytes` argument is edited here — both belong to Task 2.
  const created = await postIncident(request, {
    key: KEY,
    idempotencyKey: `e2e-textonly-panel-${randomUUID()}`,
    meta: { ...META, title: probe },
  });
  expect(created.status).toBe(201);

  await page.goto('/');
  // Title renders as list text plus the auto-selected detail heading — the
  // existing panel row's shape, intercepting nothing.
  await expect(page.getByText(probe, { exact: true })).toHaveCount(2);

  // Open the detail pane: NO screenshot element exists for the imageless
  // report — ReportDetail gates the img on a non-null content type, so a
  // broken-image element is never emitted.
  await page.getByRole('button', { name: new RegExp(probe) }).click();
  await expect(page.getByAltText(new RegExp(`Screenshot for report: ${probe}`))).toHaveCount(0);
  await expect(page.locator('img')).toHaveCount(0);
});

test('CAP-03 text-only: a meta-only post without X-Project-Key gets the same structured 401', async ({ request }) => {
  // Raw request: the helper always sets the header, and this row's point is
  // the header being ABSENT (precedent: the raw multipart builder below
  // composes its own request). The request-level guards — body caps, rate
  // limits, origin gate, project-key gate — sit in the preHandler chain and
  // run before the imageless branch exists, so an optional image must never
  // mean an optional guard (T-03-06).
  const res = await request.post('/api/incidents', {
    multipart: { meta: JSON.stringify({ ...META, title: 'No key meta-only probe' }) },
    headers: { 'Idempotency-Key': `e2e-textonly-nokey-${randomUUID()}` },
  });
  expect(res.status()).toBe(401);
  const imagelessBody = (await res.json()) as Record<string, unknown>;

  // Byte-for-byte the body an image-bearing submission gets for the same class
  // of key failure (ING-04's no-oracle 401): missing, malformed and unknown
  // keys stay indistinguishable across both submission shapes.
  const bearing = await postIncident(request, {
    key: 'wkbt_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
    idempotencyKey: `e2e-textonly-401pair-${randomUUID()}`,
    meta: META,
    bytes: png,
  });
  expect(bearing.status).toBe(401);
  expect(imagelessBody).toEqual(bearing.body);
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
 * P1-D-07 — the empty state **is** the onboarding: the key endpoint, the
 * pre-filled curl (shape + real key), and an actual run of the emitted
 * snippet against the stack. P1-D-05 — language detection and persistence.
 *
 * The "empty database" rows intercept `GET /api/incidents` with an empty
 * array: the suite shares one growing stack, so a genuinely empty list only
 * exists on a fresh install. Everything else in the row — the panel's
 * `EmptyState` component, `GET /api/setup`, the emitted command, and the API
 * it targets — is real.
 */
test('P1-D-07 / T-01-16: GET /api/setup serves exactly the seeded write-only project key through nginx', async ({ request }) => {
  const res = await request.get('/api/setup');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/json');
  const body = (await res.json()) as Record<string, unknown>;
  // T-01-16: one field and nothing else — no config, no rows.
  expect(Object.keys(body)).toEqual(['projectKey']);
  expect(body.projectKey).toBe(KEY);
  expect(String(body.projectKey)).toMatch(/^wkbt_[0-9A-Za-z]{32}$/); // P1-D-03 format
});

test('P1-D-07: with an empty list the panel shows the onboarding curl carrying the real key and the CA-01 wire shape', async ({ page }) => {
  await page.route(INCIDENTS_LIST_RE, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Send your first report' })).toBeVisible();
  await expect(page.locator('pre')).toHaveCount(1);
  const curl = await page.locator('pre').innerText();

  // The instance's real project key (the same value /api/setup serves).
  expect(curl).toContain(KEY);
  // CA-01 wire form: endpoint, key header, idempotency header, meta part, image part.
  expect(curl).toContain('/api/incidents');
  expect(curl).toContain('-H "X-Project-Key: ');
  expect(curl).toContain('-H "Idempotency-Key: ');
  expect(curl).toMatch(/-F 'meta=\{"type":"(bug|feedback)","title":"/);
  expect(curl).toContain(`-F 'image=@screenshot.png'`);
  // The one-line instruction to reload after running it.
  await expect(page.getByText('Then reload this page')).toBeVisible();
});

test('P1-D-07: the emitted onboarding curl runs verbatim and the new report appears after reload', async ({ page, request }) => {
  test.setTimeout(60_000);
  await page.route(INCIDENTS_LIST_RE, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.goto('/');
  await expect(page.locator('pre')).toBeVisible();
  const curl = await page.locator('pre').innerText();

  const before = (await (await request.get('/api/incidents')).json()) as Array<{ title: string }>;
  const title = 'Hello from Watchbug';
  const beforeCount = before.filter((row) => row.title === title).length;

  // Parse the snippet the way the shell that would paste it does: join line
  // continuations, then split honouring the quotes curl was handed.
  const joined = curl.replace(/\\\r?\n\s*/g, ' ');
  const unquote = (token: string): string => {
    if (token.length > 1 && token.startsWith('"') && token.endsWith('"')) return token.slice(1, -1);
    if (token.length > 1 && token.startsWith("'") && token.endsWith("'")) return token.slice(1, -1);
    return token;
  };
  const tokens = (joined.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(unquote);
  expect(tokens[0]).toBe('curl');

  // A pasted snippet references a local file — give it one, in its own cwd.
  const workdir = mkdtempSync(join(tmpdir(), 'watchbug-onboarding-'));
  let createdId: string | undefined;
  try {
    copyFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'), join(workdir, 'screenshot.png'));
    const run = spawnSync(tokens[0], tokens.slice(1), { cwd: workdir, encoding: 'utf8', timeout: 30_000 });
    expect(run.error, `could not run curl: ${String(run.error)}`).toBeUndefined();
    expect(run.status, `curl exited ${String(run.status)}: ${run.stderr}`).toBe(0);
    const created = JSON.parse(run.stdout) as { id?: string };
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    createdId = created.id;
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }

  // The report landed in storage…
  const after = (await (await request.get('/api/incidents?limit=200')).json()) as Array<{ id: string; title: string }>;
  expect(after.some((row) => row.id === createdId)).toBe(true);

  // …and reloading the panel (now un-intercepted) shows it in the list.
  await page.unroute(INCIDENTS_LIST_RE);
  await page.reload();
  await expect(page.getByText(title).first()).toBeVisible();
});

test('P1-D-07: a meta part sent with Content-Type: application/json ingests (the curl -F shape)', async ({ request }) => {
  // curl -F 'meta={…}' marks the field application/json; @fastify/multipart
  // JSON-parses it into an object. The ingest must re-stringify that object
  // before validation instead of String()ing it into "[object Object]".
  const boundary = `----watchbugjson${randomUUID().replace(/-/g, '')}`;
  const meta = JSON.stringify({ type: 'bug', title: 'JSON content-type meta probe', url: '/' });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="meta"\r\n` +
        `Content-Type: application/json\r\n\r\n${meta}\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="shot.png"\r\n` +
        'Content-Type: image/png\r\n\r\n',
    ),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await request.post('/api/incidents', {
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'X-Project-Key': KEY,
      'Idempotency-Key': `e2e-jsonmeta-${randomUUID()}`,
    },
    data: body,
  });
  expect(res.status()).toBe(201);

  const { id } = (await res.json()) as { id: string };
  const list = (await (await request.get('/api/incidents')).json()) as Array<{ id: string; title: string }>;
  expect(list.find((row) => row.id === id)?.title).toBe('JSON content-type meta probe');
});

test('P1-D-05: language defaults from navigator.language and a manual switch survives reload', async ({ page, browser }) => {
  // Detection (no stored choice): an `es*` locale gets Spanish on first visit.
  const esContext = await browser.newContext({ locale: 'es-ES' });
  const esPage = await esContext.newPage();
  await esPage.goto('/');
  await expect(esPage.getByText('Reportes', { exact: true })).toBeVisible();
  await esContext.close();

  // The harness default (en-US) gets English.
  await page.goto('/');
  await expect(page.getByText('Reports', { exact: true })).toBeVisible();

  // Manual switch → persisted in the panel's own localStorage, and still
  // Spanish after a full reload (which re-runs detection from scratch).
  await page.locator('select').selectOption('es');
  await expect(page.getByText('Reportes', { exact: true })).toBeVisible();
  await expect(page.getByText('Pendiente').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Reportes', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('watchbug.lang'))).toBe('es');
});
