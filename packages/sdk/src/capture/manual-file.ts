/**
 * `ManualFileCapture` — the second `CaptureSource` adapter (CAP-02, A-05,
 * P3-D-15, research Pattern 6).
 *
 * **User-invoked, never an automatic fallback.** P3-D-13's whole point is that
 * a denied capture becomes a *visible* choice in the degraded composer, not a
 * silently popped file dialog — so this adapter stands beside
 * `DisplayMediaCapture` instead of wrapping it, and only the composer's
 * `Attach image` action calls it.
 *
 * A-05 is structural here too: `capture()` resolves to raw `ImageData`, never
 * an encoded artifact. The attachment therefore enters the same
 * annotate/review/mask flow as a capture and the single encode sink downstream
 * stays the only producer of outgoing bytes (P3-D-15) — an attached JPEG
 * leaves as WebP or PNG because nothing else can encode.
 *
 * The file-picker's `accept` attribute is decoration, never validation: an
 * arbitrary file crosses the boundary here, so the bytes are admitted on
 * their magic prefix only — the same three prefix checks the server's sniff
 * applies (PATTERNS §13), so the two rules cannot drift conceptually. The
 * **header** dimensions are checked before the bitmap is decoded: a file that
 * declares more pixels than the contract allows is refused before the engine
 * allocates an attacker-sized buffer (S-5). The server's pre-decode guard
 * remains the control of record.
 */
import { MAX_IMAGE_DIM, MAX_IMAGE_PIXELS } from '@watchbug/contracts/constants';
import { CaptureUnavailableError, type CaptureRequest, type CaptureSource } from './capture-source.ts';
import { context2d, createCanvas, fitToCaps } from '../image/encode.ts';

/** The container formats the client gate admits — by magic bytes only. */
export type ClientImageFormat = 'png' | 'webp' | 'jpeg';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** The signature table — adding a container is one row, not another `&&` chain. */
const CLIENT_SIGNATURES: ReadonlyArray<{
  format: ClientImageFormat;
  length: number;
  matches: (bytes: Uint8Array) => boolean;
}> = [
  {
    format: 'png',
    length: 8,
    matches: (bytes) => PNG_SIGNATURE.every((value, index) => bytes[index] === value),
  },
  {
    format: 'webp',
    length: 12,
    matches: (bytes) =>
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50,
  },
  {
    format: 'jpeg',
    length: 3,
    matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
];

/**
 * Magic-prefix classification of an image file.
 *
 * Deliberately mirrors the server-side sniff's three prefix rules stated in
 * 03-02's plan: PNG's eight-byte signature, `RIFF` at 0 with `WEBP` at 8, and
 * the three-byte `ff d8 ff` JPEG start-of-image marker. A declared MIME type
 * or filename extension is untrusted input from the host's file system, so
 * neither is consulted here; anything else — SVG, HTML, a polyglot GIF —
 * returns `null` and never reaches a decoder (V12, T-03-02).
 */
export function sniffClientImage(bytes: Uint8Array): ClientImageFormat | null {
  for (const signature of CLIENT_SIGNATURES) {
    if (bytes.length >= signature.length && signature.matches(bytes)) return signature.format;
  }
  return null;
}

const u16be = (bytes: Uint8Array, offset: number): number => (bytes[offset] << 8) | bytes[offset + 1];

const u32be = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;

const u32le = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') return null;
  return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  const payload = 20;

  if (chunk === 'VP8X') {
    // Canvas Width/Height Minus One, 24-bit LE each.
    const width = 1 + (bytes[payload + 4] | (bytes[payload + 5] << 8) | (bytes[payload + 6] << 16));
    const height = 1 + (bytes[payload + 7] | (bytes[payload + 8] << 8) | (bytes[payload + 9] << 16));
    return { width, height };
  }

  if (chunk === 'VP8 ') {
    if (bytes[payload + 3] !== 0x9d || bytes[payload + 4] !== 0x01 || bytes[payload + 5] !== 0x2a) return null;
    return {
      width: u16be(bytes, payload + 6) & 0x3fff,
      height: u16be(bytes, payload + 8) & 0x3fff,
    };
  }

  if (chunk === 'VP8L') {
    if (bytes[payload] !== 0x2f) return null;
    const bits = u32le(bytes, payload + 1);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }

  return null;
}

