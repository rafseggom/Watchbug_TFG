export type ConsoleEntry = {
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: string;
};

export const SECRET_PATTERNS: RegExp[] = [
  /password['":\s=]+[^\s'"]+/gi,
  /token['":\s=]+[^\s'"]+/gi,
  /api[_-]?key['":\s=]+[^\s'"]+/gi,
  /secret['":\s=]+[^\s'"]+/gi,
  /authorization['":\s=]+[^\s'"]+/gi,
  /Bearer\s+[^\s'"]+/gi,
  /eyJ[A-Za-z0-9-_=]+?\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
];

export function redactSecrets(message: string): string {
  let redacted = message;
  for (const pattern of SECRET_PATTERNS) {
    // Reset lastIndex for global patterns to ensure full replacement
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  // Truncate to 500 chars per Pitfall 4
  if (redacted.length > 500) {
    redacted = redacted.substring(0, 500);
  }
  return redacted;
}

export type ConsoleBuffer = {
  entries: ConsoleEntry[];
  add(entry: ConsoleEntry): void;
  getAll(): ConsoleEntry[];
  clear(): void;
};

export function createConsoleBuffer(maxEntries: number = 50): ConsoleBuffer {
  const entries: ConsoleEntry[] = [];

  return {
    get entries() {
      return entries;
    },
    add(entry: ConsoleEntry): void {
      if (entries.length >= maxEntries) {
        entries.shift();
      }
      entries.push(entry);
    },
    getAll(): ConsoleEntry[] {
      return [...entries];
    },
    clear(): void {
      entries.length = 0;
    },
  };
}

type ConsoleMethod = 'log' | 'warn' | 'error' | 'info';

export function startConsoleCapture(
  buffer: ConsoleBuffer,
  isEnabled?: () => boolean,
): () => void {
  const original: Record<ConsoleMethod, typeof console.log> = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };

  const wrap = (level: ConsoleMethod): typeof console.log => {
    return (...args: unknown[]) => {
      try {
        if (isEnabled && !isEnabled()) {
          // Consent disabled — skip buffer but still call original
        } else {
          const message = args
            .map((arg) => (typeof arg === 'string' ? arg : String(arg)))
            .join(' ');
          const redacted = redactSecrets(message);
          const entry: ConsoleEntry = {
            level,
            message: redacted,
            timestamp: new Date().toISOString(),
          };
          buffer.add(entry);
        }
      } catch {
        // never break host app
      }
      // Always call original
      original[level].apply(console, args as never);
    };
  };

  (console as unknown as Record<string, unknown>).log = wrap('log');
  (console as unknown as Record<string, unknown>).warn = wrap('warn');
  (console as unknown as Record<string, unknown>).error = wrap('error');
  (console as unknown as Record<string, unknown>).info = wrap('info');

  const stop = (): void => {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
    console.info = original.info;
  };

  return stop;
}
