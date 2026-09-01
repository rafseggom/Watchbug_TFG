import { createConsoleBuffer, startConsoleCapture, type ConsoleBuffer } from './capture/console';
import { EventBatcher, type ReportPayload } from './capture/batcher';
import { sendReport } from './transport/sender';
import { validatePayload } from './transport/validation';
import { retrySend } from './transport/retry';
import { saveDraft, getAllDrafts, removeDraft, getAllDraftsWithKeys } from './transport/draft';
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
  submitReport(report: ReportPayload): void;
  getDrafts(): ReportPayload[];
  retryDraft(key: string): Promise<{ success: boolean; error?: string }>;
  _initialized: boolean;
};

let _initialized = false;
let _consentEnabled = true;
let _config: WatchbugConfig | null = null;

// Capture engine state — wired in Plan 02
let _consoleBufferObj: ConsoleBuffer = createConsoleBuffer(50);
let _rawBufferAdd: ConsoleBuffer['add'] | null = null;
let _stopConsoleCapture: (() => void) | null = null;
let _onErrorHandler: OnErrorEventHandler | null = null;
let _prevOnError: OnErrorEventHandler | null = null;
let _captureStarted = false;
let _batcher: EventBatcher | null = null;
let _rawBatcherEnqueue: ((report: ReportPayload) => void) | null = null;

export function _getBatcher(): EventBatcher | null {
  return _batcher;
}

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

      const apiUrl = config.apiUrl ?? '';
      const projectKey = config.key;

      // Wire capture engine (idempotent)
      if (!_captureStarted) {
        const size = config.bufferSize ?? 50;
        _consoleBufferObj = createConsoleBuffer(size);
        _rawBufferAdd = _consoleBufferObj.add.bind(_consoleBufferObj);
        _stopConsoleCapture = startConsoleCapture(_consoleBufferObj, () => _consentEnabled);
        // Patch buffer.add to respect consent for direct calls (onerror, _pushConsoleEntry)
        _consoleBufferObj.add = (entry) => {
          if (!_consentEnabled) return;
          _rawBufferAdd!(entry);
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
          _prevOnError = window.onerror;
          window.onerror = function (
            msg: string | Event,
            src?: string,
            line?: number,
            col?: number,
            err?: Error,
          ) {
            _onErrorHandler?.(msg, src, line, col, err);
            if (typeof _prevOnError === 'function') {
              // @ts-ignore - prev is narrowed to function via typeof check
              return _prevOnError(msg, src, line, col, err);
            }
            return false;
          } as OnErrorEventHandler;
        }
        _captureStarted = true;
      }

      // Event batcher per D-07 + TRN-01/02 + D-08 — idempotent
      if (!_batcher) {
        const flushFn = async (batch: ReportPayload[]) => {
          for (const report of batch) {
            const validation = validatePayload(report as unknown);
            if (!validation.valid) {
              console.error('[Watchbug] invalid payload', validation.errors);
              continue;
            }
            const result = await retrySend(() => sendReport(apiUrl, projectKey, report));
            if (!result.success) {
              try {
                saveDraft(report);
              } catch {}
            } else {
              try {
                if (typeof document !== 'undefined') {
                  const evt = new CustomEvent('watchbug:toast', { detail: { message: 'Report sent' } });
                  window.dispatchEvent(evt);
                }
              } catch {}
            }
          }
        };
        _batcher = new EventBatcher(flushFn, {
          batchSize: 5,
          flushIntervalMs: 3000,
          isEnabled: () => _consentEnabled,
        });
        _batcher.start();
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
      if (apiUrl) {
        el.setAttribute('data-api-url', apiUrl);
      }
      el.setAttribute('data-consent', String(_consentEnabled));
      if (config.autoSanitize !== undefined) {
        el.setAttribute('data-auto-sanitize', String(config.autoSanitize));
      }

      document.body.appendChild(el);
    },

    setConsent(enabled: boolean): void {
      const next = Boolean(enabled);
      if (next === _consentEnabled) return;
      _consentEnabled = next;
      // Sync widget consent attribute for submit flow
      try {
        const w = document.querySelector('watchbug-widget');
        if (w) w.setAttribute('data-consent', String(next));
      } catch {}
      if (!next) {
        if (_stopConsoleCapture) {
          try {
            _stopConsoleCapture();
          } catch {}
          _stopConsoleCapture = null;
        }
        if (typeof window !== 'undefined' && _onErrorHandler) {
          try {
            window.onerror = _prevOnError;
          } catch {}
        }
      } else {
        if (!_stopConsoleCapture && _rawBufferAdd) {
          _stopConsoleCapture = startConsoleCapture(_consoleBufferObj, () => _consentEnabled);
          const raw = _rawBufferAdd;
          _consoleBufferObj.add = (entry) => {
            if (!_consentEnabled) return;
            raw(entry);
          };
        }
        if (typeof window !== 'undefined' && _onErrorHandler) {
          _prevOnError = window.onerror;
          window.onerror = function (
            msg: string | Event,
            src?: string,
            line?: number,
            col?: number,
            err?: Error,
          ) {
            _onErrorHandler?.(msg, src, line, col, err);
            if (typeof _prevOnError === 'function') {
              // @ts-ignore
              return _prevOnError(msg, src, line, col, err);
            }
            return false;
          } as OnErrorEventHandler;
        }
      }
    },

    getConsoleLogs(): ConsoleEntry[] {
      return _consoleBufferObj.getAll() as ConsoleEntry[];
    },

    submitReport(report: ReportPayload): void {
      if (!_consentEnabled) return;
      if (!_batcher) {
        const cfg = _config;
        const apiUrl = cfg?.apiUrl ?? '';
        const projectKey = cfg?.key ?? '';
        const flushFn = async (batch: ReportPayload[]) => {
          for (const r of batch) {
            const v = validatePayload(r as unknown);
            if (!v.valid) {
              console.error('[Watchbug] invalid payload', v.errors);
              continue;
            }
            const res = await retrySend(() => sendReport(apiUrl, projectKey, r));
            if (!res.success) {
              try { saveDraft(r); } catch {}
            }
          }
        };
        _batcher = new EventBatcher(flushFn, {
          batchSize: 5,
          flushIntervalMs: 3000,
          isEnabled: () => _consentEnabled,
        });
        _batcher.start();
      }
      _batcher.enqueue(report);
    },

    getDrafts(): ReportPayload[] {
      return getAllDrafts();
    },

    async retryDraft(key: string): Promise<{ success: boolean; error?: string }> {
      const drafts = getAllDraftsWithKeys();
      const found = drafts.find((d) => d.key === key);
      if (!found) return { success: false, error: 'draft not found' };
      const cfg = _config;
      const apiUrl = cfg?.apiUrl ?? '';
      const projectKey = cfg?.key ?? '';
      const result = await retrySend(() => sendReport(apiUrl, projectKey, found.report));
      if (result.success) {
        try { removeDraft(key); } catch {}
      }
      return result;
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
  if (typeof window !== 'undefined') {
    try {
      window.onerror = _prevOnError ?? null;
    } catch {}
    _onErrorHandler = null;
    _prevOnError = null;
  }
  if (_batcher) {
    try {
      _batcher.stop();
    } catch {}
    _batcher = null;
  }
  _rawBatcherEnqueue = null;
  _captureStarted = false;
  _consoleBufferObj = createConsoleBuffer(50);
  _rawBufferAdd = _consoleBufferObj.add.bind(_consoleBufferObj);
  // Clear drafts for test isolation
  try {
    if (typeof localStorage !== 'undefined') {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('watchbug_draft_')) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch {}
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
