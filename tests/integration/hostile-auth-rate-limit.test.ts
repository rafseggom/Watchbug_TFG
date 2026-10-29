import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect } from 'node:net';
import { once } from 'node:events';

const repoRoot = resolve(__dirname, '../..');
const png = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'));

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

const UNIFORM_401_BODY = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'invalid or missing project key',
};

describe('ING-04: project-key capability gate', () => {
  const fetch = globalThis.fetch;

  it('missing, unknown and malformed project keys all get the same structured 401 and nothing is stored', async () => {
    const listBefore = await (await fetch(`${API_ORIGIN}/api/incidents`, { headers: { 'X-Project-Key': KEY } })).json() as unknown[];
    const before = listBefore.length;

    const missing = await postHostile(fetch, { filename: 'shot.png', mime: 'image/png', bytes: png }, { key: null });
    const unknown = await postHostile(
      fetch,
      { filename: 'shot.png', mime: 'image/png', bytes: png },
      { key: 'wkbt_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ' },
    );
    const malformed = await postHostile(
      fetch,
      { filename: 'shot.png', mime: 'image/png', bytes: png },
      { key: 'not-a-project-key' },
    );

    for (const [label, res] of [
      ['missing', missing],
      ['unknown', unknown],
      ['malformed', malformed],
    ] as const) {
      expect(res.status, `${label} key must be rejected with 401`).toBe(401);
      expect(res.json).toEqual(UNIFORM_401_BODY);
    }

    const encoded = [missing, unknown, malformed].map((r) => JSON.stringify(r.json));
    expect(encoded[1]).toBe(encoded[0]);
    expect(encoded[2]).toBe(encoded[0]);

    const listAfter = await (await fetch(`${API_ORIGIN}/api/incidents`, { headers: { 'X-Project-Key': KEY } })).json() as unknown[];
    const after = listAfter.length;
    expect(after).toBe(before);
  });

  it('concurrency: a parallel burst of invalid-key requests each receives its own uniform 401 and stores nothing', async () => {
    const listBefore = await (await fetch(`${API_ORIGIN}/api/incidents`, { headers: { 'X-Project-Key': KEY } })).json() as unknown[];
    const before = listBefore.length;

    const image: ImagePart = { filename: 'shot.png', mime: 'image/png', bytes: png };
    const burst = await Promise.all([
      postHostile(fetch, image, { key: null }),
      postHostile(fetch, image, { key: 'wkbt_ffffffffffffffffffffffffffffffff' }),
      postHostile(fetch, image, { key: null }),
      postHostile(fetch, image, { key: 'garbage' }),
      postHostile(fetch, image, { key: 'wkbt_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ' }),
      postHostile(fetch, image, { key: 'wkbt_short' }),
    ]);

    for (const res of burst) {
      expect(res.status).toBe(401);
      expect(res.json).toEqual(UNIFORM_401_BODY);
    }

    const listAfter = await (await fetch(`${API_ORIGIN}/api/incidents`, { headers: { 'X-Project-Key': KEY } })).json() as unknown[];
    const after = listAfter.length;
    expect(after).toBe(before);
  });
});

/** Deterministic unique forwarded IPs (10.0.x.x): one per request, ≤ 65 535 per run. */
let ipSequence = 0;
function freshIp(): string {
  ipSequence += 1;
  const n = ipSequence;
  return `10.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

function randomIp(): string {
  return `10.${64 + Math.floor(Math.random() * 64)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function freshProjectKey(): string {
  const hex = `${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`;
  return `wkbt_${hex.slice(0, 32)}`;
}

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

async function postProbe(
  fetch: typeof globalThis.fetch,
  opts: { key?: string; ip: string; baseUrl?: string },
): Promise<ProbeResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'X-Forwarded-For': opts.ip };
  if (opts.key !== undefined) headers['X-Project-Key'] = opts.key;
  const res = await fetch(`${opts.baseUrl ?? API_ORIGIN}/api/incidents`, { method: 'POST', headers, body: JSON.stringify({ probe: 'ing-05' }) });
  const contentType = res.headers.get('content-type') ?? '';
  const json = contentType.includes('application/json')
    ? ((await res.json()) as Record<string, unknown>)
    : null;
  return { status: res.status, json, retryAfter: res.headers.get('retry-after') ?? undefined };
}

function expectRateLimited(res: ProbeResult, dimension: string): void {
  expect(res.status).toBe(429);
  expect(res.json).not.toBeNull();
  expect(res.json?.statusCode).toBe(429);
  expect(res.json?.error).toBe('Too Many Requests');
  expect(String(res.json?.message)).toContain(dimension);
  expect(res.retryAfter, 'a 429 must carry Retry-After').toBeDefined();
  expect(String(res.retryAfter)).toMatch(/^\d+$/);
  expect(Number(res.retryAfter)).toBeGreaterThanOrEqual(1);
}

