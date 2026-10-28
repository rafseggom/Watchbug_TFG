import type { Page } from '@playwright/test';

/**
 * Two-tier capture stub for the tracer rows (02-02 Task 1).
 *
 * **Why two tiers (Pitfall 2):** the production adapter is
 * `getDisplayMedia → <video> → drawImage → getImageData`. Chromium and Firefox
 * can run that whole path against a faked `getDisplayMedia` that returns
 * `canvas.captureStream()` — the video decode, the frame wait and `drawImage`
 * are real, and only the OS picker is absent. WebKit exposes neither a usable
 * `getDisplayMedia` nor `HTMLCanvasElement.captureStream` here, so it gets the
 * `CaptureSource`-seam hook instead: raw `ImageData` enters at the same point
 * the adapter would have produced it, and probe → redact → encode → transport
 * still run for real.
 *
 * The seam is read **only** when `SHADOW_MODE === 'open'` (the e2e bundle), is
 * stored as a property on the widget host element and never on `window` — the
 * WDG-04 global-surface rows must stay true, so the stub itself may not leak a
 * global while it is installed.
 *
 * Frames are deliberately **non-uniform**: `blankProbe()` refuses a frame whose
 * pixels are all byte-identical, so a solid-colour stub would exercise the blank
 * failure state instead of the tracer. The `sparse` option covers the opposite
 * regression: a real page that is white almost everywhere with one detail in a
 * corner must still be accepted.
 */

/** The canvas frame the media tier serves (CSS-pixel viewport → bitmap scale). */
export const STUB_FRAME_WIDTH = 640;
export const STUB_FRAME_HEIGHT = 360;

/** `media` = faked `getDisplayMedia`; `seam` = raw `ImageData` at the port. */
export type CaptureStubTier = 'media' | 'seam';

/**
 * Engine → tier. WebKit is the seam tier; every other engine runs the real
 * video path. The branch is the source-level proof the plan asks for.
 */
export function captureStubTier(browserName: string): CaptureStubTier {
  return browserName === 'webkit' ? 'seam' : 'media';
}

/**
 * Paint a recognisable, non-uniform frame. `marker` is the viewport rect of
 * `[data-capture-marker]`, mapped into bitmap space with the same
 * frame/viewport scale the redactor uses — so a later row can assert that a
 * masked region's original pixels are gone.
 */
const PAINT_FRAME = String(function paintFrame(
  this: void,
  canvas: HTMLCanvasElement,
  marker: { left: number; top: number; right: number; bottom: number } | null,
  uniform: boolean,
  sparse: boolean,
): void {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('capture stub: a 2D canvas is unavailable');
  const width = canvas.width;
  const height = canvas.height;

  if (uniform) {
    // P2-D-12: one colour everywhere — the dense uniformity scan must abort this
    // frame before any encode or request. No dot, no marker, no gradient.
    context.fillStyle = '#808080';
    context.fillRect(0, 0, width, height);
    return;
  }

  if (sparse) {
    // P2-D-12 regression: a legitimate but sparse page — white everywhere with
    // one 4x4 dark block at (2,2). The block sits OUTSIDE the old 3x3 sample
    // points (25/50/75 %), so the old fixed-grid probe called this frame blank;
    // the dense scan must accept it and let the report through.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#1b1f26';
    context.fillRect(2, 2, 4, 4);
    return;
  }

  const scaleX = width / Math.max(1, window.innerWidth);
  const scaleY = height / Math.max(1, window.innerHeight);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#16233a');
  gradient.addColorStop(0.5, '#6b4a7f');
  gradient.addColorStop(1, '#c9a227');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  // Structured blocks give the blank probe nine genuinely different samples.
  // The launcher accent `#2f6feb` is deliberately NOT in this palette: the
  // CAP-04 row decodes the outgoing image and asserts zero accent-coloured
  // pixels, so the only way that colour could appear is the widget itself.
  const palette = ['#1e7a46', '#b3261e', '#0b7285', '#eef0f4', '#5b6472', '#f2c14e'];
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      context.fillStyle = palette[(row * 10 + column) % palette.length];
      context.fillRect(
        Math.round((column * width) / 10) + 3,
        Math.round((row * height) / 6) + 3,
        Math.max(2, Math.round(width / 20)),
        Math.max(2, Math.round(height / 14)),
      );
    }
  }

  if (marker !== null) {
    context.fillStyle = '#ff00ff';
    context.fillRect(
      Math.floor(marker.left * scaleX),
      Math.floor(marker.top * scaleY),
      Math.max(1, Math.ceil((marker.right - marker.left) * scaleX)),
      Math.max(1, Math.ceil((marker.bottom - marker.top) * scaleY)),
    );
  }

  // A tiny moving dot keeps `captureStream` emitting frames without changing
  // any region the assertions look at.
  context.fillStyle = '#ffffff';
  context.fillRect(2 + (Date.now() % 4), 2, 2, 2);
});

