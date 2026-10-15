import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
import { connect } from 'node:net';
import { resolve } from 'node:path';

/**
 * ING-06 / C-3 / C-4 / ING-07 — the hostile-submission group.
 *
 * Every row here asserts that a hostile payload is rejected with its
 * *structured* status code (roadmap success criterion 4) and never reaches
 * storage — or, for the ING-07 rows (SEC-05 pass 1), that hostile *text* is
 * stored sanitised: markup removed, plain text preserved literally, control
 * characters stripped, caps counting Unicode code points (Zod `maxLength`
 * semantics). Rows are deliberately layered:
 *
 *  - **oversize**: nginx `client_max_body_size 5m` at the panel origin, the
 *    `Content-Length` pre-read + streaming counter at `MAX_BODY_BYTES`, the
 *    multipart parser at `MAX_IMAGE_PART_BYTES`, and the semantic cap at
 *    `MAX_ENCODED_IMAGE_BYTES` — each layer gets its own row so a pass can
 *    never be satisfied by the wrong layer.
 *  - **content**: SVG, GIF/HTML polyglot, decode bomb → 400.
 *  - **naming**: traversal-shaped client filenames → 400 (the name never
 *    reaches a path — C-4).
 *
 * Bodies are hand-built multipart (not Playwright's `multipart:` option) so
 * the client filename travels on the wire exactly as hostile — no client
 * sanitising may hide what the server must reject.
 *
 * The chunked row speaks raw HTTP over a socket because it must *omit*
 * `Content-Length` entirely: Playwright's request API always states one, and
 * only an absent/lying declaration exercises the streaming counter rather than
 * the pre-read.
 *
 * R-12: assertions only, artifact level — status + structured body of the
 * real HTTP response against the running compose stack.
 */

const repoRoot = resolve(__dirname, '..');

const png = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'));
const hostileSvg = readFileSync(resolve(repoRoot, 'e2e/fixtures/hostile.svg'));
const polyglotGif = readFileSync(resolve(repoRoot, 'e2e/fixtures/polyglot-gif-html.gif'));
const decodeBomb = readFileSync(resolve(repoRoot, 'e2e/fixtures/decode-bomb.png'));

/** Layer caps under test (mirrors packages/contracts/src/constants.ts). */
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB — Content-Length pre-read + streaming counter
const MAX_IMAGE_PART_BYTES = 4 * 1024 * 1024; // 4 MB — multipart parser limit
const MAX_ENCODED_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB — semantic cap (A-06 "hard")

/** Direct-to-API origin: bypasses nginx, reaches Fastify's own gates. */
const API_ORIGIN = 'http://127.0.0.1:3000';

// The deploy stack's seeded project key — read the same file the api reads so
// the suite and the stack agree without hardcoding a secret.
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

const META = JSON.stringify({
  type: 'bug',
  title: 'Hostile submission probe',
  note: 'This report must never be stored.',
  url: '/hostile',
  user: { id: null, name: null, email: null },
});

interface ImagePart {
  filename: string;
  mime: string;
  bytes: Buffer;
}

interface PostResult {
  status: number;
  /** Parsed JSON body, or null when the response was not JSON (e.g. nginx's HTML 413). */
  json: Record<string, unknown> | null;
  contentType: string;
}

/** Hand-built multipart body: the filename goes on the wire verbatim. */
function buildMultipart(meta: string, image: ImagePart): { body: Buffer; contentType: string } {
  const boundary = `----watchbughostile${randomUUID().replace(/-/g, '')}`;
  const chunks: Buffer[] = [];
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="meta"\r\n\r\n${meta}\r\n`));
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${image.filename}"\r\n` +
        `Content-Type: ${image.mime}\r\n\r\n`,
    ),
  );
  chunks.push(image.bytes);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

/**
 * POST the hostile body. `baseUrl` defaults to the panel origin (nginx → api);
 * pass the API origin directly to reach a layer *before* nginx's own
 * `client_max_body_size`. `key: null` omits the header entirely; a string
 * overrides it (ING-04's missing / unknown / malformed trio).
 */
async function postHostile(
  request: import('@playwright/test').APIRequestContext,
  image: ImagePart,
  opts: { baseUrl?: string; title?: string; key?: string | null } = {},
): Promise<PostResult> {
  const { body, contentType } = buildMultipart(META, image);
  void opts.title; // titles stay uniform: hostile rows never store anything
  const headers: Record<string, string> = {
    'content-type': contentType,
    'Idempotency-Key': `e2e-hostile-${randomUUID()}`,
  };
  const key = opts.key === undefined ? KEY : opts.key;
  if (key !== null) headers['X-Project-Key'] = key;
  const res = await request.post(`${opts.baseUrl ?? ''}/api/incidents`, {
    headers,
    data: body,
  });
  const responseContentType = res.headers()['content-type'] ?? '';
  let json: Record<string, unknown> | null = null;
  if (responseContentType.includes('application/json')) {
    json = (await res.json()) as Record<string, unknown>;
  }
  return { status: res.status(), json, contentType: responseContentType };
}

/**
 * Raw HTTP/1.1 POST with `Transfer-Encoding: chunked` and **no**
 * `Content-Length` — the only framing that can reach the streaming counter
 * instead of the pre-read. The body is written in 1 MB chunks until the
 * server answers or 32 MB have gone out; either way the row only passes if
 * the structured 413 naming `MAX_BODY_BYTES` comes back.
 */
