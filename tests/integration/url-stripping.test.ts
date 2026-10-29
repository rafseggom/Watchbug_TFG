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

describe('integration: R-08/S-5 path-only URL stripping', () => {
  let KEY: string;

  beforeAll(() => {
    KEY = readProjectKey();
  });

  it('strips query string and fragment from meta.url on ingest', async () => {
    const idem = `tracer-url-strip-${randomUUID()}`;
    const meta = {
      type: 'bug' as const,
      title: 'URL strip probe',
      note: 'Query and fragment should be stripped',
      url: '/checkout?token=secret&session=abc#step-2',
      user: { id: null, name: null, email: null },
    };

    const created = await postIncident({
      key: KEY,
      idempotencyKey: idem,
      meta,
    });

    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const list = await getIncidents(KEY);
    const row = list.find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row?.url).toBe('/checkout');
  });

  it('strips only fragment when no query string', async () => {
    const idem = `tracer-url-fragment-${randomUUID()}`;
    const meta = {
      type: 'bug' as const,
      title: 'Fragment only probe',
      note: 'Only fragment should be stripped',
      url: '/dashboard#section-3',
      user: { id: null, name: null, email: null },
    };

    const created = await postIncident({
      key: KEY,
      idempotencyKey: idem,
      meta,
    });

    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const list = await getIncidents(KEY);
    const row = list.find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row?.url).toBe('/dashboard');
  });

  it('preserves path when no query or fragment', async () => {
    const idem = `tracer-url-clean-${randomUUID()}`;
    const meta = {
      type: 'bug' as const,
      title: 'Clean URL probe',
      note: 'Path should be preserved as-is',
      url: '/settings/profile',
      user: { id: null, name: null, email: null },
    };

    const created = await postIncident({
      key: KEY,
      idempotencyKey: idem,
      meta,
    });

    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const list = await getIncidents(KEY);
    const row = list.find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row?.url).toBe('/settings/profile');
  });
});