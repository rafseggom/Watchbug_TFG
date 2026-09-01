import { describe, it, expect, beforeEach } from 'vitest';
import { createWatchbug, _resetForTesting, _pushConsoleEntry } from '../../sdk/src/index';

describe('Watchbug SDK entry point', () => {
  beforeEach(() => {
    _resetForTesting();
    // Clean up any window.Watchbug that may have been set
    // Re-create fresh instance for isolation (but window.Watchbug is singleton)
    // For tests we use createWatchbug() directly
  });

  it('init() sets _initialized to true', () => {
    const wb = createWatchbug();
    expect(wb._initialized).toBe(false);
    wb.init({ key: 'test-key' });
    expect(wb._initialized).toBe(true);
  });

  it('init() mounts a custom element to document.body', () => {
    const wb = createWatchbug();
    wb.init({ key: 'test-key' });
    const el = document.querySelector('watchbug-widget');
    expect(el).not.toBeNull();
    expect(document.body.contains(el)).toBe(true);
  });

  it('window.Watchbug has only init, setConsent, getConsoleLogs, submitReport, _initialized', async () => {
    // Ensure the module's side-effect (window assignment) has run
    await import('../../sdk/src/index');
    const wb = (window as unknown as Record<string, unknown>).Watchbug as Record<string, unknown>;
    expect(wb).toBeDefined();
    const keys = Object.keys(wb).sort();
    // _initialized is a getter/setter, so it appears as a key; submitReport added in 01-02, getDrafts/retryDraft added in 01-04
    expect(keys).toEqual(['_initialized', 'getConsoleLogs', 'getDrafts', 'init', 'retryDraft', 'setConsent', 'submitReport']);
  });

  it('init() without key throws or returns error', () => {
    const wb = createWatchbug();
    expect(() => (wb as unknown as { init: (c: unknown) => void }).init({} as unknown as never)).toThrow();
    expect(() => wb.init({ key: '' })).toThrow();
    // @ts-expect-error testing missing key
    expect(() => wb.init({})).toThrow();
    // @ts-expect-error testing null
    expect(() => wb.init(null as unknown as never)).toThrow();
  });

  it('setConsent(false) prevents subsequent capture calls', () => {
    const wb = createWatchbug();
    wb.init({ key: 'test-key' });
    wb.setConsent(false);
    _pushConsoleEntry({ level: 'log', message: 'should be blocked', timestamp: Date.now() });
    expect(wb.getConsoleLogs()).toHaveLength(0);

    wb.setConsent(true);
    _pushConsoleEntry({ level: 'log', message: 'should pass', timestamp: Date.now() });
    expect(wb.getConsoleLogs()).toHaveLength(1);
    expect(wb.getConsoleLogs()[0].message).toBe('should pass');
  });

  it('getConsoleLogs returns a copy', () => {
    const wb = createWatchbug();
    wb.init({ key: 'test-key' });
    _pushConsoleEntry({ level: 'log', message: 'hello', timestamp: Date.now() });
    const logs = wb.getConsoleLogs();
    logs.push({ level: 'log', message: 'mutated', timestamp: Date.now() });
    expect(wb.getConsoleLogs()).toHaveLength(1);
  });

  it('does not mount duplicate widget on second init', () => {
    const wb = createWatchbug();
    wb.init({ key: 'test-key' });
    wb.init({ key: 'test-key-2' });
    const els = document.querySelectorAll('watchbug-widget');
    expect(els.length).toBe(1);
  });

  it('accepts optional language and apiUrl config', () => {
    const wb = createWatchbug();
    expect(() => wb.init({ key: 'k', language: 'es', apiUrl: 'https://example.com', bufferSize: 100 })).not.toThrow();
    expect(wb._initialized).toBe(true);
    const el = document.querySelector('watchbug-widget');
    expect(el?.getAttribute('data-language')).toBe('es');
  });
});