/**
 * Host-state observation (CAP-04): recorded by BOTH tiers at the moment the
 * stub is invoked, i.e. while the pipeline is between `hideSync()` and the
 * pixel read. Kept in a host-page attribute (never on `window` — WDG-04), like
 * the headline recorder.
 */
const RECORD_OBSERVATION = String.raw`function recordObservation(tier) {
  var host = document.querySelector('watchbug-host');
  if (host === null) return;
  var inline = host.getAttribute('style') || '';
  document.documentElement.setAttribute(
    'data-wb-stub-observation',
    JSON.stringify({
      tier: tier,
      display: window.getComputedStyle(host).display,
      inline: inline,
      inlineHidden: inline.indexOf('display: none') !== -1
    })
  );
}`;

/**
 * Outgoing-image recorder (CAP-01/04/05, M-3).
 *
 * **Why this exists:** Playwright's WebKit cannot serialise blob-backed
 * FormData parts into `request.postDataBuffer()` (02-02 deviation 2) — the
 * image part arrives as 0 bytes there, so intercepting the request cannot
 * yield the pixels that left the browser. The SDK calls `fetch` with the
 * FormData body, so wrapping `window.fetch` reads the **actual outgoing Blob**
 * on every engine, before Playwright's transport layer ever sees it. The
 * bytes land in a host-page attribute (never on `window` — WDG-04).
 */
const OUTGOING_RECORDER = String.raw`(() => {
  var original = window.fetch;
  if (typeof original !== 'function') return;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = (init && init.method) || (input && input.method) || 'GET';
      var body = init && init.body;
      if (method === 'POST' && /\/api\/incidents$/.test(url) && body !== null && body !== undefined && typeof body.get === 'function') {
        var image = body.get('image');
        if (image !== null && image !== undefined && typeof image.arrayBuffer === 'function') {
          image.arrayBuffer().then(function (buffer) {
            var bytes = new Uint8Array(buffer);
            var chunk = 0x8000;
            var binary = '';
            for (var at = 0; at < bytes.length; at += chunk) {
              binary += String.fromCharCode.apply(null, bytes.subarray(at, at + chunk));
            }
            document.documentElement.setAttribute('data-wb-outgoing-image', btoa(binary));
          }).catch(function () {});
        }
      }
    } catch (error) {
      // Instrumentation must never break the send it observes.
    }
    return original.call(this, input, init);
  };
})();`;

/** Fixed frame geometry a row can request; default = the 640×360 tracer frame. */
export interface CaptureStubFrame {
  width: number;
  height: number;
}

export interface CaptureStubOptions {
  /** Force a tier (rows that need the same tier on every engine). */
  tier?: CaptureStubTier;
  /** Fixed frame geometry instead of the default tracer frame. */
  frame?: CaptureStubFrame;
  /** Paint one solid colour: the uniform frame P2-D-12 must reject. */
  uniform?: boolean;
  /**
   * Paint a legitimate but sparse page: white everywhere plus one small dark
   * block outside the old 3×3 sample grid. The dense probe must ACCEPT it
   * (regression for the blank-probe false positive found in manual UAT).
   */
  sparse?: boolean;
  /**
   * Provocation instead of a frame:
   *  - `prompt-rejected` — `getDisplayMedia` rejects with `NotAllowedError`
   *  - `non-tab-surface` — a track reporting `displaySurface: 'window'`
   *  - `beyond-cap` — an ImageData over MAX_IMAGE_PIXELS (seam: canvas-free)
   */
  failure?: 'prompt-rejected' | 'non-tab-surface' | 'beyond-cap';
}

