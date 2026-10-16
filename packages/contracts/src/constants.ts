/**
 * The A-06 binding constant set — the single source of truth for every cap,
 * size, count and TTL in Watchbug (R-18 DRY).
 *
 * Plain TypeScript with **zero Zod import** so the SDK can inline these values
 * at build time and Zod never ships to the browser (R-01 size lane, R-15
 * types-only import). The Zod schema, the API edge enforcement and the panel
 * clamps all import from here: client clamps are UX only, server caps are the
 * control.
 *
 * Values [VERIFIED: `.planning/research/SUMMARY.md:74-88`, A-06 in
 * `documentation/resolution-record.md`].
 */

// --- Request / payload ceilings -------------------------------------------
/** 5 MB — whole request body, `Content-Length` pre-read + streaming counter → 413. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024;
/** 4 MB — multipart `limits.fileSize`, the parser-level guard → 413. */
export const MAX_IMAGE_PART_BYTES = 4 * 1024 * 1024;
/** 2 MB — the A-06 *semantic* cap on the encoded image, checked after part read. */
export const MAX_ENCODED_IMAGE_BYTES = 2 * 1024 * 1024;
/** 16,777,216 px (4096×4096) — decode-bomb guard, read from headers before any decode. */
export const MAX_IMAGE_PIXELS = 16_777_216;
/** 8192 px — per-side dimension guard, read from headers before any decode. */
export const MAX_IMAGE_DIM = 8192;
/** 64 KB — serialized `meta` part. */
export const MAX_META_BYTES = 64 * 1024;

// --- Console log buffer (populated by Phase 4; constants ship now) --------
export const MAX_CONSOLE_TOTAL_BYTES = 48 * 1024;
export const MAX_CONSOLE_ENTRIES = 100;
export const MAX_CONSOLE_MESSAGE_CHARS = 2048;
export const MAX_CONSOLE_ARG_CHARS = 1024;
export const MAX_CONSOLE_DEPTH = 3;
export const MAX_CONSOLE_STACK_CHARS = 8192;

// --- Text caps (Zod `maxLength`, API 400) ---------------------------------
export const MAX_TITLE_CHARS = 200;
export const MAX_NOTE_CHARS = 5_000;
export const MAX_USER_NAME_CHARS = 120;
export const MAX_USER_EMAIL_CHARS = 254;
export const MAX_USER_ID_CHARS = 64;
export const MAX_URL_PATH_CHARS = 2048;
export const MAX_ENRICHER_VALUE_CHARS = 512;

// --- Rate limits (in-memory, INV-03 — no Redis) ---------------------------
export const RATE_LIMIT_PER_KEY_PER_MIN = 10;
export const RATE_LIMIT_PER_IP_PER_MIN = 30;
export const RATE_LIMIT_PER_PROJECT_PER_DAY = 2_000;

// --- Retention (M-1/A-02: TTL columns exist from the first migration) -----
export const TTL_IDENTITY_DAYS = 30;
export const TTL_ARTIFACT_DAYS = 90;

// --- Masking contract (R-13 / A-01 / SEC-02) -----------------------------
/**
 * Flat opaque fill (alpha 255) is the **only** automatic masking primitive.
 * Gaussian blur is prohibited (invertible by deconvolution); pixelation is
 * opt-in only, at `MASK_PIXELATION_MIN_BLOCK_PX` or larger. This contract may
 * never grow an invertible or weak masking mode.
 */
export const MASK_ALPHA_OPAQUE = 255;
export const MASK_PIXELATION_MIN_BLOCK_PX = 8;
