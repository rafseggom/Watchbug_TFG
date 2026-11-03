import { describe, expect, it } from 'vitest';
import { MASK_ALPHA_OPAQUE, MASK_PIXELATION_MIN_BLOCK_PX } from '@watchbug/contracts/constants';
import { blockSizeFor } from '@watchbug/sdk/annotator/masks.ts';
import {
  MASK_RGB,
  snapOutward,
  pixelateRegion,
  solidFillRegion,
} from '@watchbug/sdk/redact/masks.ts';
import type { BitmapRect } from '@watchbug/sdk/redact/geometry.ts';

/**
 * Unit lane for the mask **arithmetic** — the pure half of the J-05 rows
 * (03-08 Batch 3c).
 *
 * Three separate claims live in these functions and none of them needs a
 * canvas or a browser:
 *
 *  - `blockSizeFor` — the R-13 block floor (`max(8, 2× cap height)`),
 *  - `snapOutward` — the grid snap that keeps a pixelated mask on grid lines,
 *  - `pixelateRegion` / `solidFillRegion` — the two destructive primitives,
 *    which are raw `Uint8ClampedArray` maths over an `ImageData`-shaped
 *    buffer.
 *
 * The e2e rows keep the part only a browser can prove: that the *delivered*
 * image lost those pixels (decoded bytes, mask rect and its 1-px ring). This
 * file pins the decision that produced them, so a wrong block size or an
 * un-snapped rect fails in milliseconds instead of as a pixel diff.
 */

/**
 * An `ImageData` stand-in. The primitives read only `width`, `height` and
 * `data`; Node has no `ImageData`, and constructing a canvas to get one would
 * put the assertion back in the browser. The cast is the only concession.
 */
function makeImage(
  width: number,
  height: number,
  pixel: (x: number, y: number) => readonly [number, number, number, number],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      const at = (y * width + x) * 4;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
      data[at + 3] = a;
    }
  }
  return { width, height, data, colorSpace: 'srgb' } as unknown as ImageData;
}

/** The RGBA of one pixel, as a tuple. */
function px(image: ImageData, x: number, y: number): [number, number, number, number] {
  const at = (y * image.width + x) * 4;
  return [image.data[at], image.data[at + 1], image.data[at + 2], image.data[at + 3]];
}

describe('unit: R-13 mask block size', () => {
  it('never goes below the 8 px floor', () => {
    expect(MASK_PIXELATION_MIN_BLOCK_PX).toBe(8);
    expect(blockSizeFor(0)).toBe(8);
    expect(blockSizeFor(4)).toBe(8); // exactly 2 × 4 — still the floor
    expect(blockSizeFor(3.5)).toBe(8); // 2 × 3.5 = 7 → ceil 7 → floor wins
    // Uncertainty resolves upward at the CALL SITE, which is where the guard
    // belongs: `capHeightPx` returns `LABEL_FONT_PX` when the platform reports
    // no usable ascent, so a non-finite read-back can never reach this
    // function (this one is pure arithmetic and propagates NaN on purpose).
    expect(blockSizeFor(Number.NaN)).toBeNaN();
  });

  it('swallows at least two glyph rows above the floor', () => {
    expect(blockSizeFor(5)).toBe(10);
    expect(blockSizeFor(4.1)).toBe(9); // ceil(8.2) — never truncates the 2× rule
    expect(blockSizeFor(15)).toBe(30); // the label font's own size, if used as cap height
  });

  it('is monotonic in cap height', () => {
    let previous = 0;
    for (const capHeight of [0, 1, 3.9, 4, 4.01, 8, 12, 40]) {
      const block = blockSizeFor(capHeight);
      expect(block).toBeGreaterThanOrEqual(previous);
      previous = block;
    }
  });
});

describe('unit: snapOutward grid snap', () => {
  const BLOCK = 8;

  it('leaves a rect already on the grid untouched', () => {
    const onGrid: BitmapRect = { left: 8, top: 16, right: 24, bottom: 32 };
    expect(snapOutward(onGrid, BLOCK)).toEqual(onGrid);
  });

  it('floors left/top and ceils right/bottom — never inward', () => {
    const snapped = snapOutward({ left: 9, top: 17, right: 23, bottom: 31 }, BLOCK);
    expect(snapped).toEqual({ left: 8, top: 16, right: 24, bottom: 32 });
    // The property that matters: the snap may only grow the destroyed area.
    expect(snapped.left).toBeLessThanOrEqual(9);
    expect(snapped.top).toBeLessThanOrEqual(17);
    expect(snapped.right).toBeGreaterThanOrEqual(23);
    expect(snapped.bottom).toBeGreaterThanOrEqual(31);
  });

  it('tiles from the bitmap origin, not from the rect', () => {
    // A 1-px rect at the origin snaps to exactly one full block at (0,0).
    expect(snapOutward({ left: 0, top: 0, right: 1, bottom: 1 }, BLOCK)).toEqual({
      left: 0,
      top: 0,
      right: 8,
      bottom: 8,
    });
    // A rect one pixel past a grid line lands on the SAME block face.
    expect(snapOutward({ left: 1, top: 1, right: 2, bottom: 2 }, BLOCK)).toEqual({
      left: 0,
      top: 0,
      right: 8,
      bottom: 8,
    });
  });

  it('refuses a block size that cannot tile', () => {
    const rect: BitmapRect = { left: 1, top: 1, right: 2, bottom: 2 };
    expect(() => snapOutward(rect, 0)).toThrow(/positive finite/);
    expect(() => snapOutward(rect, -8)).toThrow(/positive finite/);
    expect(() => snapOutward(rect, Number.POSITIVE_INFINITY)).toThrow(/positive finite/);
  });

  it('fails closed on a non-finite rect rather than guessing a region', () => {
    expect(() =>
      snapOutward({ left: Number.NaN, top: 0, right: 4, bottom: 4 }, BLOCK),
    ).toThrow(/non-finite/);
  });
});

