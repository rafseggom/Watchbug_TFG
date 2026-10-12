import sanitizeHtml from 'sanitize-html';
import { reportSchema } from '@watchbug/contracts/schema';
import type { ReportMeta } from '@watchbug/contracts/types';

/**
 * SEC-05 pass 1 — **sanitize on write**: every user-supplied string is stripped
 * to plain text with an empty allowlist before it is stored. React text-node
 * rendering (pass 2) is the second control; neither is a substitute for the
 * other (Pattern 7, C-3).
 *
 * Sanitising can change a value (`<b>x</b>` → `x`, entity decoding, tag-only
 * text → empty), so {@link sanitizeMeta} re-validates the cleaned payload
 * against the published schema: whatever reaches storage is guaranteed to
 * validate against `schema/report.schema.json` (ENR-06), and a title that only
 * consisted of markup is rejected rather than stored empty.
 */

const PLAIN_TEXT = { allowedTags: [], allowedAttributes: {} };

export function toPlainText(value: string): string {
  return sanitizeHtml(value, PLAIN_TEXT);
}

/** Preserves `null` and absence exactly — sanitizing must not reshape the contract. */
function clean(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value;
  return toPlainText(value);
}

export function sanitizeMeta(meta: ReportMeta): ReportMeta {
  return {
    ...meta,
    title: toPlainText(meta.title),
    note: clean(meta.note),
    url: clean(meta.url),
    user:
      meta.user === null || meta.user === undefined
        ? meta.user
        : {
            id: clean(meta.user.id),
            name: clean(meta.user.name),
            email: clean(meta.user.email),
          },
  };
}

/** Sanitize, then re-run the contract: `null` means the cleaned payload no longer validates. */
export function sanitizeAndValidate(meta: ReportMeta): ReportMeta | null {
  const cleaned = sanitizeMeta(meta);
  const result = reportSchema.safeParse(cleaned);
  return result.success ? result.data : null;
}