/** 4700×3600 = 16,920,000 px — above MAX_IMAGE_PIXELS (16,777,216). */
const BEYOND_CAP_FRAME: CaptureStubFrame = { width: 4700, height: 3600 };

/** GetDisplayMedia that always refuses — the user dismissing the picker. */
function promptRejectedStub(): string {
  return String.raw`(() => {
  var media = navigator.mediaDevices;
  if (media === undefined || media === null) {
    var stub = {};
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: stub });
    media = stub;
  }
  Object.defineProperty(media, 'getDisplayMedia', {
    configurable: true,
    value: function () {
      document.documentElement.setAttribute('data-wb-stub-invoked', 'prompt-rejected');
      return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    }
  });
})();`;
}

/**
 * GetDisplayMedia resolving a stream whose track reports a `window` surface —
 * exactly what the OQ-1 policy must refuse (Pitfall 7: DOM→bitmap mapping is
 * meaningless outside the tab). Only the surface check runs: the adapter
 * throws before any `<video>` is attached, so a plain object stands in for
 * the MediaStream.
 */
function nonTabSurfaceStub(): string {
  return String.raw`(() => {
  var track = {
    getSettings: function () { return { displaySurface: 'window' }; },
    stop: function () {}
  };
  var stream = {
    getVideoTracks: function () { return [track]; },
    getTracks: function () { return [track]; }
  };
  var media = navigator.mediaDevices;
  if (media === undefined || media === null) {
    var stub = {};
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: stub });
    media = stub;
  }
  Object.defineProperty(media, 'getDisplayMedia', {
    configurable: true,
    value: function () {
      document.documentElement.setAttribute('data-wb-stub-invoked', 'non-tab-surface');
      return Promise.resolve(stream);
    }
  });
})();`;
}

/** Frame/paint configuration shared by both tier builders. */
interface FrameStubConfig {
  frame?: CaptureStubFrame;
  /** Paint a single solid colour (P2-D-12 uniform probe). */
  uniform: boolean;
  /** Paint a white page with one corner detail (P2-D-12 sparse regression). */
  sparse: boolean;
  /** Return an ImageData straight over MAX_IMAGE_PIXELS (P2-D-12 oversize). */
  beyondCap: boolean;
}

/**
 * Build the media-tier init script: a faked `getDisplayMedia` returning a
 * `canvas.captureStream()` stream — the real `<video>` → `drawImage` path.
 */
function mediaStub(config: FrameStubConfig): string {
  const frame = config.frame ?? { width: STUB_FRAME_WIDTH, height: STUB_FRAME_HEIGHT };
  return String.raw`(() => {
  const paintFrame = ${PAINT_FRAME};
  ${RECORD_OBSERVATION}

  function markerRect() {
    const marker = document.querySelector('[data-capture-marker]');
    return marker === null ? null : marker.getBoundingClientRect();
  }

  function makeStream() {
    // CAP-04: the host must already be inline-hidden when capture starts.
    recordObservation('media');
    const canvas = document.createElement('canvas');
    canvas.width = ${frame.width};
    canvas.height = ${frame.height};
    paintFrame(canvas, markerRect(), ${config.uniform}, ${config.sparse});

    const stream = canvas.captureStream(30);
    const track = stream.getVideoTracks()[0];

    // Repaint on a short interval: the frame stays current, and the stream
    // keeps producing decoded frames for the <video> the adapter creates.
    const timer = window.setInterval(() => paintFrame(canvas, markerRect(), ${config.uniform}, ${config.sparse}), 80);
    if (track !== undefined && track !== null) {
      track.addEventListener('ended', () => window.clearInterval(timer));
    }
    return stream;
  }

  let media = navigator.mediaDevices;
  if (media === undefined || media === null) {
    const stub = {};
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: stub });
    media = stub;
  }

  Object.defineProperty(media, 'getDisplayMedia', {
    configurable: true,
    value: async () => makeStream(),
  });
})();`;
}

