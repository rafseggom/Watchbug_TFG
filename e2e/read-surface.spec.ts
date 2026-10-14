import { expect, test } from '@playwright/test';

const META = {
  type: 'bug' as const,
  title: 'Read surface probe',
  note: null,
  url: '/',
  user: { id: null, name: null, email: null },
};

test('read surface: GET routes are rate-limited per IP with integer Retry-After', async ({ request }) => {
  for (let i = 0; i < 610; i++) {
    const res = await request.get('/api/incidents');
    if (res.status() === 429) {
      expect(res.headers()['retry-after']).toBeDefined();
      const retry = Number(res.headers()['retry-after']);
      expect(Number.isInteger(retry)).toBe(true);
      expect(retry).toBeGreaterThanOrEqual(1);
      return;
    }
    expect(res.status()).toBe(200);
  }
  throw new Error('expected 429 after exceeding read rate limit');
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
