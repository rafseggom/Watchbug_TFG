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
import { toBitmapRect, transformFor, type BitmapRect, type RectLike } from './geometry.ts';
import { MASK_RGB, type MaskRgb } from './masks.ts';

/**
 * The fill colour lives in the leaf `./masks.ts` so the lazy mask lane can
 * reach it without importing this module (and with it, `patterns.ts`).
 * Re-exported here because every T1 call site's path predates the split (R-18:
 * one definition, re-exported — never a second copy).
 */
export { MASK_RGB } from './masks.ts';

/** The SEC-01 selector set. One scan, both structural families. */
export const SENSITIVE_SELECTOR = 'input[type="password"], [data-watchbug-sensitive]';

/** Form controls whose *value* is scanned against the input-value families. */
export const VALUE_SCAN_SELECTOR = 'input, textarea';

/** Parents whose text never renders (no rects) and never reaches the pixels. */
const UNRENDERED_PARENTS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/** A CSS transform matrix that is a pure translation (see `isUntransformedPath`). */
const PURE_TRANSLATE = /^matrix\(\s*1\s*,\s*0\s*,\s*0\s*,\s*1\s*,/;

/**
 * The R-02 port: destructive, in place, nothing encoded in or out.
 *
 * `collect()` and `redact()` are separate so the rects can be measured at the
 * instant the pixels are read (WR-01) rather than after the frame exists.
 */
export interface Redactor {
  /**
   * Measure the rects to destroy. The pipeline calls this inside the capture
   * adapter's `beforeRead()` hook, so a layout shift between "frame drawn" and
   * "rects walked" cannot move a secret out from under its mask (WR-01).
   */
  collect(): RectLike[];
  /**
   * Mutate `image` in place; returns how many rects were painted. Pass the set
   * `collect()` returned. Omitting it re-measures now -- the degraded path for
   * a `CaptureSource` that never calls `beforeRead`, never a weaker one.
   */
  redact(image: ImageData, rects?: readonly RectLike[]): number;
}

/**
 * S-7 / CR-03: how deep the scan descends across nested roots. It bounds
 * shadow-root and same-origin frame *nesting*, never DOM height -- a plain
 * document is depth 0 and its whole tree is always walked.
 */
export const MAX_SCAN_DEPTH = 8;

/**
 * A root the scanner can reach, plus the translation from that root's client
 * coordinates to the top document's viewport coordinates.
 *
 * A shadow root shares its host document's coordinate space (`dx`/`dy` stay
 * whatever the host document's were). A same-origin frame document does not:
 * its `getBoundingClientRect()` values are relative to the frame's own
 * viewport, so the frame's content-box origin is added.
 */
interface ScanRoot {
  root: Document | ShadowRoot;
  dx: number;
  dy: number;
}

/** Skip zero-area rects (invisible elements, collapsed ranges). */
function pushRect(
  into: RectLike[],
  rect: { left: number; top: number; right: number; bottom: number },
  dx = 0,
  dy = 0,
): void {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  if (width <= 0 || height <= 0) return;
  into.push({ left: rect.left + dx, top: rect.top + dy, right: rect.right + dx, bottom: rect.bottom + dy });
}

/**
 * True when `element` and every ancestor up to the document is free of CSS
 * transforms and renders at its own layout size.
 *
 * A rotation, skew, scale or zoom makes the frame's client-to-viewport map a
 * non-translation, and a mask computed against the wrong map lands on the
 * wrong pixels -- the silent fall-open SEC-01 forbids. Rather than guess, the
 * caller REFUSES such a frame, the same way `capture-source.ts` refuses a
 * window/screen capture whose DOM-to-bitmap registration cannot be verified
 * (OQ-1 / T-02-05). A pure translation is fine: `getBoundingClientRect()` is
 * exact for it (FX-02).
 */
function isUntransformedPath(element: HTMLElement): boolean {
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    const matrix = getComputedStyle(node).transform;
    // `matrix(1, 0, 0, 1, e, f)` is a pure translation. Anything else --
    // `matrix3d`, a rotation, a scale, a skew -- is refused.
    if (matrix !== 'none' && !PURE_TRANSLATE.test(matrix)) return false;
  }
  const box = element.getBoundingClientRect();
  return (
    Math.abs(box.width - element.offsetWidth) <= 0.5 &&
    Math.abs(box.height - element.offsetHeight) <= 0.5
  );
}

