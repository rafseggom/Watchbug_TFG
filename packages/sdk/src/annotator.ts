/**
 * Lazy editor lane (RNF-01 lane 2 — ≤ 25 KB gz, loaded on demand).
 *
 * **Build/size shell only.** The hand-rolled canvas annotator lands with the
 * widget behavior (Phase 2/3): D-05 closed `fabric.js`/`konva` (≈85 KB / ≈45 KB
 * gz) as over-budget, and R-13 fixes the masking contract this editor must
 * honour — flat opaque fill (alpha 255) is the only automatic primitive,
 * pixelation opt-in at ≥ 8 px, Gaussian blur prohibited.
 *
 * Emitted as its own entry point so the core lane never carries editor bytes
 * (esbuild splitting works for ESM only; the IIFE build loads this lane by
 * script-tag injection instead).
 */

/** Lane identity for the size gate. */
export const ANNOTATOR_LANE = 'lazy-editor' as const;
