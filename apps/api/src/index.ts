import { buildApp } from './app';

// Phase-1 Step 0 (Q-08): proves `tsx` boots the Fastify 5 hello route under the
// pinned TypeScript 7.0.2 toolchain. Step 4 replaces the bare PORT read with
// the fail-fast `config.ts` loader (P1-D-02, SEC-04).
const port = Number(process.env.PORT ?? 3000);

const app = await buildApp();

try {
  await app.listen({ port, host: '127.0.0.1' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
