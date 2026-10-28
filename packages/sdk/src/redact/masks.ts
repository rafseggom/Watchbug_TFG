/**
 * The mask-patch vocabulary (C-2 / T2 / T3) and the **single** definition of
 * the flat fill colour (R-13 / R-18).
 *
 * This is a LEAF module on purpose: it imports only `BitmapRect` from
 * `./geometry.ts` and `MASK_ALPHA_OPAQUE` from the contracts' Zod-free
 * constants — nothing that reaches `patterns.ts`. The lazy mask lane imports
 * the fill colour from here; importing it from `redactor.ts` would drag the
 * whole T1 detection catalogue into the ≤ 25 KB chunk (RNF-01, PRF-02).
 * `redactor.ts` imports and re-exports `MASK_RGB` so every T1 call site keeps
 * its existing path (one definition, not two — R-18).
 */
import { MASK_ALPHA_OPAQUE } from '@watchbug/contracts/constants';
import type { BitmapRect } from './geometry.ts';

/** Flat, opaque, and the only masking primitive (R-13). Both lanes, one black. */
export const MASK_RGB = { r: 0, g: 0, b: 0 } as const;

/** The fill colour's shape — `MASK_RGB` and any future twin satisfy it. */
export type MaskRgb = typeof MASK_RGB;

/**
 * A baked mask region: the pixels **after** the destructive fill or pixelation
 * (T2). A patch carries only destroyed pixels — there is no pre-mask state
 * anywhere in this design (C-2, T-03-15), and `masks` is an append-only list
 * the undo stack never pops.
 */
export interface MaskPatch {
  readonly rect: BitmapRect;
  readonly pixels: ImageData;
}

/**
 * Replay a baked patch into `target` at its bitmap-space rect: a row-wise
 * replacement (never a compositing draw), with the alpha forced to
 * `MASK_ALPHA_OPAQUE` on write so a replayed mask cannot be semi-transparent
 * even if some future producer handed over an alpha-broken patch (SEC-02 /
 * R-13 fail-safe).
 *
 * FAIL CLOSED (S-3, mirroring `geometry.ts`'s refusal to guess a region): a
 * rect that is non-finite, non-integral, negatively degenerate, or outside the
 * target bitmap — or whose pixels do not match its rect — **throws**. The
 * throw propagates to `encodeFinal`'s caller, which turns it into a loud
 * no-send; a silently skipped patch is the fall-open this module forbids.
 */
export function putPatch(target: ImageData, patch: MaskPatch): void {
  const { rect, pixels } = patch;
  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.right) ||
    !Number.isFinite(rect.bottom)
  ) {
    throw new Error('putPatch: non-finite patch rect (refusing to guess a mask region)');
  }
  if (
    !Number.isInteger(rect.left) ||
    !Number.isInteger(rect.top) ||
    !Number.isInteger(rect.right) ||
    !Number.isInteger(rect.bottom)
  ) {
    throw new Error('putPatch: non-integral patch rect (bitmap space requires whole pixels)');
  }
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  if (width < 0 || height < 0) {
    throw new Error('putPatch: negative-area patch rect');
  }
  if (width === 0 || height === 0) return;
  if (rect.left < 0 || rect.top < 0 || rect.right > target.width || rect.bottom > target.height) {
    throw new Error('putPatch: patch rect lies outside the target bitmap');
  }
  if (pixels.width !== width || pixels.height !== height) {
    throw new Error('putPatch: patch pixels do not match their rect');
  }

  const source = pixels.data;
  for (let y = 0; y < height; y += 1) {
    const from = y * width * 4;
    const row = source.subarray(from, from + width * 4);
    // The masking contract is flat opaque (alpha 255); normalise it on the way
    // in rather than trusting the producer's alpha channel.
    for (let at = 3; at < row.length; at += 4) {
      row[at] = MASK_ALPHA_OPAQUE;
    }
    target.data.set(row, (rect.top + y) * target.width * 4 + rect.left * 4);
  }
}
