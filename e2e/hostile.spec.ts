import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { connect } from 'node:net';
import { resolve } from 'node:path';

/**
 * ING-06 / C-3 / C-4 — the hostile-submission group.
 *
 * Every row here asserts that a hostile payload is rejected with its
 * *structured* status code (roadmap success criterion 4) and never reaches
 * storage. Rows are deliberately layered:
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
 * `client_max_body_size`.
 */
async function postHostile(
  request: import('@playwright/test').APIRequestContext,
  image: ImagePart,
  opts: { baseUrl?: string; title?: string } = {},
): Promise<PostResult> {
  const { body, contentType } = buildMultipart(META, image);
  void opts.title; // titles stay uniform: hostile rows never store anything
  const res = await request.post(`${opts.baseUrl ?? ''}/api/incidents`, {
    headers: {
      'content-type': contentType,
      'X-Project-Key': KEY,
      'Idempotency-Key': `e2e-hostile-${randomUUID()}`,
    },
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
  let written = 0;
  while (written < cap && !socket.destroyed && !received.startsWith('HTTP/')) {
    if (!socket.write(frame(mebibyte)) /* backpressure: wait for drain */) {
      await Promise.race([once(socket, 'drain'), once(socket, 'close').catch(() => [])]);
    }
    written += mebibyte.length;
  }
  try {
    socket.write('0\r\n\r\n');
  } catch {
    /* already closed by the server — the answer is what matters */
  }

  const text = await response;
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

test('ING-06 layer 2: body > MAX_BODY_BYTES (5 MB) → 413 structured from the Content-Length pre-read (direct to API)', async ({ request }) => {
  // Sent straight to the API origin so the *API's* gate is the layer under
  // test (nginx would answer first at the panel origin). Truthful
  // Content-Length: the pre-read must reject before the body is read, and
  // the message must name MAX_BODY_BYTES.
  const bodyOver = await postHostile(
    request,
    { filename: 'shot.png', mime: 'image/png', bytes: Buffer.alloc(MAX_BODY_BYTES + 1024 * 1024, 0x41) },
    { baseUrl: API_ORIGIN },
  );
  expect(bodyOver.status).toBe(413);
  expect(bodyOver.json).not.toBeNull();
  expect(bodyOver.json?.statusCode).toBe(413);
  expect(bodyOver.json?.error).toBe('Payload Too Large');
  expect(String(bodyOver.json?.message)).toContain('MAX_BODY_BYTES');
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
