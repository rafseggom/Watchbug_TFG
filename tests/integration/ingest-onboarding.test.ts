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

async function getIncidents(key: string, query?: string): Promise<Array<Record<string, unknown>>> {
  const url = `${API_BASE}/api/incidents${query ? '?' + query : ''}`;
  const res = await fetch(url, {
    headers: { 'X-Project-Key': key },
  });
  return (await res.json()) as Array<Record<string, unknown>>;
}

async function getSetup(): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/api/setup`);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const META = {
  type: 'bug' as const,
  title: 'Onboarding probe',
  note: 'Test note',
  url: '/onboarding',
  user: { id: null, name: null, email: null },
};

describe('integration: P1-D-07 onboarding & /api/setup', () => {
  let KEY: string;

  beforeAll(() => {
    KEY = readProjectKey();
  });

  it('P1-D-07 / T-01-16: GET /api/setup serves exactly the seeded write-only project key through nginx', async () => {
    const res = await getSetup();
    expect(res.status).toBe(200);
    expect(res.body.projectKey).toBe(KEY);
    expect(Object.keys(res.body)).toEqual(['projectKey']);
    expect(String(res.body.projectKey)).toMatch(/^wkbt_[0-9A-Za-z]{32}$/);
  });

  it('P1-D-07: a meta part sent with Content-Type: application/json ingests (the curl -F shape)', async () => {
    const boundary = `----watchbugjson${randomUUID().replace(/-/g, '')}`;
    const meta = JSON.stringify({ type: 'bug', title: 'JSON content-type meta probe', url: '/' });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="meta"\r\nContent-Type: application/json\r\n\r\n${meta}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="shot.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${API_BASE}/api/incidents`, {
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'X-Project-Key': KEY,
        'Idempotency-Key': `int-jsonmeta-${randomUUID()}`,
      },
      body,
    });
    expect(res.status).toBe(201);

    const { id } = (await res.json()) as { id: string };
    const list = await getIncidents(KEY);
    expect(list.find((row) => row.id === id)?.title).toBe('JSON content-type meta probe');
  });

  it('P1-D-07: the emitted onboarding curl shape works when submitted directly', async () => {
    const setup = await getSetup();
    expect(setup.status).toBe(200);
    const key = setup.body.projectKey as string;

    const probeTitle = 'Hello from Watchbug integration';
    const boundary = `----watchbugonboarding${randomUUID().replace(/-/g, '')}`;
    const meta = JSON.stringify({ type: 'bug', title: probeTitle, url: '/' });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="meta"\r\n\r\n${meta}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="screenshot.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${API_BASE}/api/incidents`, {
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'X-Project-Key': key,
        'Idempotency-Key': `test-${randomUUID()}`,
      },
      body,
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id?: string };
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);

    const after = await getIncidents(key, 'limit=200');
    expect(after.some((row) => row.id === created.id)).toBe(true);
  });
});