/**
 * Build the seam-tier init script: raw `ImageData` at the `CaptureSource`
 * seam (Pitfall 2) — probe → redact → encode → transport run fully real.
 */
function seamStub(config: FrameStubConfig): string {
  const frame = config.frame;
  const widthExpr =
    frame === undefined ? 'Math.max(2, Math.floor(window.innerWidth / 2))' : String(frame.width);
  const heightExpr =
    frame === undefined ? 'Math.max(2, Math.floor(window.innerHeight / 2))' : String(frame.height);
  const beyondCapReturn = config.beyondCap
    ? '// P2-D-12: area above MAX_IMAGE_PIXELS — allocated without a canvas so\n' +
      '  // no engine-side canvas cap can preempt the probe that must reject it.\n' +
      '        return new ImageData(width, height);'
    : '';
  const uniformPaint = config.uniform
    ? "context.fillStyle = '#808080';\n" +
      '        context.fillRect(0, 0, width, height);\n' +
      '        return context.getImageData(0, 0, width, height);'
    : '';
  const sparsePaint = config.sparse
    ? "context.fillStyle = '#ffffff';\n" +
      '        context.fillRect(0, 0, width, height);\n' +
      "        context.fillStyle = '#1b1f26';\n" +
      '        context.fillRect(2, 2, 4, 4);\n' +
      '        return context.getImageData(0, 0, width, height);'
    : '';
  return String.raw`(() => {
  ${RECORD_OBSERVATION}

  function install() {
    const host = document.querySelector('watchbug-host');
    if (host === null) return false;
    if (Object.prototype.hasOwnProperty.call(host, '__watchbugCaptureFrame')) return true;

    Object.defineProperty(host, '__watchbugCaptureFrame', {
      configurable: true,
      value: () => {
        // CAP-04: runs after the pipeline's beforeRead() assertion, so the
        // host must be inline-hidden at this instant too.
        recordObservation('seam');
        const width = ${widthExpr};
        const height = ${heightExpr};

        // IN-01: the oversize early-return must run BEFORE any canvas exists --
        // on an engine whose getContext() returns null above its area cap,
        // allocating first would throw and land the row in the capture-failed
        // state instead of the blank state it asserts.
        ${beyondCapReturn}

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (context === null) throw new Error('capture seam: a 2D canvas is unavailable');

        ${uniformPaint}
        ${sparsePaint}

        const scaleX = width / Math.max(1, window.innerWidth);
        const scaleY = height / Math.max(1, window.innerHeight);
        const gradient = context.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#16233a');
        gradient.addColorStop(0.5, '#6b4a7f');
        gradient.addColorStop(1, '#c9a227');
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);

        const marker = document.querySelector('[data-capture-marker]');
        if (marker !== null) {
          const rect = marker.getBoundingClientRect();
          context.fillStyle = '#ff00ff';
          context.fillRect(
            Math.floor(rect.left * scaleX),
            Math.floor(rect.top * scaleY),
            Math.max(1, Math.ceil(rect.width * scaleX)),
            Math.max(1, Math.ceil(rect.height * scaleY)),
          );
        }

        return context.getImageData(0, 0, width, height);
      },
    });
    return true;
  }

  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });
})();`;
}

/**
 * Install the engine's capture tier. Must run **before** the fixture
 * navigation: both tiers are document-start init scripts. The outgoing-image
 * recorder rides every capture stub so any row can decode the bytes that
 * actually left the browser (WebKit-safe).
 */
export async function installCaptureStub(
  page: Page,
  browserName: string,
  options: CaptureStubOptions = {},
): Promise<void> {
  // Provocations that replace getDisplayMedia entirely: no seam, no recorder
  // — these flows must never send, and the row asserts exactly that.
  if (options.failure === 'prompt-rejected') {
    await page.addInitScript({ content: promptRejectedStub() });
    return;
  }
  if (options.failure === 'non-tab-surface') {
    await page.addInitScript({ content: nonTabSurfaceStub() });
    return;
  }

  const beyondCap = options.failure === 'beyond-cap';
  const config: FrameStubConfig = {
    frame: options.frame ?? (beyondCap ? BEYOND_CAP_FRAME : undefined),
    uniform: options.uniform === true,
    sparse: options.sparse === true,
    beyondCap,
  };
  const tier = options.tier ?? captureStubTier(browserName);
  const content = tier === 'seam' ? seamStub(config) : mediaStub(config);
  await page.addInitScript({ content });
  await page.addInitScript({ content: OUTGOING_RECORDER });
}

