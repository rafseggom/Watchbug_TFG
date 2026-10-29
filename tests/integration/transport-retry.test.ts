import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  MAX_RETRIES,
  RETRY_DELAYS_MS,
  RETRY_JITTER_RATIO,
  SendError,
  retryDelayMs,
  sendReport,
  type SendOptions,
} from '@watchbug/sdk/transport/lane1.ts';

/**
 * Integration lane for lane-1 transport classification — the conversion target
 * of the transport half of the `sdk.spec.ts` **P2-D-03** pair (03-08 Batch 3a).
 *
 * The claim these tests carry is the one `sendReport` owns outright:
 *
 *  - a transient failure (network error, timeout, 408, 429, 5xx) is retried on
 *    the locked 1 s / 4 s / 10 s schedule, with the SAME `Idempotency-Key` and
 *    the SAME encoded bytes — never a re-encode, never a new logical report;
 *  - a contract 4xx is terminal: one attempt, and the server's `message` is
 *    surfaced verbatim through `SendError.reason`.
 *
 * No browser is involved: `fetch` is the platform's, stubbed here, and the
 * multipart `FormData` it receives is read back directly. The e2e rows stay for
 * their browser half — the `Capturing… → Sending… → Retrying (1 of 3)… → Report
 * sent ✓` headline sequence, the disabled launcher while the retry window is
 * open, and the ≤240-char reason rendering inside the shadow-root panel. See
 * `03-08-CONVERSION-LEDGER.md` (J-10).
 */

const PROJECT_KEY = 'wkbt_00000000000000000000000000000000';
const IDEMPOTENCY_KEY = 'aaaaaaa1-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const API_BASE = 'http://127.0.0.1:8080';
const IMAGE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03]);

interface Attempt {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  credentials: RequestCredentials | undefined;
  referrerPolicy: ReferrerPolicy | undefined;
  meta: string;
  imageBytes: Uint8Array | null;
  imageName: string | null;
}

type Reply = { status: number; body: string } | 'network-error';

/** Stub `fetch`, recording every attempt and replying from `replies[index]`. */
function stubFetch(replies: Reply[]): Attempt[] {
  const attempts: Attempt[] = [];
  const fetchStub = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const body = init?.body;
    if (!(body instanceof FormData)) throw new Error('sendReport must post a FormData body');
    const image = body.get('image');
    const file = image instanceof File ? image : null;
    attempts.push({
      url: String(input),
      method: init?.method,
      headers: (init?.headers ?? {}) as Record<string, string>,
      credentials: init?.credentials,
      referrerPolicy: init?.referrerPolicy,
      meta: String(body.get('meta')),
      imageBytes: file === null ? null : new Uint8Array(await file.arrayBuffer()),
      imageName: file === null ? null : file.name,
    });

    const reply = replies[attempts.length - 1];
    if (reply === undefined) throw new Error(`unexpected attempt ${attempts.length}`);
    if (reply === 'network-error') throw new TypeError('Failed to fetch');
    return new Response(reply.body, {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  });

  globalThis.fetch = fetchStub as unknown as typeof fetch;
  return attempts;
}

function options(overrides: Partial<SendOptions> = {}): SendOptions {
  const meta = { type: 'bug' as const, title: 'transport retry report', url: '/form' };
  return {
    apiBase: API_BASE,
    projectKey: PROJECT_KEY,
    idempotencyKey: IDEMPOTENCY_KEY,
    filename: 'screenshot.png',
    blob: new Blob([IMAGE_BYTES], { type: 'image/png' }),
    meta,
    ...overrides,
  };
}

