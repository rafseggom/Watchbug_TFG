import { crc32 } from 'node:zlib';
import type { ImageExt } from '@watchbug/contracts/types';
import { readDimensions } from './guard';
import { sniffImage } from './sniff';

/**
 * Stage 4: container hardening — the zero-dep **structural strip/rebuild**
 * backend (Pattern 2 option 2, the documented fallback of P1-D-10).
 *
 * P1-D-10 (heavy dependency, e.g. `sharp`) is consultation-gated in plan 01-02,
 * so this plan ships the backend that needs no new dependency and no pixel
 * decode: only allowlisted container chunks survive the rewrite, so EXIF/XMP/
 * ICCP, `tEXt` annotations, trailing data and container-level polyglots are
 * dropped **before anything touches disk** (T-01-04, SEC-02) — and because no
 * decoder runs, a decode bomb cannot be weaponised here by construction.
 *
 * Same container in, same container out (P1-D-12). The swap to a re-encode
 * backend happens behind this function's contract:
 * `hardenImage(bytes) → { bytes, ext, w, h }`.
 */

export type HardenResult =
  | { ok: true; bytes: Uint8Array; ext: ImageExt; w: number; h: number }
  | { ok: false; statusCode: 400; message: string };

type Rebuild = { bytes: Buffer } | { error: string };

/** PNG chunks that survive: everything else (ancillary/metadata) is dropped. */
const PNG_ALLOWED = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND']);
/** WebP chunks that survive; animations (ANIM/ANMF) are rejected outright. */
const WEBP_ALLOWED = new Set(['VP8X', 'VP8 ', 'VP8L', 'ALPH']);
const WEBP_ANIMATION = new Set(['ANIM', 'ANMF']);

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function rebuildPng(buf: Buffer): Rebuild {
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

    if (PNG_ALLOWED.has(type)) {
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

function rebuildWebp(buf: Buffer): Rebuild {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') {
    return { error: 'not a WebP file (RIFF/WEBP signature mismatch)' };
  }

  const declaredSize = buf.readUInt32LE(4);
  if (8 + declaredSize > buf.length) return { error: 'WebP is truncated (declared RIFF size exceeds the file)' };
  if (8 + declaredSize < buf.length) {
    return { error: 'WebP contains trailing data past its declared RIFF size' };
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

    if (WEBP_ANIMATION.has(type)) return { error: 'animated WebP (ANIM/ANMF) is not accepted' };

    if (WEBP_ALLOWED.has(type)) {
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
  body.writeUInt32LE(body.length - 8, 4); // recompute the RIFF size
  return { bytes: body };
}

export function hardenImage(input: Uint8Array): HardenResult {
  const ext = sniffImage(input);
  if (ext === null) {
    return {
      ok: false,
      statusCode: 400,
      message: 'image is neither PNG nor WebP (magic bytes); SVG, GIF and HTML are never accepted',
    };
  }

  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const rebuilt = ext === 'png' ? rebuildPng(buf) : rebuildWebp(buf);
  if ('error' in rebuilt) return { ok: false, statusCode: 400, message: `image rejected: ${rebuilt.error}` };

  const dims = readDimensions(rebuilt.bytes, ext);
  if (dims === null) return { ok: false, statusCode: 400, message: 'hardened image header could not be read' };

  return { ok: true, bytes: rebuilt.bytes, ext, w: dims.width, h: dims.height };
}