/**
 * The exact image bytes the SDK sent on `POST /api/incidents`, as captured in
 * the page at the `fetch` boundary. Waits for the recorder (the Blob read is
 * async) — safe to call after the panel reached `Report sent ✓`.
 */
export async function readOutgoingImage(page: Page): Promise<Buffer> {
  await page.waitForFunction(
    () => {
      const raw = document.documentElement.getAttribute('data-wb-outgoing-image');
      return raw !== null && raw.length > 0;
    },
    null,
    { timeout: 15_000 },
  );
  const raw = await page.locator('html').getAttribute('data-wb-outgoing-image');
  if (raw === null) throw new Error('readOutgoingImage: no recorded outgoing image');
  return Buffer.from(raw, 'base64');
}

/**
 * Force the silent WebP→PNG fallback on **every** encode (M-3 / Pitfall 3):
 * an `image/webp` request is answered with PNG-typed bytes instead. The SDK
 * must detect this by sniffing the produced blob's `type` and route the report
 * as a `.png` part — this host's WebKit encodes real WebP, so no engine
 * reproduces the fallback naturally (research Pitfall 3, OQ-2).
 */
const FORCE_PNG_ENCODE = String.raw`(() => {
  var original = HTMLCanvasElement.prototype.toBlob;
  if (typeof original !== 'function') return;
  HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
    var requested = type === 'image/webp' ? 'image/png' : type;
    original.call(this, callback, requested, quality);
  };
})();`;

/** Install before the fixture navigation (document-start init script). */
export async function forcePngEncode(page: Page): Promise<void> {
  await page.addInitScript({ content: FORCE_PNG_ENCODE });
}

/** Resolve once the widget host exists (the async script tag has run). */
export async function waitForWidget(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('watchbug-host') !== null, null, {
    timeout: 10_000,
  });
}

/**
 * Click the launcher's centre with a **trusted** mouse event — the same
 * coordinates `elementFromPoint` uses in the WDG-05 rows. This is also a real
 * hit-test: if the host were buried under hostile content the click would miss
 * and the row would fail rather than pass vacuously.
 */
export async function clickLauncher(page: Page): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.mouse.click(viewport.width - 48, viewport.height - 48);
}

