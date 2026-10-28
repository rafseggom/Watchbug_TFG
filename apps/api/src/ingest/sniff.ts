import type { ImageExt } from '@watchbug/contracts/types';

/**
 * Stage 2: **magic bytes only** — never the client-declared `Content-Type`
 * (Pattern 2a, C-3).
 *
 * PNG, WebP and JPEG are the accepted containers (P3-D-14 widens P1-D-11);
 * SVG is an active text format that sniffer-based allowlists misclassify, so
 * it is rejected unconditionally along with GIF/HTML/anything else.
 *
 * The JPEG signature is the 3-byte SOI-plus-marker prefix `FF D8 FF`, NOT a
 * 4-byte JFIF form: Exif files start `FF D8 FF E1` and libjpeg/libvips output
 * (including sharp's own re-encode on this host) starts `FF D8 FF DB`, so a
 * signature keyed on `FF D8 FF E0` would reject the server's own stored bytes
 * (research F1).
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
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  return null;
}