/**
 * Every scanning root reachable from `doc` (S-7): the document's own light DOM,
 * every **open** shadow root, and every same-origin frame document.
 *
 * Closed shadow roots are unreachable by construction, and a cross-origin
 * frame exposes neither `shadowRoot` content nor `contentDocument` -- both are
 * documented integration limits (T-02-14 / AR-01), not scanner choices.
 *
 * Nothing here is swallowed. A traversal error, a transformed frame (FX-02) and
 * a nesting overflow (FX-06) all THROW, and the pipeline turns that into a
 * loud no-send before encode (T-02-10). What must never happen is a subtree
 * being quietly skipped: that is exactly the hole S-7 closed.
 */
export function collectScanRoots(doc: Document, maxDepth = MAX_SCAN_DEPTH): ScanRoot[] {
  const roots: ScanRoot[] = [];

  const visit = (root: Document | ShadowRoot, dx: number, dy: number, depth: number): void => {
    if (depth > maxDepth) {
      // Not a silent skip (FX-06). `MAX_SCAN_DEPTH` bounds ROOT NESTING, never
      // DOM height -- eight nested shadow roots or frames is not a real page --
      // but if it is ever reached the safe answer is no-send, not a partial
      // scan whose unvisited subtree ships unmasked.
      throw new Error(`redaction scan exceeded the nesting bound of ${MAX_SCAN_DEPTH} roots`);
    }
    roots.push({ root, dx, dy });

    for (const element of Array.from(root.querySelectorAll('*'))) {
      // `shadowRoot` is null for a closed root: that subtree is unreachable.
      const shadow = element.shadowRoot;
      if (shadow !== null) visit(shadow, dx, dy, depth + 1);
    }

    for (const frame of Array.from(root.querySelectorAll('iframe, frame'))) {
      // `contentDocument` is null for a cross-origin frame (T-02-14 / AR-01).
      const inner = (frame as HTMLIFrameElement).contentDocument;
      if (inner === null) continue;
      const frameElement = frame as HTMLElement;
      if (!isUntransformedPath(frameElement)) {
        throw new Error(
          'a same-origin frame is scaled or transformed: its client rects cannot be mapped to the captured pixels (refusing to mask the wrong region)',
        );
      }
      const box = frameElement.getBoundingClientRect();
      visit(inner, dx + box.left + frameElement.clientLeft, dy + box.top + frameElement.clientTop, depth + 1);
    }
  };

  visit(doc, 0, 0, 0);
  return roots;
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
 * Viewport-relative rects for everything that must be destroyed -- one rect per
 * matched element or text node (P2-D-08: a text node is masked as a whole, and
 * uncertainty resolves to the larger rect).
 *
 * S-7 / CR-03: the scan visits **every** root reachable from `doc` -- light
 * DOM, open shadow roots and same-origin frame documents -- bounded by
 * `maxDepth`. What it cannot reach (closed shadow roots, cross-origin frames)
 * is a documented integration limit, never a silent skip.
 */
export function collectMaskRects(doc: Document, maxDepth = MAX_SCAN_DEPTH): RectLike[] {
  const rects: RectLike[] = [];
  for (const { root, dx, dy } of collectScanRoots(doc, maxDepth)) {
    collectStructuralRects(root, dx, dy, rects);
    collectValueRects(root, dx, dy, rects);
    collectTextRects(root, dx, dy, rects);
  }
  return rects;
}

/** Structural SEC-01 families: the whole element rect. */
function collectStructuralRects(
  root: Document | ShadowRoot,
  dx: number,
  dy: number,
  into: RectLike[],
): void {
  for (const element of root.querySelectorAll(SENSITIVE_SELECTOR)) {
    pushRect(into, element.getBoundingClientRect(), dx, dy);
  }
}

/** Credential patterns in form-control values: the whole element rect. */
function collectValueRects(root: Document | ShadowRoot, dx: number, dy: number, into: RectLike[]): void {
  if (INPUT_VALUE_FAMILIES.length === 0) return;
  for (const element of root.querySelectorAll(VALUE_SCAN_SELECTOR)) {
    const value = (element as HTMLInputElement | HTMLTextAreaElement).value;
    if (value.length === 0) continue;
    const matched = INPUT_VALUE_FAMILIES.some((family) => textMatchesFamily(value, family));
    if (matched) pushRect(into, element.getBoundingClientRect(), dx, dy);
  }
}

/**
 * The union of a text node's client rects, translated into the top viewport --
 * the node's whole box, never just the matched substring (P2-D-08). `null` when
 * the node renders no box at all: there is nothing to mask and nothing of it in
 * the pixels.
 */
function textNodeRect(owner: Document, text: Text, dx: number, dy: number): RectLike | null {
  const range = owner.createRange();
  range.selectNodeContents(text);
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const box of Array.from(range.getClientRects())) {
    if (box.right <= box.left || box.bottom <= box.top) continue;
    left = Math.min(left, box.left + dx);
    top = Math.min(top, box.top + dy);
    right = Math.max(right, box.right + dx);
    bottom = Math.max(bottom, box.bottom + dy);
  }
  return right <= left || bottom <= top ? null : { left, top, right, bottom };
}

