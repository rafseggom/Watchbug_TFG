/**
 * `Redactor` (SEC-01/SEC-02, R-13, A-01, P2-D-08) — the destructive half of the
 * privacy contract.
 *
 * The T1 families required from the first commit are the two the DOM can name
 * structurally, with no text heuristics:
 *
 *  - `input[type="password"]` — the value is secret by declaration;
 *  - `[data-watchbug-sensitive]` — the integrator's explicit opt-in.
 *
 * Each matched rect is painted **into the `ImageData`** with a flat opaque fill
 * (alpha 255) before any encode exists. There is no CSS overlay, no blur, no
 * semi-transparent wash: a pixel is either replaced or it is not (R-13). The
 * pattern families that live in text (`redact/patterns.ts`) and the text-node
 * scan land in 02-04, on top of this exact primitive.
 *
 * Over-masking is the accepted direction of error (P2-D-08): a multi-line
 * inline element is masked as its bounding box, and `geometry.ts` rounds the
 * rect outward.
 */
import { MASK_ALPHA_OPAQUE } from '@watchbug/contracts/constants';
import { toBitmapRect, transformFor, type RectLike } from './geometry.ts';

/** The SEC-01 selector set. One scan, both families. */
export const SENSITIVE_SELECTOR = 'input[type="password"], [data-watchbug-sensitive]';

/** The fill colour. Flat, opaque, and the only masking primitive (R-13). */
const MASK_RGB = { r: 0, g: 0, b: 0 } as const;

/** The R-02 port: destructive, in place, nothing encoded in or out. */
export interface Redactor {
  /** Mutate `image` in place; returns how many rects were painted. */
  redact(image: ImageData): number;
}

/** Viewport-relative rects for every currently matching element. */
export function collectSensitiveRects(doc: Document): RectLike[] {
  const rects: RectLike[] = [];
  for (const element of doc.querySelectorAll(SENSITIVE_SELECTOR)) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    rects.push({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    });
  }
  return rects;
}

/** Paint each rect into the bitmap. Pure, synchronous, destructive. */
export function maskRects(
  image: ImageData,
  rects: readonly RectLike[],
  viewport: { width: number; height: number },
): number {
  if (rects.length === 0) return 0;
  const transform = transformFor(image.width, image.height, viewport.width, viewport.height);
  const { data, width, height } = image;
  let masked = 0;

  for (const rect of rects) {
    const target = toBitmapRect(rect, transform, width, height);
    if (target === null) continue;
    masked += 1;
    for (let y = target.top; y < target.bottom; y += 1) {
      let index = (y * width + target.left) * 4;
      for (let x = target.left; x < target.right; x += 1) {
        data[index] = MASK_RGB.r;
        data[index + 1] = MASK_RGB.g;
        data[index + 2] = MASK_RGB.b;
        data[index + 3] = MASK_ALPHA_OPAQUE;
        index += 4;
      }
    }
  }

  return masked;
}

/**
 * The DOM-backed redactor. Rect collection happens at redact time — not at
 * mount time — so it sees the page as the user saw it when they clicked.
 */
export function createDomRedactor(doc: Document, view: Window): Redactor {
  return {
    redact(image: ImageData): number {
      return maskRects(image, collectSensitiveRects(doc), {
        width: view.innerWidth,
        height: view.innerHeight,
      });
    },
  };
}
