import sanitizeHtml from 'sanitize-html';
import { reportSchema } from '@watchbug/contracts/schema';
import type { ReportMeta } from '@watchbug/contracts/types';

/**
 * SEC-05 pass 1 — **sanitize on write**: every user-supplied string is stripped
 * to plain text with an empty allowlist before it is stored. React text-node
 * rendering (pass 2) is the second control; neither is a substitute for the
 * other (Pattern 7, C-3).
 *
 * Sanitising can change a value (`<b>x</b>` -> `x`, entity decoding, tag-only
 * text -> empty), so {@link sanitizeMeta} re-validates the cleaned payload
 * against the published schema: whatever reaches storage is guaranteed to
 * validate against `schema/report.schema.json` (ENR-06), and a title that only
 * consisted of markup is rejected rather than stored empty.
 *
 * Three properties define the pass (ING-07):
 *
 * 1. **Markup removed, text preserved.** Plain text round-trips literally —
 *    `2 < 3 & 4 > 1` stores as those exact characters, not entity-escaped —
 *    while real tags are dropped with their contents (`<b>a</b><i>b</i>` -> `ab`,
 *    document order kept).
 * 2. **Decoding never re-opens markup.** sanitize-html escapes the text it
 *    keeps; decoding those escapes back is what makes (1) hold, but an
 *    entity-encoded payload (`&lt;img ...&gt;`, `&#60;img ...&#62;`, or a
 *    `<title>` RCDATA container, which sanitize-html preserves as escaped text)
 *    must stay escaped — decoding it would store raw markup.
 * 3. **Control characters never reach storage.** PostgreSQL text cannot hold
 *    U+0000 at all; C0/C1 controls and the BOM are stripped in the same pass.
 *    Console fields (Phase 4) will reuse {@link stripControlChars}.
 */

const PLAIN_TEXT = { allowedTags: [], allowedAttributes: {} };

/**
 * The entities sanitize-html's renderer re-escapes when it keeps text — it
 * escapes `&`, `<` and `>` (quotes pass through untouched) — and their
 * characters. Decoding is a **single pass** so replacements are never
 * rescanned: `&amp;lt;` becomes `&lt;` (literal text), never a raw `<`.
 */
const ESCAPED_TEXT = /&(?:amp|lt|gt);/g;
const ENTITY_TO_CHAR: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>' };

/**
 * A decoded value that would open a tag (`<` followed by a letter, `/`, `!`
 * or `?`). Unicode letters included: browsers accept them as tag names.
 */
const TAG_OPEN = /[<][\p{L}\/!?]/u;

/**
 * C0 controls except tab/LF/CR, DEL, C1 controls and the UTF-8/UTF-16 BOM.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFEFF]/g;

/** Strips control characters from a stored string (shared with Phase 4 console fields). */
export function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS, '');
}

function decodeTextEntities(value: string): string {
  return value.replace(ESCAPED_TEXT, (entity) => ENTITY_TO_CHAR[entity]);
}

export function toPlainText(value: string): string {
  // Pass A — markup removed, surviving text escaped by the renderer.
  const stripped = sanitizeHtml(value, PLAIN_TEXT);
  // Pass B — control characters removed, escapes decoded back to literal text.
  const decoded = stripControlChars(decodeTextEntities(stripped));
  // Pass C — keep the escaped form whenever decoding would hand storage a
  // tag-shaped string: literal text must round-trip, markup must not reappear.
  return TAG_OPEN.test(decoded) ? stripControlChars(stripped) : decoded;
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
