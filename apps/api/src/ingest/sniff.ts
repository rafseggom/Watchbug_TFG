import type { ImageExt } from '@watchbug/contracts/types';

/**
 * Stage 2: **magic bytes only** — never the client-declared `Content-Type`
 * (Pattern 2a, C-3).
 *
 * PNG and WebP are the only accepted containers (P1-D-11); SVG is an active
 * text format that sniffer-based allowlists misclassify, so it is rejected
 * unconditionally along with GIF/HTML/JPEG/anything else.
 */

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function sniffImage(bytes: Uint8Array): ImageExt | null {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (
    buf.length >= 12 &&
    buf.toString('latin1', 0, 4) === 'RIFF' &&
    buf.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}
