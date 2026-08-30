import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWatchbug, _resetForTesting, _getBatcher } from '../../sdk/src/index';

describe('consent API', () => {
  beforeEach(() => {
    _resetForTesting();
    localStorage.clear();
  });

  it('setConsent(false) pauses console capture', async () => {
    const wb = createWatchbug();
    wb.init({ key: 'test-consent-1' });
    wb.setConsent(false);
    // console.log should not be captured when consent false
    const before = wb.getConsoleLogs().length;
    console.log('should be blocked by consent');
    expect(wb.getConsoleLogs().length).toBe(before);
    // Also direct _push via wrapper should be blocked
    // Restore
    wb.setConsent(true);
  });

  it('setConsent(true) resumes console capture', async () => {
    const wb = createWatchbug();
    wb.init({ key: 'test-consent-2' });
    wb.setConsent(false);
    console.log('blocked');
    expect(wb.getConsoleLogs().length).toBe(0);
    wb.setConsent(true);
    console.log('should pass after resume');
    const logs = wb.getConsoleLogs();
    expect(logs.some((l) => l.message.includes('should pass after resume'))).toBe(true);
  });

  it('setConsent(false) prevents window.onerror capture', async () => {
    const wb = createWatchbug();
    wb.init({ key: 'test-onerror-consent' });
    wb.setConsent(false);
    const handler = window.onerror;
    // When consent false, handler should be null (removed) or not capture
    if (handler) {
      const before = wb.getConsoleLogs().length;
      try {
        (handler as unknown as (m: string) => void)('Uncaught Error: blocked error');
      } catch {}
      expect(wb.getConsoleLogs().length).toBe(before);
    } else {
      expect(handler == null).toBe(true);
      expect(wb.getConsoleLogs().length).toBe(0);
    }

    wb.setConsent(true);
    const handler2 = window.onerror as unknown as (msg: string) => void;
    expect(typeof handler2).toBe('function');
    (handler2 as unknown as (m: string) => void)('Uncaught Error: should capture');
    expect(wb.getConsoleLogs().some((l) => l.message.includes('should capture'))).toBe(true);
  });

  it('setConsent(false) prevents batcher enqueue', async () => {
    const wb = createWatchbug();
    wb.init({ key: 'test-batcher-consent' });
    wb.setConsent(false);
    const batcher = _getBatcher();
    expect(batcher).not.toBeNull();
    const report = {
      type: 'bug' as const,
      screenshot: 'data:image/png;base64,abc',
      metadata: { url: 'https://example.com', userAgent: 'agent', timestamp: new Date().toISOString() },
      consoleLogs: [{ level: 'log' as const, message: 'hi', timestamp: new Date().toISOString() }],
      errors: [],
    };
    batcher!.enqueue(report);
    expect(batcher!.getQueueLength()).toBe(0);
    // submitReport also should be blocked
    wb.submitReport(report);
    expect(batcher!.getQueueLength()).toBe(0);
  });

  it('setConsent(true) allows batcher enqueue again', async () => {
    const wb = createWatchbug();
    wb.init({ key: 'test-batcher-resume' });
    wb.setConsent(false);
    const batcher = _getBatcher()!;
    const report = {
      type: 'bug' as const,
      screenshot: 'data:image/png;base64,abc',
      metadata: { url: 'https://example.com', userAgent: 'agent', timestamp: new Date().toISOString() },
      consoleLogs: [{ level: 'log' as const, message: 'hi', timestamp: new Date().toISOString() }],
      errors: [],
    };
    batcher.enqueue(report);
    expect(batcher.getQueueLength()).toBe(0);
    wb.setConsent(true);
    batcher.enqueue(report);
    expect(batcher.getQueueLength()).toBe(1);
    expect(_getBatcher()!.getQueueLength()).toBe(1);
  });

  it('window.onerror stores errors in console buffer per D-04 when consent true', async () => {
    const wb = createWatchbug();
    wb.init({ key: 'test-onerror-buffer' });
    const handler = window.onerror as OnErrorEventHandler;
    expect(handler).not.toBeNull();
    (handler as unknown as (msg: string) => void)('Uncaught ReferenceError: x is not defined');
    const logs = wb.getConsoleLogs();
    expect(logs.some((l) => l.level === 'error' && l.message.includes('ReferenceError'))).toBe(true);
  });
});
