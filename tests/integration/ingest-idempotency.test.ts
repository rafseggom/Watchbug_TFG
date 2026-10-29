import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const API_BASE = 'http://127.0.0.1:3000';

const png = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'));

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
  idempotencyKey: string | null;
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
  if (opts.idempotencyKey !== null) headers['Idempotency-Key'] = opts.idempotencyKey;

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

const META = {
  type: 'bug' as const,
  title: 'Idempotency probe',
  note: 'Test note',
  url: '/idempotency',
  user: { id: null, name: null, email: null },
};

describe('integration: ING-03 idempotency replay & concurrency', () => {
  let KEY: string;

  beforeAll(() => {
    KEY = readProjectKey();
  });

  it('ING-03: same Idempotency-Key replays the same id and stores one row', async () => {
    const idem = `int-replay-${randomUUID()}`;
    const first = await postIncident({ key: KEY, idempotencyKey: idem, meta: { ...META, title: 'Replay probe' }, image: png });
    expect(first.status).toBe(201);

    const replay = await postIncident({ key: KEY, idempotencyKey: idem, meta: { ...META, title: 'Replay probe' }, image: png });
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.id).toBe(first.body.id);

    const list = await getIncidents(KEY);
    expect(list.filter((r) => r.id === first.body.id)).toHaveLength(1);
  });

  it('ING-03: concurrent pair with one key yields one row', async () => {
    const idem = `int-race-${randomUUID()}`;
    const meta = { ...META, title: 'Race probe' };
    const [a, b] = await Promise.all([
      postIncident({ key: KEY, idempotencyKey: idem, meta, image: png }),
      postIncident({ key: KEY, idempotencyKey: idem, meta, image: png }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBe(201);
    expect(a.body.id).toBe(b.body.id);

    const list = await getIncidents(KEY);
    expect(list.filter((r) => r.id === a.body.id)).toHaveLength(1);
  });

  it('ING-03 (Q6): missing Idempotency-Key → 400 structured body, list unchanged', async () => {
    const before = (await getIncidents(KEY)).length;

    const created = await postIncident({ key: KEY, idempotencyKey: null, meta: { ...META, title: 'No key probe' }, image: png });
    expect(created.status).toBe(400);
    expect(typeof created.body.statusCode).toBe('number');
    expect(typeof created.body.error).toBe('string');
    expect(typeof created.body.message).toBe('string');

    const after = (await getIncidents(KEY)).length;
    expect(after).toBe(before);
  });
});