/**
 * The single image-encode sink and the P2-D-10/11 ladder (CAP-05, M-3).
 *
 * **One textual sink call site in the whole SDK.** `scripts/gate.mjs`'s
 * `sdk-single-encode-sink` rule allows exactly one occurrence of the canvas
 * encode API under `packages/sdk/src`; the quality ladder is therefore a loop
 * *around* `encodeOnce`, and the WebP capability probe routes through the same
 * function. Do not add a second call site, and do not name the API in a
 * comment: the gate counts text, comments included.
 *
 * **M-3 — the silent codec fallback.** A canvas asked for WebP may answer PNG
 * without throwing and without returning null; `blob.type` is the only tell.
 * The probe caches the engine's real capability once and the ladder re-sniffs
 * every produced blob, so the multipart filename and MIME type always match
 * the bytes on the wire.
 *
 * Ladder: clamp devicePixelRatio at 2 → fit under `MAX_IMAGE_PIXELS` → q0.8,
 * then q0.6, q0.5 → 0.75× downscale and repeat → hard ceiling
 * `MAX_ENCODED_IMAGE_BYTES` (2 MB, the server's 413 boundary).
 */
import {
  MAX_ENCODED_IMAGE_BYTES,
  MAX_IMAGE_DIM,
  MAX_IMAGE_PIXELS,
} from '@watchbug/contracts/constants';

/** The agreed soft target; the 2 MB contract cap is the hard stop (CAP-05). */
export const TARGET_ENCODED_IMAGE_BYTES = 800 * 1024;
/** Preferred quality first, then two cheaper passes before any downscale. */
export const QUALITY_LADDER = [0.8, 0.6, 0.5] as const;
/** Each ladder round shrinks the frame by this factor. */
export const DOWNSCALE_FACTOR = 0.75;
/** Bounded loop: after this many rounds the hard ceiling decides. */
export const MAX_ENCODE_ROUNDS = 6;
/** Do not downscale below this; tiny captures stop being legible. */
const MIN_EDGE_PX = 32;
/** WebP is only requested when the engine proved it encodes it (M-3). */
const WEBP_MIME = 'image/webp';
const PNG_MIME = 'image/png';

export interface EncodedImage {
  blob: Blob;
  /** The type the engine actually produced — never the requested one. */
  mimeType: string;
  width: number;
  height: number;
}

/** `webp` when the engine honoured the request, `png` on the silent fallback. */
export function sniffImageType(producedType: string): string {
  return producedType === WEBP_MIME ? WEBP_MIME : PNG_MIME;
}

/**
 * Real WebP bytes: `RIFF` at 0 and `WEBP` at 8.
 *
 * `blob.type` alone is not a sufficient capability answer. WebKit answers a
 * WebP request with a **zero-byte blob still labelled `image/webp`** rather than
 * the spec's PNG fallback, so a type-only probe would cache "WebP works", encode
 * an empty image and hand the API nothing to sniff. The magic bytes are the only
 * claim the server will accept, so they are the claim the probe trusts.
 */
function hasWebpMagic(bytes: Uint8Array): boolean {
  const ascii = (start: number, end: number): string =>
    String.fromCharCode(...bytes.subarray(start, end));
  return bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
}

/**
 * The only call site of the canvas encode API in `packages/sdk/src`.
 * Everything else in the SDK goes through it.
 */
function encodeOnce(pngOrWebpCanvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    pngOrWebpCanvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error('the canvas produced no image'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

let webpSupported: boolean | null = null;

/** One 1×1 capability probe, cached for the widget's lifetime (M-3). */
async function preferredMimeType(): Promise<string> {
  if (webpSupported === null) {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const produced = await encodeOnce(probe, WEBP_MIME, 0.8);
    const bytes = new Uint8Array(await produced.arrayBuffer());
    webpSupported =
      sniffImageType(produced.type) === WEBP_MIME && hasWebpMagic(bytes);
  }
  return webpSupported ? WEBP_MIME : PNG_MIME;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('a 2D canvas is unavailable');
  return context;
}

/** Downscale a canvas with high-quality smoothing. */
function scaledCopy(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const context = context2d(canvas);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Apply the devicePixelRatio clamp, MAX_IMAGE_DIM and the 16 MP ceiling. */
function initialDimensions(width: number, height: number): { width: number; height: number } {
  let nextWidth = width;
  let nextHeight = height;

  const ratio = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  if (ratio > 2) {
    nextWidth = Math.round((width * 2) / ratio);
    nextHeight = Math.round((height * 2) / ratio);
  }

  // No side may exceed MAX_IMAGE_DIM (8192) — beyond that the canvas (and
  // other engines' decoders) start failing silently instead of encoding.
  const maxSide = Math.max(nextWidth, nextHeight);
  if (maxSide > MAX_IMAGE_DIM) {
    const sideFactor = MAX_IMAGE_DIM / maxSide;
    nextWidth = Math.round(nextWidth * sideFactor);
    nextHeight = Math.round(nextHeight * sideFactor);
  }

  const area = nextWidth * nextHeight;
  if (area > MAX_IMAGE_PIXELS) {
    const factor = Math.sqrt(MAX_IMAGE_PIXELS / area) * 0.98;
    nextWidth = Math.round(nextWidth * factor);
    nextHeight = Math.round(nextHeight * factor);
  }

  return {
    width: Math.max(MIN_EDGE_PX, nextWidth),
    height: Math.max(MIN_EDGE_PX, nextHeight),
  };
}

/**
 * Encode an already-redacted frame. The caller must have run the `Redactor`
 * on `image` first — this function never sees a pre-mask pixel (SEC-02/T-02-03).
 */
export async function encodeLadder(image: ImageData): Promise<EncodedImage> {
  const source = createCanvas(image.width, image.height);
  context2d(source).putImageData(image, 0, 0);

  const mimeType = await preferredMimeType();
  const start = initialDimensions(image.width, image.height);
  let current = scaledCopy(source, start.width, start.height);
  let last: EncodedImage | null = null;

  for (let round = 0; round < MAX_ENCODE_ROUNDS; round += 1) {
    for (const quality of QUALITY_LADDER) {
      const blob = await encodeOnce(current, mimeType, quality);
      // An empty encode is a broken engine answer, never a sendable image: the
      // API rejects it on magic bytes and the user gets a pointless round trip.
      if (blob.size === 0) throw new Error('the canvas produced an empty image');
      last = {
        blob,
        mimeType: sniffImageType(blob.type),
        width: current.width,
        height: current.height,
      };
      if (blob.size <= TARGET_ENCODED_IMAGE_BYTES) return last;
    }

    const nextWidth = Math.round(current.width * DOWNSCALE_FACTOR);
    const nextHeight = Math.round(current.height * DOWNSCALE_FACTOR);
    if (nextWidth < MIN_EDGE_PX || nextHeight < MIN_EDGE_PX) break;
    current = scaledCopy(current, nextWidth, nextHeight);
  }

  if (last === null || last.blob.size > MAX_ENCODED_IMAGE_BYTES) {
    throw new Error('the encoded image exceeds the 2 MB contract ceiling');
  }
  // Between the soft target and the hard ceiling: still sendable.
  return last;
}
