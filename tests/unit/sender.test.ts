import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendReport } from '../../sdk/src/transport/sender';
import type { ReportPayload } from '../../sdk/src/capture/batcher';

function makePayload(overrides: Partial<ReportPayload> = {}): ReportPayload {
  return {
    type: 'bug',
    screenshot: 'data:image/png;base64,abc',
    metadata: { url: 'https://example.com', userAgent: 'test-agent', timestamp: new Date().toISOString() },
    consoleLogs: [{ level: 'log', message: 'hello', timestamp: new Date().toISOString() }],
    errors: [],
    notes: 'test',
    ...overrides,
  };
}

describe('sender', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sendReport uses credentials: omit', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await sendReport('https://api.example.com', 'key123', makePayload());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'omit' }),
    );
  });

  it('sendReport POSTs to ${apiUrl}/api/incidents', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await sendReport('https://api.example.com', 'key123', makePayload());
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/api/incidents', expect.any(Object));
    // trailing slash handling
    await sendReport('https://api.example.com/', 'key123', makePayload());
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/api/incidents', expect.any(Object));
  });

  it('sendReport includes X-Watchbug-Key header', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await sendReport('https://api.example.com', 'my-key', makePayload());
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect((opts.headers as Record<string, string>)['X-Watchbug-Key']).toBe('my-key');
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('sendReport returns success on 2xx', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 201, text: async () => '' }) as Response) as unknown as typeof fetch;
    const res = await sendReport('https://api.example.com', 'k', makePayload());
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('sendReport returns error on non-2xx', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'server error' }) as Response) as unknown as typeof fetch;
    const res = await sendReport('https://api.example.com', 'k', makePayload());
    expect(res.success).toBe(false);
    expect(res.error).toContain('server error');
  });

  it('sendReport returns error on network failure', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    const res = await sendReport('https://api.example.com', 'k', makePayload());
    expect(res.success).toBe(false);
    expect(res.error).toContain('network down');
  });
});
