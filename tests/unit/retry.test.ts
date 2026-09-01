import { describe, it, expect, vi } from 'vitest';
import { retrySend } from '../../sdk/src/transport/retry';

describe('retrySend', () => {
  it('retrySend succeeds on first attempt', async () => {
    const fn = vi.fn(async () => ({ success: true }));
    const res = await retrySend(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(res.success).toBe(true);
    expect(res.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retrySend retries on failure', async () => {
    const fn = vi.fn(async () => ({ success: false, error: 'fail' }));
    const res = await retrySend(fn, { maxRetries: 2, baseDelayMs: 1 });
    expect(res.success).toBe(false);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(res.attempts).toBe(3);
  });

  it('retrySend uses exponential backoff', async () => {
    const fn = vi.fn(async () => ({ success: false, error: 'fail' }));
    const start = Date.now();
    await retrySend(fn, { maxRetries: 2, baseDelayMs: 10 });
    const elapsed = Date.now() - start;
    // delays: 10ms + 20ms = 30ms minimal (allow some slack)
    expect(elapsed).toBeGreaterThanOrEqual(25);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retrySend stops after maxRetries', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) return { success: false, error: 'not yet' };
      return { success: true };
    };
    const res = await retrySend(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(res.success).toBe(true);
    expect(res.attempts).toBe(3);
  });

  it('retrySend succeeds after one retry', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts === 1) return { success: false, error: 'first fail' };
      return { success: true };
    });
    const res = await retrySend(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(res.success).toBe(true);
    expect(res.attempts).toBe(2);
  });
});
