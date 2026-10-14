import { expect, test } from '@playwright/test';

const META = {
  type: 'bug' as const,
  title: 'Read surface probe',
  note: null,
  url: '/',
  user: { id: null, name: null, email: null },
};

/**
 * The suite normally talks to the compose stack through the nginx edge
 * (same-origin, A-10), but nginx OVERWRITES `X-Forwarded-For` with
 * `$remote_addr`, so every test would share the single `127.0.0.1` bucket and
 * a boundary test that exhausts it would 429 every other test for the rest of
 * the window (observed: 46 cascading failures). The boundary row therefore
 * talks to the api process directly — the connection still arrives from the
 * trusted loopback hop (`WATCHBUG_TRUST_PROXY`), which is exactly the
 * precondition under which Fastify honours the forwarded header, so a
 * per-test public address selects that test's own bucket (CR-02 covers the
 * spoof-resistance of the same mechanism).
 */
const API = 'http://127.0.0.1:3000';

test('read surface: GET routes are rate-limited per IP with integer Retry-After', async ({ request }) => {
  const bucket = `203.0.113.${1 + (Date.now() % 250)}`;
  let saw429 = false;

  for (let i = 0; i < 610; i++) {
    const res = await request.get(`${API}/api/incidents`, {
      headers: { 'x-forwarded-for': bucket },
    });
    if (res.status() === 429) {
      saw429 = true;
      expect(res.headers()['retry-after']).toBeDefined();
      const retry = Number(res.headers()['retry-after']);
      expect(Number.isInteger(retry)).toBe(true);
      expect(retry).toBeGreaterThanOrEqual(1);
      break;
    }
    expect(res.status()).toBe(200);
  }
  expect(saw429, 'expected 429 after exceeding read rate limit').toBe(true);

  // The bucket is per IP, not global: a fresh address still reads 200 while
  // the exhausted one is still inside its window.
  const fresh = await request.get(`${API}/api/incidents`, {
    headers: { 'x-forwarded-for': '198.51.100.9' },
  });
  expect(fresh.status()).toBe(200);
});

test('read surface: list is bounded and returns x-next-cursor for large sets', async ({ request, baseURL }) => {
  const batchSize = 50;
  for (let i = 0; i < batchSize; i++) {
    const form = {
      meta: JSON.stringify({ ...META, title: `Probe ${i}` }),
      image: {
        name: 'shot.png',
        mimeType: 'image/png',
        buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 29, 99, 0, 1, 0, 0, 5, 0, 1, 29, 43, 14, 166, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]),
      },
    };
    await request.post('/api/incidents', { multipart: form, headers: { 'X-Project-Key': 'wkbt_00000000000000000000000000000001', 'Idempotency-Key': `probe-${Date.now()}-${i}-${Math.random()}` } });
  }
  const res = await request.get('/api/incidents?limit=5');
  expect(res.status()).toBe(200);
  const data = await res.json() as Array<any>;
  expect(data.length).toBeLessThanOrEqual(5);
  const next = res.headers()['x-next-cursor'];
  if (next) {
    expect(typeof next).toBe('string');
    expect(next.length).toBeGreaterThan(0);
    const res2 = await request.get(`/api/incidents?limit=5&cursor=${encodeURIComponent(next)}`);
    expect(res2.status()).toBe(200);
  }
});

test('read surface: malformed limit and cursor return 400', async ({ request }) => {
  const bad1 = await request.get('/api/incidents?limit=0');
  expect(bad1.status()).toBe(400);
  const bad2 = await request.get('/api/incidents?limit=500');
  expect(bad2.status()).toBe(400);
  const bad3 = await request.get('/api/incidents?cursor=invalid');
  expect(bad3.status()).toBe(400);
});
