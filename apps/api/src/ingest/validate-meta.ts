import { MAX_META_BYTES } from '@watchbug/contracts/constants';
import { REPORT_FIELD_ORDER, reportSchema } from '@watchbug/contracts/schema';
import type { ReportMeta } from '@watchbug/contracts/types';

/**
 * Stage 1 of the ingest chain: turn the raw `meta` part into a validated
 * {@link ReportMeta}, or into a structured 400 that names the offending fields
 * **in schema field-declaration order** (stable across repeated identical
 * requests — ENR-06 ordering edge).
 *
 * Order matters: this runs before any image work, so a malformed payload never
 * costs a decode (cheap guards first, codecs last).
 */

export interface MetaIssue {
  field: string;
  message: string;
}

export type MetaValidation =
  | { ok: true; meta: ReportMeta }
  | { ok: false; statusCode: 400; issues: MetaIssue[] };

function reject(issues: MetaIssue[]): MetaValidation {
  return { ok: false, statusCode: 400, issues };
}

function orderOf(field: string): number {
  const idx = (REPORT_FIELD_ORDER as readonly string[]).indexOf(field);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

export function validateMeta(raw: string | undefined): MetaValidation {
  // Missing and empty behave identically (ENR-06 empty edge): nothing is stored.
  if (raw === undefined || raw.trim() === '') {
    return reject([{ field: 'meta', message: 'the "meta" part is missing or empty' }]);
  }

  const byteLength = Buffer.byteLength(raw, 'utf8');
  if (byteLength > MAX_META_BYTES) {
    return reject([
      {
        field: 'meta',
        message: `meta is ${byteLength} bytes; the contract allows at most ${MAX_META_BYTES} (MAX_META_BYTES)`,
      },
    ]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return reject([{ field: 'meta', message: 'meta is not valid JSON' }]);
  }

  const result = reportSchema.safeParse(parsed);
  if (result.success) return { ok: true, meta: result.data };

  const issues = result.error.issues
    .map((issue, index) => ({
      field: issue.path.length > 0 ? String(issue.path[0]) : 'meta',
      message: issue.message,
      index,
    }))
    .sort((a, b) => orderOf(a.field) - orderOf(b.field) || a.index - b.index)
    .map(({ field, message }) => ({ field, message }));

  return reject(issues);
}