describe('ING-05: composed rate limiters (per key, per IP, per day)', () => {
  const fetch = globalThis.fetch;

  it('per key: exactly RATE_LIMIT_PER_KEY_PER_MIN requests pass on a fresh key, max+1 is 429 + Retry-After', { timeout: 120_000 }, async () => {
    const { perKeyPerMin } = rateLimitConfig();
    const key = freshProjectKey();
    for (let i = 1; i <= perKeyPerMin; i++) {
      const res = await postProbe(fetch, { key, ip: freshIp() });
      expect(res.status, `request ${i} of ${perKeyPerMin} must not be rate limited (inclusive boundary)`).not.toBe(429);
    }
    const over = await postProbe(fetch, { key, ip: freshIp() });
    expectRateLimited(over, 'RATE_LIMIT_PER_KEY_PER_MIN');
  });

  it('per IP: exactly RATE_LIMIT_PER_IP_PER_MIN requests pass from one forwarded IP, max+1 is 429 + Retry-After', { timeout: 120_000 }, async () => {
    const { perIpPerMin } = rateLimitConfig();
    const key = freshProjectKey();
    const ip = randomIp();
    for (let i = 1; i <= perIpPerMin; i++) {
      const res = await postProbe(fetch, { key, ip });
      expect(res.status, `request ${i} of ${perIpPerMin} must not be rate limited (inclusive boundary)`).not.toBe(429);
    }
    const over = await postProbe(fetch, { key, ip });
    expectRateLimited(over, 'RATE_LIMIT_PER_IP_PER_MIN');
  });

  it('per day: the daily project quota trips at RATE_LIMIT_PER_PROJECT_PER_DAY + 1 with Retry-After', { timeout: 600_000 }, async () => {
    const { perKeyPerMin, perProjectPerDay } = rateLimitConfig();
    const key = freshProjectKey();
    let sent = 0;
    while (sent < perProjectPerDay) {
      const batch = Math.min(perKeyPerMin, perProjectPerDay - sent);
      for (let start = 0; start < batch; start += 50) {
        const chunk = Math.min(50, batch - start);
        const results = await Promise.all(
          Array.from({ length: chunk }, () => postProbe(fetch, { key, ip: freshIp() })),
        );
        for (const res of results) {
          sent += 1;
          expect(res.status, `request ${sent} of ${perProjectPerDay} must pass while the daily quota lasts`).not.toBe(429);
        }
      }
      if (sent < perProjectPerDay) {
        await new Promise((resolveSleep) => setTimeout(resolveSleep, 65_000));
      }
    }
    const over = await postProbe(fetch, { key, ip: freshIp() });
    expectRateLimited(over, 'RATE_LIMIT_PER_PROJECT_PER_DAY');
  });
});

