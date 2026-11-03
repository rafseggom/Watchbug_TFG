import type { z } from 'zod';
import type { reportSchema } from './schema.ts';

/**
 * Type-only surface of the contract (R-01/R-15): the SDK and the panel consume
 * these with `import type`, so **Zod never ships to the client bundle** — the
 * runtime schema object is used by the API (CA-01 validation) and by the
 * schema-emitting build script only.
 */

/** Report kind filed by the end user. */
export type IncidentType = 'bug' | 'feedback';

/**
 * Accepted image container — PNG, WebP and JPEG (P3-D-14 widens P1-D-11;
 * SVG rejected unconditionally). JPEG is a server-side contract only: the SDK
 * never encodes JPEG (the single encode sink emits WebP or PNG), so this arm
 * exists for direct API callers attaching a photo.
 */
export type ImageExt = 'png' | 'webp' | 'jpeg';

/** The validated `meta` payload of `POST /api/incidents` (CA-01). */
export type ReportMeta = z.infer<typeof reportSchema>;

/** Nullable sub-object of {@link ReportMeta} — host-supplied identity (R-09/R-10). */
export type ReportUser = NonNullable<NonNullable<ReportMeta['user']>>;
