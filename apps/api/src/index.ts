import { buildApp, type FastifyInstance } from './app';

// Step 0 (Q-08): `tsx` boots the Fastify 5 app under the pinned TypeScript
// 7.0.2 toolchain. Step 4 replaces the bare PORT read with the fail-fast
// `config.ts` loader (P1-D-02, SEC-04).
const port = Number(process.env.PORT ?? 3000);

const app = await buildApp();

if (process.env.WATCHBUG_SMOKE === '1') {
  await runMultipartSmoke(app);
} else {
  try {
    await app.listen({ port, host: '127.0.0.1' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

/**
 * P1-D-09 multipart smoke (the phase's first risk commit): parse a real
 * `FormData` — a `meta` JSON field plus one image file part — through the
 * registered limits, then prove the size ceiling actually rejects an oversized
 * image. Failure follows P1-D-08's order: another `@fastify/multipart` release
 * (contract untouched), then a hand-rolled boundary parser; base64-in-JSON would
 * be a CA-01 contract change and needs owner consultation.
 */
async function runMultipartSmoke(app: FastifyInstance): Promise<void> {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (typeof address !== 'object' || address === null) {
    console.error('SMOKE FAIL: no bound address');
    process.exit(1);
  }
  const base = `http://127.0.0.1:${address.port}`;

  // Minimal valid 1×1 PNG (89 bytes) — enough for the parser, not for decoding.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  const form = new FormData();
  form.set('meta', JSON.stringify({ type: 'bug', title: 'smoke' }));
  form.set('image', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'valid.png');

  let failures = 0;

  const ok = await fetch(`${base}/api/_smoke/multipart`, { method: 'POST', body: form });
  const okBody = (await ok.json()) as { meta?: string; imageBytes?: number; imageMime?: string };
  if (ok.status === 200 && okBody.imageBytes === png.length && okBody.imageMime === 'image/png') {
    console.log(`SMOKE 1/2 PASS  multipart parse: 200, meta + ${okBody.imageBytes} image bytes (${okBody.imageMime})`);
  } else {
    failures++;
    console.error(`SMOKE 1/2 FAIL  status=${ok.status} body=${JSON.stringify(okBody)}`);
  }

  // Oversized part must be refused by the fileSize limit (T-01-05).
  const big = new FormData();
  big.set('meta', JSON.stringify({ type: 'bug', title: 'too big' }));
  big.set('image', new Blob([new Uint8Array(4 * 1024 * 1024 + 1024)], { type: 'image/png' }), 'big.png');
  const over = await fetch(`${base}/api/_smoke/multipart`, { method: 'POST', body: big });
  if (over.status === 413) {
    console.log('SMOKE 2/2 PASS  oversized part rejected with 413 (fileSize limit + throwFileSizeLimit)');
  } else {
    failures++;
    console.error(`SMOKE 2/2 FAIL  expected 413, got ${over.status}`);
  }

  await app.close();
  if (failures > 0) {
    console.error(`SMOKE FAILED (${failures}/2)`);
    process.exit(1);
  }
  console.log('SMOKE OK — @fastify/multipart 10.1.2 parses CA-01 FormData under the A-06 limits');
  process.exit(0);
}