/** Everything the panel rows need, read from the open-mode shadow root. */
export interface WidgetProbe {
  hostPresent: boolean;
  /** `null` in the closed production bundle — the point of INV-01. */
  shadowRootOpen: boolean;
  panelHidden: string | null;
  panelWidth: number;
  headline: string;
  hint: string;
  reason: string;
  reasonLength: number;
  headlineRole: string | null;
  textRole: string | null;
  textLive: string | null;
  /** The whole `.actions` row — hidden for every non-terminal state. */
  actionsVisible: boolean;
  retryVisible: boolean;
  dismissVisible: boolean;
  launcherWidth: number;
  launcherHeight: number;
  launcherDisabled: boolean;
  hostStyle: string;
  hostDisplay: string;
  hostPosition: string;
  hostZIndex: string;
  /** The router's screen: `idle | status | composer | editor | review`. */
  screen: string | null;
  /** `section.composer` exists and is not hidden. */
  composerOpen: boolean;
  /** `data-wb-state` = `image | text-only | degraded`. */
  composerState: string | null;
  /** The live title-field value (what the user currently sees). */
  composerTitle: string;
  /** The pressed segment's `data-wb-type`. */
  composerType: string | null;
  /** The visible title-validation copy ('' while hidden). */
  composerError: string;
  /** `section.review` exists and is not hidden. */
  reviewOpen: boolean;
  /** The summary title row's value (the draft title exactly as reviewed). */
  reviewTitle: string;
  /** The summary type row's value — a localized string, never the wire id. */
  reviewType: string;
  /** The decoded outgoing artifact's dimensions, on the review canvas. */
  reviewImageWidth: number;
  reviewImageHeight: number;
  /** `.wrap[lang]` — the declared locale; must agree with the dictionary. */
  wrapLang: string | null;
  /** The composer overlay's rendered width in CSS pixels. */
  composerWidth: number;
  /** The composer heading's rendered copy (EN/ES assertions). */
  composerHeading: string;
  /** The in-field aria-invalid flag on the title input. */
  composerTitleAriaInvalid: string | null;
  /** Whether focus currently sits on the title input (blocked-review row). */
  titleFocused: boolean;
  /** The `{used} / {max}` readout ('' while hidden below 4,000 code points). */
  composerCounter: string;
  composerCounterShown: boolean;
  /** `canvas.composer-preview` backing-store size — 0 before any frame. */
  composerPreviewWidth: number;
  composerPreviewHeight: number;
  /** The degraded notice's heading/hint copy ('' when the zone has an image). */
  composerNoticeHeading: string;
  composerNoticeHint: string;
  /** Whether a VISIBLE `Attach image` action exists (footer or notice). */
  composerAttachVisible: boolean;
  /** Whether the `Continue with text only` action is visible. */
  composerContinueVisible: boolean;
  /** Whether the image zone itself is rendered (hidden in text-only state). */
  composerZoneVisible: boolean;
  /** The visible attach-refusal copy ('' while hidden). */
  composerAttachError: string;
  composerAttachErrorHint: string;
  /** The review summary's image row — 'No image' on a text-only report. */
  reviewNoImage: string;
}

