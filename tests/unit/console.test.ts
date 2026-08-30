import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { redactSecrets, SECRET_PATTERNS, createConsoleBuffer, startConsoleCapture, type ConsoleEntry } from '../../sdk/src/capture/console';

describe('console capture', () => {
  describe('redactSecrets', () => {
    it('redactSecrets replaces API key patterns with [REDACTED]', () => {
      expect(redactSecrets('api_key=abc123secret')).toContain('[REDACTED]');
      expect(redactSecrets('api-key: mykey123')).toContain('[REDACTED]');
    });

    it('redactSecrets replaces JWT tokens with [REDACTED]', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      expect(redactSecrets(`token is ${jwt} end`)).toContain('[REDACTED]');
    });

    it('redactSecrets replaces password patterns with [REDACTED]', () => {
      expect(redactSecrets('password=abc123secret')).toContain('[REDACTED]');
      expect(redactSecrets('password: supersecret')).toContain('[REDACTED]');
    });

    it('redactSecrets truncates messages to 500 characters', () => {
      const long = 'a'.repeat(600);
      const result = redactSecrets(long);
      expect(result.length).toBe(500);
      const longWithSecret = 'password=secret ' + 'x'.repeat(600);
      const result2 = redactSecrets(longWithSecret);
      expect(result2.length).toBeLessThanOrEqual(500);
    });

    it('SECRET_PATTERNS contains at least 7 regex patterns', () => {
      expect(SECRET_PATTERNS.length).toBeGreaterThanOrEqual(7);
    });

    it('redactSecrets handles Bearer tokens', () => {
      expect(redactSecrets('Authorization: Bearer abc.def.ghi')).toContain('[REDACTED]');
    });

    it('redactSecrets handles secret and authorization patterns', () => {
      expect(redactSecrets('secret=mysecretvalue')).toContain('[REDACTED]');
      expect(redactSecrets('authorization: token123')).toContain('[REDACTED]');
    });
  });

  describe('createConsoleBuffer', () => {
    it('createConsoleBuffer respects maxEntries (ring buffer behavior)', () => {
      const buf = createConsoleBuffer(2);
      buf.add({ level: 'log', message: 'a', timestamp: new Date().toISOString() });
      buf.add({ level: 'log', message: 'b', timestamp: new Date().toISOString() });
      expect(buf.getAll()).toHaveLength(2);
      // Adding third should evict oldest
      buf.add({ level: 'log', message: 'c', timestamp: new Date().toISOString() });
      const all = buf.getAll();
      expect(all).toHaveLength(2);
      expect(all[0].message).toBe('b');
      expect(all[1].message).toBe('c');
    });

    it('createConsoleBuffer evicts oldest entry when full', () => {
      const buf = createConsoleBuffer(3);
      for (let i = 1; i <= 4; i++) {
        buf.add({ level: 'log', message: `msg${i}`, timestamp: new Date().toISOString() });
      }
      const all = buf.getAll();
      expect(all).toHaveLength(3);
      expect(all.map((e) => e.message)).toEqual(['msg2', 'msg3', 'msg4']);
    });

    it('createConsoleBuffer default maxEntries is 50', () => {
      const buf = createConsoleBuffer();
      for (let i = 0; i < 51; i++) {
        buf.add({ level: 'log', message: `m${i}`, timestamp: new Date().toISOString() });
      }
      expect(buf.getAll()).toHaveLength(50);
      expect(buf.getAll()[0].message).toBe('m1');
    });

    it('clear() empties buffer', () => {
      const buf = createConsoleBuffer(5);
      buf.add({ level: 'log', message: 'x', timestamp: new Date().toISOString() });
      buf.clear();
      expect(buf.getAll()).toHaveLength(0);
    });
  });

  describe('startConsoleCapture', () => {
    let originalLog: typeof console.log;
    let originalWarn: typeof console.warn;
    let originalError: typeof console.error;
    let originalInfo: typeof console.info;

    beforeEach(() => {
      originalLog = console.log;
      originalWarn = console.warn;
      originalError = console.error;
      originalInfo = console.info;
    });

    afterEach(() => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      console.info = originalInfo;
      vi.restoreAllMocks();
    });

    it('startConsoleCapture intercepts console.log', () => {
      const buf = createConsoleBuffer(10);
      const stop = startConsoleCapture(buf);
      console.log('hello log');
      const entries = buf.getAll();
      expect(entries.length).toBe(1);
      expect(entries[0].level).toBe('log');
      expect(entries[0].message).toBe('hello log');
      stop();
    });

    it('startConsoleCapture intercepts console.warn, console.error, console.info', () => {
      const buf = createConsoleBuffer(10);
      const stop = startConsoleCapture(buf);
      console.warn('warn msg');
      console.error('error msg');
      console.info('info msg');
      const all = buf.getAll();
      expect(all).toHaveLength(3);
      expect(all[0].level).toBe('warn');
      expect(all[1].level).toBe('error');
      expect(all[2].level).toBe('info');
      stop();
    });

    it('stop function restores original console methods', () => {
      const buf = createConsoleBuffer(10);
      const stop = startConsoleCapture(buf);
      const logAfterStart = console.log;
      stop();
      expect(console.log).toBe(originalLog);
      expect(console.warn).toBe(originalWarn);
      expect(console.error).toBe(originalError);
      expect(console.info).toBe(originalInfo);
      // After stop, further logs should not be captured
      console.log('after stop');
      expect(buf.getAll()).toHaveLength(0);
    });

    it('redaction is applied before storage', () => {
      const buf = createConsoleBuffer(10);
      const stop = startConsoleCapture(buf);
      console.log('password=supersecret123');
      const entry = buf.getAll()[0];
      expect(entry.message).toContain('[REDACTED]');
      expect(entry.message).not.toContain('supersecret123');
      stop();
    });
  });

  describe('window.onerror', () => {
    it('window.onerror adds error entry to buffer via init', async () => {
      const { createWatchbug, _resetForTesting } = await import('../../sdk/src/index');
      _resetForTesting();
      const wb = createWatchbug();
      wb.init({ key: 'test-key-onerror' });

      // Trigger window.onerror
      const handler = window.onerror as OnErrorEventHandler;
      expect(typeof handler).toBe('function');
      // Call with error message
      (handler as unknown as (msg: string) => void)('Uncaught TypeError: x is not defined');

      const logs = wb.getConsoleLogs();
      const errorEntry = logs.find((e) => e.level === 'error' && e.message.includes('Uncaught TypeError'));
      expect(errorEntry).toBeDefined();

      _resetForTesting();
    });
  });
});