/** Markers with no length field and no payload (EOI, TEM, RSTn). */
function isStandaloneJpegMarker(marker: number): boolean {
  return marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

/** SOFn (baseline through lossless, minus DNL C4 / JPEG8 C8 / codec CC). */
function isSofJpegMarker(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

/** Walk the JPEG marker segments only as far as the first SOFn. */
function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];

    if (isStandaloneJpegMarker(marker)) {
      offset += 2;
      continue;
    }
    if (isSofJpegMarker(marker)) {
      if (offset + 9 > bytes.length) return null;
      return { width: u16be(bytes, offset + 7), height: u16be(bytes, offset + 5) };
    }

    const length = u16be(bytes, offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

/**
 * Header-declared dimensions for the three admitted containers. `null` means
 * the header is truncated or malformed; the caller refuses the file rather
 * than handing it to the decoder without a bound (S-5).
 */
export function readClientImageDimensions(
  bytes: Uint8Array,
  format: ClientImageFormat,
): { width: number; height: number } | null {
  switch (format) {
    case 'png':
      return readPngDimensions(bytes);
    case 'webp':
      return readWebpDimensions(bytes);
    case 'jpeg':
      return readJpegDimensions(bytes);
  }
}

/** Enough leading bytes to reach a JPEG SOFn even behind a large EXIF block. */
const HEADER_WINDOW_BYTES = 1024 * 1024;

function exceedsCaps(width: number, height: number): boolean {
  return (
    width < 1 ||
    height < 1 ||
    width > MAX_IMAGE_DIM ||
    height > MAX_IMAGE_DIM ||
    width * height > MAX_IMAGE_PIXELS
  );
}

/**
 * The adapter itself. One file per `capture()` call, handed through the
 * additive `CaptureRequest.file` member; the `beforeRead` contract is kept
 * verbatim (it is a no-op for a file — there is no DOM↔bitmap registration to
 * assert — but a throw still aborts, exactly like the display adapter).
 */
export function createManualFileCapture(): CaptureSource {
  return {
    async capture(request: CaptureRequest): Promise<ImageData> {
      const file = request.file;
      if (file === undefined) {
        throw new CaptureUnavailableError('no file was selected for the attachment', 'format');
      }

      // The prefix check runs on the first bytes only — a multi-megabyte
      // selection never enters memory just to be classified.
      let head: Uint8Array;
      try {
        head = new Uint8Array(await file.slice(0, HEADER_WINDOW_BYTES).arrayBuffer());
      } catch {
        throw new CaptureUnavailableError('the selected file could not be read', 'format');
      }
      const format = sniffClientImage(head);
      if (format === null) {
        throw new CaptureUnavailableError(
          'the attached file is not a PNG, WebP or JPEG image',
          'format',
        );
      }

      // S-5: read the dimensions from the header BEFORE decoding. A file that
      // declares 50 000 × 50 000 is refused here, not after the engine has
      // already materialised the bitmap.
      const declared = readClientImageDimensions(head, format);
      if (declared === null) {
        throw new CaptureUnavailableError('the attached image header is unreadable', 'format');
      }
      if (exceedsCaps(declared.width, declared.height)) {
        throw new CaptureUnavailableError(
          'the attached image exceeds the supported dimensions',
          'size',
        );
      }

      let bitmap: ImageBitmap;
      try {
        // EXIF orientation is applied by the engine here (`imageOrientation`
        // defaults to from-image), so a phone photo enters upright — the same
        // guarantee the server's autoOrient re-encode gives its own way.
        bitmap = await createImageBitmap(file);
      } catch {
        throw new CaptureUnavailableError('the attached image could not be decoded', 'decode');
      }

      try {
        // The header said it fits; the decoded bitmap is the engine's final
        // word (EXIF rotation swaps the axes but never the pixel count).
        if (exceedsCaps(bitmap.width, bitmap.height)) {
          throw new CaptureUnavailableError(
            'the attached image exceeds the supported dimensions',
            'size',
          );
        }

        const fit = fitToCaps(bitmap.width, bitmap.height);
        request.beforeRead();
        const canvas = createCanvas(fit.width, fit.height);
        const context = context2d(canvas);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return context.getImageData(0, 0, canvas.width, canvas.height);
      } catch (error) {
        if (error instanceof CaptureUnavailableError) throw error;
        throw new CaptureUnavailableError('the attached image could not be prepared', 'decode');
      } finally {
        bitmap.close();
      }
    },
  };
}