/** Read the panel/launcher state. `probe` deliberately has no side effects. */
export async function probeWidget(page: Page): Promise<WidgetProbe> {
  return page.evaluate(() => {
    const host = document.querySelector('watchbug-host');
    const root = host?.shadowRoot ?? null;
    const panel = root?.querySelector('.panel') as HTMLElement | null;
    const headline = root?.querySelector('.headline') as HTMLElement | null;
    const hint = root?.querySelector('.hint') as HTMLElement | null;
    const reason = root?.querySelector('.reason') as HTMLElement | null;
    const text = root?.querySelector('.text') as HTMLElement | null;
    const actions = root?.querySelector('.actions') as HTMLElement | null;
    const actionsVisible = actions !== null && actions.style.display !== 'none';
    const retry = root?.querySelector('.action--primary') as HTMLElement | null;
    const dismiss = root?.querySelector('.action:not(.action--primary)') as HTMLElement | null;
    const launcher = root?.querySelector('button.launcher') as HTMLButtonElement | null;
    const launcherRect = launcher?.getBoundingClientRect() ?? null;
    const hostStyle = host?.getAttribute('style') ?? '';
    const computed = host === null || host === undefined ? null : getComputedStyle(host);

    const wrap = root?.querySelector('.wrap') as HTMLElement | null;
    const composerSection = root?.querySelector('section.composer') as HTMLElement | null;
    const reviewSection = root?.querySelector('section.review') as HTMLElement | null;
    const composerOpen =
      composerSection !== null && composerSection.getAttribute('data-hidden') !== 'true';
    const titleInput = root?.querySelector('.composer-title') as HTMLInputElement | null;
    const errorShown = root?.querySelector(
      'span.field-error[data-wb-error="title"][data-shown="true"]',
    ) as HTMLElement | null;
    const reviewCanvas = root?.querySelector('canvas.review-image') as HTMLCanvasElement | null;

    return {
      hostPresent: host !== null,
      shadowRootOpen: root !== null,
      panelHidden: panel?.getAttribute('data-hidden') ?? null,
      panelWidth: panel === null ? 0 : Math.round(panel.getBoundingClientRect().width),
      headline: headline?.textContent ?? '',
      hint: hint?.textContent ?? '',
      reason: reason?.textContent ?? '',
      reasonLength: (reason?.textContent ?? '').length,
      headlineRole: headline?.getAttribute('role') ?? null,
      textRole: text?.getAttribute('role') ?? null,
      textLive: text?.getAttribute('aria-live') ?? null,
      actionsVisible,
      retryVisible: retry !== null && retry.style.display !== 'none',
      dismissVisible: dismiss !== null && dismiss.style.display !== 'none',
      launcherWidth: launcherRect === null ? 0 : Math.round(launcherRect.width),
      launcherHeight: launcherRect === null ? 0 : Math.round(launcherRect.height),
      launcherDisabled: launcher?.disabled ?? false,
      hostStyle,
      hostDisplay: computed?.display ?? '',
      hostPosition: computed?.position ?? '',
      hostZIndex: computed?.zIndex ?? '',
      screen: wrap?.getAttribute('data-wb-screen') ?? null,
      composerOpen,
      composerState: composerSection?.getAttribute('data-wb-state') ?? null,
      composerTitle: titleInput?.value ?? '',
      composerType:
        root?.querySelector('button.segment[aria-pressed="true"]')?.getAttribute('data-wb-type') ??
        null,
      composerError: errorShown?.textContent ?? '',
      reviewOpen:
        reviewSection !== null && reviewSection.getAttribute('data-hidden') !== 'true',
      reviewTitle:
        root?.querySelector('[data-wb-summary="title"] .summary-value')?.textContent ?? '',
      reviewType:
        root?.querySelector('[data-wb-summary="type"] .summary-value')?.textContent ?? '',
      reviewImageWidth: reviewCanvas?.width ?? 0,
      reviewImageHeight: reviewCanvas?.height ?? 0,
      wrapLang: wrap?.getAttribute('lang') ?? null,
      composerWidth:
        composerSection === null ? 0 : Math.round(composerSection.getBoundingClientRect().width),
      composerHeading:
        (root?.querySelector('.composer-heading') as HTMLElement | null)?.textContent ?? '',
      composerTitleAriaInvalid: titleInput?.getAttribute('aria-invalid') ?? null,
      titleFocused:
        titleInput !== null && root !== null && root.activeElement === titleInput,
      composerCounter:
        (root?.querySelector('.composer-counter') as HTMLElement | null)?.textContent ?? '',
      composerCounterShown:
        root?.querySelector('.composer-counter[data-shown="true"]') !== null,
      composerPreviewWidth:
        (root?.querySelector('canvas.composer-preview') as HTMLCanvasElement | null)?.width ?? 0,
      composerPreviewHeight:
        (root?.querySelector('canvas.composer-preview') as HTMLCanvasElement | null)?.height ?? 0,
      composerNoticeHeading:
        (root?.querySelector('.zone-notice-heading') as HTMLElement | null)?.textContent ?? '',
      composerNoticeHint:
        (root?.querySelector('.zone-notice-hint') as HTMLElement | null)?.textContent ?? '',
      composerAttachVisible:
        [...(root?.querySelectorAll('button.composer-attach') ?? [])].some(
          (button) => button.getBoundingClientRect().width > 0,
        ),
      composerContinueVisible:
        (root?.querySelector('button.composer-continue-text')?.getBoundingClientRect().width ?? 0) >
        0,
      composerZoneVisible:
        (root?.querySelector('.image-zone')?.getBoundingClientRect().width ?? 0) > 0,
      composerAttachError:
        (root?.querySelector(
          'span.field-error[data-wb-error="attach"][data-shown="true"]',
        ) as HTMLElement | null)?.textContent ?? '',
      composerAttachErrorHint:
        (root?.querySelector(
          'span.field-error[data-wb-error="attach-hint"][data-shown="true"]',
        ) as HTMLElement | null)?.textContent ?? '',
      reviewNoImage:
        (root?.querySelector('[data-wb-summary="image"] .summary-value') as HTMLElement | null)
          ?.textContent ?? '',
    };
  });
}

/** Wait until the panel's headline equals `expected` exactly. */
export async function waitForHeadline(page: Page, expected: string, timeout = 10_000): Promise<void> {
  await page.waitForFunction(
    (value) => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      const headline = root?.querySelector('.headline');
      return headline?.textContent === value;
    },
    expected,
    { timeout },
  );
}