const created = (id: string): Reply => ({ status: 201, body: JSON.stringify({ id }) });
const serverError: Reply = {
  status: 500,
  body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'boom' }),
};
const rejected = (status: number, message: string): Reply => ({
  status,
  body: JSON.stringify({ statusCode: status, error: 'Bad Request', message }),
});

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.useFakeTimers();
  // Pin the jitter: 0.5 → factor 1.0 → the locked 1 s / 4 s / 10 s schedule.
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe('integration: lane-1 retry classification (P2-D-03 transient)', () => {
  it('retries a 500 with the same Idempotency-Key and the same encoded bytes', async () => {
    const attempts = stubFetch([serverError, created('id-after-retry')]);
    const retries: number[] = [];

    const pending = sendReport({ ...options(), onRetry: (attempt) => retries.push(attempt) });
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    const result = await pending;

    expect(result.id).toBe('id-after-retry');
    expect(attempts).toHaveLength(2);
    expect(retries).toEqual([1]);

    // One logical submission: same key on both attempts.
    expect(attempts[0].headers['Idempotency-Key']).toBe(IDEMPOTENCY_KEY);
    expect(attempts[1].headers['Idempotency-Key']).toBe(IDEMPOTENCY_KEY);

    // Same encoded bytes — the retry resends, it never re-encodes.
    expect(attempts[0].imageBytes).not.toBeNull();
    expect(attempts[1].imageBytes).toEqual(attempts[0].imageBytes);
    expect(attempts[1].imageName).toBe('screenshot.png');

    // Same meta part, byte for byte.
    expect(attempts[1].meta).toBe(attempts[0].meta);
    expect(JSON.parse(attempts[1].meta)).toEqual({
      type: 'bug',
      title: 'transport retry report',
      url: '/form',
    });
  });

  it('waits the full locked delay before the first retry — no immediate resend', async () => {
    const attempts = stubFetch([serverError, created('id')]);
    const pending = sendReport(options());

    // Just short of the 1 s (±25 %) minimum: still one attempt.
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] * (1 - RETRY_JITTER_RATIO) - 1);
    expect(attempts).toHaveLength(1);

    // Crossing the locked 1 s boundary is what arms the retry.
    await vi.advanceTimersByTimeAsync(251);
    await pending;
    expect(attempts).toHaveLength(2);
  });

  it.each([408, 429, 503])('treats %i as transient', async (status) => {
    const attempts = stubFetch([rejected(status, 'later'), created('id')]);
    const pending = sendReport(options());
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    await expect(pending).resolves.toEqual({ id: 'id' });
    expect(attempts).toHaveLength(2);
  });

  it('treats a transport-level failure as transient', async () => {
    const attempts = stubFetch(['network-error', created('id')]);
    const pending = sendReport(options());
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    await expect(pending).resolves.toEqual({ id: 'id' });
    expect(attempts).toHaveLength(2);
  });

  it('exhausts MAX_RETRIES and reports a network failure with the last reason', async () => {
    const attempts = stubFetch([serverError, serverError, serverError, serverError]);
    const retries: number[] = [];

    const pending = sendReport({ ...options(), onRetry: (attempt) => retries.push(attempt) });
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'network', reason: 'boom' });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(4_000);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;

    // Initial send + MAX_RETRIES retries — the `(n of 3)` copy matches exactly.
    expect(MAX_RETRIES).toBe(3);
    expect(attempts).toHaveLength(MAX_RETRIES + 1);
    expect(retries).toEqual([1, 2, 3]);
    // The key never rotates across the whole schedule.
    expect(new Set(attempts.map((attempt) => attempt.headers['Idempotency-Key'])).size).toBe(1);
  });
});

describe('integration: lane-1 terminal 4xx (P2-D-03 contract)', () => {
  it('fails immediately on a 400, surfaces the server message and never retries', async () => {
    const reason = 'Project key not recognised';
    const attempts = stubFetch([rejected(400, reason)]);
    const retries: number[] = [];

    const error = await sendReport({ ...options(), onRetry: (a) => retries.push(a) }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(SendError);
    expect(error).toMatchObject({ kind: 'rejected', reason });
    expect(attempts).toHaveLength(1);
    expect(retries).toEqual([]);
  });

  it.each([400, 401, 403, 413])('treats %i as terminal', async (status) => {
    const attempts = stubFetch([rejected(status, `rejected ${status}`)]);
    const error = await sendReport(options()).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ kind: 'rejected', reason: `rejected ${status}` });
    expect(attempts).toHaveLength(1);
  });

  it('falls back to the status line when the body carries no message', async () => {
    const attempts = stubFetch([{ status: 422, body: 'not json' }]);
    const error = await sendReport(options()).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ kind: 'rejected', reason: 'HTTP 422' });
    expect(attempts).toHaveLength(1);
  });
});

describe('integration: lane-1 wire shape', () => {
  it('posts multipart to /api/incidents with the project key and no host credentials', async () => {
    const attempts = stubFetch([created('id')]);
    await expect(sendReport(options())).resolves.toEqual({ id: 'id' });

    expect(attempts[0].url).toBe(`${API_BASE}/api/incidents`);
    expect(attempts[0].method).toBe('POST');
    expect(attempts[0].headers['X-Project-Key']).toBe(PROJECT_KEY);
    // SEC-03 / R-08: no host cookies, no referrer.
    expect(attempts[0].credentials).toBe('omit');
    expect(attempts[0].referrerPolicy).toBe('no-referrer');
  });

  it('omits the image part entirely on the text-only lane (CAP-03)', async () => {
    const attempts = stubFetch([created('id')]);
    await sendReport(options({ blob: null, filename: 'screenshot.png' }));

    expect(attempts[0].imageBytes).toBeNull();
    expect(JSON.parse(attempts[0].meta)).toMatchObject({ type: 'bug' });
  });
});

describe('unit: retryDelayMs schedule', () => {
  it('stays within ±25 % of the locked 1 s / 4 s / 10 s ladder', () => {
    expect([...RETRY_DELAYS_MS]).toEqual([1_000, 4_000, 10_000]);
    for (const [index, base] of RETRY_DELAYS_MS.entries()) {
      for (const random of [0, 0.499, 0.5, 1]) {
        vi.spyOn(Math, 'random').mockReturnValue(random);
        const delay = retryDelayMs(index + 1);
        expect(delay).toBeGreaterThanOrEqual(Math.round(base * (1 - RETRY_JITTER_RATIO)));
        expect(delay).toBeLessThanOrEqual(Math.round(base * (1 + RETRY_JITTER_RATIO)));
      }
    }
  });

  it('clamps an out-of-range attempt instead of returning NaN', () => {
    expect(retryDelayMs(0)).toBe(1_000);
    expect(retryDelayMs(99)).toBe(10_000);
  });
});
