export type ConsoleEntry = {
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;
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
const _consoleBuffer: ConsoleEntry[] = [];

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

      // Mount widget to document.body
      // Avoid duplicate mounts
      const existing = document.querySelector('watchbug-widget');
      if (existing) {
        return;
      }

      // Create the custom element; if WatchbugWidget is defined it will upgrade,
      // otherwise it remains as an HTMLElement placeholder until defined.
      const el = document.createElement('watchbug-widget');

      // Pass language via attribute so widget can pick it up
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
      // Return a shallow copy to prevent external mutation
      return [..._consoleBuffer];
    },
  };

  return api;
}

// Internal helpers for future capture module (Plan 02) — not exposed on global
export function _isConsentEnabled(): boolean {
  return _consentEnabled;
}

export function _getConfig(): WatchbugConfig | null {
  return _config;
}

export function _pushConsoleEntry(entry: ConsoleEntry): void {
  if (!_consentEnabled) return;
  _consoleBuffer.push(entry);
  // Respect bufferSize if configured (default 50)
  const limit = _config?.bufferSize ?? 50;
  if (_consoleBuffer.length > limit) {
    _consoleBuffer.splice(0, _consoleBuffer.length - limit);
  }
}

export function _resetForTesting(): void {
  _initialized = false;
  _consentEnabled = true;
  _config = null;
  _consoleBuffer.length = 0;
  // Remove any mounted widget
  const existing = document.querySelector('watchbug-widget');
  if (existing) {
    existing.remove();
  }
}

// Ensure widget is registered (side-effect import) — must be bundled with SDK
import './widget/WatchbugWidget';

// Assign to window — single global entry point per INV-02
const watchbugInstance = createWatchbug();

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).Watchbug = watchbugInstance;
}

export default watchbugInstance;
