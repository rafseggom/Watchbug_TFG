import type { ReportPayload } from '../capture/batcher';

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Client-side payload validation per TRN-02 and TRN-04.
 * - type must be 'bug' | 'feedback'
 * - screenshot non-empty string
 * - metadata required object with url, userAgent, timestamp
 * - consoleLogs required (non-empty) for type=bug, optional for type=feedback
 * - errors must be array
 */
export function validatePayload(payload: unknown): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['payload must be an object'] };
  }

  const p = payload as Record<string, unknown>;

  // type
  if (p.type !== 'bug' && p.type !== 'feedback') {
    errors.push("type must be 'bug' or 'feedback'");
  }

  // screenshot
  if (typeof p.screenshot !== 'string' || (p.screenshot as string).trim() === '') {
    errors.push('screenshot must be a non-empty string');
  }

  // metadata
  if (!p.metadata || typeof p.metadata !== 'object' || Array.isArray(p.metadata)) {
    errors.push('metadata is required');
  } else {
    const m = p.metadata as Record<string, unknown>;
    if (typeof m.url !== 'string' || (m.url as string).trim() === '') {
      errors.push('metadata.url is required');
    }
    if (typeof m.userAgent !== 'string' || (m.userAgent as string).trim() === '') {
      errors.push('metadata.userAgent is required');
    }
    if (typeof m.timestamp !== 'string' || (m.timestamp as string).trim() === '') {
      errors.push('metadata.timestamp is required');
    }
  }

  // consoleLogs — TRN-04: required for bug, optional for feedback
  if (p.type === 'bug') {
    if (!Array.isArray(p.consoleLogs) || (p.consoleLogs as unknown[]).length === 0) {
      errors.push('consoleLogs is required for type=bug');
    }
  } else if (p.type === 'feedback') {
    if (p.consoleLogs !== undefined && !Array.isArray(p.consoleLogs)) {
      errors.push('consoleLogs must be an array when provided');
    }
  } else {
    // invalid type already reported, but also check consoleLogs is array if present
    if (p.consoleLogs !== undefined && !Array.isArray(p.consoleLogs)) {
      errors.push('consoleLogs must be an array');
    }
  }

  // errors field must be array
  if (!Array.isArray(p.errors)) {
    errors.push('errors must be an array');
  }

  return { valid: errors.length === 0, errors };
}
