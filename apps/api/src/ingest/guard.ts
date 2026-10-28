import { MAX_IMAGE_DIM, MAX_IMAGE_PIXELS } from '@watchbug/contracts/constants';
import type { ImageExt } from '@watchbug/contracts/types';

/**
 * Stage 3: decode-bomb guard — **from the headers, before any decode**
 * (Pattern 2c). A 16 MP image advertised by a hostile file must never reach a
 * decoder, so width/height are read straight out of the container header:
 *
 * - PNG: `IHDR` at the fixed offset (width/height, big-endian, bytes 16–23).
 * - WebP: `VP8X` canvas (24-bit LE), or the `VP8 ` frame header, or the `VP8L`
 *   bitstream header — whichever chunk the file actually starts with.
 * - JPEG: the first SOFn marker (`0xC0`–`0xCF` excluding `0xC4`/`0xC8`/`0xCC`)
 *   reached by walking marker segments from SOI. This reads ONLY the header —
 *   past SOS lies entropy-coded scan data and this walker deliberately never
 *   goes there (the structural control for JPEG is the `harden.ts` re-encode,
 *   research F1/A3).
 *
 * Limits: `w`, `h ≤ MAX_IMAGE_DIM` (8192) and `w × h ≤ MAX_IMAGE_PIXELS`
 * (16,777,216 — A-06 / P1-D-10; the looser 25 MP figure was superseded).
 */

export interface Dimensions {
  ext: ImageExt;
  width: number;
  height: number;
}

export type GuardResult =
  | { ok: true; dims: Dimensions }
  | { ok: false; statusCode: 400; message: string };

function readPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  const chunk = buf.toString('latin1', 12, 16);
  const payload = 20;

  if (chunk === 'VP8X') {
    // Canvas Width/Height Minus One, 24-bit LE each.
    const width = 1 + (buf[payload + 4] | (buf[payload + 5] << 8) | (buf[payload + 6] << 16));
    const height = 1 + (buf[payload + 7] | (buf[payload + 8] << 8) | (buf[payload + 9] << 16));
    return { width, height };
  }

  if (chunk === 'VP8 ') {
    // 3-byte frame tag + 3-byte sync code 9D 01 2A, then 14-bit LE dims.
    if (buf[payload + 3] !== 0x9d || buf[payload + 4] !== 0x01 || buf[payload + 5] !== 0x2a) return null;
    return {
      width: buf.readUInt16LE(payload + 6) & 0x3fff,
      height: buf.readUInt16LE(payload + 8) & 0x3fff,
    };
  }

  if (chunk === 'VP8L') {
    if (buf[payload] !== 0x2f) return null;
    const bits = buf.readUInt32LE(payload + 1);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }

  return null;
}

/**
 * JPEG dimensions from the first SOFn marker, reached by walking the header's
 * marker segments from SOI. Segment shape: `FF <marker> <len:2 BE> <payload>`,
 * except the standalone markers (`FF D9` EOI, `FF 01` TEM, `FF D0`–`FF D7`
 * RSTn) which carry no length. The SOFn payload is
 * `[precision:1][height:2 BE][width:2 BE]` after its own length field.
 *
 * This is a **header** walker only: any malformed traversal returns `null`
 * (→ the fail-closed 400 in `assertDecodeSafe`). It deliberately never parses
 * past SOS — entropy-coded scan data has no length field and belongs to the
 * `harden.ts` re-encode, not to a hand-written parser (research F1/A3).
 */
function readJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) return null; // every marker starts with FF
    const marker = buf[offset + 1];

    // Standalone markers: no length field, no payload — skip and continue.
    if (marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    // SOFn (baseline through lossless, minus DNL C4 / JPEG8 C8 / codec CC):
    // the first one seen declares the frame the guard must bound.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (offset + 9 > buf.length) return null;
      return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
    }

    // Any other segment (APPn, DQT, DHT, DAC…) is explicit — step over it by
    // its declared length. SOS (0xDA) lands here too: reaching it without a
    // preceding SOFn means the header carries no readable dimensions.
    const length = buf.readUInt16BE(offset + 2);
    if (length < 2) return null; // a segment cannot claim fewer than 2 bytes
    offset += 2 + length;
  }
  return null;
}

/** Header-derived dimensions, or `null` when the container header is unusable. */
export function readDimensions(bytes: Uint8Array, ext: ImageExt): { width: number; height: number } | null {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  switch (ext) {
    case 'png':
      return readPngDimensions(buf);
    case 'webp':
      return readWebpDimensions(buf);
    case 'jpeg':
      return readJpegDimensions(buf);
    default: {
      // Exhaustiveness guard (P3-D-14): a fourth container must get its own
      // header reader here, never silently reuse another arm.
      const exhausted: never = ext;
      throw new TypeError(`unhandled image extension in dimension guard: ${String(exhausted)}`);
    }
  }
}

export function assertDecodeSafe(bytes: Uint8Array, ext: ImageExt): GuardResult {
  const dims = readDimensions(bytes, ext);
  if (dims === null) {
    return {
      ok: false,
      statusCode: 400,
      message: `the ${ext.toUpperCase()} header is missing or unreadable; refusing to decode it`,
    };
  }

  const { width, height } = dims;
  if (width < 1 || height < 1) {
    return { ok: false, statusCode: 400, message: `image dimensions must be positive (got ${width}×${height})` };
  }
  if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
    return {
      ok: false,
      statusCode: 400,
      message: `image is ${width}×${height}px; each side must be at most ${MAX_IMAGE_DIM}px (MAX_IMAGE_DIM)`,
    };
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    return {
      ok: false,
      statusCode: 400,
      message: `image declares ${width * height}px; the contract allows at most ${MAX_IMAGE_PIXELS}px (MAX_IMAGE_PIXELS)`,
    };
  }

  return { ok: true, dims: { ext, width, height } };
}