/**
 * Record every distinct headline the panel shows. Installed before the click:
 * `Capturing…` and `Sending…` can be shorter-lived than a poll interval, and a
 * MutationObserver sees each render synchronously. The recording lives in an
 * attribute (host-page instrumentation), never on `window`.
 */
export async function collectHeadlines(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const headline = root?.querySelector('.headline');
    if (headline === null || headline === undefined) throw new Error('collectHeadlines: panel missing');

    const seen: string[] = [];
    const record = (): void => {
      const text = headline.textContent ?? '';
      if (seen[seen.length - 1] !== text) seen.push(text);
      document.documentElement.setAttribute('data-wb-headlines', JSON.stringify(seen));
    };
    record();
    const observer = new MutationObserver(record);
    observer.observe(headline, { childList: true, characterData: true, subtree: true });
  });
}

/** The headline sequence recorded by `collectHeadlines`. */
export async function readHeadlines(page: Page): Promise<string[]> {
  const raw = await page.locator('html').getAttribute('data-wb-headlines');
  return raw === null ? [] : (JSON.parse(raw) as string[]);
}

/* ------------------------------------------------------------------------- */
/* Host/stacking probe — WDG-02 / WDG-05                                      */
/* ------------------------------------------------------------------------- */

export interface HostProbe {
  hostPresent: boolean;
  /** The UI-SPEC ordering contract: host is the last child of documentElement. */
  hostLastChild: boolean;
  shadowRootOpen: boolean;
  hostStyle: string;
  display: string;
  position: string;
  zIndex: string;
  pointerEvents: string;
  launcherFound: boolean;
  launcherWidth: number;
  launcherHeight: number;
  rightInset: number;
  bottomInset: number;
  launcherDisabled: boolean;
  /** `document.elementFromPoint` at the launcher centre → the widget host? */
  documentHitsHost: boolean;
  /** `shadowRoot.elementFromPoint` at the launcher centre → inside `button.launcher`? */
  rootHitsLauncher: boolean;
  /** The element the shadow root actually hit, for failure messages. */
  rootHitTag: string;
  /** The element the document actually hit, for failure messages. */
  documentHitTag: string;
}

/** Read the host element's geometry, inline contract and stacking result. */
export async function probeHost(page: Page): Promise<HostProbe> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  return page.evaluate(
    ({ x, y }) => {
      const host = document.querySelector('watchbug-host');
      const root = host?.shadowRoot ?? null;
      const launcher = root?.querySelector('button.launcher') as HTMLButtonElement | null;
      const rect = launcher?.getBoundingClientRect() ?? null;
      const computed = host === null ? null : getComputedStyle(host);
      const documentHit = document.elementFromPoint(x, y);
      const rootHit = root?.elementFromPoint(x, y) ?? null;
      return {
        hostPresent: host !== null,
        hostLastChild: host !== null && document.documentElement.lastElementChild === host,
        shadowRootOpen: root !== null,
        hostStyle: host?.getAttribute('style') ?? '',
        display: computed?.display ?? '',
        position: computed?.position ?? '',
        zIndex: computed?.zIndex ?? '',
        pointerEvents: computed?.pointerEvents ?? '',
        launcherFound: launcher !== null,
        launcherWidth: rect === null ? 0 : Math.round(rect.width),
        launcherHeight: rect === null ? 0 : Math.round(rect.height),
        rightInset: rect === null ? -1 : Math.round(window.innerWidth - rect.right),
        bottomInset: rect === null ? -1 : Math.round(window.innerHeight - rect.bottom),
        launcherDisabled: launcher?.disabled ?? false,
        documentHitsHost: documentHit === host,
        // The launcher's centre is covered by its own SVG glyph, so a strict
        // identity check would fail on a correctly stacked widget. Containment
        // is the real contract: the hit lands inside the launcher button and
        // nowhere else in the shadow tree.
        rootHitsLauncher: launcher !== null && rootHit !== null && launcher.contains(rootHit),
        rootHitTag: rootHit?.tagName.toLowerCase() ?? '',
        documentHitTag: documentHit?.tagName.toLowerCase() ?? '',
      };
    },
    { x: viewport.width - 48, y: viewport.height - 48 },
  );
}
