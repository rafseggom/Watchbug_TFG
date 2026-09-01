import type { ConsoleEntry } from './console';

export type ReportPayload = {
  type: 'bug' | 'feedback';
  screenshot: string;
  metadata: Record<string, unknown>;
  consoleLogs: ConsoleEntry[];
  errors: string[];
  notes?: string;
};

export type BatcherOptions = {
  batchSize?: number;
  flushIntervalMs?: number;
  isEnabled?: () => boolean;
};

export class EventBatcher {
  private queue: ReportPayload[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly flushFn: (batch: ReportPayload[]) => Promise<void>;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly isEnabled?: () => boolean;

  constructor(flushFn: (batch: ReportPayload[]) => Promise<void>, options?: BatcherOptions) {
    this.flushFn = flushFn;
    this.batchSize = options?.batchSize ?? 5;
    this.flushIntervalMs = options?.flushIntervalMs ?? 3000;
    this.isEnabled = options?.isEnabled;
  }

  enqueue(report: ReportPayload): void {
    if (this.isEnabled && !this.isEnabled()) return;
    this.queue.push(report);
    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.batchSize);
    try {
      await this.flushFn(batch);
    } catch {
      // Re-queue failed batch for retry per D-08 — prepend to preserve order
      this.queue.unshift(...batch);
    }
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
