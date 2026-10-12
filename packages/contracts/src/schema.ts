import { z } from 'zod';
import {
  MAX_NOTE_CHARS,
  MAX_TITLE_CHARS,
  MAX_URL_PATH_CHARS,
  MAX_USER_EMAIL_CHARS,
  MAX_USER_ID_CHARS,
  MAX_USER_NAME_CHARS,
} from './constants.ts';

/**
 * CA-01 report meta — the single official wire contract.
 *
 * **Closed shape:** `z.strictObject` rejects unknown keys, so the ingest can
 * never silently grow into a free-form data sink that persists arbitrary
 * client-supplied fields (plan prohibition: stored payload stays closed).
 * Every bound is imported from `constants.ts` (R-18) — never restated here.
 *
 * The published artifact `schema/report.schema.json` is generated from this
 * schema by `scripts/emit-schema.mjs` (never hand-written, never the
 * deprecated `zod-to-json-schema` converter).
 */
export const reportSchema = z.strictObject({
  /** What the user filed. */
  type: z.enum(['bug', 'feedback']),
  /** Required, non-empty, inclusive 1..MAX_TITLE_CHARS code units. */
  title: z.string().min(1).max(MAX_TITLE_CHARS),
  /** Optional free-form description. */
  note: z.string().max(MAX_NOTE_CHARS).nullable().optional(),
  /** Path of the page the report was filed on (≤ MAX_URL_PATH_CHARS). */
  url: z.string().max(MAX_URL_PATH_CHARS).nullable().optional(),
  /** Host-supplied identity (R-09/R-10) — each field separable and nullable. */
  user: z
    .strictObject({
      id: z.string().max(MAX_USER_ID_CHARS).nullable().optional(),
      name: z.string().max(MAX_USER_NAME_CHARS).nullable().optional(),
      email: z.string().max(MAX_USER_EMAIL_CHARS).nullable().optional(),
    })
    .nullable()
    .optional(),
});

/**
 * Declaration order of the top-level fields — the stable order in which
 * validation failures are reported in a 400 body (schema field-declaration
 * order, stable across repeated identical requests).
 */
export const REPORT_FIELD_ORDER = ['type', 'title', 'note', 'url', 'user'] as const;
