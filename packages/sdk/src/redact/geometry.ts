/**
 * CSS-pixel → bitmap-pixel registration for every mask source (H-1, P2-D-08).
 *
 * The transform is derived from the *actual* captured frame (`ImageData`
 * width/height) against the live viewport, so a devicePixelRatio change, a
 * downscaled capture or a zoomed page all stay consistent without a second
 * source of truth.
 *
 * Rounding is deliberately **outward** — floor the origin, ceil the extent.
 * A rounding error that closes the rect by one pixel leaks the edge of a
 * character; over-masking by one pixel is invisible and explicitly safe
 * (P2-D-08). This is the only rounding rule in the redaction path.
 */

/** A viewport-relative rectangle in CSS pixels (a `DOMRect` satisfies it). */
export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A rectangle in bitmap pixels, half-open (`right`/`bottom` exclusive). */
export interface BitmapRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface BitmapTransform {
  scaleX: number;
  scaleY: number;
}

/** True only when every edge of `rect` is a real, finite number. */
function allFinite(rect: RectLike): boolean {
  return (
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.right) &&
    Number.isFinite(rect.bottom)
  );
}

/** Map a CSS-pixel rect into bitmap space, outward-rounded and clamped.
 *
 * FAIL CLOSED (T-02-10): a non-finite input THROWS. With `NaN`, `right <= left`
 * is `false`, so the degenerate guard below would not fire and the rect would be
 * handed back unpaintable -- the mask silently not landing is exactly the
 * fall-open this module exists to prevent. Every source is a DOM rect today
 * (always finite); this keeps the boundary honest if a future one is not
 * (V-1 #8).
 */
export function toBitmapRect(
  rect: RectLike,
  transform: BitmapTransform,
  width: number,
  height: number,
): BitmapRect | null {
  if (!allFinite(rect)) {
    throw new Error('toBitmapRect: non-finite rect (refusing to guess a mask region)');
  }
  const left = Math.max(0, Math.floor(rect.left * transform.scaleX));
  const top = Math.max(0, Math.floor(rect.top * transform.scaleY));
  const right = Math.min(width, Math.ceil(rect.right * transform.scaleX));
  const bottom = Math.min(height, Math.ceil(rect.bottom * transform.scaleY));
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom };
}

/** Frame-vs-viewport scale, per axis (a capture may be letterboxed by the OS). */
export function transformFor(
  frameWidth: number,
  frameHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): BitmapTransform {
  return {
    scaleX: viewportWidth > 0 ? frameWidth / viewportWidth : 1,
    scaleY: viewportHeight > 0 ? frameHeight / viewportHeight : 1,
  };
}