async function postChunkedWithoutContentLength(): Promise<string> {
  const boundary = `----watchbugchunked${randomUUID().replace(/-/g, '')}`;
  const socket = connect(3000, '127.0.0.1');
  socket.on('error', () => {
    /* the server may reset the connection after answering — the response, if
     * any, has already been collected by the reader below. */
  });
  await once(socket, 'connect');

  const head =
    'POST /api/incidents HTTP/1.1\r\n' +
    'Host: 127.0.0.1:3000\r\n' +
    'Content-Type: multipart/form-data; boundary=' +
    boundary +
    '\r\n' +
    'Transfer-Encoding: chunked\r\n' +
    'X-Project-Key: ' +
    KEY +
    '\r\n' +
    'Idempotency-Key: e2e-chunked-' +
    randomUUID() +
    '\r\n' +
    '\r\n';

  let received = '';
  const response = new Promise<string>((resolveResponse) => {
    socket.on('data', (data) => {
      received += data.toString('latin1');
      if (/^HTTP\/1\.[01] \d{3}/.test(received)) resolveResponse(received);
    });
    socket.on('close', () => resolveResponse(received));
  });

  const frame = (payload: Buffer): Buffer =>
    Buffer.concat([
      Buffer.from(`${payload.length.toString(16)}\r\n`),
      payload,
      Buffer.from('\r\n'),
    ]);

  socket.write(head);
  socket.write(
    frame(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="meta"\r\n\r\n${META}\r\n` +
          `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="stream.png"\r\n` +
          'Content-Type: image/png\r\n\r\n',
      ),
    ),
  );

  const mebibyte = Buffer.alloc(1024 * 1024, 0x41);
  const cap = 32 * 1024 * 1024;
  const pause = (ms: number): Promise<void> => new Promise((resolvePause) => setTimeout(resolvePause, ms));
  let written = 0;

  // Paced writes: the body must still be in flight when the server's counter
  // reaches the cap, otherwise this row could pass on the parser's own error
  // instead of on the streaming abort it is named for.
  while (written < cap && !socket.destroyed && !received.startsWith('HTTP/')) {
    try {
      socket.write(frame(mebibyte));
    } catch {
      break; // the server closed the connection mid-upload
    }
    written += mebibyte.length;
    await pause(10);
  }

  try {
    if (!received.startsWith('HTTP/')) socket.write('0\r\n\r\n');
  } catch {
    /* already closed by the server — the answer is what matters */
  }

  const text = await Promise.race([
    response,
    pause(20_000).then(() => received),
  ]);
  socket.destroy();
  return text;
}

/**
 * A truthful `Content-Length` over `MAX_BODY_BYTES`, spoken over a raw socket.
 *
 * Playwright's request API cannot observe this answer, and the server is not
 * at fault: the pre-read rejects on the header while this client is still
 * uploading, and `close()` on a socket with unread inbound data makes the
 * kernel answer RST rather than FIN — which can discard the 413 the client has
 * not consumed yet, surfacing as `read ECONNRESET`. Same transport choice as
 * the chunked row above, whose `socket.on('error', ...)` comment records
 * exactly this fact. Collecting the response as its first bytes arrive lets
 * the assertion see the server's real answer instead of the transport's
 * accounting of it.
 *
 * The pre-read's own wording is asserted, not just `MAX_BODY_BYTES`: the
 * streaming counter names that same constant, so without it layer 2 would not
 * be distinguishable from layer 2b and would prove nothing about which gate
 * answered.
 */
async function postOversizeDeclaredBody(): Promise<string> {
  const boundary = `----watchbugdeclared${randomUUID().replace(/-/g, '')}`;
  const declared = MAX_BODY_BYTES + 1024 * 1024;
  const socket = connect(3000, '127.0.0.1');
  socket.on('error', () => {
    /* the server may reset the connection after answering — the response, if
     * any, has already been collected by the reader below. */
  });
  await once(socket, 'connect');

  const head =
    'POST /api/incidents HTTP/1.1\r\n' +
    'Host: 127.0.0.1:3000\r\n' +
    'Content-Type: multipart/form-data; boundary=' +
    boundary +
    '\r\n' +
    'Content-Length: ' +
    declared +
    '\r\n' +
    'X-Project-Key: ' +
    KEY +
    '\r\n' +
    'Idempotency-Key: e2e-declared-' +
    randomUUID() +
    '\r\n' +
    '\r\n';

  let received = '';
  const response = new Promise<string>((resolveResponse) => {
    socket.on('data', (data) => {
      received += data.toString('latin1');
      if (/^HTTP\/1\.[01] \d{3}/.test(received)) resolveResponse(received);
    });
    socket.on('close', () => resolveResponse(received));
  });

  const pause = (ms: number): Promise<void> => new Promise((resolvePause) => setTimeout(resolvePause, ms));
  const chunk = Buffer.alloc(1024 * 1024, 0x41);
  let written = 0;

  socket.write(head);
  // Paced writes, for the same reason the chunked row paces: the body must
  // still be in flight when the pre-read answers, or this row could pass
  // without ever exercising "reject before the body is read".
  while (written < declared && !socket.destroyed && !received.startsWith('HTTP/')) {
    try {
      socket.write(chunk);
    } catch {
      break; // the server closed the connection mid-upload
    }
    written += chunk.length;
    await pause(10);
  }

  const text = await Promise.race([response, pause(20_000).then(() => received)]);
  socket.destroy();
  return text;
}

test('ING-06 layer 1: image part > MAX_IMAGE_PART_BYTES (4 MB) → 413 structured at the multipart parser', async ({ request }) => {
  // Total body stays under nginx's 5m so this row reaches the API layer it
  // names; the parser aborts the upload and the message names the constant.
  const partOver = await postHostile(request, {
    filename: 'shot.png',
    mime: 'image/png',
    bytes: Buffer.alloc(MAX_IMAGE_PART_BYTES + 512 * 1024, 0x41),
  });
  expect(partOver.status).toBe(413);
  expect(partOver.json).not.toBeNull();
  expect(partOver.json?.statusCode).toBe(413);
  expect(partOver.json?.error).toBe('Payload Too Large');
  expect(String(partOver.json?.message)).toContain('MAX_IMAGE_PART_BYTES');
});

test('ING-06 layer 2: body > MAX_BODY_BYTES (5 MB) → 413 structured from the Content-Length pre-read (direct to API)', async () => {
  // Sent straight to the API origin so the *API's* gate is the layer under
  // test (nginx would answer first at the panel origin). Truthful
  // Content-Length: the pre-read must reject before the body is read, and the
  // message must name MAX_BODY_BYTES — and specifically the PRE-READ, since
  // the streaming counter names that constant too (layer 2b). Transport is the
  // raw socket rather than Playwright's request API; see
  // postOversizeDeclaredBody() for why the API's own client cannot observe
  // this answer reliably.
  const bodyOver = await postOversizeDeclaredBody();
  expect(bodyOver).toMatch(/^HTTP\/1\.[01] 413/);
  expect(bodyOver).toContain('application/json');
  expect(bodyOver).toContain('MAX_BODY_BYTES');
  expect(bodyOver).toContain('Content-Length pre-read');
});

test('ING-06 layer 2b: a chunked body with NO Content-Length over MAX_BODY_BYTES is aborted by the streaming counter → 413', async () => {
  // The pre-read has nothing to read here, so only a byte counter that
  // watches the live stream and destroys it at the cap can answer — and the
  // answer must still be structured and name MAX_BODY_BYTES.
  const text = await postChunkedWithoutContentLength();
  expect(text).toMatch(/^HTTP\/1\.[01] 413/);
  expect(text).toContain('MAX_BODY_BYTES');
  expect(text).toContain('application/json');
});

test('ING-06 layer 3: the stated nginx limit (client_max_body_size 5m) stops the same body at the panel origin', async ({ request }) => {
  // Status only — nginx answers in HTML by design; the structured layers are
  // asserted in the two tests above.
  const viaNginx = await postHostile(request, {
    filename: 'shot.png',
    mime: 'image/png',
    bytes: Buffer.alloc(MAX_BODY_BYTES + 1024 * 1024, 0x41),
  });
  expect(viaNginx.status).toBe(413);
});

test('ING-06: an encoded image over MAX_ENCODED_IMAGE_BYTES is rejected 413 (semantic cap, A-06 hard)', async ({ request }) => {
  // A 2.5 MB "PNG" — under the 4 MB parser limit so the *semantic* cap is the
  // layer under test, and the check runs before sniff/structure/guard.
  const over = await postHostile(request, {
    filename: 'shot.png',
    mime: 'image/png',
    bytes: Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(MAX_ENCODED_IMAGE_BYTES + 512 * 1024, 0x42),
    ]),
  });
  expect(over.status).toBe(413);
  expect(over.json).not.toBeNull();
  expect(over.json?.statusCode).toBe(413);
  expect(over.json?.error).toBe('Payload Too Large');
  expect(String(over.json?.message)).toContain('MAX_ENCODED_IMAGE_BYTES');
});

test('C-3: SVG, GIF/HTML polyglot and decode-bomb payloads are rejected 400 (structured)', async ({ request }) => {
  // SVG unconditionally — script-bearing vector markup is never an image here.
  const svg = await postHostile(request, { filename: 'hostile.svg', mime: 'image/svg+xml', bytes: hostileSvg });
  expect(svg.status).toBe(400);
  expect(svg.json?.statusCode).toBe(400);
  expect(svg.json?.error).toBe('Bad Request');

  // GIF89a magic + HTML: a polyglot that would render as script in any
  // consumer that sniffs differently. Magic bytes decide, not the mime.
  const polyglot = await postHostile(request, {
    filename: 'polyglot-gif-html.gif',
    mime: 'image/gif',
    bytes: polyglotGif,
  });
  expect(polyglot.status).toBe(400);
  expect(polyglot.json?.statusCode).toBe(400);
  expect(polyglot.json?.error).toBe('Bad Request');

  // Decode bomb: a structurally valid 68-byte PNG declaring 50000x50000px —
  // rejected from the header dimensions before any decoder sees it (H-7).
  const bomb = await postHostile(request, {
    filename: 'decode-bomb.png',
    mime: 'image/png',
    bytes: decodeBomb,
  });
  expect(bomb.status).toBe(400);
  expect(bomb.json?.statusCode).toBe(400);
  expect(String(bomb.json?.message)).toMatch(/MAX_IMAGE_(DIM|PIXELS)/);
});

test('C-4: traversal-shaped client filenames are rejected 400 — the name never reaches a path', async ({ request }) => {
  for (const filename of ['../../../etc/passwd.png', '..\\..\\windows\\system32\\evil.png', 'nested/dir/shot.png']) {
    const res = await postHostile(request, { filename, mime: 'image/png', bytes: png });
    expect(res.status, `filename ${JSON.stringify(filename)} must be rejected`).toBe(400);
    expect(res.json?.statusCode).toBe(400);
    expect(res.json?.error).toBe('Bad Request');
    expect(String(res.json?.message)).toMatch(/filename/i);
  }
});

test('C-3/C-4: the blob route serves the report with the full inert header set and a fixed ASCII name', async ({ request }) => {
  // A benign-but-client-supplied filename travels with the upload. Whatever
  // the client called the file, the response must carry the *server's* name:
  // the stored key is `projectId/<xx>/<uuid>.<ext>` (asserted before any file
  // access by STORAGE_KEY_REGEX + the resolve-prefix check in fs-storage) and
  // is never observable from outside — the only reachable facts are this
  // id-scoped URL and the headers below.
  const created = await request.post('/api/incidents', {
    multipart: {
      meta: META,
      image: { name: 'report shot (final).png', mimeType: 'image/png', buffer: png },
    },
    headers: { 'X-Project-Key': KEY, 'Idempotency-Key': `e2e-blob-${randomUUID()}` },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  const blob = await request.get(`/api/incidents/${id}/image`);
  expect(blob.status()).toBe(200);
  const headers = blob.headers();
  expect(headers['content-type']).toBe('image/png');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['content-disposition']).toBe('attachment; filename="screenshot.png"');
  expect(headers['content-disposition']).not.toContain('report shot');
  expect(headers['content-security-policy']).toContain("default-src 'none'");
  expect(headers['content-security-policy']).toContain('sandbox');
  expect(headers['cross-origin-resource-policy']).toBe('same-origin');
  expect(headers['cache-control']).toContain('private');

  // The stored key never leaves the server in any projection either.
  const list = (await (await request.get('/api/incidents')).json()) as Array<Record<string, unknown>>;
  const row = list.find((r) => r.id === id);
  expect(row).toBeDefined();
  expect(row).not.toHaveProperty('storageKey');
  expect(row).not.toHaveProperty('projectId');
});

test('C-4: an unknown incident id is 404 — never 400, and the body shape matches the other 404s', async ({ request }) => {
  const res = await request.get(`/api/incidents/${randomUUID()}/image`);
  expect(res.status()).toBe(404);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.statusCode).toBe(404);
  expect(body.error).toBe('Not Found');
  expect(body.message).toBe('incident not found');
});

/**
 * ING-04 (T-01-14) — the project-key capability gate.
 *
 * The three rejection shapes (missing header, unknown-but-well-formed key,
 * malformed key) must answer with **one byte-identical structured 401**: the
 * response is never allowed to reveal whether a key exists. The gate runs
 * before any meta/image work and before any `Storage.put`, so a rejected
 * submission leaves the report list untouched.
 *
 * The exact message is part of the contract here — it is the *only* message
 * any of the three shapes may produce.
 */
const UNIFORM_401_BODY = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'invalid or missing project key',
};

test('ING-04: missing, unknown and malformed project keys all get the same structured 401 and nothing is stored', async ({ request }) => {
  const before = (await (await request.get('/api/incidents')).json() as unknown[]).length;

  const missing = await postHostile(request, { filename: 'shot.png', mime: 'image/png', bytes: png }, { key: null });
  const unknown = await postHostile(
    request,
    { filename: 'shot.png', mime: 'image/png', bytes: png },
    { key: 'wkbt_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ' }, // well-formed, not seeded
  );
  const malformed = await postHostile(
    request,
    { filename: 'shot.png', mime: 'image/png', bytes: png },
    { key: 'not-a-project-key' }, // wrong prefix and length
  );

  for (const [label, res] of [
    ['missing', missing],
    ['unknown', unknown],
    ['malformed', malformed],
  ] as const) {
    expect(res.status, `${label} key must be rejected with 401`).toBe(401);
    expect(res.json).toEqual(UNIFORM_401_BODY);
  }

  // Byte-for-byte identical: no existence hint leaks through the body.
  const encoded = [missing, unknown, malformed].map((r) => JSON.stringify(r.json));
  expect(encoded[1]).toBe(encoded[0]);
  expect(encoded[2]).toBe(encoded[0]);

  // Nothing was stored by any of the three.
  const after = (await (await request.get('/api/incidents')).json() as unknown[]).length;
  expect(after).toBe(before);
});

test('ING-04 concurrency: a parallel burst of invalid-key requests each receives its own uniform 401 and stores nothing', async ({ request }) => {
  const before = (await (await request.get('/api/incidents')).json() as unknown[]).length;

  const image: ImagePart = { filename: 'shot.png', mime: 'image/png', bytes: png };
  const burst = await Promise.all([
    postHostile(request, image, { key: null }),
    postHostile(request, image, { key: 'wkbt_ffffffffffffffffffffffffffffffff' }),
    postHostile(request, image, { key: null }),
    postHostile(request, image, { key: 'garbage' }),
    postHostile(request, image, { key: 'wkbt_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ' }),
    postHostile(request, image, { key: 'wkbt_short' }),
  ]);

  for (const res of burst) {
    expect(res.status).toBe(401);
    expect(res.json).toEqual(UNIFORM_401_BODY);
  }

  const after = (await (await request.get('/api/incidents')).json() as unknown[]).length;
  expect(after).toBe(before);
});

/**
 * ING-05 (T-01-12) — the three composed limiters.
 *
 * Each row isolates ONE dimension, so a pass can never be satisfied by the
 * wrong limiter:
 *
 *  - **per key**: one fresh `X-Project-Key`, one *fresh forwarded IP per
 *    request* (the per-IP bucket can never be the one that trips), firing
 *    exactly `RATE_LIMIT_PER_KEY_PER_MIN` requests — none 429 — then
 *    `max+1` → 429 (inclusive boundary).
 *  - **per IP**: one fresh key *and one fresh forwarded IP for the whole
 *    window*, firing exactly `RATE_LIMIT_PER_IP_PER_MIN` requests, then
 *    `max+1` → 429. The key's own counters stay far below their maxima.
 *  - **per day**: one fresh key accumulating `RATE_LIMIT_PER_PROJECT_PER_DAY`
 *    requests across per-key windows (a fresh IP per request keeps the per-IP
 *    bucket out of it), then the next request → 429.
 *
 * All rows speak **directly to the API origin** so the `X-Forwarded-For`
 * header is the only forwarded identity (nginx would overwrite it with the
 * real client address — CR-02). That requires a `WATCHBUG_TRUST_PROXY`
 * trust configuration in `.env` that honours this loopback test entry (the
 * shipped trust list or `true` — Pitfall 5), asserted by config, not assumed.
 *
 * Boundaries are derived from the configured maxima in `.env` — the same
 * file the api reads — never hardcoded here.
 */

/** Deterministic unique forwarded IPs (10.0.x.x): one per request, ≤ 65 535 per run. */
let ipSequence = 0;
function freshIp(): string {
  ipSequence += 1;
  const n = ipSequence;
  return `10.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

/** A random per-run IP in a range the deterministic sequence never uses. */
function randomIp(): string {
  return `10.${64 + Math.floor(Math.random() * 64)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

/** A well-formed, never-seeded `wkbt_` key: its own per-key and per-day buckets. */
function freshProjectKey(): string {
  const hex = `${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`;
  return `wkbt_${hex.slice(0, 32)}`;
}

/** The maxima the api is configured with — parsed from the `.env` it reads. */
function rateLimitConfig(): { perKeyPerMin: number; perIpPerMin: number; perProjectPerDay: number } {
  const envFile = readFileSync(resolve(repoRoot, '.env'), 'utf8');
  const read = (name: string): number => {
    const match = new RegExp(`^${name}=(\\d+)$`, 'm').exec(envFile);
    if (match === null) {
      throw new Error(`.env must set ${name} to an integer — the boundary rows derive their maxima from it`);
    }
    return Number(match[1]);
  };
  const config = {
    perKeyPerMin: read('WATCHBUG_RATE_LIMIT_PER_KEY_PER_MIN'),
    perIpPerMin: read('WATCHBUG_RATE_LIMIT_PER_IP_PER_MIN'),
    perProjectPerDay: read('WATCHBUG_RATE_LIMIT_PER_PROJECT_PER_DAY'),
  };
  // Each row isolates one dimension; the configured order is what makes the
  // *other* two limiters unable to trip first. Fail loud if a future `.env`
  // edit breaks the ordering instead of producing a silently wrong pass.
  if (config.perKeyPerMin >= config.perProjectPerDay) {
    throw new Error(
      `WATCHBUG_RATE_LIMIT_PER_KEY_PER_MIN (${config.perKeyPerMin}) must be below ` +
        `WATCHBUG_RATE_LIMIT_PER_PROJECT_PER_DAY (${config.perProjectPerDay}) — otherwise the daily limiter masks the per-key boundary`,
    );
  }
  if (config.perIpPerMin >= config.perKeyPerMin) {
    throw new Error(
      `WATCHBUG_RATE_LIMIT_PER_IP_PER_MIN (${config.perIpPerMin}) must be below ` +
        `WATCHBUG_RATE_LIMIT_PER_KEY_PER_MIN (${config.perKeyPerMin}) — otherwise the per-key limiter masks the per-IP boundary`,
    );
  }
  return config;
}

interface ProbeResult {
  status: number;
  json: Record<string, unknown> | null;
  retryAfter: string | undefined;
}

/** JSON probe straight to the API: reaches the preHandlers and never the ingest body. */
async function postProbe(
  request: import('@playwright/test').APIRequestContext,
  opts: { key?: string; ip: string; baseUrl?: string },
): Promise<ProbeResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'X-Forwarded-For': opts.ip };
  if (opts.key !== undefined) headers['X-Project-Key'] = opts.key;
  const res = await request.post(`${opts.baseUrl ?? API_ORIGIN}/api/incidents`, { headers, data: { probe: 'ing-05' } });
  const contentType = res.headers()['content-type'] ?? '';
  const json = contentType.includes('application/json')
    ? ((await res.json()) as Record<string, unknown>)
    : null;
  return { status: res.status(), json, retryAfter: res.headers()['retry-after'] };
}

/** A 429 must be structured, name the dimension that tripped, and carry a whole-second Retry-After ≥ 1. */
function expectRateLimited(res: ProbeResult, dimension: string): void {
  expect(res.status).toBe(429);
  expect(res.json).not.toBeNull();
  expect(res.json?.statusCode).toBe(429);
  expect(res.json?.error).toBe('Too Many Requests');
  expect(String(res.json?.message)).toContain(dimension);
  expect(res.retryAfter, 'a 429 must carry Retry-After').toBeDefined();
  expect(String(res.retryAfter)).toMatch(/^\d+$/); // integer of whole seconds — never fractional
  expect(Number(res.retryAfter)).toBeGreaterThanOrEqual(1); // never 0
}

test('ING-05 per key: exactly RATE_LIMIT_PER_KEY_PER_MIN requests pass on a fresh key, max+1 is 429 + Retry-After', async ({ request }) => {
  test.setTimeout(120_000);
  const { perKeyPerMin } = rateLimitConfig();
  const key = freshProjectKey();
  for (let i = 1; i <= perKeyPerMin; i++) {
    // Fresh forwarded IP per request: only the per-key bucket can accumulate.
    const res = await postProbe(request, { key, ip: freshIp() });
    expect(res.status, `request ${i} of ${perKeyPerMin} must not be rate limited (inclusive boundary)`).not.toBe(429);
  }
  const over = await postProbe(request, { key, ip: freshIp() });
  expectRateLimited(over, 'RATE_LIMIT_PER_KEY_PER_MIN');
});

test('ING-05 per IP: exactly RATE_LIMIT_PER_IP_PER_MIN requests pass from one forwarded IP, max+1 is 429 + Retry-After', async ({ request }) => {
  test.setTimeout(120_000);
  const { perIpPerMin } = rateLimitConfig();
  const key = freshProjectKey();
  const ip = randomIp(); // one client identity for the whole window
  for (let i = 1; i <= perIpPerMin; i++) {
    const res = await postProbe(request, { key, ip });
    expect(res.status, `request ${i} of ${perIpPerMin} must not be rate limited (inclusive boundary)`).not.toBe(429);
  }
  const over = await postProbe(request, { key, ip });
  expectRateLimited(over, 'RATE_LIMIT_PER_IP_PER_MIN');
});

test('ING-05 per day: the daily project quota trips at RATE_LIMIT_PER_PROJECT_PER_DAY + 1 with Retry-After', async ({ request }) => {
  test.setTimeout(600_000);
  const { perKeyPerMin, perProjectPerDay } = rateLimitConfig();
  const key = freshProjectKey();
  let sent = 0;
  while (sent < perProjectPerDay) {
    const batch = Math.min(perKeyPerMin, perProjectPerDay - sent);
    for (let start = 0; start < batch; start += 50) {
      const chunk = Math.min(50, batch - start);
      const results = await Promise.all(
        Array.from({ length: chunk }, () => postProbe(request, { key, ip: freshIp() })),
      );
      for (const res of results) {
        sent += 1;
        expect(res.status, `request ${sent} of ${perProjectPerDay} must pass while the daily quota lasts`).not.toBe(429);
      }
    }
    if (sent < perProjectPerDay) {
      // The per-key minute window must expire between batches (or the
      // per-key limiter would mask the daily one); the day window must not.
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 65_000));
    }
  }
  const over = await postProbe(request, { key, ip: freshIp() });
  expectRateLimited(over, 'RATE_LIMIT_PER_PROJECT_PER_DAY');
});

/**
 * CR-01 — key-normalization asymmetry: the limiter bucketed on the RAW
 * `X-Project-Key` header while the gate trims it. Node's HTTP parser strips
 * only SP/HTAB OWS, so an NBSP (U+00A0) padding byte survives to
 * `req.headers`, `trim()` removes it, and the padded variant is ACCEPTED by
 * the gate as the same project while being counted in a FRESH bucket —
 * minting unlimited per-key/per-day quota from one public key.
 *
 * The padded probes speak **raw bytes** over a socket so the `0xA0` byte
 * reaches the wire exactly as an exploit client would send it (no client
 * library re-encoding in between).
 */
async function postProbeRaw(headersLine: string): Promise<ProbeResult> {
  const socket = connect(3000, '127.0.0.1');
  socket.on('error', () => {
    /* the server may reset the connection after answering — the response, if
     * any, has already been collected by the reader below. */
  });
  await once(socket, 'connect');

  const body = JSON.stringify({ probe: 'ing-05' });
  const requestText =
    'POST /api/incidents HTTP/1.1\r\n' +
    'Host: 127.0.0.1:3000\r\n' +
    'Content-Type: application/json\r\n' +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    'Connection: close\r\n' +
    headersLine +
    '\r\n' +
    body;
  socket.write(requestText, 'latin1');

  let received = '';
  await new Promise<void>((resolveRead) => {
    socket.on('data', (data) => {
      received += data.toString('latin1');
    });
    socket.on('close', () => resolveRead());
    setTimeout(resolveRead, 20_000).unref();
  });
  socket.destroy();

  const headEnd = received.indexOf('\r\n\r\n');
  const head = headEnd === -1 ? received : received.slice(0, headEnd);
  const statusMatch = /^HTTP\/1\.[01] (\d{3})/.exec(head);
  const retryAfter = /(?:^|\r\n)retry-after:\s*(\d+)/i.exec(head)?.[1];
  let json: Record<string, unknown> | null = null;
  if (headEnd !== -1) {
    const text = received.slice(headEnd + 4).trim();
    if (text.length > 0) {
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        json = null;
      }
    }
  }
  return {
    status: statusMatch === null ? 0 : Number(statusMatch[1]),
    json,
    retryAfter,
  };
}

test('CR-01: NBSP-padded X-Project-Key shares the padded key\'s bucket — padding never mints fresh per-key quota', async ({ request }) => {
  test.setTimeout(180_000);
  const { perKeyPerMin } = rateLimitConfig();
  const key = freshProjectKey();

  // 1) Fill the plain key's per-minute bucket exactly to its max: none may 429.
  for (let i = 1; i <= perKeyPerMin; i++) {
    const res = await postProbe(request, { key, ip: freshIp() });
    expect(res.status, `request ${i} of ${perKeyPerMin} must not be rate limited (inclusive boundary)`).not.toBe(429);
  }

  // 2) Same key with one trailing NBSP byte (0xA0) on the wire: the gate trims
  //    and accepts it as the same project, so the limiter MUST count it in the
  //    same bucket → request max+1 is 429 + Retry-After.
  const suffixPadded = await postProbeRaw(
    `X-Project-Key: ${key}\xA0\r\nX-Forwarded-For: ${freshIp()}\r\n`,
  );
  expectRateLimited(suffixPadded, 'RATE_LIMIT_PER_KEY_PER_MIN');

  // 3) Leading + double-trailing NBSP padding must not mint another bucket either.
  const bothPadded = await postProbeRaw(
    `X-Project-Key: \xA0${key}\xA0\xA0\r\nX-Forwarded-For: ${freshIp()}\r\n`,
  );
  expectRateLimited(bothPadded, 'RATE_LIMIT_PER_KEY_PER_MIN');
});

/**
 * CR-02 — `trustProxy: true` resolved `req.ip` from the LEFTMOST
 * `X-Forwarded-For` entry, i.e. from attacker-controlled bytes. Two rows, one
 * per exposure:
 *
 *  - **direct**: a forged leftmost entry must never become `req.ip`; the
 *    hop adjacent to the trusted edge (rightmost) owns the per-IP bucket.
 *  - **proxy**: nginx must overwrite the client's `X-Forwarded-For` at the
 *    panel edge — a forged entry must not ride the proxy into a fresh bucket.
 */
test('CR-02 (direct): a forged leftmost X-Forwarded-For entry never becomes req.ip — the asserted rightmost hop owns the per-IP bucket', async ({ request }) => {
  test.setTimeout(180_000);
  const { perIpPerMin } = rateLimitConfig();
  const key = freshProjectKey();
  const asserted = randomIp(); // the hop adjacent to the trusted edge — the identity that must win
  for (let i = 1; i <= perIpPerMin; i++) {
    const forged = randomIp(); // attacker-prepended entry, varied per request
    const res = await postProbe(request, { key, ip: `${forged}, ${asserted}` });
    expect(res.status, `request ${i} must bucket on the asserted hop, not on the forged leftmost entry`).not.toBe(429);
  }
  const over = await postProbe(request, { key, ip: `${randomIp()}, ${asserted}` });
  expectRateLimited(over, 'RATE_LIMIT_PER_IP_PER_MIN');
});

test('CR-02 (proxy): nginx overwrites the client X-Forwarded-For — a forged entry cannot ride the panel edge into a fresh per-IP bucket', async ({ request }) => {
  test.setTimeout(180_000);
  const { perIpPerMin } = rateLimitConfig();
  const key = freshProjectKey();
  const forged = randomIp();

  // Exhaust the forged identity's per-IP bucket with direct probes (a
  // single-entry XFF resolves to `forged` under any trust configuration that
  // honours the suite's loopback test entry).
  for (let i = 1; i <= perIpPerMin; i++) {
    const res = await postProbe(request, { key, ip: forged });
    expect(res.status, `request ${i} of ${perIpPerMin} must not be rate limited (inclusive boundary)`).not.toBe(429);
  }
  const over = await postProbe(request, { key, ip: forged });
  expectRateLimited(over, 'RATE_LIMIT_PER_IP_PER_MIN');

  // The SAME forged entry arriving through the panel origin: nginx must have
  // REPLACED it with the real client address, so this request is bucketed
  // under the real client — never under the exhausted forged identity.
  const viaPanel = await postProbe(request, { key, ip: forged, baseUrl: '' });
  expect(viaPanel.status, 'the forged X-Forwarded-For entry must not survive the nginx edge').not.toBe(429);
});

/**
 * ING-08 (T-01-13, A-11) — the `WATCHBUG_CORS_ORIGINS` allowlist with the
 * Origin-present rule (Pitfall 9):
 *
 *  - a **present** `Origin` must be on the allowlist, else 403 structured and
 *    nothing is stored;
 *  - an allowlisted origin is accepted AND gets the CORS allow headers for
 *    exactly that origin;
 *  - **no** `Origin` header (curl / server-side — P1-D-07's onboarding
 *    flow) is accepted.
 *
 * The allowlisted origin is read from the same `.env` the api reads, so the
 * row can never drift from the deployed configuration.
 */

function allowedOrigin(): string {
  const envFile = readFileSync(resolve(repoRoot, '.env'), 'utf8');
  const match = /^WATCHBUG_CORS_ORIGINS=(.*)$/m.exec(envFile);
  const first = match?.[1]?.split(',').map((o) => o.trim()).filter(Boolean)[0];
  if (first === undefined) {
    throw new Error('.env must set WATCHBUG_CORS_ORIGINS to at least one origin — the ING-08 rows need one');
  }
  return first;
}

function ingestWithOrigin(
  request: import('@playwright/test').APIRequestContext,
  origin: string | undefined,
): Promise<import('@playwright/test').APIResponse> {
  const headers: Record<string, string> = {
    'X-Project-Key': KEY,
    'Idempotency-Key': `e2e-origin-${randomUUID()}`,
  };
  if (origin !== undefined) headers['Origin'] = origin;
  return request.post('/api/incidents', {
    multipart: {
      meta: META,
      image: { name: 'shot.png', mimeType: 'image/png', buffer: png },
    },
    headers,
  });
}

test('ING-08 trio: non-allowlisted Origin → 403 + nothing stored; allowlisted Origin → 201 + CORS headers; no Origin → 201', async ({ request }) => {
  const allowed = allowedOrigin();

  // 1. Present but NOT allowlisted → structured 403, list unchanged.
  const before = (await (await request.get('/api/incidents')).json() as unknown[]).length;
  const rejected = await ingestWithOrigin(request, 'https://evil.example');
  expect(rejected.status()).toBe(403);
  const body = (await rejected.json()) as Record<string, unknown>;
  expect(body.statusCode).toBe(403);
  expect(body.error).toBe('Forbidden');
  const after = (await (await request.get('/api/incidents')).json() as unknown[]).length;
  expect(after).toBe(before); // nothing was stored

  // 2. Allowlisted → accepted, with the CORS allow headers for that origin.
  const accepted = await ingestWithOrigin(request, allowed);
  expect(accepted.status()).toBe(201);
  expect(accepted.headers()['access-control-allow-origin']).toBe(allowed);

  // 3. No Origin header (curl / server-side onboarding, P1-D-07) → accepted.
  const curl = await ingestWithOrigin(request, undefined);
  expect(curl.status()).toBe(201);
});

test(`ING-08 concurrency: a mixed parallel burst yields per-request decisions matching each request's own Origin`, async ({ request }) => {
  const allowed = allowedOrigin();
  const origins: Array<string | undefined> = [
    allowed,
    'https://evil.example',
    allowed,
    'https://not-in-the-list.example',
    allowed,
    undefined, // header-less client mixed into the burst
  ];
  const results = await Promise.all(origins.map((origin) => ingestWithOrigin(request, origin)));
  for (const [i, res] of results.entries()) {
    const origin = origins[i];
    if (origin === undefined || origin === allowed) {
      expect(res.status(), `request ${i} (Origin: ${String(origin)}) must be accepted`).toBe(201);
    } else {
      expect(res.status(), `request ${i} (Origin: ${String(origin)}) must be rejected 403`).toBe(403);
    }
  }
});

/**
 * ING-07 (SEC-05 pass 1, C-3) — sanitise on write.
 *
 * Hostile *text* (as opposed to hostile image bytes) is accepted and stored,
 * but never with its markup intact: `sanitize-html` with an empty allowlist
 * runs over every user string before the contract re-validation, and the C-3
 * double control is completed on the render side (pass 2) in the rows that
 * assert the panel's DOM.
 *
 * The properties asserted here are the plan's own edges:
 *
 *  - **markup removed, payload text kept in document order** — the img-onerror
 *    payload, `<script>`, `javascript:`, UTF-7 and BOM strings all store as
 *    plain text with no raw `<` around them;
 *  - **text-preserving** — `2 < 3 & 4 > 1` round-trips as that exact literal,
 *    `<b>a</b><i>b</i>` stores as `ab`;
 *  - **empty edge** — a zero-length `title` is a structured 400, an absent
 *    optional `note`/`user` stores as `null`, never `""`;
 *  - **encoding edge** — caps follow the contract's `maxLength` semantics
 *    (Unicode code points; identical to code units for the ASCII boundary):
 *    inclusive at the cap, one over is 400, and a value that sanitises
 *    *wider* than its input (`&` → `&amp;`) still never exceeds the cap it
 *    was validated against;
 *  - **control characters** — stripped from the stored string in the same pass.
 *
 * Row 1 rows send the meta part the way the panel/SDK do (Playwright
 * `multipart`, a plain string field); the JSON-content-type shape of the
 * onboarding curl is covered in `e2e/ingest.spec.ts`.
 */

const BOM = String.fromCharCode(0xfeff);
const NUL = String.fromCharCode(0);
const VT = String.fromCharCode(0x0b);
const US = String.fromCharCode(0x1f);

/** POST an arbitrary meta object with the valid fixture image. */
async function postMeta(
  request: import('@playwright/test').APIRequestContext,
  meta: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await request.post('/api/incidents', {
    multipart: {
      meta: JSON.stringify(meta),
      image: { name: 'shot.png', mimeType: 'image/png', buffer: png },
    },
    headers: { 'X-Project-Key': KEY, 'Idempotency-Key': `e2e-ing07-${randomUUID()}` },
  });
  return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
}

/** The stored row exactly as `GET /api/incidents` serves it (pass 1 artifact). */
async function storedRow(
  request: import('@playwright/test').APIRequestContext,
  id: string,
): Promise<Record<string, unknown>> {
  const list = (await (await request.get('/api/incidents')).json()) as Array<Record<string, unknown>>;
  const row = list.find((r) => r.id === id);
  expect(row, `incident ${id} must appear in the list`).toBeDefined();
  return row as Record<string, unknown>;
}

const BASE_META = {
  type: 'bug' as const,
  title: 'ING-07 probe',
  url: '/ing-07',
};

test('ING-07 pass 1: hostile text payloads are stored with all markup removed (img-onerror, script, BOM, UTF-7, entity-encoded)', async ({ request }) => {
  // 1. The canonical img-onerror payload with surrounding text: the tag
  //    disappears entirely, the surrounding text stays (document order, the
  //    two spaces are the tag's removal seam).
  const imgTitle = await postMeta(request, {
    ...BASE_META,
    title: 'Hello <img src=x onerror=alert(1)> world',
    note: '<script>document.cookie</script>Leaky notes',
    user: { id: 'u-1', name: '<img src=x onerror=alert(1)>Admin', email: 'bad<script>alert(1)</script>@x.com' },
  });
  expect(imgTitle.status).toBe(201);
  const imgRow = await storedRow(request, imgTitle.body.id as string);
  expect(imgRow.title).toBe('Hello  world');
  expect(imgRow.note).toBe('Leaky notes');
  expect((imgRow.user as { name: string }).name).toBe('Admin');
  expect((imgRow.user as { email: string }).email).toBe('bad@x.com');
  // No raw markup survives anywhere in the stored strings.
  for (const value of [imgRow.title, imgRow.note, JSON.stringify(imgRow.user)]) {
    expect(value).not.toContain('<');
    expect(value).not.toContain('>');
    expect(value).not.toContain('onerror=');
  }

  // 2. The raw `"><img …>` payload: the tag is gone, the quote pair remains.
  const quote = await postMeta(request, { ...BASE_META, title: '"><img src=x onerror=alert(1)>' });
  expect(quote.status).toBe(201);
  expect((await storedRow(request, quote.body.id as string)).title).toBe('">');

  // 3. `javascript:` is inert as plain text — stored verbatim, and pass 2
  //    never linkifies it (the render-side rows assert the DOM).
  const jsUri = await postMeta(request, { ...BASE_META, title: 'javascript:alert(1)' });
  expect(jsUri.status).toBe(201);
  expect((await storedRow(request, jsUri.body.id as string)).title).toBe('javascript:alert(1)');

  // 4. UTF-7 style payload: it never contains a raw `<`, so it is stored as
  //    the literal text it is (decoding it is the consumer's problem, and the
  //    panel renders text only).
  const utf7 = await postMeta(request, { ...BASE_META, title: '+ADw-script+AD4-alert(1)+ADw-/script+AD4-' });
  expect(utf7.status).toBe(201);
  const utf7Row = await storedRow(request, utf7.body.id as string);
  expect(utf7Row.title).toBe('+ADw-script+AD4-alert(1)+ADw-/script+AD4-');
  expect(utf7Row.title).not.toContain('<');

  // 5. UTF-16 BOM in front of the payload: the BOM is a control character and
  //    is stripped with the tag, leaving the literal text behind it.
  const bom = await postMeta(request, { ...BASE_META, title: `${BOM}Login <img src=x onerror=alert(1)> failed` });
  expect(bom.status).toBe(201);
  expect((await storedRow(request, bom.body.id as string)).title).toBe('Login  failed');

  // 6. Entity-encoded markup must stay entity-encoded: decoding it on write
  //    would store raw `<img …>` text — the entity form is the markup-free
  //    form, both for a bare payload and inside a `<title>` RCDATA container
  //    (which sanitize-html preserves as escaped text).
  const entity = await postMeta(request, { ...BASE_META, title: '&lt;img src=x onerror=alert(1)&gt;' });
  expect(entity.status).toBe(201);
  expect((await storedRow(request, entity.body.id as string)).title).toBe('&lt;img src=x onerror=alert(1)&gt;');

  const titleTag = await postMeta(request, { ...BASE_META, title: '<title><img src=x onerror=alert(1)></title>' });
  expect(titleTag.status).toBe(201);
  expect((await storedRow(request, titleTag.body.id as string)).title).toBe('&lt;img src=x onerror=alert(1)&gt;');
});

test('ING-07 pass 1: plain text with angle brackets round-trips exactly; styled fragments keep document order', async ({ request }) => {
  // Text-preserving stripping: `2 < 3 & 4 > 1` is plain text (the `<` opens
  // no tag), so it must come back from GET /api/incidents byte-for-byte —
  // NOT entity-escaped, or the panel would render "2 &lt; 3 &amp; 4 &gt; 1".
  const plain = await postMeta(request, { ...BASE_META, title: '2 < 3 & 4 > 1' });
  expect(plain.status).toBe(201);
  expect((await storedRow(request, plain.body.id as string)).title).toBe('2 < 3 & 4 > 1');

  // Adjacent styled fragments: tags dropped, surviving text concatenated in
  // document order — `ab`, never `ba`, never `a b`.
  const fragments = await postMeta(request, { ...BASE_META, title: '<b>a</b><i>b</i>' });
  expect(fragments.status).toBe(201);
  expect((await storedRow(request, fragments.body.id as string)).title).toBe('ab');
});

test('ING-07 empty edge: a zero-length title is rejected 400; absent optional fields are stored as null', async ({ request }) => {
  // Markup-only title case: `title: ""` fails the contract before sanitising
  // (min(1)) — a structured 400, never an empty stored title.
  const empty = await postMeta(request, { ...BASE_META, title: '' });
  expect(empty.status).toBe(400);
  expect(empty.body.statusCode).toBe(400);
  expect(empty.body.error).toBe('Bad Request');

  // Absent optional `note` and `user` stay absent: the row stores NULL, and
  // the list projection reports `null` — never an empty-string coercion.
  const minimal = await postMeta(request, { type: 'bug', title: 'absent optional fields' });
  expect(minimal.status).toBe(201);
  const row = await storedRow(request, minimal.body.id as string);
  expect(row.note).toBeNull();
  expect(row.url).toBeNull();
  expect(row.user).toBeNull();
});

test('ING-07 encoding edge: caps count Unicode code points (inclusive at the cap, one over is 400) and sanitised output never exceeds its cap', async ({ request }) => {
  // Inclusive boundary: exactly MAX_TITLE_CHARS (200 UTF-16 code units).
  const atCap = 'a'.repeat(200);
  const ok = await postMeta(request, { ...BASE_META, title: atCap });
  expect(ok.status).toBe(201);
  expect((await storedRow(request, ok.body.id as string)).title).toBe(atCap);

  // One unit over the cap → structured 400.
  const overCap = await postMeta(request, { ...BASE_META, title: 'a'.repeat(201) });
  expect(overCap.status).toBe(400);
  expect(overCap.body.statusCode).toBe(400);

  // Astral characters: Zod 4's `maxLength` counts **Unicode code points**
  // (the same semantics JSON Schema gives `maxLength`), not UTF-16 code
  // units — so 200 emoji (400 UTF-16 units) is exactly at the cap, and the
  // 201st code point trips it. The ASCII rows above are identical under
  // either counting; this pair pins the astral boundary to the published
  // contract's own semantics.
  const emojiAtCap = '😀'.repeat(200); // 200 code points / 400 UTF-16 units
  const emojiOk = await postMeta(request, { ...BASE_META, title: emojiAtCap });
  expect(emojiOk.status).toBe(201);
  expect((await storedRow(request, emojiOk.body.id as string)).title).toBe(emojiAtCap);
  const emojiOver = await postMeta(request, { ...BASE_META, title: `${emojiAtCap}😀` }); // 201 code points
  expect(emojiOver.status).toBe(400);
  expect(emojiOver.body.statusCode).toBe(400);

  // Sanitising can widen a value (`&` → `&amp;`): 200 `&` is a legal title
  // and must still *store* as 200 characters — never be rejected for
  // exceeding the cap on its own escape, and never be stored wider than the
  // cap it validated against.
  const amps = '&'.repeat(200);
  const ampOk = await postMeta(request, { ...BASE_META, title: amps });
  expect(ampOk.status).toBe(201);
  const ampRow = await storedRow(request, ampOk.body.id as string);
  expect(ampRow.title).toBe(amps);
  expect((ampRow.title as string).length).toBeLessThanOrEqual(200);
});

test('ING-07: control characters are stripped from every user string on write', async ({ request }) => {
  // NUL is rejected by PostgreSQL itself (text may not contain U+0000), so
  // without the strip the insert cannot even happen; VT/US pass through as
  // ordinary characters. All three must be gone from the stored value.
  const title = `evil${NUL}${VT}${US}payload`;
  const res = await postMeta(request, { ...BASE_META, title, note: `line one${VT}line two` });
  expect(res.status).toBe(201);
  const row = await storedRow(request, res.body.id as string);
  expect(row.title).toBe('evilpayload');
  expect(row.note).toBe('line oneline two');
  expect(row.title).not.toContain(NUL);
  expect(row.title).not.toContain(VT);
  expect(row.title).not.toContain(US);
});

/**
 * R-08 / S-5 — the single contract stores `meta.url` as a **path only**.
 *
 * The rule is enforced INSIDE `reportSchema` (a string transform), so both
 * ingest stages re-parse through it and every runtime consumer inherits it.
 * Three cases pin the property: a query+fragment payload is stripped, a full
 * href keeps scheme-origin + path and loses only query+fragment, and an
 * already-clean path round-trips untouched (idempotent).
 */
const R08_SENTINEL = 'r08-sentinel-7f3a1c';

test('R-08/S-5: meta.url is stored path-only — query string and fragment stripped on ingest', async ({ request }) => {
  // Case A: query + fragment carrying a distinct sentinel → stored as the
  // bare path, and no trace of the sentinel survives in the served list.
  const caseA = await postMeta(request, {
    ...BASE_META,
    title: 'R-08 strip probe',
    url: `/checkout?token=${R08_SENTINEL}#frag`,
  });
  expect(caseA.status).toBe(201);
  const rowA = await storedRow(request, caseA.body.id as string);
  expect(rowA.url).toBe('/checkout');
  const listText = await (await request.get('/api/incidents')).text();
  expect(listText).not.toContain(R08_SENTINEL);
  expect(listText).not.toContain('#frag');

  // Case B: a full href keeps scheme-origin + path; only query + fragment go.
  const caseB = await postMeta(request, {
    ...BASE_META,
    title: 'R-08 full href probe',
    url: `https://x.dev/callback?code=${R08_SENTINEL}#frag`,
  });
  expect(caseB.status).toBe(201);
  expect((await storedRow(request, caseB.body.id as string)).url).toBe('https://x.dev/callback');

  // Case C: an already-clean path is untouched (the transform is idempotent
  // and leaves every existing fixture alone).
  const caseC = await postMeta(request, { ...BASE_META, title: 'R-08 clean path probe', url: '/plain-path' });
  expect(caseC.status).toBe(201);
  expect((await storedRow(request, caseC.body.id as string)).url).toBe('/plain-path');
});

/**
 * ING-07 pass 2 (C-3 render half) — inertness in the panel DOM.
 *
 * Pass 1 guarantees the database never holds markup; pass 2 guarantees the
 * browser never gets a chance to parse any, whatever slips through: every
 * report field is a React text node inside a JSX expression (auto-escaped),
 * there is no HTML-rendering sink anywhere in the panel, and the detail image
 * only ever receives the blob-route URL. These rows prove it at the DOM level
 * (queries against the live page, never regex over serialized HTML) and at the
 * source level (the sink gate) — the double control's render half.
 */
test('ING-07 pass 2: stored hostile payloads render as literal text and inject zero elements into the panel DOM', async ({ page, request }) => {
  // Store the pass-1 artefacts first: raw img-onerror with surrounding text,
  // entity-encoded markup, the plain-text round-trip and the styled fragments.
  const titles = [
    '&lt;img src=x onerror=alert(1)&gt;',
    '2 < 3 & 4 > 1',
    '<b>a</b><i>b</i>',
    'Hello <img src=x onerror=alert(1)> world', // posted last → first in the list (createdAt desc)
  ];
  for (const title of titles) {
    const res = await postMeta(request, { ...BASE_META, title });
    expect(res.status, `payload ${JSON.stringify(title)} must store`).toBe(201);
  }

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Watchbug' })).toBeVisible();
  // Wait for the list fetch to land (WebKit renders the shell before the
  // promise resolves — the body snapshot below must see rows, not "Loading…").
  await expect(page.locator('aside button').first()).toBeVisible();

  // Every payload's surviving text is visible as literal text — innerText is
  // the *rendered* text, so an entity-escaped payload shows its entity form
  // and a stripped payload shows only what passed through pass 1.
  const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const normalise = (s: string): string => s.replace(/\s+/g, ' ');
  expect(bodyText).toContain(normalise('Hello  world'));
  expect(bodyText).toContain('2 < 3 & 4 > 1');
  expect(bodyText).toContain('ab');
  expect(bodyText).toContain('&lt;img src=x onerror=alert(1)&gt;');

  // The newest row is auto-selected, so the detail pane shows it too: text
  // node, not markup.
  const detailHeading = page.locator('main h2');
  await expect(detailHeading).toHaveCount(1);
  expect((await detailHeading.innerText()).replace(/\s+/g, ' ')).toContain('Hello world');

  // Zero elements attributable to the payloads — DOM queries, not HTML regex.
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.locator('[onerror]')).toHaveCount(0);
  await expect(page.locator('script:not([src])')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);

  // The one image on the page is the report screenshot, served from the
  // blob route — never a payload-supplied src.
  const shot = page.locator('main img');
  await expect(shot).toHaveCount(1);
  expect((await shot.getAttribute('src')) ?? '').toMatch(/^\/api\/incidents\/[0-9a-f-]{36}\/image$/);
});

test('ING-07 pass 2: apps/panel/src contains no HTML-rendering sink (dangerouslySetInnerHTML / innerHTML)', async () => {
  // Source-level sink gate: the DOM rows above prove today's rendering is
  // inert; this gate stops a future `dangerouslySetInnerHTML` / `innerHTML`
  // assignment from quietly becoming tomorrow's bypass (C-3 warning sign).
  const files = readdirSync(resolve(repoRoot, 'apps/panel/src'), { recursive: true })
    .map((entry) => String(entry))
    .filter((entry) => /\.(ts|tsx|css)$/.test(entry));
  expect(files.length).toBeGreaterThan(3); // the walk actually found the panel sources

  for (const file of files) {
    const source = readFileSync(resolve(repoRoot, 'apps/panel/src', file), 'utf8');
    expect(source.includes('dangerouslySetInnerHTML'), `${file} must not contain a dangerouslySetInnerHTML sink`).toBe(false);
    expect(source.includes('innerHTML'), `${file} must not contain an innerHTML sink`).toBe(false);
  }
});
