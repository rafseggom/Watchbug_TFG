import { MAX_IMAGE_PIXELS } from '@watchbug/contracts/constants';
import type { ImageExt } from '@watchbug/contracts/types';
import { sniffImage } from './sniff';

/**
 * Stage 5: the mandatory **root re-encode** (P1-D-10, decided `sharp` at the
 * plan 01-02 Task 1 consultation gate).
 *
 * Every accepted image is decoded and written back out by libvips before
 * anything reaches disk. That is the control the structural strip in
 * `structure.ts` cannot be: a decoder-differential polyglot — a file whose
 * bytes decode differently in different decoders — survives any amount of
 * container rewriting, and only a real decode → re-encode reduces it to the
 * pixels one decoder actually produced.
 *
 * Contract of this stage (unchanged from plan 01-01, so the seam stays a
 * plain module and no second backend competes with it):
 *
 *   `hardenImage(bytes) → { bytes, ext, w, h }`
 *
 * - **Same format in, same format out** (P1-D-12, widened by P3-D-14):
 *   PNG → PNG, WebP → WebP, JPEG → JPEG, so the A-06 caps are compared like
 *   for like and R-11's WebP→PNG fallback promise is not pre-empted here.
 * - **EXIF orientation is applied before the pixels are re-encoded** —
 *   `autoOrient: true` is NOT sharp's default and must never be removed as
 *   "unnecessary": without it, a phone photo tagged `Orientation = 6` is
 *   decoded in raw sensor order and the metadata strip below then discards
 *   the tag, so the stored artifact is permanently sideways with the intended
 *   orientation unrecoverable (research F1, Pitfall 9). Applying it removes
 *   the Orientation tag as a side effect, which is exactly what the strip
 *   wants.
 * - **Metadata stripped by default** — sharp's documented default is "strip
 *   all metadata and convert to the device-independent sRGB colour space", so
 *   no EXIF/XMP/IPTC payload from the input can reach the stored bytes
 *   (SEC-02, M-1). `keepMetadata()`/`withMetadata()` are deliberately never
 *   called.
 * - **Processing-time guard** — `timeout({ seconds })` plus
 *   `limitInputPixels` bound the decode, so a crafted file that passes the
 *   header-dimension check (T-01-08) still cannot pin a worker.
 *
 * sharp (the heaviest native binary in the repo) is loaded **lazily on the
 * first ingest** via `loadSharp()` below — never at module-eval time — so the
 * API boot path never resolves it. The backend decision itself (P1-D-10) is
 * unchanged; only the import eagerness moved off the critical path.
 */

async function loadSharpModule() {
  const mod = await import('sharp');
  return mod.default;
}

let sharpLoad: ReturnType<typeof loadSharpModule> | null = null;

/**
 * Memoized singleton: concurrent first ingests share one in-flight import (no
 * import storm), and a rejected load clears the slot so the next ingest can
 * retry instead of inheriting a permanently poisoned promise.
 */
function loadSharp(): ReturnType<typeof loadSharpModule> {
  if (sharpLoad === null) {
    sharpLoad = loadSharpModule().catch((err: unknown) => {
      sharpLoad = null;
      throw err;
    });
  }
  return sharpLoad;
}

export type HardenResult =
  | { ok: true; bytes: Uint8Array; ext: ImageExt; w: number; h: number }
  | { ok: false; statusCode: 400; message: string };

/** T-01-08: how long one decode/re-encode may run before sharp aborts it. */
const HARDEN_TIMEOUT_SECONDS = 5;

/** Client-facing message shape — never echo raw codec internals verbatim. */
function codecMessage(err: unknown): string {
  const detail = err instanceof Error ? err.message.split('\n')[0] : '';
  const cleaned = detail.replace(/\s+/g, ' ').slice(0, 160);
  return `image rejected by the re-encode stage${cleaned === '' ? '' : `: ${cleaned}`}`;
}

export async function hardenImage(input: Uint8Array): Promise<HardenResult> {
  const ext = sniffImage(input);
  if (ext === null) {
    return {
      ok: false,
      statusCode: 400,
      message: 'image is neither PNG, WebP nor JPEG (magic bytes); SVG, GIF and HTML are never accepted',
    };
  }

  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);

  // Deliberately outside the codec try: a broken sharp install is an
  // OPERATIONAL failure, so it propagates to app.ts `setErrorHandler` as a
  // logged generic 500 — never a 400 that blames the client, and never an
  // absolute install path in a client-visible body.
  const sharp = await loadSharp();

  try {
    const pipeline = sharp(buf, {
      // T-01-08: refuse to even open an image larger than the A-06 pixel cap.
      limitInputPixels: MAX_IMAGE_PIXELS,
      // sharp's default for untrusted input; stated here so it cannot drift.
      failOn: 'warning',
      // Mandatory for JPEG correctness (Pitfall 9): apply EXIF Orientation
      // before re-encoding. Sharp does NOT orient by default; without this a
      // rotated photo is stored sideways AND its tag is stripped. Harmless
      // for PNG/WebP, which carry no EXIF Orientation after structure.ts.
      autoOrient: true,
    }).timeout({ seconds: HARDEN_TIMEOUT_SECONDS });

    // P1-D-12 widened by P3-D-14: same format in, same format out — an
    // exhaustive switch, so a fourth container cannot fall through a binary
    // ternary into another format's encoder (the Pitfall 8 bug class).
    switch (ext) {
      case 'png': {
        const { data, info } = await pipeline.png().toBuffer({ resolveWithObject: true });
        return { ok: true, bytes: data, ext, w: info.width, h: info.height };
      }
      case 'webp': {
        const { data, info } = await pipeline.webp().toBuffer({ resolveWithObject: true });
        return { ok: true, bytes: data, ext, w: info.width, h: info.height };
      }
      case 'jpeg': {
        // quality 80 is sharp's documented default, written explicitly so it
        // cannot drift with a future sharp upgrade.
        const { data, info } = await pipeline.jpeg({ quality: 80 }).toBuffer({ resolveWithObject: true });
        return { ok: true, bytes: data, ext, w: info.width, h: info.height };
      }
      default: {
        // Exhaustiveness guard: unreachable while ImageExt is closed. A broken
        // build must never quietly encode JPEG as WebP (T-03-03).
        const exhausted: never = ext;
        throw new TypeError(`unhandled image extension in re-encode: ${String(exhausted)}`);
      }
    }
  } catch (err) {
    return { ok: false, statusCode: 400, message: codecMessage(err) };
  }
}
