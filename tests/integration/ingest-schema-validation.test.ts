import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const API_BASE = 'http://127.0.0.1:3000';

const png = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'));
const webp = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.webp'));
const jpeg = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.jpg'));
const oversizeJpeg = readFileSync(resolve(repoRoot, 'e2e/fixtures/oversize-64mp.jpg'));
const rotatedJpeg = readFileSync(resolve(repoRoot, 'e2e/fixtures/rotated-exif-80x40.jpg'));
const polyglotGif = readFileSync(resolve(repoRoot, 'e2e/fixtures/polyglot-gif-html.gif'));

function readProjectKey(): string {
  const envFile = readFileSync(resolve(repoRoot, '.env'), 'utf8');
  const match = /^WATCHBUG_PROJECT_KEY=(.+)$/m.exec(envFile);
  if (!match) throw new Error('.env has no WATCHBUG_PROJECT_KEY');
  const key = match[1].trim();
  if (key === 'wkbt_00000000000000000000000000000000') {
    throw new Error('.env still holds the placeholder key');
  }
  return key;
}

async function postIncident(opts: {
  key: string;
  idempotencyKey: string;
  meta: Record<string, unknown>;
  image?: Buffer;
  filename?: string;
  mime?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const formData = new FormData();
  formData.append('meta', JSON.stringify(opts.meta));
  if (opts.image) {
    const blob = new Blob([opts.image], { type: opts.mime ?? 'image/png' });
    formData.append('image', blob, opts.filename ?? 'shot.png');
  }
  const headers: Record<string, string> = { 'X-Project-Key': opts.key };
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await fetch(`${API_BASE}/api/incidents`, {
    method: 'POST',
    headers,
    body: formData,
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function getIncidents(key: string): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(`${API_BASE}/api/incidents`, {
    headers: { 'X-Project-Key': key },
  });
  return (await res.json()) as Array<Record<string, unknown>>;
}

async function getImage(key: string, id: string): Promise<{ status: number; body: Buffer; headers: Record<string, string> }> {
  const res = await fetch(`${API_BASE}/api/incidents/${id}/image`, {
    headers: { 'X-Project-Key': key },
  });
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => { headers[key] = value; });
  return { status: res.status, body: Buffer.from(await res.arrayBuffer()), headers };
}

const META = {
  type: 'bug' as const,
  title: 'Schema validation probe',
  note: 'Test note',
  url: '/schema-validation',
  user: { id: null, name: null, email: null },
};

describe('integration: ingest schema & format validation', () => {
  let KEY: string;

  beforeAll(() => {
    KEY = readProjectKey();
  });

  it('POST /api/incidents: 201, row validates against published schema, list + image round-trip (ING-01, ENR-06)', async () => {
    const idem = `int-create-${randomUUID()}`;
    const created = await postIncident({ key: KEY, idempotencyKey: idem, meta: META, image: png });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const list = await getIncidents(KEY);
    const row = list.find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row?.title).toBe(META.title);
    expect(row?.type).toBe('bug');
    expect(row?.status).toBe('pending');
    expect(row?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row).not.toHaveProperty('storageKey');
    expect(row).not.toHaveProperty('idempotencyKey');
    expect(row).not.toHaveProperty('projectId');

    const image = await getImage(KEY, id);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.headers['x-content-type-options']).toBe('nosniff');
    expect(image.headers['content-disposition']).toBe('attachment; filename="screenshot.png"');
    expect(image.headers['content-security-policy']).toContain("default-src 'none'");
    expect(image.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(image.body.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(image.body.length).toBeGreaterThan(0);
  });

  it('webp fixture ingests and serves image/webp', async () => {
    const idem = `int-webp-${randomUUID()}`;
    const created = await postIncident({
      key: KEY,
      idempotencyKey: idem,
      meta: { ...META, title: 'WebP upload path' },
      image: webp,
      filename: 'shot.webp',
      mime: 'image/webp',
    });
    expect(created.status).toBe(201);
    const image = await getImage(KEY, created.body.id as string);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/webp');
    expect(image.body.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(image.body.subarray(8, 12).toString('latin1')).toBe('WEBP');
  });

  it('JPEG: a real JPEG ingests, stores image/jpeg and the blob route serves it as a JPEG', async () => {
    const idem = `int-jpeg-${randomUUID()}`;
    const created = await postIncident({
      key: KEY,
      idempotencyKey: idem,
      meta: { ...META, title: 'JPEG upload path' },
      image: jpeg,
      filename: 'shot.jpg',
      mime: 'image/jpeg',
    });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const list = await getIncidents(KEY);
    expect(list.find((r) => r.id === id)?.contentType).toBe('image/jpeg');

    const image = await getImage(KEY, id);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/jpeg');
    expect(image.headers['x-content-type-options']).toBe('nosniff');
    expect(image.headers['content-disposition']).toBe('attachment; filename="screenshot.jpeg"');
    expect(image.headers['content-security-policy']).toContain("default-src 'none'");
    expect(image.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(image.body.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(image.body[3]).not.toBe(0xe0);
    expect(image.body.length).toBeGreaterThan(0);
  });

  it('JPEG decode-bomb: a >16 MP JPEG is rejected before sharp', async () => {
    const idem = `int-jpeg-bomb-${randomUUID()}`;
    const created = await postIncident({
      key: KEY,
      idempotencyKey: idem,
      meta: { ...META, title: 'JPEG decode-bomb probe' },
      image: oversizeJpeg,
      filename: 'bomb.jpg',
      mime: 'image/jpeg',
    });
    expect(created.status).toBe(400);
    expect(String(created.body.message)).toContain('MAX_IMAGE_PIXELS');
  });

  it('JPEG header: a truncated JPEG is rejected', async () => {
    const created = await postIncident({
      key: KEY,
      idempotencyKey: `int-jpeg-truncated-${randomUUID()}`,
      meta: { ...META, title: 'Truncated JPEG probe' },
      image: jpeg.subarray(0, 40),
      filename: 'truncated.jpg',
      mime: 'image/jpeg',
    });
    expect(created.status).toBe(400);
    expect(String(created.body.message)).toContain('JPEG header is missing or unreadable');
  });

  it('JPEG boundary: a side above MAX_IMAGE_DIM is rejected', async () => {
    const wideSideJpeg = Buffer.from([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x11, 0x08,
      0x00, 0x64,
      0x23, 0x28,
      0xff, 0xd9,
    ]);
    const created = await postIncident({
      key: KEY,
      idempotencyKey: `int-jpeg-wide-${randomUUID()}`,
      meta: { ...META, title: 'JPEG wide-side probe' },
      image: wideSideJpeg,
      filename: 'wide.jpg',
      mime: 'image/jpeg',
    });
    expect(created.status).toBe(400);
    expect(String(created.body.message)).toContain('MAX_IMAGE_DIM');
  });

  it('format allowlist: SVG and GIF are still rejected and the copy names JPEG', async () => {
    const svg = await postIncident({
      key: KEY,
      idempotencyKey: `int-allowlist-svg-${randomUUID()}`,
      meta: { ...META, title: 'Allowlist SVG probe' },
      image: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64"/></svg>'),
      filename: 'shot.svg',
      mime: 'image/svg+xml',
    });
    expect(svg.status).toBe(400);
    expect(String(svg.body.message)).toContain('PNG');
    expect(String(svg.body.message)).toContain('WebP');
    expect(String(svg.body.message)).toContain('JPEG');

    const gif = await postIncident({
      key: KEY,
      idempotencyKey: `int-allowlist-gif-${randomUUID()}`,
      meta: { ...META, title: 'Allowlist GIF probe' },
      image: polyglotGif,
      filename: 'polyglot.gif',
      mime: 'image/gif',
    });
    expect(gif.status).toBe(400);
    expect(String(gif.body.message)).toContain('JPEG');
  });

  it('JPEG orientation: an EXIF-rotated photo is stored upright without its EXIF segment', async () => {
    expect(rotatedJpeg.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));

    function jpegHeaderDims(buf: Buffer): { width: number; height: number } | null {
      if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
      let off = 2;
      while (off + 4 <= buf.length) {
        if (buf[off] !== 0xff) return null;
        const marker = buf[off + 1];
        if (marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          off += 2;
          continue;
        }
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          if (off + 9 > buf.length) return null;
          return { width: buf.readUInt16BE(off + 7), height: buf.readUInt16BE(off + 5) };
        }
        const length = buf.readUInt16BE(off + 2);
        if (length < 2) return null;
        off += 2 + length;
      }
      return null;
    }

    const fixtureDims = jpegHeaderDims(rotatedJpeg);
    expect(fixtureDims, 'fixture carries an SOF declaring the raw sensor frame').toEqual({ width: 80, height: 40 });
    expect(rotatedJpeg.includes('Exif'), 'fixture carries an Exif segment').toBe(true);

    const created = await postIncident({
      key: KEY,
      idempotencyKey: `int-jpeg-exif-${randomUUID()}`,
      meta: { ...META, title: 'JPEG EXIF orientation probe' },
      image: rotatedJpeg,
      filename: 'rotated.jpg',
      mime: 'image/jpeg',
    });
    expect(created.status).toBe(201);

    const image = await getImage(KEY, created.body.id as string);
    expect(image.status).toBe(200);
    const served = image.body;

    expect(served.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(served.includes('Exif'), 'served bytes carry no Exif segment').toBe(false);
    expect(jpegHeaderDims(served)).toEqual({ width: 40, height: 80 });

    // Round-trip admission of the engine's OWN output
    const idem2 = `int-jpeg-rt-${randomUUID()}`;
    const again = await postIncident({
      key: KEY,
      idempotencyKey: idem2,
      meta: { ...META, title: 'JPEG round-trip' },
      image: served,
      filename: 'stored.jpeg',
      mime: 'image/jpeg',
    });
    expect(again.status).toBe(201);
    const list2 = await getIncidents(KEY);
    expect(list2.find((r) => r.id === again.body.id)?.contentType).toBe('image/jpeg');
  });
});