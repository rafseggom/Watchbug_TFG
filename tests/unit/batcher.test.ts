import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBatcher, type ReportPayload } from '../../sdk/src/capture/batcher';

function makeReport(type: 'bug' | 'feedback' = 'bug', notes = 'test'): ReportPayload {
  return {
    type,
    screenshot: 'data:image/png;base64,abc',
    metadata: { url: 'https://example.com' },
    consoleLogs: [],
    errors: [],
    notes,
  };
}

describe('EventBatcher', () => {
  it('EventBatcher enqueues reports', () => {
    const flushFn = vi.fn(async () => {});
    const batcher = new EventBatcher(flushFn, { batchSize: 5, flushIntervalMs: 3000 });
    batcher.enqueue(makeReport());
    expect(batcher.getQueueLength()).toBe(1);
    batcher.stop();
  });

  it('EventBatcher flushes when batch size reached', async () => {
    const flushFn = vi.fn(async () => {});
    const batcher = new EventBatcher(flushFn, { batchSize: 2, flushIntervalMs: 10000 });
    batcher.enqueue(makeReport());
    expect(flushFn).not.toHaveBeenCalled();
    batcher.enqueue(makeReport());
    // enqueue triggers flush when threshold reached — flush is async, wait a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(flushFn).toHaveBeenCalledTimes(1);
    expect(flushFn).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ type: 'bug' })]));
    expect(batcher.getQueueLength()).toBe(0);
    batcher.stop();
  });

  it('EventBatcher flushes on interval', async () => {
    vi.useFakeTimers();
    const flushFn = vi.fn(async () => {});
    const batcher = new EventBatcher(flushFn, { batchSize: 10, flushIntervalMs: 100 });
    batcher.start();
    batcher.enqueue(makeReport());
    expect(batcher.getQueueLength()).toBe(1);
    // Advance timers past interval
    await vi.advanceTimersByTimeAsync(100);
    expect(flushFn).toHaveBeenCalledTimes(1);
    expect(batcher.getQueueLength()).toBe(0);
    batcher.stop();
    vi.useRealTimers();
  });

  it('Failed flush re-queues the batch', async () => {
    const flushFn = vi.fn(async () => {
      throw new Error('network failure');
    });
    const batcher = new EventBatcher(flushFn, { batchSize: 5, flushIntervalMs: 3000 });
    batcher.enqueue(makeReport('bug', 'a'));
    batcher.enqueue(makeReport('feedback', 'b'));
    expect(batcher.getQueueLength()).toBe(2);
    await batcher.flush();
    // After failed flush, batch should be back in queue
    expect(batcher.getQueueLength()).toBe(2);
    expect(flushFn).toHaveBeenCalledTimes(1);
    batcher.stop();
  });

  it('flush() does nothing when queue is empty', async () => {
    const flushFn = vi.fn(async () => {});
    const batcher = new EventBatcher(flushFn);
    await batcher.flush();
    expect(flushFn).not.toHaveBeenCalled();
    expect(batcher.getQueueLength()).toBe(0);
    batcher.stop();
  });

  it('stop() clears the interval', async () => {
    vi.useFakeTimers();
    const flushFn = vi.fn(async () => {});
    const batcher = new EventBatcher(flushFn, { batchSize: 10, flushIntervalMs: 50 });
    batcher.start();
    batcher.enqueue(makeReport());
    batcher.stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(flushFn).not.toHaveBeenCalled();
    expect(batcher.getQueueLength()).toBe(1);
    vi.useRealTimers();
  });

  it('getQueueLength() returns current queue size', () => {
    const flushFn = vi.fn(async () => {});
    const batcher = new EventBatcher(flushFn);
    expect(batcher.getQueueLength()).toBe(0);
    batcher.enqueue(makeReport());
    batcher.enqueue(makeReport());
    expect(batcher.getQueueLength()).toBe(2);
    batcher.stop();
  });

  it('default batchSize is 5 and default flushIntervalMs is 3000', () => {
    const flushFn = vi.fn(async () => {});
    const batcher = new EventBatcher(flushFn);
    // Enqueue 4 should not trigger auto flush
    for (let i = 0; i < 4; i++) batcher.enqueue(makeReport());
    expect(batcher.getQueueLength()).toBe(4);
    // 5th should trigger
    batcher.enqueue(makeReport());
    // flush is async but queue should be empty after flush completes (give tick)
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(flushFn).toHaveBeenCalledTimes(1);
        batcher.stop();
        resolve();
      }, 20);
    });
  });

  it('ReportPayload type distinguishes bug vs feedback', () => {
    const bugReport: ReportPayload = makeReport('bug');
    const feedbackReport: ReportPayload = makeReport('feedback');
    expect(bugReport.type).toBe('bug');
    expect(feedbackReport.type).toBe('feedback');
  });
});