/**
 * Credential patterns in text nodes: ONE union rect per matched text node
 * (P2-D-08 -- the whole node, never the matched substring). This walk is the
 * fail-closed seam: any error it raises propagates to the pipeline.
 */
function collectTextRects(root: Document | ShadowRoot, dx: number, dy: number, into: RectLike[]): void {
  if (TEXT_FAMILIES.length === 0) return;
  // `createTreeWalker` wants the owning document. `ownerDocument` is null for a
  // Document and set for a ShadowRoot, so this stays realm-correct even for a
  // same-origin frame's document.
  const owner: Document = (root as ShadowRoot).ownerDocument ?? (root as Document);
  const walker = owner.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node as Text;
    const parent = text.parentElement;
    if (parent !== null && UNRENDERED_PARENTS.has(parent.tagName)) continue;
    const data = text.data;
    if (data.length === 0) continue;
    const matched = TEXT_FAMILIES.some((family) => textMatchesFamily(data, family));
    if (!matched) continue;
    const rect = textNodeRect(owner, text, dx, dy);
    if (rect !== null) into.push(rect);
  }
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
 * Paint already-bitmap-space rects into `image` — the viewport-free sibling of
 * `fillRects` for `encodeFinal()`'s T1 re-run. The rects come off the draft
 * exactly as measured at the pixel-read instant (WR-01 / H-1), so nothing here
 * is ever re-derived from the live viewport at export time.
 *
 * Both passes are flat opaque writes (R-13), which makes the re-run idempotent
 * over the already-redacted draft. FAIL CLOSED (S-3): a non-finite rect
 * throws — a silently skipped re-fill is the fall-open this path forbids.
 */
export function fillBitmapRects(
  image: ImageData,
  rects: readonly BitmapRect[],
  rgb: MaskRgb,
  alpha: number,
): number {
  if (rects.length === 0) return 0;
  const { data, width, height } = image;
  let painted = 0;

  for (const rect of rects) {
    if (
      !Number.isFinite(rect.left) ||
      !Number.isFinite(rect.top) ||
      !Number.isFinite(rect.right) ||
      !Number.isFinite(rect.bottom)
    ) {
      throw new Error('fillBitmapRects: non-finite rect (refusing to guess a mask region)');
    }
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(width, rect.right);
    const bottom = Math.min(height, rect.bottom);
    if (right <= left || bottom <= top) continue;
    painted += 1;
    for (let y = top; y < bottom; y += 1) {
      let index = (y * width + left) * 4;
      for (let x = left; x < right; x += 1) {
        data[index] = rgb.r;
        data[index + 1] = rgb.g;
        data[index + 2] = rgb.b;
        data[index + 3] = alpha;
        index += 4;
      }
    }
  }

  return painted;
}

/**
 * The DOM-backed redactor. `collect()` is separate from `redact()` so the
 * pipeline can measure the rects at the pixel-read instant (WR-01); passing
 * them to `redact()` paints exactly the page the user was shown.
 */
export function createDomRedactor(doc: Document, view: Window): Redactor {
  const viewport = (): { width: number; height: number } => ({
    width: view.innerWidth,
    height: view.innerHeight,
  });
  return {
    collect(): RectLike[] {
      return collectMaskRects(doc);
    },
    redact(image: ImageData, rects?: readonly RectLike[]): number {
      return fillRects(image, rects ?? collectMaskRects(doc), viewport());
    },
  };
}
