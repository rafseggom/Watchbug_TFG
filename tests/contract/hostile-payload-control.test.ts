import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');
const png = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'));
const hostileSvg = readFileSync(resolve(repoRoot, 'e2e/fixtures/hostile.svg'));
const polyglotGif = readFileSync(resolve(repoRoot, 'e2e/fixtures/polyglot-gif-html.gif'));
const decodeBomb = readFileSync(resolve(repoRoot, 'e2e/fixtures/decode-bomb.png'));

const API_ORIGIN = 'http://127.0.0.1:3000';

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

describe('C-3: hostile image content rejected — SVG, GIF/HTML polyglot, decode-bomb', () => {
  const fetch = globalThis.fetch;

  it('SVG unconditionally rejected 400 — script-bearing vector markup is never an image here', async () => {
    const svg = await postHostile(fetch, { filename: 'hostile.svg', mime: 'image/svg+xml', bytes: hostileSvg });
    expect(svg.status).toBe(400);
    expect(svg.json?.statusCode).toBe(400);
    expect(svg.json?.error).toBe('Bad Request');
  });

  it('GIF/HTML polyglot rejected 400 — magic bytes decide, not the mime', async () => {
    const polyglot = await postHostile(fetch, {
      filename: 'polyglot-gif-html.gif',
      mime: 'image/gif',
      bytes: polyglotGif,
    });
    expect(polyglot.status).toBe(400);
    expect(polyglot.json?.statusCode).toBe(400);
    expect(polyglot.json?.error).toBe('Bad Request');
  });

  it('decode bomb rejected 400 — structurally valid PNG declaring 50000x50000px rejected from header dimensions', async () => {
    const bomb = await postHostile(fetch, {
      filename: 'decode-bomb.png',
      mime: 'image/png',
      bytes: decodeBomb,
    });
    expect(bomb.status).toBe(400);
    expect(bomb.json?.statusCode).toBe(400);
    expect(String(bomb.json?.message)).toMatch(/MAX_IMAGE_(DIM|PIXELS)/);
  });
});

describe('C-4: traversal-shaped client filenames rejected — the name never reaches a path', () => {
  const fetch = globalThis.fetch;

  it('traversal filenames and nested paths are rejected 400', async () => {
    for (const filename of ['../../../etc/passwd.png', '..\\..\\windows\\system32\\evil.png', 'nested/dir/shot.png']) {
      const res = await postHostile(fetch, { filename, mime: 'image/png', bytes: png });
      expect(res.status, `filename ${JSON.stringify(filename)} must be rejected`).toBe(400);
      expect(res.json?.statusCode).toBe(400);
      expect(res.json?.error).toBe('Bad Request');
      expect(String(res.json?.message)).toMatch(/filename/i);
    }
  });
});

describe('C-3/C-4: blob route serves with inert headers and fixed ASCII name', () => {
  const fetch = globalThis.fetch;

  it('blob route carries server-controlled name and full inert header set', async () => {
    const boundary = `----watchbugblob${randomUUID().replace(/-/g, '')}`;
    const chunks: Buffer[] = [];
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="meta"\r\n\r\n${META}\r\n`));
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="report shot (final).png"\r\n` +
          `Content-Type: image/png\r\n\r\n`,
      ),
    );
    chunks.push(png);
    chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(chunks);
    const contentType = `multipart/form-data; boundary=${boundary}`;

    const created = await fetch(`${API_ORIGIN}/api/incidents`, {
      method: 'POST',
      headers: { 'content-type': contentType, 'X-Project-Key': KEY, 'Idempotency-Key': `e2e-blob-${randomUUID()}` },
      body,
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const blob = await fetch(`${API_ORIGIN}/api/incidents/${id}/image`, { headers: { 'X-Project-Key': KEY } });
    expect(blob.status).toBe(200);
    const headers = Object.fromEntries(blob.headers.entries());
    expect(headers['content-type']).toBe('image/png');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-disposition']).toBe('attachment; filename="screenshot.png"');
    expect(headers['content-disposition']).not.toContain('report shot');
    expect(headers['content-security-policy']).toContain("default-src 'none'");
    expect(headers['content-security-policy']).toContain('sandbox');
    expect(headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(headers['cache-control']).toContain('private');

    const list = (await (await fetch(`${API_ORIGIN}/api/incidents`, { headers: { 'X-Project-Key': KEY } })).json()) as Array<Record<string, unknown>>;
    const row = list.find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('storageKey');
    expect(row).not.toHaveProperty('projectId');
  });

  it('unknown incident id is 404 — never 400, and the body shape matches other 404s', async () => {
    const res = await fetch(`${API_ORIGIN}/api/incidents/${randomUUID()}/image`, { headers: { 'X-Project-Key': KEY } });
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.statusCode).toBe(404);
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('incident not found');
  });
});