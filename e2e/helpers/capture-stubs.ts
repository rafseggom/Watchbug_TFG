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
 * Frames are deliberately **non-uniform**: `blankProbe()` samples a 3×3 grid
 * and refuses a frame whose samples are byte-identical, so a solid-colour stub
 * would exercise the blank failure state instead of the tracer.
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
): void {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('capture stub: a 2D canvas is unavailable');
  const width = canvas.width;
  const height = canvas.height;
  const scaleX = width / Math.max(1, window.innerWidth);
  const scaleY = height / Math.max(1, window.innerHeight);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#16233a');
  gradient.addColorStop(0.5, '#6b4a7f');
  gradient.addColorStop(1, '#c9a227');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  // Structured blocks give the blank probe nine genuinely different samples.
  const palette = ['#1e7a46', '#b3261e', '#2f6feb', '#eef0f4', '#5b6472', '#f2c14e'];
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

/** The media-tier init script (runs at document-start on every navigation). */
const MEDIA_STUB = String.raw`(() => {
  const paintFrame = ${PAINT_FRAME};

  function markerRect() {
    const marker = document.querySelector('[data-capture-marker]');
    return marker === null ? null : marker.getBoundingClientRect();
  }

  function makeStream() {
    const canvas = document.createElement('canvas');
    canvas.width = ${STUB_FRAME_WIDTH};
    canvas.height = ${STUB_FRAME_HEIGHT};
    paintFrame(canvas, markerRect());

    const stream = canvas.captureStream(30);
    const track = stream.getVideoTracks()[0];

    // Repaint on a short interval: the frame stays current, and the stream
    // keeps producing decoded frames for the <video> the adapter creates.
    const timer = window.setInterval(() => paintFrame(canvas, markerRect()), 80);
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

/** The seam-tier init script: installs raw-ImageData capture on the host. */
const SEAM_STUB = String.raw`(() => {
  function install() {
    const host = document.querySelector('watchbug-host');
    if (host === null) return false;
    if (Object.prototype.hasOwnProperty.call(host, '__watchbugCaptureFrame')) return true;

    Object.defineProperty(host, '__watchbugCaptureFrame', {
      configurable: true,
      value: () => {
        const width = Math.max(2, Math.floor(window.innerWidth / 2));
        const height = Math.max(2, Math.floor(window.innerHeight / 2));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (context === null) throw new Error('capture seam: a 2D canvas is unavailable');

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

/**
 * Install the engine's capture tier. Must run **before** the fixture
 * navigation: both tiers are document-start init scripts.
 */
export async function installCaptureStub(page: Page, browserName: string): Promise<void> {
  const content = captureStubTier(browserName) === 'seam' ? SEAM_STUB : MEDIA_STUB;
  await page.addInitScript({ content });
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
  retryVisible: boolean;
  dismissVisible: boolean;
  launcherWidth: number;
  launcherHeight: number;
  launcherDisabled: boolean;
  hostStyle: string;
  hostDisplay: string;
  hostPosition: string;
  hostZIndex: string;
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
    const retry = root?.querySelector('.action--primary') as HTMLElement | null;
    const dismiss = root?.querySelector('.action:not(.action--primary)') as HTMLElement | null;
    const launcher = root?.querySelector('button.launcher') as HTMLButtonElement | null;
    const launcherRect = launcher?.getBoundingClientRect() ?? null;
    const hostStyle = host?.getAttribute('style') ?? '';
    const computed = host === null || host === undefined ? null : getComputedStyle(host);

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
      retryVisible: retry !== null && retry.style.display !== 'none',
      dismissVisible: dismiss !== null && dismiss.style.display !== 'none',
      launcherWidth: launcherRect === null ? 0 : Math.round(launcherRect.width),
      launcherHeight: launcherRect === null ? 0 : Math.round(launcherRect.height),
      launcherDisabled: launcher?.disabled ?? false,
      hostStyle,
      hostDisplay: computed?.display ?? '',
      hostPosition: computed?.position ?? '',
      hostZIndex: computed?.zIndex ?? '',
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
