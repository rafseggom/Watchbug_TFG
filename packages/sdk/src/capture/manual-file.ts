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
 * decoded bitmap's dimensions are checked before any working canvas is
 * allocated (T-03-18); the client's posture is the decoded-bitmap check, not
 * a container-header parser (research A4 — the server's pre-decode guard
 * remains the control of record).
 */
import { MAX_IMAGE_DIM, MAX_IMAGE_PIXELS } from '@watchbug/contracts/constants';
import { CaptureUnavailableError, type CaptureRequest, type CaptureSource } from './capture-source.ts';
import { context2d, createCanvas, fitToCaps } from '../image/encode.ts';

/** The container formats the client gate admits — by magic bytes only. */
export type ClientImageFormat = 'png' | 'webp' | 'jpeg';

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
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 && // P
    bytes[2] === 0x4e && // N
    bytes[3] === 0x47 && // G
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) return 'png';

  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50; // P
  if (isWebp) return 'webp';

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  return null;
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
        head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      } catch {
        throw new CaptureUnavailableError('the selected file could not be read', 'format');
      }
      if (sniffClientImage(head) === null) {
        throw new CaptureUnavailableError(
          'the attached file is not a PNG, WebP or JPEG image',
          'format',
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
        const pixels = bitmap.width * bitmap.height;
        if (
          bitmap.width < 1 ||
          bitmap.height < 1 ||
          pixels > MAX_IMAGE_PIXELS ||
          bitmap.width > MAX_IMAGE_DIM ||
          bitmap.height > MAX_IMAGE_DIM
        ) {
          // Refuse BEFORE the working canvas exists (T-03-18): the decode of
          // the bitmap already happened at the engine's own budget; the second
          // full-size allocation is what this guard prevents.
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
