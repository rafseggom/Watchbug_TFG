/**
 * `CaptureSource` port (R-02 seam) and its `DisplayMediaCapture` adapter
 * (CAP-01, P2-D-05/06, A-05).
 *
 * **A-05 is structural, not a convention:** `capture()` resolves to raw
 * `ImageData`, never a `Blob`. No encoded byte can exist before the redactor
 * runs because this seam has no way to produce one — the single encode sink
 * lives downstream of it (`image/encode.ts`). That is the SEC-02 boundary.
 *
 * Ordering the pipeline depends on, all inside this adapter:
 *
 *   getDisplayMedia → surface policy → <video> srcObject → wait a real frame
 *   → `beforeRead()` (the P2-D-06 hidden assertion) → drawImage → getImageData
 *
 * `track.stop()` runs in `finally`, so a failure (or a second attempt) never
 * leaves a live capture session behind.
 */

/** What the pipeline hands the adapter: one hook, run immediately before the pixel read. */
export interface CaptureRequest {
  /**
   * Invoked immediately before `drawImage`/`getImageData` — the pipeline's
   * P2-D-06 invariant ("the widget host is hidden at pixel-read time"). It
   * throws to abort the capture; the adapter never swallows that error.
   */
  beforeRead: () => void;
  /**
   * The user-picked file for `ManualFileCapture` (CAP-02, P3-D-15). Additive
   * and optional, so `DisplayMediaCapture` is untouched: the production
   * adapter never reads this member and the composer is the only caller that
   * ever sets it.
   */
  file?: File;
}

/** The seam (R-02): raw pixels in, nothing encoded. */
export interface CaptureSource {
  capture(request: CaptureRequest): Promise<ImageData>;
}

/**
 * Why a file never became a bitmap — the attachment gate's distinguishing
 * class (CAP-02, T-03-02): magic-prefix refusal, over-cap decoded dimensions,
 * or a failed decode. The composer maps all three to one visible inline
 * refusal; the reason exists so the branch can stay one `instanceof` while
 * the diagnosis survives.
 */
export type CaptureUnavailableReason = 'format' | 'size' | 'decode';

/** The capture could not run at all (no API, denied, unsupported surface). */
export class CaptureUnavailableError extends Error {
  /** Present for every attachment-gate refusal (CAP-02); absent for capture failures. */
  readonly reason: CaptureUnavailableReason | undefined;

  constructor(message: string, reason?: CaptureUnavailableReason) {
    super(message);
    this.name = 'CaptureUnavailableError';
    this.reason = reason;
  }
}

/**
 * e2e-only seam property name (A-02 / Pitfall 2). Read from the host element
 * **only when `SHADOW_MODE === 'open'`**, so esbuild folds the branch away in
 * every shipped bundle and production can never be driven by a page-supplied
 * frame provider. Nothing is parked on `window` (WDG-04 discipline).
 */
const SEAM_PROPERTY = '__watchbugCaptureFrame';

type SeamFrameProvider = () => ImageData;

function readCaptureSeam(element: HTMLElement): SeamFrameProvider | null {
  if (SHADOW_MODE !== 'open') return null;
  const candidate = (element as unknown as Record<string, unknown>)[SEAM_PROPERTY];
  return typeof candidate === 'function' ? (candidate as SeamFrameProvider) : null;
}

/** Resolve on the first real decoded frame of the stream. */
function waitForFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
    };
    const onLoaded = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new CaptureUnavailableError(message));
    };
    const onError = (): void => fail('the capture stream could not be decoded');
    // A stream that never produces a frame must surface as a loud failure, not
    // as a panel stuck on `Capturing…` (M-6).
    const timer = setTimeout(() => fail('the capture stream produced no frame'), 10_000);
    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('error', onError);
    // Some engines only start the pipeline once playback is requested.
    void video.play().catch(() => undefined);
  });
}

/** One animation frame — the frame the browser has actually painted. */
function nextFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

