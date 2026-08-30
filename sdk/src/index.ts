import { createConsoleBuffer, startConsoleCapture, type ConsoleBuffer } from './capture/console';
import './widget/WatchbugWidget';

export type ConsoleEntry = {
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: string;
};

export type WatchbugConfig = {
  key: string;
  autoSanitize?: boolean;
  language?: 'en' | 'es';
  apiUrl?: string;
  bufferSize?: number;
};

export type WatchbugAPI = {
  init(config: WatchbugConfig): void;
  setConsent(enabled: boolean): void;
  getConsoleLogs(): ConsoleEntry[];
  _initialized: boolean;
};

let _initialized = false;
let _consentEnabled = true;
let _config: WatchbugConfig | null = null;

// Capture engine state — wired in Plan 02
let _consoleBufferObj: ConsoleBuffer = createConsoleBuffer(50);
let _stopConsoleCapture: (() => void) | null = null;
let _onErrorHandler: OnErrorEventHandler | null = null;
let _captureStarted = false;

export function createWatchbug(): WatchbugAPI {
  const api: WatchbugAPI = {
    get _initialized() {
      return _initialized;
    },
    set _initialized(value: boolean) {
      _initialized = value;
    },

    init(config: WatchbugConfig): void {
      if (!config || !config.key || typeof config.key !== 'string' || config.key.trim() === '') {
        throw new Error('[Watchbug] init() requires a non-empty `key` property');
      }

      _config = { ...config };
      _initialized = true;

      // Wire capture engine (idempotent)
      if (!_captureStarted) {
        const size = config.bufferSize ?? 50;
        _consoleBufferObj = createConsoleBuffer(size);
        _stopConsoleCapture = startConsoleCapture(_consoleBufferObj);
        // Patch buffer.add to respect consent
        const origAdd = _consoleBufferObj.add.bind(_consoleBufferObj);
        _consoleBufferObj.add = (entry) => {
          if (!_consentEnabled) return;
          origAdd(entry);
        };

        // window.onerror handler per D-04
        _onErrorHandler = (
          message: string | Event,
          _source?: string,
          _lineno?: number,
          _colno?: number,
          _error?: Error,
        ) => {
          if (!_consentEnabled) return;
          const msg = typeof message === 'string' ? message : String(message);
          _consoleBufferObj.add({
            level: 'error',
            message: msg,
            timestamp: new Date().toISOString(),
          });
        };
        if (typeof window !== 'undefined') {
          const prev = window.onerror;
          window.onerror = function (
            msg: string | Event,
            src?: string,
            line?: number,
            col?: number,
            err?: Error,
          ) {
            _onErrorHandler?.(msg, src, line, col, err);
            if (typeof prev === 'function') {
              return (prev as OnErrorEventHandler)(msg, src, line, col, err);
            }
            return false;
          } as OnErrorEventHandler;
        }
        _captureStarted = true;
      }

      // Mount widget to document.body — avoid duplicate mounts
      const existing = document.querySelector('watchbug-widget');
      if (existing) {
        return;
      }

      const el = document.createElement('watchbug-widget');

      if (config.language) {
        el.setAttribute('data-language', config.language);
      }
      if (config.key) {
        el.setAttribute('data-key', config.key);
      }

      document.body.appendChild(el);
    },

    setConsent(enabled: boolean): void {
      _consentEnabled = Boolean(enabled);
    },

    getConsoleLogs(): ConsoleEntry[] {
      return _consoleBufferObj.getAll() as ConsoleEntry[];
    },
  };

  return api;
}

// Internal helpers — not exposed on global
export function _isConsentEnabled(): boolean {
  return _consentEnabled;
}

export function _getConfig(): WatchbugConfig | null {
  return _config;
}

export function _pushConsoleEntry(entry: ConsoleEntry | { level: string; message: string; timestamp: number | string }): void {
  if (!_consentEnabled) return;
  const normalized: ConsoleEntry = {
    level: entry.level as ConsoleEntry['level'],
    message: entry.message,
    timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : new Date(entry.timestamp).toISOString(),
  };
  _consoleBufferObj.add(normalized as never);
}

export function _resetForTesting(): void {
  _initialized = false;
  _consentEnabled = true;
  _config = null;
  if (_stopConsoleCapture) {
    try {
      _stopConsoleCapture();
    } catch {}
    _stopConsoleCapture = null;
  }
  if (typeof window !== 'undefined' && _onErrorHandler) {
    window.onerror = null;
    _onErrorHandler = null;
  }
  _captureStarted = false;
  _consoleBufferObj = createConsoleBuffer(50);
  const existing = document.querySelector('watchbug-widget');
  if (existing) {
    existing.remove();
  }
}

// Assign to window — single global entry point per INV-02
const watchbugInstance = createWatchbug();

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).Watchbug = watchbugInstance;
}

export default watchbugInstance;
