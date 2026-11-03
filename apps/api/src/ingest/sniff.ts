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

/**
 * The signature table, in match order. Each entry says how many leading bytes
 * it needs and a predicate over that slice — adding a container is one row,
 * never another `if` on a growing boolean chain.
 */
const SIGNATURES: ReadonlyArray<{
  ext: ImageExt;
  length: number;
  matches: (buf: Buffer) => boolean;
}> = [
  { ext: 'png', length: 8, matches: (buf) => buf.subarray(0, 8).equals(PNG_SIGNATURE) },
  {
    ext: 'webp',
    length: 12,
    matches: (buf) => buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP',
  },
  {
    ext: 'jpeg',
    length: 3,
    matches: (buf) => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
];

export function sniffImage(bytes: Uint8Array): ImageExt | null {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  for (const signature of SIGNATURES) {
    if (buf.length >= signature.length && signature.matches(buf)) return signature.ext;
  }
  return null;
}
