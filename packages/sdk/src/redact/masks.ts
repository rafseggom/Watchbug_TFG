/**
 * The mask-patch vocabulary (C-2 / T2 / T3), the destructive pixel primitives
 * both masking lanes share, and the **single** definition of the flat fill
 * colour (R-13 / R-18).
 *
 * This is a LEAF module on purpose: it imports only `BitmapRect` from
 * `./geometry.ts` and `MASK_ALPHA_OPAQUE` from the contracts' Zod-free
 * constants — nothing that reaches `patterns.ts`. The lazy mask lane imports
 * the fill colour and these primitives from here; importing them through
 * `redactor.ts` would drag the whole T1 detection catalogue into the ≤ 25 KB
 * chunk (RNF-01, PRF-02). `redactor.ts` imports and re-exports `MASK_RGB` so
 * every T1 call site keeps its existing path (one definition, not two — R-18).
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
    // Copy-then-normalise (LW-01): `source` is the draft's RETAINED history —
    // replayed by `rebakeMasks` and re-sent on the next round trip — so alpha is
    // forced on a copy, never in place through a `subarray` view of the source.
    // (Today every producer already writes alpha 255, so the old in-place
    // version was a no-op; the moment one does not, it would silently rewrite
    // the draft's mask patches instead of normalising the write.)
    const row = new Uint8ClampedArray(width * 4);
    row.set(source.subarray(from, from + width * 4));
    // The masking contract is flat opaque (alpha 255); normalise it on the way
    // in rather than trusting the producer's alpha channel.
    for (let at = 3; at < row.length; at += 4) {
      row[at] = MASK_ALPHA_OPAQUE;
    }
    target.data.set(row, (rect.top + y) * target.width * 4 + rect.left * 4);
  }
}

/** Validate a rect for the destructive primitives (S-3, mirrors `putPatch`). */
function assertPaintRect(rect: BitmapRect, who: string): void {
  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.right) ||
    !Number.isFinite(rect.bottom)
  ) {
    throw new Error(`${who}: non-finite rect (refusing to guess a mask region)`);
  }
}

/**
 * The ONE automatic masking primitive (R-13 / A-01 / SEC-02): a flat opaque
 * fill of `MASK_RGB` at `MASK_ALPHA_OPAQUE` over `rect` (image-local
 * coordinates) — the exact triple T1 auto-redaction paints, so a user mask
 * reads as the same redaction (UI-SPEC A-6). No CSS overlay, no feathering,
 * no blur: every covered pixel is replaced.
 */
export function solidFillRegion(image: ImageData, rect: BitmapRect): void {
  assertPaintRect(rect, 'solidFillRegion');
  const left = Math.max(0, Math.floor(rect.left));
  const top = Math.max(0, Math.floor(rect.top));
  const right = Math.min(image.width, Math.ceil(rect.right));
  const bottom = Math.min(image.height, Math.ceil(rect.bottom));
  const { data, width } = image;
  for (let y = top; y < bottom; y += 1) {
    let index = (y * width + left) * 4;
    for (let x = left; x < right; x += 1) {
      data[index] = MASK_RGB.r;
      data[index + 1] = MASK_RGB.g;
      data[index + 2] = MASK_RGB.b;
      data[index + 3] = MASK_ALPHA_OPAQUE;
      index += 4;
    }
  }
}

/**
 * Snap `rect` OUTWARD to the pixelation block grid (R-13 / P3-D-10): floor
 * left/top, ceil right/bottom to multiples of `blockPx`. The grid origin is
 * the bitmap's (0, 0), so a snapped rect's blocks always tile from a grid
 * line; clamping to the frame (if needed) happens in the caller, which alone
 * knows the bounds.
 */
export function snapOutward(rect: BitmapRect, blockPx: number): BitmapRect {
  assertPaintRect(rect, 'snapOutward');
  if (!Number.isFinite(blockPx) || blockPx < 1) {
    throw new Error('snapOutward: block size must be a positive finite number');
  }
  return {
    left: Math.floor(rect.left / blockPx) * blockPx,
    top: Math.floor(rect.top / blockPx) * blockPx,
    right: Math.ceil(rect.right / blockPx) * blockPx,
    bottom: Math.ceil(rect.bottom / blockPx) * blockPx,
  };
}

/**
 * The opt-in pixelation primitive (R-13 / P3-D-10): replace every `blockPx`
 * block of `rect` (image-local, blocks tiled from `rect`'s top-left — the
 * caller grid-snaps first, so those coordinates sit on grid lines) with the
 * block's mean colour at alpha 255. Block-average is a one-way many-to-one
 * map: no invertible transform reconstructs it, which is why blur is banned
 * and this is not. A partial edge block averages only its own pixels.
 */
export function pixelateRegion(image: ImageData, rect: BitmapRect, blockPx: number): void {
  assertPaintRect(rect, 'pixelateRegion');
  if (!Number.isFinite(blockPx) || blockPx < 1) {
    throw new Error('pixelateRegion: block size must be a positive finite number');
  }
  const left = Math.max(0, Math.floor(rect.left));
  const top = Math.max(0, Math.floor(rect.top));
  const right = Math.min(image.width, Math.ceil(rect.right));
  const bottom = Math.min(image.height, Math.ceil(rect.bottom));
  const { data, width } = image;
  for (let by = top; by < bottom; by += blockPx) {
    const blockBottom = Math.min(bottom, by + blockPx);
    for (let bx = left; bx < right; bx += blockPx) {
      const blockRight = Math.min(right, bx + blockPx);
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;
      for (let y = by; y < blockBottom; y += 1) {
        for (let x = bx; x < blockRight; x += 1) {
          const at = (y * width + x) * 4;
          sumR += data[at];
          sumG += data[at + 1];
          sumB += data[at + 2];
          count += 1;
        }
      }
      // Rounded means; alpha forced opaque (R-13 / A-01). Integer division of
      // the fixed-point sum keeps every pixel of a block byte-identical.
      const meanR = Math.round(sumR / count);
      const meanG = Math.round(sumG / count);
      const meanB = Math.round(sumB / count);
      for (let y = by; y < blockBottom; y += 1) {
        for (let x = bx; x < blockRight; x += 1) {
          const at = (y * width + x) * 4;
          data[at] = meanR;
          data[at + 1] = meanG;
          data[at + 2] = meanB;
          data[at + 3] = MASK_ALPHA_OPAQUE;
        }
      }
    }
  }
}