describe('unit: pixelateRegion block average', () => {
  it('replaces every pixel of a block with that block\u2019s rounded mean, opaque', () => {
    // Each 2×2 block carries four distinct reds, so a rounded mean is the only
    // value that can cover them; alpha starts at 0 everywhere to prove the
    // primitive forces it to MASK_ALPHA_OPAQUE on write.
    const reds = [10, 20, 30, 41];
    const image = makeImage(2, 2, (x, y) => [reds[y * 2 + x], 0, 0, 0]);
    const expected = Math.round(reds.reduce((sum, value) => sum + value, 0) / reds.length);

    pixelateRegion(image, { left: 0, top: 0, right: 2, bottom: 2 }, 2);

    expect(expected).toBe(25); // 101 / 4 = 25.25 → 25, NOT truncated to 25 by luck of ¼
    expect(px(image, 0, 0)).toEqual([25, 0, 0, MASK_ALPHA_OPAQUE]);
    expect(px(image, 1, 0)).toEqual([25, 0, 0, MASK_ALPHA_OPAQUE]);
    expect(px(image, 0, 1)).toEqual([25, 0, 0, MASK_ALPHA_OPAQUE]);
    expect(px(image, 1, 1)).toEqual([25, 0, 0, MASK_ALPHA_OPAQUE]);
  });

  it('averages a partial edge block over its own pixels only', () => {
    // 10×10 with block 8: the bottom-right block is 2×2. One bright pixel in
    // it must average over 4 pixels, not over a full 8×8 block (which would
    // let four times as much of the original colour survive).
    const image = makeImage(10, 10, (x, y) => (x === 9 && y === 9 ? [255, 255, 255, 255] : [0, 0, 0, 255]));

    pixelateRegion(image, { left: 0, top: 0, right: 10, bottom: 10 }, 8);

    expect(px(image, 9, 9)).toEqual([64, 64, 64, MASK_ALPHA_OPAQUE]); // round(255 / 4)
    expect(px(image, 8, 8)).toEqual([64, 64, 64, MASK_ALPHA_OPAQUE]);
    // An interior block that held no bright pixel stays fully black.
    expect(px(image, 7, 7)).toEqual([0, 0, 0, MASK_ALPHA_OPAQUE]);
  });

  it('never writes outside its rect', () => {
    // Two columns of differing reds inside the rect, uniform columns outside.
    const image = makeImage(4, 4, (x) => (x < 2 ? [x * 10, 0, 0, 255] : [77, 77, 77, 255]));

    pixelateRegion(image, { left: 0, top: 0, right: 2, bottom: 4 }, 8);

    // The covered block's mean lands inside it — round((0 + 10) / 2) = 5.
    expect(px(image, 0, 0)).toEqual([5, 0, 0, MASK_ALPHA_OPAQUE]);
    expect(px(image, 1, 3)).toEqual([5, 0, 0, MASK_ALPHA_OPAQUE]);
    // …and the columns the rect never covered keep their originals.
    expect(px(image, 2, 0)).toEqual([77, 77, 77, 255]);
    expect(px(image, 3, 3)).toEqual([77, 77, 77, 255]);
  });

  it('clamps a rect that overruns the bitmap instead of reading past it', () => {
    const image = makeImage(3, 3, () => [9, 9, 9, 255]);
    expect(() =>
      pixelateRegion(image, { left: 0, top: 0, right: 99, bottom: 99 }, 2),
    ).not.toThrow();
    expect(px(image, 2, 2)).toEqual([9, 9, 9, MASK_ALPHA_OPAQUE]); // one uniform block: mean is itself
  });

  it('refuses a non-tiling block size', () => {
    const image = makeImage(2, 2, () => [1, 2, 3, 255]);
    expect(() => pixelateRegion(image, { left: 0, top: 0, right: 2, bottom: 2 }, 0)).toThrow(
      /positive finite/,
    );
  });
});

describe('unit: solidFillRegion flat opaque fill', () => {
  it('paints MASK_RGB at alpha 255 over the floored/ceiled rect', () => {
    const image = makeImage(4, 4, () => [200, 100, 50, 0]);
    // Fractional edges: floor(0.4)=0, ceil(1.6)=2 → the four pixels of (0,0)..(1,1).
    solidFillRegion(image, { left: 0.4, top: 0.4, right: 1.6, bottom: 1.6 });

    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      expect(px(image, x, y)).toEqual([MASK_RGB.r, MASK_RGB.g, MASK_RGB.b, MASK_ALPHA_OPAQUE]);
    }
    // Flat and opaque means black: the one primitive R-13 allows automatically.
    expect([MASK_RGB.r, MASK_RGB.g, MASK_RGB.b]).toEqual([0, 0, 0]);
    expect(MASK_ALPHA_OPAQUE).toBe(255);
  });

  it('leaves every pixel outside the rect untouched', () => {
    const image = makeImage(4, 4, () => [200, 100, 50, 255]);
    solidFillRegion(image, { left: 0, top: 0, right: 2, bottom: 2 });
    expect(px(image, 3, 3)).toEqual([200, 100, 50, 255]);
    expect(px(image, 2, 0)).toEqual([200, 100, 50, 255]);
  });

  it('fails closed on a non-finite rect', () => {
    const image = makeImage(2, 2, () => [1, 1, 1, 255]);
    expect(() =>
      solidFillRegion(image, { left: 0, top: 0, right: Number.POSITIVE_INFINITY, bottom: 2 }),
    ).toThrow(/non-finite/);
  });
});
