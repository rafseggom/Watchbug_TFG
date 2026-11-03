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
  key: string | null;
  idempotencyKey: string;
  meta: Record<string, unknown>;
  image?: Buffer;
  filename?: string;
  mime?: string;
}): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const formData = new FormData();
  formData.append('meta', JSON.stringify(opts.meta));
  if (opts.image) {
    const blob = new Blob([opts.image], { type: opts.mime ?? 'image/png' });
    formData.append('image', blob, opts.filename ?? 'shot.png');
  }
  const headers: Record<string, string> = {};
  if (opts.key !== null) headers['X-Project-Key'] = opts.key;
  headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await fetch(`${API_BASE}/api/incidents`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const contentType = res.headers.get('content-type') ?? '';
  let body: Record<string, unknown> | null = null;
  if (contentType.includes('application/json')) {
    body = (await res.json()) as Record<string, unknown>;
  } else {
    await res.text(); // consume body
  }
  return { status: res.status, body };
}

async function getIncidents(key: string): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(`${API_BASE}/api/incidents`, {
    headers: { 'X-Project-Key': key },
  });
  return (await res.json()) as Array<Record<string, unknown>>;
}

const META = {
  type: 'bug' as const,
  title: 'Auth probe',
  note: 'Test note',
  url: '/auth',
  user: { id: null, name: null, email: null },
};

const UNIFORM_401_BODY = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'invalid or missing project key',
};

describe('integration: ING-04 project key gate & auth', () => {
  let KEY: string;

  beforeAll(() => {
    KEY = readProjectKey();
  });

  it('wrong project key → 401; SVG → 400 (SEC-03, P1-D-11)', async () => {
    const wrong = await postIncident({
      key: 'wkbt_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
      idempotencyKey: `int-wrongkey-${randomUUID()}`,
      meta: META,
      image: png,
    });
    expect(wrong.status).toBe(401);

    const svg = await postIncident({
      key: KEY,
      idempotencyKey: `int-svg-${randomUUID()}`,
      meta: META,
      image: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64"/></svg>'),
      filename: 'shot.svg',
      mime: 'image/svg+xml',
    });
    expect(svg.status).toBe(400);
  });

  it('ING-04: missing, unknown and malformed project keys all get the same structured 401 and nothing is stored', async () => {
    const before = (await getIncidents(KEY)).length;

    const missing = await postIncident({ key: null, idempotencyKey: `int-missing-${randomUUID()}`, meta: META, image: png });
    const unknown = await postIncident({ key: 'wkbt_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ', idempotencyKey: `int-unknown-${randomUUID()}`, meta: META, image: png });
    const malformed = await postIncident({ key: 'not-a-project-key', idempotencyKey: `int-malformed-${randomUUID()}`, meta: META, image: png });

    for (const [label, res] of [
      ['missing', missing],
      ['unknown', unknown],
      ['malformed', malformed],
    ] as const) {
      expect(res.status, `${label} key must be rejected with 401`).toBe(401);
      expect(res.body).toEqual(UNIFORM_401_BODY);
    }

    const encoded = [missing, unknown, malformed].map((r) => JSON.stringify(r.body));
    expect(encoded[1]).toBe(encoded[0]);
    expect(encoded[2]).toBe(encoded[0]);

    const after = (await getIncidents(KEY)).length;
    expect(after).toBe(before);
  });

  it('ING-04 concurrency: a parallel burst of invalid-key requests each receives its own uniform 401 and stores nothing', async () => {
    const before = (await getIncidents(KEY)).length;

    const image = { filename: 'shot.png', mime: 'image/png', bytes: png };
    const burst = await Promise.all([
      postIncident({ key: null, idempotencyKey: `int-burst-1-${randomUUID()}`, meta: META, image: png }),
      postIncident({ key: 'wkbt_ffffffffffffffffffffffffffffffff', idempotencyKey: `int-burst-2-${randomUUID()}`, meta: META, image: png }),
      postIncident({ key: null, idempotencyKey: `int-burst-3-${randomUUID()}`, meta: META, image: png }),
      postIncident({ key: 'garbage', idempotencyKey: `int-burst-4-${randomUUID()}`, meta: META, image: png }),
      postIncident({ key: 'wkbt_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ', idempotencyKey: `int-burst-5-${randomUUID()}`, meta: META, image: png }),
      postIncident({ key: 'wkbt_short', idempotencyKey: `int-burst-6-${randomUUID()}`, meta: META, image: png }),
    ]);

    for (const res of burst) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(UNIFORM_401_BODY);
    }

    const after = (await getIncidents(KEY)).length;
    expect(after).toBe(before);
  });

  it('CAP-03 text-only: a meta-only post without X-Project-Key gets the same structured 401', async () => {
    const res = await fetch(`${API_BASE}/api/incidents`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': `int-textonly-nokey-${randomUUID()}`,
      },
      body: JSON.stringify({ meta: JSON.stringify({ ...META, title: 'No key meta-only probe' }) }),
    });
    expect(res.status).toBe(401);
    const imagelessBody = await res.json();

    const bearing = await postIncident({
      key: 'wkbt_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
      idempotencyKey: `int-textonly-401pair-${randomUUID()}`,
      meta: META,
      image: png,
    });
    expect(bearing.status).toBe(401);
    expect(imagelessBody).toEqual(bearing.body);
  });
});