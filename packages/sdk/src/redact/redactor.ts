/**
 * `Redactor` (SEC-01/SEC-02, R-13, A-01, P2-D-08/09) — the destructive half
 * of the privacy contract.
 *
 * Three detection routes, one primitive:
 *
 *  - **structural elements** — `input[type="password"]` (secret by
 *    declaration) and `[data-watchbug-sensitive]` (the integrator's opt-in):
 *    masked at the full element rect;
 *  - **form-control values** — the P2-D-07 catalog matched against
 *    `input`/`textarea` values: masked at the full element rect;
 *  - **text nodes** — the P2-D-07 catalog matched over text nodes with a
 *    `TreeWalker`, each match masking the rect of the **whole containing text
 *    node** (`range.getClientRects()` unioned — never just the matched
 *    substring: P2-D-08 granularity, over-masking is the safe direction).
 *
 * Every rect goes through `geometry.ts` `toBitmapRect()` (outward rounding)
 * and is painted **into the `ImageData`** with a flat opaque fill (alpha 255)
 * before any encode exists. There is no CSS overlay, no blur, no
 * semi-transparent wash: a pixel is either replaced or it is not (R-13).
 *
 * Fail closed (T-02-10): no step here swallows an error. A scan or geometry
 * failure propagates to `pipeline.ts`, which short-circuits the flow into a
 * loud terminal state before encode/send — falling open to unredacted bytes
 * is the one failure mode the core value forbids.
 *
 * Uncertainty resolves to the larger rect (P2-D-09): a multi-line inline
 * element is masked as its bounding box, and `geometry.ts` rounds outward.
 */
import { MASK_ALPHA_OPAQUE } from '@watchbug/contracts/constants';
import { INPUT_VALUE_FAMILIES, TEXT_FAMILIES, type PatternFamily } from './patterns.ts';
import { toBitmapRect, transformFor, type RectLike } from './geometry.ts';

/** The SEC-01 selector set. One scan, both structural families. */
export const SENSITIVE_SELECTOR = 'input[type="password"], [data-watchbug-sensitive]';

/** Form controls whose *value* is scanned against the input-value families. */
export const VALUE_SCAN_SELECTOR = 'input, textarea';

/** Parents whose text never renders (no rects) and never reaches the pixels. */
const UNRENDERED_PARENTS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/** The fill colour. Flat, opaque, and the only masking primitive (R-13). */
const MASK_RGB = { r: 0, g: 0, b: 0 } as const;

/** The R-02 port: destructive, in place, nothing encoded in or out. */
export interface Redactor {
  /** Mutate `image` in place; returns how many rects were painted. */
  redact(image: ImageData): number;
}

/** Skip zero-area rects (invisible elements, collapsed ranges). */
function pushRect(into: RectLike[], rect: { left: number; top: number; right: number; bottom: number }): void {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  if (width <= 0 || height <= 0) return;
  into.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
}

/**
 * One family's matches over `text`: the first candidate that passes the
 * family's `validate` counts (a Luhn-invalid digit run must not mask, but a
 * valid run later in the same node must).
 */
function textMatchesFamily(text: string, family: PatternFamily): boolean {
  const { regex } = family;
  regex.lastIndex = 0;
  for (;;) {
    const match = regex.exec(text);
    if (match === null) return false;
    if (family.validate === undefined || family.validate(match[0])) return true;
    if (match[0].length === 0) regex.lastIndex = match.index + 1;
  }
}

/**
 * Viewport-relative rects for everything that must be destroyed. One rect per
 * matched element or text node — collected at redact time, not at mount time,
 * so the page is scanned as the user saw it when they clicked.
 */
export function collectMaskRects(doc: Document): RectLike[] {
  const rects: RectLike[] = [];

  // Structural SEC-01 families: the whole element rect.
  for (const element of doc.querySelectorAll(SENSITIVE_SELECTOR)) {
    pushRect(rects, element.getBoundingClientRect());
  }

  // Credential patterns in form-control values: the whole element rect.
  if (INPUT_VALUE_FAMILIES.length > 0) {
    for (const element of doc.querySelectorAll(VALUE_SCAN_SELECTOR)) {
      const value = (element as HTMLInputElement | HTMLTextAreaElement).value;
      if (value.length === 0) continue;
      const matched = INPUT_VALUE_FAMILIES.some((family) => textMatchesFamily(value, family));
      if (matched) pushRect(rects, element.getBoundingClientRect());
    }
  }

  // Credential patterns in text nodes: ONE union rect per matched text node
  // (P2-D-08 — the whole node, never the matched substring). This walk is the
  // fail-closed seam: any error it raises propagates to the pipeline.
  if (TEXT_FAMILIES.length > 0) {
    const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node as Text;
      const parent = text.parentElement;
      if (parent !== null && UNRENDERED_PARENTS.has(parent.tagName)) continue;
      const data = text.data;
      if (data.length === 0) continue;
      const matched = TEXT_FAMILIES.some((family) => textMatchesFamily(data, family));
      if (!matched) continue;

      const range = doc.createRange();
      range.selectNodeContents(text);
      let left = Number.POSITIVE_INFINITY;
      let top = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      for (const box of Array.from(range.getClientRects())) {
        if (box.right <= box.left || box.bottom <= box.top) continue;
        left = Math.min(left, box.left);
        top = Math.min(top, box.top);
        right = Math.max(right, box.right);
        bottom = Math.max(bottom, box.bottom);
      }
      if (right <= left || bottom <= top) continue;
      rects.push({ left, top, right, bottom });
    }
  }

  return rects;
}

/** Paint each rect into the bitmap. Pure, synchronous, destructive. */
export function fillRects(
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
      return fillRects(image, collectMaskRects(doc), {
        width: view.innerWidth,
        height: view.innerHeight,
      });
    },
  };
}
