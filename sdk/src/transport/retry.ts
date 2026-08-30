export type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
};

export type RetryResult = {
  success: boolean;
  error?: string;
  attempts: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff per D-08.
 * delay = baseDelayMs * 2^attempt
 * Default maxRetries 3, baseDelayMs 1000.
 */
export async function retrySend(
  fn: () => Promise<{ success: boolean; error?: string }>,
  options?: RetryOptions,
): Promise<RetryResult> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  let lastResult: { success: boolean; error?: string } = { success: false, error: 'no attempts' };
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;
    try {
      const result = await fn();
      lastResult = result;
      if (result.success) {
        return { success: true, attempts };
      }
    } catch (e) {
      lastResult = { success: false, error: e instanceof Error ? e.message : String(e) };
    }

    // Don't sleep after the last attempt
    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  return { success: lastResult.success, error: lastResult.error, attempts };
}
