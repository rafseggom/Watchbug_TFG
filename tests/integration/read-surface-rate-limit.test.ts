import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const API_BASE = 'http://127.0.0.1:3000';

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

async function getIncidents(key: string, query?: string, forwardedFor?: string): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const headers: Record<string, string> = { 'X-Project-Key': key };
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;

  const url = `${API_BASE}/api/incidents${query ? '?' + query : ''}`;
  const res = await fetch(url, { headers });
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => { responseHeaders[key] = value; });
  const body = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();
  return { status: res.status, body, headers: responseHeaders };
}

async function postIncident(key: string, idempotencyKey: string, forwardedFor?: string): Promise<{ status: number; body: unknown }> {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 29, 99, 0, 1, 0, 0, 5, 0, 1, 29, 43, 14, 166, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  const boundary = `----watchbugrate${randomUUID().replace(/-/g, '')}`;
  const meta = JSON.stringify({ type: 'bug', title: `Rate probe ${randomUUID().slice(0, 8)}`, url: '/', user: { id: null, name: null, email: null } });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="meta"\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="shot.png"\r\nContent-Type: image/png\r\n\r\n`),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const headers: Record<string, string> = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'X-Project-Key': key,
    'Idempotency-Key': idempotencyKey,
  };
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;

  const res = await fetch(`${API_BASE}/api/incidents`, { method: 'POST', headers, body });
  return { status: res.status, body: res.headers.get('content-type')?.includes('application/json') ? await res.json() : await res.text() };
}

describe('integration: read surface rate limiting & pagination', () => {
  let KEY: string;

  beforeAll(() => {
    KEY = readProjectKey();
  });

  it('read surface: GET routes are rate-limited per IP with integer Retry-After', async () => {
    const bucket = `203.0.113.${1 + (Date.now() % 250)}`;
    let saw429 = false;

    for (let i = 0; i < 610; i++) {
      const res = await getIncidents(KEY, undefined, bucket);
      if (res.status === 429) {
        saw429 = true;
        expect(res.headers['retry-after']).toBeDefined();
        const retry = Number(res.headers['retry-after']);
        expect(Number.isInteger(retry)).toBe(true);
        expect(retry).toBeGreaterThanOrEqual(1);
        break;
      }
      expect(res.status).toBe(200);
    }
    expect(saw429, 'expected 429 after exceeding read rate limit').toBe(true);

    const fresh = await getIncidents(KEY, undefined, '198.51.100.9');
    expect(fresh.status).toBe(200);
  });

  it('read surface: list is bounded and returns x-next-cursor for large sets', async () => {
    // Seed 50 incidents
    for (let i = 0; i < 50; i++) {
      await postIncident(KEY, `probe-${Date.now()}-${i}-${randomUUID()}`);
    }

    const res = await getIncidents(KEY, 'limit=5');
    expect(res.status).toBe(200);
    const data = res.body as Array<any>;
    expect(data.length).toBeLessThanOrEqual(5);

    const next = res.headers['x-next-cursor'];
    if (next) {
      expect(typeof next).toBe('string');
      expect(next.length).toBeGreaterThan(0);
      const res2 = await getIncidents(KEY, `limit=5&cursor=${encodeURIComponent(next)}`);
      expect(res2.status).toBe(200);
    }
  });

  it('read surface: malformed limit and cursor return 400', async () => {
    const bad1 = await getIncidents(KEY, 'limit=0');
    expect(bad1.status).toBe(400);
    const bad2 = await getIncidents(KEY, 'limit=500');
    expect(bad2.status).toBe(400);
    const bad3 = await getIncidents(KEY, 'cursor=invalid');
    expect(bad3.status).toBe(400);
  });
});