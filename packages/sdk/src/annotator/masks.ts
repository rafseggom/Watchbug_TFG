/**
 * The editor's mask bake (ANN-05 / PRV-04, T2 + T3 + C-2 in one mechanism).
 *
 * A completed mask drag destroys its region NOW — in the working canvas and
 * in the draft's own buffer — and the only pixel data retained afterwards is
 * the POST-mask patch (`MaskPatch`): a rect plus the destroyed bytes. There
 * is no pre-mask snapshot anywhere (C-2 / A-04 / Pitfall 4): `bakeMask` reads
 * only the dragged rect (`getImageData` with four arguments, never the whole
 * frame), mutates that region destructively, writes the identical destroyed
 * pixels into `base`, and hands back exactly those bytes. Undo therefore
 * cannot resurrect a secret — the redraw source already holds flat fill (or
 * block means) in every masked rect.
 *
 * `rebakeMasks()` replays base → strokes → patches in creation order, so
 * masks are the LAST pixel write in every redraw: annotation ink physically
 * cannot sit on top of a mask, in the preview or in the export (T3 — the same
 * order `encodeFinal` locks for the encode). The patch replay is idempotent
 * precisely because `base` already holds the destroyed bytes.
 *
 * Like every file in the lazy lane this module never names the canvas encode
 * API — the `sdk-single-encode-sink` gate counts text, comments included.
 */
import { MASK_PIXELATION_MIN_BLOCK_PX } from '@watchbug/contracts/constants';
import type { BitmapRect } from '../redact/geometry.ts';
import {
  pixelateRegion,
  snapOutward,
  solidFillRegion,
  type MaskPatch,
} from '../redact/masks.ts';
import { drawStroke, LABEL_FONT_PX, resolveFont, type Stroke } from './tools.ts';

/** The two mask styles (P3-D-10): `fill` is the default, `pixelate` opt-in. */
export type MaskMode = 'fill' | 'pixelate';

/**
 * The real cap height of the editor's own label font, measured, not assumed:
 * assign the 15 px label font (with the `resolveFont` read-back, Pitfall 6)
 * and take `actualBoundingBoxAscent` of `'H'` — a hard-coded constant would
 * be an unverified claim about the platform font (research Pattern 3).
 * Uncertainty resolves to the LARGER block (P2-D-09): a platform that
 * reports no cap height falls back to the full label size, which can only
 * make blocks bigger, never smaller.
 */
export function capHeightPx(ctx: CanvasRenderingContext2D): number {
  resolveFont(ctx, LABEL_FONT_PX);
  const ascent = ctx.measureText('H').actualBoundingBoxAscent;
  return Number.isFinite(ascent) && ascent > 0 ? ascent : LABEL_FONT_PX;
}

/**
 * The R-13 block floor: at least `MASK_PIXELATION_MIN_BLOCK_PX` (8) and at
 * least twice the cap height, so a block swallows at least two glyph rows —
 * fine detail cannot survive inside it.
 */
export function blockSizeFor(capHeight: number): number {
  return Math.max(MASK_PIXELATION_MIN_BLOCK_PX, Math.ceil(2 * capHeight));
}

/**
 * Destroy `rect` in the canvas and in the shared `base` buffer, and return
 * the post-mask patch. The canvas and the base are bitmap-sized by the
 * editor's construction (`canvas.width = base.width`), so one clamp fits
 * both. A rect that leaves no paintable pixels throws — the caller fail-closes
 * and aborts the mask rather than filling an approximate region (never a
 * guessed rectangle, C-2).
 */
export function bakeMask(
  base: ImageData,
  ctx: CanvasRenderingContext2D,
  rect: BitmapRect,
  mode: MaskMode,
  blockPx: number,
): MaskPatch {
  if (
    !Number.isInteger(rect.left) ||
    !Number.isInteger(rect.top) ||
    !Number.isInteger(rect.right) ||
    !Number.isInteger(rect.bottom)
  ) {
    throw new Error('bakeMask: non-integral rect (bitmap space requires whole pixels)');
  }
  const snapped = mode === 'pixelate' ? snapOutward(rect, blockPx) : rect;
  const left = Math.max(0, snapped.left);
  const top = Math.max(0, snapped.top);
  const right = Math.min(base.width, snapped.right);
  const bottom = Math.min(base.height, snapped.bottom);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) {
    throw new Error('bakeMask: empty rect (refusing to guess a mask region)');
  }
  // Rect-restricted read — O(rect), never the whole 16 MP frame (research
  // anti-pattern). What comes back is already the region to destroy; the
  // primitives below only replace pixels inside it.
  const region = ctx.getImageData(left, top, width, height);
  const local: BitmapRect = { left: 0, top: 0, right: width, bottom: height };
  if (mode === 'pixelate') pixelateRegion(region, local, blockPx);
  else solidFillRegion(region, local);
  // Destroy NOW (T2): the canvas loses the region immediately…
  ctx.putImageData(region, left, top);
  // …and so does the draft's own buffer — the redraw source, the flattened
  // draft and `options.base` are this one instance (C-2/A-04), which is why
  // no pre-mask copy exists anywhere and undo cannot resurrect it.
  for (let y = 0; y < height; y += 1) {
    const from = y * width * 4;
    base.data.set(
      region.data.subarray(from, from + width * 4),
      (top + y) * base.width * 4 + left * 4,
    );
  }
  return { rect: { left, top, right: left + width, bottom: top + height }, pixels: region };
}

/**
 * Repaint the working bitmap: base, then the committed vector strokes, then
 * every mask patch in creation order ON TOP (T3 — masks are the last pixel
 * write before the next flatten or the encode). Called after every stroke
 * commit, every preview redraw and at Done, not only at export. Idempotent:
 * `base` already holds the destroyed bytes, so replaying the patches changes
 * nothing unless a stroke tried to overdraw one.
 */
export function rebakeMasks(
  ctx: CanvasRenderingContext2D,
  base: ImageData,
  strokes: readonly Stroke[],
  masks: readonly MaskPatch[],
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(base, 0, 0);
  for (const stroke of strokes) drawStroke(ctx, stroke);
  for (const patch of masks) {
    ctx.putImageData(patch.pixels, patch.rect.left, patch.rect.top);
  }
}
