import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect } from 'node:net';
import { once } from 'node:events';

const repoRoot = resolve(__dirname, '../..');
const png = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'));

/** Layer caps under test (mirrors packages/contracts/src/constants.ts). */
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB — Content-Length pre-read + streaming counter
const MAX_IMAGE_PART_BYTES = 4 * 1024 * 1024; // 4 MB — multipart parser limit
const MAX_ENCODED_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB — semantic cap (A-06 "hard")

/** Direct-to-API origin: bypasses nginx, reaches Fastify's own gates. */
const API_ORIGIN = 'http://127.0.0.1:3000';
const PANEL_ORIGIN = 'http://127.0.0.1:8080';

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
  json: Record<string, unknown> | null;
  contentType: string;
}

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

async function postHostile(
  fetch: typeof globalThis.fetch,
  image: ImagePart,
  opts: { baseUrl?: string; key?: string | null } = {},
): Promise<PostResult> {
  const { body, contentType } = buildMultipart(META, image);
  const headers: Record<string, string> = {
    'content-type': contentType,
    'Idempotency-Key': `e2e-hostile-${randomUUID()}`,
  };
  const key = opts.key === undefined ? KEY : opts.key;
  if (key !== null) headers['X-Project-Key'] = key;
  const res = await fetch(`${opts.baseUrl ?? API_ORIGIN}/api/incidents`, {
    method: 'POST',
    headers,
    body,
  });
  const responseContentType = res.headers.get('content-type') ?? '';
  let json: Record<string, unknown> | null = null;
  if (responseContentType.includes('application/json')) {
    json = (await res.json()) as Record<string, unknown>;
  }
  return { status: res.status, json, contentType: responseContentType };
}

async function postChunkedWithoutContentLength(): Promise<string> {
  const boundary = `----watchbugchunked${randomUUID().replace(/-/g, '')}`;
  const socket = connect(3000, '127.0.0.1');
  socket.on('error', () => {
    /* the server may reset the connection after answering */
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

  while (written < cap && !socket.destroyed && !received.startsWith('HTTP/')) {
    try {
      socket.write(frame(mebibyte));
    } catch {
      break;
    }
    written += mebibyte.length;
    await pause(10);
  }

  try {
    if (!received.startsWith('HTTP/')) socket.write('0\r\n\r\n');
  } catch {
    /* already closed by the server */
  }

  const text = await Promise.race([response, pause(20_000).then(() => received)]);
  socket.destroy();
  return text;
}

async function postOversizeDeclaredBody(): Promise<string> {
  const boundary = `----watchbugdeclared${randomUUID().replace(/-/g, '')}`;
  const declared = MAX_BODY_BYTES + 1024 * 1024;
  const socket = connect(3000, '127.0.0.1');
  socket.on('error', () => {
    /* the server may reset the connection after answering */
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
  while (written < declared && !socket.destroyed && !received.startsWith('HTTP/')) {
    try {
      socket.write(chunk);
    } catch {
      break;
    }
    written += chunk.length;
    await pause(10);
  }

  const text = await Promise.race([response, pause(20_000).then(() => received)]);
  socket.destroy();
  return text;
}

describe('ING-06: size caps — hostile submission layer enforcement', () => {
  const fetch = globalThis.fetch;

  it('layer 1: image part > MAX_IMAGE_PART_BYTES (4 MB) → 413 structured at the multipart parser', { timeout: 60_000 }, async () => {
    const partOver = await postHostile(fetch, {
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

  it('layer 2: body > MAX_BODY_BYTES (5 MB) → 413 structured from the Content-Length pre-read (direct to API)', { timeout: 60_000 }, async () => {
    const bodyOver = await postOversizeDeclaredBody();
    expect(bodyOver).toMatch(/^HTTP\/1\.[01] 413/);
    expect(bodyOver).toContain('application/json');
    expect(bodyOver).toContain('MAX_BODY_BYTES');
    expect(bodyOver).toContain('Content-Length pre-read');
  });

  it('layer 2b: a chunked body with NO Content-Length over MAX_BODY_BYTES is aborted by the streaming counter → 413', { timeout: 120_000 }, async () => {
    const text = await postChunkedWithoutContentLength();
    expect(text).toMatch(/^HTTP\/1\.[01] 413/);
    expect(text).toContain('MAX_BODY_BYTES');
    expect(text).toContain('application/json');
  });

  it('layer 3: the stated nginx limit (client_max_body_size 5m) stops the same body at the panel origin', { timeout: 60_000 }, async () => {
    const viaNginx = await postHostile(fetch, {
      filename: 'shot.png',
      mime: 'image/png',
      bytes: Buffer.alloc(MAX_BODY_BYTES + 1024 * 1024, 0x41),
    }, { baseUrl: PANEL_ORIGIN }); // panel origin via nginx
    expect(viaNginx.status).toBe(413);
  });

  it('an encoded image over MAX_ENCODED_IMAGE_BYTES is rejected 413 (semantic cap, A-06 hard)', { timeout: 60_000 }, async () => {
    const over = await postHostile(fetch, {
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
});