/**
 * The production adapter: `getDisplayMedia` → `<video>` → canvas → `ImageData`.
 *
 * `preferCurrentTab` is only a hint (Chromium-only), so the *authoritative*
 * check is the track's `displaySurface`: a window or monitor capture makes
 * DOM→bitmap registration meaningless, and auto-redaction would silently miss
 * (OQ-1, Pattern 3). `undefined` (older engines) is accepted with a documented
 * caveat — refusing it would break browsers that never report the surface.
 */
export function createDisplayMediaCapture(hostElement: HTMLElement): CaptureSource {
  return {
    async capture(request: CaptureRequest): Promise<ImageData> {
      const seam = readCaptureSeam(hostElement);
      if (seam !== null) return captureFromSeam(seam, request);

      const media = navigator.mediaDevices;
      if (media === undefined || typeof media.getDisplayMedia !== 'function') {
        throw new CaptureUnavailableError('this browser does not expose tab capture (getDisplayMedia)');
      }

      let stream: MediaStream;
      try {
        stream = await media.getDisplayMedia({
          video: true,
          preferCurrentTab: true,
        } as DisplayMediaStreamOptions);
      } catch {
        // Prompt rejection (`NotAllowedError`), dismissal, or no API — all map
        // to the same loud `status.captureFailed` state downstream (M-6):
        // never a silent no-op.
        throw new CaptureUnavailableError('screen capture was not granted');
      }

      try {
        const track = stream.getVideoTracks()[0];
        if (track === undefined) {
          throw new CaptureUnavailableError('the capture stream carries no video track');
        }

        assertTabSurface(track);

        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        return await readFrame(video, request);
      } finally {
        for (const track of stream.getTracks()) track.stop();
      }
    },
  };
}

/**
 * The e2e seam branch (A-02): a page-supplied frame, accepted only from the
 * `SHADOW_MODE === 'open'` build. Kept in its own function so the production
 * `capture()` reads as three guard clauses and two collaborators.
 */
function captureFromSeam(seam: SeamFrameProvider, request: CaptureRequest): ImageData {
  request.beforeRead();
  const frame = seam();
  if (!(frame instanceof ImageData)) {
    throw new CaptureUnavailableError('the capture seam produced no ImageData');
  }
  return frame;
}

/**
 * OQ-1 / Pitfall 7 -- the displaySurface policy. Only a TAB frame maps to this
 * page's DOM, so only a tab frame can be redacted automatically:
 *
 *   'browser'  -> the current tab: accepted.
 *   'window'   -> a single window: DOM-to-bitmap registration is unverifiable,
 *                 so it is refused (nothing is sent; never "send anyway").
 *   'screen'   -> the whole monitor: same reason -- refused.
 *   undefined  -> older engines report no surface at all: ACCEPTED with the
 *                 documented caveat (OQ-1) that `preferCurrentTab` plus the
 *                 picker choice are the only signals there; refusing outright
 *                 would break browsers that never report the surface.
 *
 * Any other reported surface ('monitor', 'application') is refused with the
 * same loud failure -- conservative per P2-D-09 (T-02-05).
 */
function assertTabSurface(track: MediaStreamTrack): void {
  const surface = track.getSettings().displaySurface;
  if (surface === undefined || surface === 'browser') return;
  throw new CaptureUnavailableError(
    `only tab captures can be redacted automatically (surface: ${surface})`,
  );
}

/**
 * Wait for a real decoded frame and read it into raw pixels. `beforeRead` runs
 * immediately before `getImageData`, and the video is torn down in `finally`
 * whatever happens.
 */
async function readFrame(video: HTMLVideoElement, request: CaptureRequest): Promise<ImageData> {
  try {
    await waitForFrame(video);
    await video.play();
    await nextFrame();

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width < 1 || height < 1) {
      throw new CaptureUnavailableError('the captured frame is empty');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) {
      throw new CaptureUnavailableError('a 2D canvas is unavailable');
    }

    // P2-D-06: asserted in code, immediately before pixels are read.
    request.beforeRead();
    context.drawImage(video, 0, 0);
    return context.getImageData(0, 0, width, height);
  } finally {
    video.srcObject = null;
    video.remove();
  }
}
