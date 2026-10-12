import type { FullConfig } from '@playwright/test';

/**
 * Fails loud and early if the compose stack is not up: the suite targets the
 * real three-container deployment (INV-03), not a dev server. Start it with
 * `docker compose up -d --build` before `npm run verify`.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const base = 'http://127.0.0.1:8080';
  let lastError = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) {
        const body = (await res.json()) as { status?: string };
        if (body.status === 'ok') return;
        lastError = `health responded ${JSON.stringify(body)}`;
      } else {
        lastError = `health responded ${res.status}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `compose stack is not reachable at ${base} (last error: ${lastError}). ` +
      'Start it with "docker compose up -d --build" and retry.',
  );
}
