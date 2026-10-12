import { crc32 } from 'node:zlib';
import type { ImageExt } from '@watchbug/contracts/types';

/**
 * Stage 3: container structure — the **pre-codec guard** of the image control
 * stack (Pattern 2b, C-3/P1-D-11).
 *
 * Nothing here decodes a pixel: the chunk walk validates the container and
 * re-emits only what an image actually needs, so a hostile file is judged (and
 * largely neutralised) before any codec is allowed to see it.
 *
 * - **PNG:** IHDR first, IEND last, one IHDR, every CRC verified, no bytes
 *   after IEND. Ancillary metadata chunks (`tEXt`, `zTXt`, `iTXt`, `eXIf`,
 *   `tIME`) are **dropped** — they carry the EXIF/timestamp payload a stored
 *   artifact must never retain (SEC-02, M-1).
 * - **WebP:** `VP8X?/VP8|VP8L/ALPH?` only. Animation (`ANIM`/`ANMF`) is
 *   rejected outright; `EXIF`/`XMP `/`ICCP` and unknown chunks are dropped;
 *   data past the declared **File Size** is rejected (the container spec says
 *   a WebP file "SHOULD NOT contain any data after the data specified by
 *   File Size" — trailing bytes are exactly where a second payload hides).
 *
 * The dropping here is the structural half of the hardening; the root
 * re-encode in `harden.ts` (P1-D-10, `sharp`) is the other half. This module
 * is a *guard*, not the hardening backend: it never claims to be the control
 * on its own, because a decoder-differential polyglot can survive a structural
 * rewrite and only a true decode → re-encode kills it.
 */

export type StructureResult = { ok: true; bytes: Uint8Array } | { ok: false; message: string };

type Strip = { bytes: Buffer } | { error: string };

/** PNG chunks that survive the walk: everything else is dropped or fatal. */
const PNG_ALLOWED = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND']);
/** PNG ancillary chunks that carry metadata — dropped, never re-emitted. */
const PNG_METADATA_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

/** WebP chunks that survive; anything else (EXIF/XMP/ICCP/unknown) is dropped. */
const WEBP_ALLOWED = new Set(['VP8X', 'VP8 ', 'VP8L', 'ALPH']);
/** WebP metadata chunks — dropped, never re-emitted. */
const WEBP_METADATA_CHUNKS = new Set(['EXIF', 'XMP ', 'ICCP']);
/** WebP animation chunks — rejected outright (P1-D-11 accepts still images). */
const WEBP_ANIMATION = new Set(['ANIM', 'ANMF']);

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function stripPng(buf: Buffer): Strip {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { error: 'not a PNG file (signature mismatch)' };
  }

  const parts: Buffer[] = [buf.subarray(0, 8)];
  let offset = 8;
  let sawIHDR = false;
  let sawIEND = false;

  while (offset < buf.length) {
    if (offset + 8 > buf.length) return { error: 'PNG ends inside a chunk header' };
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buf.length) return { error: `PNG chunk ${type} is truncated` };

    if (offset === 8 && type !== 'IHDR') return { error: 'PNG does not begin with IHDR' };
    if (type === 'IHDR' && sawIHDR) return { error: 'PNG declares IHDR twice' };
    if (type === 'IEND' && length !== 0) return { error: 'PNG IEND chunk must be empty' };

    // CRC covers the chunk type + data; a mismatch means the file is corrupt
    // or tampered with — reject rather than re-emit something we cannot verify.
    const expectedCrc = buf.readUInt32BE(dataEnd);
    const actualCrc = crc32(buf.subarray(offset + 4, dataEnd)) >>> 0;
    if (expectedCrc !== actualCrc) return { error: `PNG chunk ${type} fails its CRC check` };

    // Metadata and ancillary chunks are dropped; only IHDR/PLTE/IDAT/IEND are
    // re-emitted (PNG_METADATA_CHUNKS is an explicit subset of "not allowed").
    if (!PNG_ALLOWED.has(type) || PNG_METADATA_CHUNKS.has(type)) {
      // consumed, not carried
    } else {
      const header = Buffer.alloc(8);
      header.writeUInt32BE(length, 0);
      header.write(type, 4, 'latin1');
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(actualCrc, 0);
      parts.push(header, buf.subarray(dataStart, dataEnd), crc);
    }

    if (type === 'IHDR') sawIHDR = true;
    offset = dataEnd + 4;
    if (type === 'IEND') {
      sawIEND = true;
      break;
    }
  }

  if (!sawIHDR) return { error: 'PNG has no IHDR chunk' };
  if (!sawIEND) return { error: 'PNG has no IEND chunk' };
  if (offset !== buf.length) return { error: 'PNG contains trailing data after IEND' };

  return { bytes: Buffer.concat(parts) };
}

function stripWebp(buf: Buffer): Strip {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') {
    return { error: 'not a WebP file (RIFF/WEBP signature mismatch)' };
  }

  // Trailing data: the RIFF header declares the container's own size, so a
  // file that is longer than its declared File Size carries a hidden payload.
  const declaredSize = buf.readUInt32LE(4);
  if (8 + declaredSize > buf.length) return { error: 'WebP is truncated (declared File Size exceeds the file)' };
  if (8 + declaredSize < buf.length) {
    return { error: 'WebP contains trailing data past its declared File Size' };
  }

  const parts: Buffer[] = [buf.subarray(0, 12)];
  let offset = 12;
  let sawImageChunk = false;

  while (offset + 8 <= buf.length) {
    const type = buf.toString('latin1', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > buf.length) return { error: `WebP chunk ${type} is truncated` };

    if (WEBP_ANIMATION.has(type)) return { error: `animated WebP (${type}) is not accepted` };

    if (WEBP_METADATA_CHUNKS.has(type)) {
      // EXIF/XMP/ICCP are consumed, not carried.
    } else if (WEBP_ALLOWED.has(type)) {
      if (type === 'VP8 ' || type === 'VP8L') sawImageChunk = true;
      const header = Buffer.alloc(8);
      header.write(type, 0, 'latin1');
      header.writeUInt32LE(size, 4);
      const data = buf.subarray(dataStart, dataEnd);
      // Chunks are padded to an even byte boundary; the pad belongs to the file
      // but not to the chunk size.
      parts.push(header, size % 2 === 1 ? Buffer.concat([data, Buffer.alloc(1)]) : data);
    }

    offset = dataEnd + (size % 2);
  }

  if (offset !== buf.length) return { error: 'WebP contains bytes after its last chunk' };
  if (!sawImageChunk) return { error: 'WebP contains no VP8/VP8L image data' };

  const body = Buffer.concat(parts);
  body.writeUInt32LE(body.length - 8, 4); // recompute the RIFF File Size
  return { bytes: body };
}

/**
 * Validate the container and return the bytes with metadata dropped — or the
 * reason the file is rejected. Runs after the magic-byte sniff and before the
 * decode-bomb guard, so no codec ever sees an unvalidated container.
 */
export function validateStructure(bytes: Uint8Array, ext: ImageExt): StructureResult {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const stripped = ext === 'png' ? stripPng(buf) : stripWebp(buf);
  if ('error' in stripped) return { ok: false, message: `image rejected: ${stripped.error}` };
  return { ok: true, bytes: stripped.bytes };
}
