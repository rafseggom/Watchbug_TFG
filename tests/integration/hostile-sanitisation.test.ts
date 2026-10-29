import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');
const png = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'));

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

const BOM = String.fromCharCode(0xfeff);
const NUL = String.fromCharCode(0);
const VT = String.fromCharCode(0x0b);
const US = String.fromCharCode(0x1f);

const BASE_META = {
  type: 'bug' as const,
  title: 'ING-07 probe',
  url: '/ing-07',
};

async function postMeta(
  fetch: typeof globalThis.fetch,
  meta: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const boundary = `----watchbugmeta${randomUUID().replace(/-/g, '')}`;
  const chunks: Buffer[] = [];
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="meta"\r\n\r\n${JSON.stringify(meta)}\r\n`));
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
    headers: { 'content-type': contentType, 'X-Project-Key': KEY, 'Idempotency-Key': `e2e-ing07-${randomUUID()}` },
    body,
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function storedRow(
  fetch: typeof globalThis.fetch,
  id: string,
): Promise<Record<string, unknown>> {
  const list = (await (await fetch(`${API_ORIGIN}/api/incidents`, { headers: { 'X-Project-Key': KEY } })).json()) as Array<Record<string, unknown>>;
  const row = list.find((r) => r.id === id);
  expect(row, `incident ${id} must appear in the list`).toBeDefined();
  return row as Record<string, unknown>;
}

describe('ING-07 pass 1: sanitise on write — hostile text payloads stored with markup removed', () => {
  const fetch = globalThis.fetch;

  it('hostile text payloads are stored with all markup removed (img-onerror, script, BOM, UTF-7, entity-encoded)', async () => {
    const imgTitle = await postMeta(fetch, {
      ...BASE_META,
      title: 'Hello <img src=x onerror=alert(1)> world',
      note: '<script>document.cookie</script>Leaky notes',
      user: { id: 'u-1', name: '<img src=x onerror=alert(1)>Admin', email: 'bad<script>alert(1)</script>@x.com' },
    });
    expect(imgTitle.status).toBe(201);
    const imgRow = await storedRow(fetch, imgTitle.body.id as string);
    expect(imgRow.title).toBe('Hello  world');
    expect(imgRow.note).toBe('Leaky notes');
    expect((imgRow.user as { name: string }).name).toBe('Admin');
    expect((imgRow.user as { email: string }).email).toBe('bad@x.com');
    for (const value of [imgRow.title, imgRow.note, JSON.stringify(imgRow.user)]) {
      expect(value).not.toContain('<');
      expect(value).not.toContain('>');
      expect(value).not.toContain('onerror=');
    }

    const quote = await postMeta(fetch, { ...BASE_META, title: '"><img src=x onerror=alert(1)>' });
    expect(quote.status).toBe(201);
    expect((await storedRow(fetch, quote.body.id as string)).title).toBe('">');

    const jsUri = await postMeta(fetch, { ...BASE_META, title: 'javascript:alert(1)' });
    expect(jsUri.status).toBe(201);
    expect((await storedRow(fetch, jsUri.body.id as string)).title).toBe('javascript:alert(1)');

    const utf7 = await postMeta(fetch, { ...BASE_META, title: '+ADw-script+AD4-alert(1)+ADw-/script+AD4-' });
    expect(utf7.status).toBe(201);
    const utf7Row = await storedRow(fetch, utf7.body.id as string);
    expect(utf7Row.title).toBe('+ADw-script+AD4-alert(1)+ADw-/script+AD4-');
    expect(utf7Row.title).not.toContain('<');

    const bom = await postMeta(fetch, { ...BASE_META, title: `${BOM}Login <img src=x onerror=alert(1)> failed` });
    expect(bom.status).toBe(201);
    expect((await storedRow(fetch, bom.body.id as string)).title).toBe('Login  failed');

    // Entity-encoded markup must stay entity-encoded: decoding it on write
    // would store raw `<img …>` text — the entity form is the markup-free
    // form, both for a bare payload and inside a `<title>` RCDATA container
    // (which sanitize-html preserves as escaped text).
    const entity = await postMeta(fetch, { ...BASE_META, title: '&lt;img src=x onerror=alert(1)&gt;' });
    expect(entity.status).toBe(201);
    expect((await storedRow(fetch, entity.body.id as string)).title).toBe('&lt;img src=x onerror=alert(1)&gt;');

    const titleTag = await postMeta(fetch, { ...BASE_META, title: '<title><img src=x onerror=alert(1)></title>' });
    expect(titleTag.status).toBe(201);
    expect((await storedRow(fetch, titleTag.body.id as string)).title).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('plain text with angle brackets round-trips exactly; styled fragments keep document order', async () => {
    const plain = await postMeta(fetch, { ...BASE_META, title: '2 < 3 & 4 > 1' });
    expect(plain.status).toBe(201);
    expect((await storedRow(fetch, plain.body.id as string)).title).toBe('2 < 3 & 4 > 1');

    const fragments = await postMeta(fetch, { ...BASE_META, title: '<b>a</b><i>b</i>' });
    expect(fragments.status).toBe(201);
    expect((await storedRow(fetch, fragments.body.id as string)).title).toBe('ab');
  });

  it('empty edge: a zero-length title is rejected 400; absent optional fields are stored as null', async () => {
    const empty = await postMeta(fetch, { ...BASE_META, title: '' });
    expect(empty.status).toBe(400);
    expect(empty.body.statusCode).toBe(400);
    expect(empty.body.error).toBe('Bad Request');

    const minimal = await postMeta(fetch, { type: 'bug', title: 'absent optional fields' });
    expect(minimal.status).toBe(201);
    const row = await storedRow(fetch, minimal.body.id as string);
    expect(row.note).toBeNull();
    expect(row.url).toBeNull();
    expect(row.user).toBeNull();
  });

  it('encoding edge: caps count Unicode code points (inclusive at the cap, one over is 400) and sanitised output never exceeds its cap', async () => {
    const atCap = 'a'.repeat(200);
    const ok = await postMeta(fetch, { ...BASE_META, title: atCap });
    expect(ok.status).toBe(201);
    expect((await storedRow(fetch, ok.body.id as string)).title).toBe(atCap);

    const overCap = await postMeta(fetch, { ...BASE_META, title: 'a'.repeat(201) });
    expect(overCap.status).toBe(400);
    expect(overCap.body.statusCode).toBe(400);

    const emojiAtCap = '😀'.repeat(200);
    const emojiOk = await postMeta(fetch, { ...BASE_META, title: emojiAtCap });
    expect(emojiOk.status).toBe(201);
    expect((await storedRow(fetch, emojiOk.body.id as string)).title).toBe(emojiAtCap);
    const emojiOver = await postMeta(fetch, { ...BASE_META, title: `${emojiAtCap}😀` });
    expect(emojiOver.status).toBe(400);
    expect(emojiOver.body.statusCode).toBe(400);

    const amps = '&'.repeat(200);
    const ampOk = await postMeta(fetch, { ...BASE_META, title: amps });
    expect(ampOk.status).toBe(201);
    const ampRow = await storedRow(fetch, ampOk.body.id as string);
    expect(ampRow.title).toBe(amps);
    expect((ampRow.title as string).length).toBeLessThanOrEqual(200);
  });

  it('control characters are stripped from every user string on write', async () => {
    const title = `evil${NUL}${VT}${US}payload`;
    const res = await postMeta(fetch, { ...BASE_META, title, note: `line one${VT}line two` });
    expect(res.status).toBe(201);
    const row = await storedRow(fetch, res.body.id as string);
    expect(row.title).toBe('evilpayload');
    expect(row.note).toBe('line oneline two');
    expect(row.title).not.toContain(NUL);
    expect(row.title).not.toContain(VT);
    expect(row.title).not.toContain(US);
  });
});

describe('R-08/S-5: meta.url is stored path-only — query string and fragment stripped on ingest', () => {
  const fetch = globalThis.fetch;

  const R08_SENTINEL = 'r08-sentinel-7f3a1c';

  it('query string and fragment stripped on ingest', async () => {
    const caseA = await postMeta(fetch, {
      ...BASE_META,
      title: 'R-08 strip probe',
      url: `/checkout?token=${R08_SENTINEL}#frag`,
    });
    expect(caseA.status).toBe(201);
    const rowA = await storedRow(fetch, caseA.body.id as string);
    expect(rowA.url).toBe('/checkout');
    const listText = await (await fetch(`${API_ORIGIN}/api/incidents`, { headers: { 'X-Project-Key': KEY } })).text();
    expect(listText).not.toContain(R08_SENTINEL);
    expect(listText).not.toContain('#frag');

    const caseB = await postMeta(fetch, {
      ...BASE_META,
      title: 'R-08 full href probe',
      url: `https://x.dev/callback?code=${R08_SENTINEL}#frag`,
    });
    expect(caseB.status).toBe(201);
    expect((await storedRow(fetch, caseB.body.id as string)).url).toBe('https://x.dev/callback');

    const caseC = await postMeta(fetch, { ...BASE_META, title: 'R-08 clean path probe', url: '/plain-path' });
    expect(caseC.status).toBe(201);
    expect((await storedRow(fetch, caseC.body.id as string)).url).toBe('/plain-path');
  });
});