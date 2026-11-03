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

async function getImage(key: string, id: string): Promise<{ status: number; body: Record<string, unknown>; headers: Record<string, string> }> {
  const res = await fetch(`${API_BASE}/api/incidents/${id}/image`, {
    headers: { 'X-Project-Key': key },
  });
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => { headers[key] = value; });
  const body = res.headers.get('content-type')?.includes('application/json')
    ? (await res.json()) as Record<string, unknown>
    : {};
  return { status: res.status, body, headers };
}

const META = {
  type: 'bug' as const,
  title: 'Text-only probe',
  note: 'Test note',
  url: '/text-only',
  user: { id: null, name: null, email: null },
};

describe('integration: CAP-03 text-only submissions', () => {
  let KEY: string;

  beforeAll(() => {
    KEY = readProjectKey();
  });

  it('CAP-03 text-only: a meta-only submission stores a row with no screenshot', async () => {
    const idem = `int-textonly-${randomUUID()}`;
    const title = 'Text-only report probe';
    const created = await postIncident({ key: KEY, idempotencyKey: idem, meta: { ...META, title } });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const list = await getIncidents(KEY);
    const row = list.find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row?.title).toBe(title);
    expect(row?.contentType).toBeNull();

    const image = await getImage(KEY, id);
    expect(image.status).toBe(404);
    expect(typeof image.body.message).toBe('string');
    expect(image.headers['content-type']).toContain('application/json');
    expect(String(image.headers['content-type'])).not.toMatch(/^image\//);
  });

  it('CAP-03 text-only concurrent: one idempotency key, one row, no blob', async () => {
    const idem = `int-textonly-race-${randomUUID()}`;
    const meta = { ...META, title: 'Text-only race probe' };
    const [a, b] = await Promise.all([
      postIncident({ key: KEY, idempotencyKey: idem, meta }),
      postIncident({ key: KEY, idempotencyKey: idem, meta }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBe(201);
    expect(a.body.id).toBe(b.body.id);

    const list = await getIncidents(KEY);
    const rows = list.filter((r) => r.id === a.body.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].contentType).toBeNull();
  });

  it('CAP-03 text-only: the blob route never 500s', async () => {
    const idem = `int-textonly-404-${randomUUID()}`;
    const created = await postIncident({
      key: KEY,
      idempotencyKey: idem,
      meta: { ...META, title: 'Imageless 404 probe' },
    });
    expect(created.status).toBe(201);

    const res = await getImage(KEY, created.body.id as string);
    expect(res.status).toBe(404);
    expect(typeof res.body.message).toBe('string');
    expect(res.headers['content-type']).toContain('application/json');
    expect(String(res.headers['content-type'])).not.toMatch(/^image\//);
  });
});