describe('CR-01: NBSP-padded X-Project-Key bucket sharing', () => {
  const fetch = globalThis.fetch;

  async function postProbeRaw(headersLine: string): Promise<ProbeResult> {
    const socket = connect(3000, '127.0.0.1');
    socket.on('error', () => {
      /* the server may reset the connection after answering */
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

  it('NBSP-padded X-Project-Key shares the padded key\'s bucket — padding never mints fresh per-key quota', { timeout: 180_000 }, async () => {
    const { perKeyPerMin } = rateLimitConfig();
    const key = freshProjectKey();

    for (let i = 1; i <= perKeyPerMin; i++) {
      const res = await postProbe(fetch, { key, ip: freshIp() });
      expect(res.status, `request ${i} of ${perKeyPerMin} must not be rate limited (inclusive boundary)`).not.toBe(429);
    }

    const suffixPadded = await postProbeRaw(
      `X-Project-Key: ${key}\xA0\r\nX-Forwarded-For: ${freshIp()}\r\n`,
    );
    expectRateLimited(suffixPadded, 'RATE_LIMIT_PER_KEY_PER_MIN');

    const bothPadded = await postProbeRaw(
      `X-Project-Key: \xA0${key}\xA0\xA0\r\nX-Forwarded-For: ${freshIp()}\r\n`,
    );
    expectRateLimited(bothPadded, 'RATE_LIMIT_PER_KEY_PER_MIN');
  });
});

describe('CR-02: forged X-Forwarded-For never owns the per-IP bucket', () => {
  const fetch = globalThis.fetch;

  it('(direct): a forged leftmost X-Forwarded-For entry never becomes req.ip — the asserted rightmost hop owns the per-IP bucket', { timeout: 180_000 }, async () => {
    const { perIpPerMin } = rateLimitConfig();
    const key = freshProjectKey();
    const asserted = randomIp();
    for (let i = 1; i <= perIpPerMin; i++) {
      const forged = randomIp();
      const res = await postProbe(fetch, { key, ip: `${forged}, ${asserted}` });
      expect(res.status, `request ${i} must bucket on the asserted hop, not on the forged leftmost entry`).not.toBe(429);
    }
    const over = await postProbe(fetch, { key, ip: `${randomIp()}, ${asserted}` });
    expectRateLimited(over, 'RATE_LIMIT_PER_IP_PER_MIN');
  });

  it('(proxy): nginx overwrites the client X-Forwarded-For — a forged entry cannot ride the panel edge into a fresh per-IP bucket', { timeout: 180_000 }, async () => {
    const { perIpPerMin } = rateLimitConfig();
    const key = freshProjectKey();
    const forged = randomIp();

    for (let i = 1; i <= perIpPerMin; i++) {
      const res = await postProbe(fetch, { key, ip: forged });
      expect(res.status, `request ${i} of ${perIpPerMin} must not be rate limited (inclusive boundary)`).not.toBe(429);
    }
    const over = await postProbe(fetch, { key, ip: forged });
    expectRateLimited(over, 'RATE_LIMIT_PER_IP_PER_MIN');

    const viaPanel = await postProbe(fetch, { key, ip: forged, baseUrl: PANEL_ORIGIN });
    expect(viaPanel.status, 'the forged X-Forwarded-For entry must not survive the nginx edge').not.toBe(429);
  });
});

function allowedOrigin(): string {
  const envFile = readFileSync(resolve(repoRoot, '.env'), 'utf8');
  const match = /^WATCHBUG_CORS_ORIGINS=(.*)$/m.exec(envFile);
  const first = match?.[1]?.split(',').map((o) => o.trim()).filter(Boolean)[0];
  if (first === undefined) {
    throw new Error('.env must set WATCHBUG_CORS_ORIGINS to at least one origin — the ING-08 rows need one');
  }
  return first;
}

async function ingestWithOrigin(
  fetch: typeof globalThis.fetch,
  origin: string | undefined,
): Promise<{ status: number; headers: Record<string, string> }> {
  const headers: Record<string, string> = {
    'X-Project-Key': KEY,
    'Idempotency-Key': `e2e-origin-${randomUUID()}`,
  };
  if (origin !== undefined) headers['Origin'] = origin;
  const boundary = `----watchbugorigin${randomUUID().replace(/-/g, '')}`;
  const chunks: Buffer[] = [];
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="meta"\r\n\r\n${META}\r\n`));
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="shot.png"\r\n` +
        `Content-Type: image/png\r\n\r\n`,
    ),
  );
  chunks.push(png);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(chunks);
  const contentType = `multipart/form-data; boundary=${boundary}`;

  const res = await fetch(`${API_ORIGIN}/api/incidents`, {
    method: 'POST',
    headers: { ...headers, 'content-type': contentType },
    body,
  });
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => { responseHeaders[key] = value; });
  return { status: res.status, headers: responseHeaders };
}

describe('ING-08: CORS Origin allowlist with Origin-present rule', () => {
  const fetch = globalThis.fetch;

  it('trio: non-allowlisted Origin → 403 + nothing stored; allowlisted Origin → 201 + CORS headers; no Origin → 201', async () => {
    const allowed = allowedOrigin();

    const listBefore = await (await fetch(`${API_ORIGIN}/api/incidents`, { headers: { 'X-Project-Key': KEY } })).json() as unknown[];
    const before = listBefore.length;

    const rejected = await ingestWithOrigin(fetch, 'https://evil.example');
    expect(rejected.status).toBe(403);
    const listAfterReject = await (await fetch(`${API_ORIGIN}/api/incidents`, { headers: { 'X-Project-Key': KEY } })).json() as unknown[];
    expect(listAfterReject.length).toBe(before);

    const accepted = await ingestWithOrigin(fetch, allowed);
    expect(accepted.status).toBe(201);
    expect(accepted.headers['access-control-allow-origin']).toBe(allowed);

    const curl = await ingestWithOrigin(fetch, undefined);
    expect(curl.status).toBe(201);
  });

  it('concurrency: a mixed parallel burst yields per-request decisions matching each request\'s own Origin', async () => {
    const allowed = allowedOrigin();
    const origins: Array<string | undefined> = [
      allowed,
      'https://evil.example',
      allowed,
      'https://not-in-the-list.example',
      allowed,
      undefined,
    ];
    const results = await Promise.all(origins.map((origin) => ingestWithOrigin(fetch, origin)));
    for (const [i, res] of results.entries()) {
      const origin = origins[i];
      if (origin === undefined || origin === allowed) {
        expect(res.status, `request ${i} (Origin: ${String(origin)}) must be accepted`).toBe(201);
      } else {
        expect(res.status, `request ${i} (Origin: ${String(origin)}) must be rejected 403`).toBe(403);
      }
    }
  });
});