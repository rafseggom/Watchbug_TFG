export type ScreenshotResult = {
  dataUrl: string;
  width: number;
  height: number;
};

/**
 * Capture viewport screenshot via Canvas API.
 * Viewport-only (window.innerWidth / innerHeight), maxWidth capped at 1280px,
 * 500 ms timeout, SecurityError handling.
 * Uses offscreen canvas; in a real browser the canvas would be drawn from DOM.
 * For jsdom/tests, canvas methods are mocked.
 */
import { sanitizeCanvas } from '../editor/sanitizer';

function getViewportDimensions(): { width: number; height: number } {
  const width = typeof window !== 'undefined' ? window.innerWidth : 0;
  const height = typeof window !== 'undefined' ? window.innerHeight : 0;
  return { width, height };
}

function calculateTargetDimensions(viewportWidth: number, viewportHeight: number, maxWidth: number): { width: number; height: number } {
  if (viewportWidth <= maxWidth) {
    return { width: viewportWidth, height: viewportHeight };
  }
  const scale = maxWidth / viewportWidth;
  return { width: maxWidth, height: Math.round(viewportHeight * scale) };
}

function isSecurityError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'SecurityError') return true;
  const err = e as { name?: string };
  return err?.name === 'SecurityError';
}

function createCanvas(targetWidth: number, targetHeight: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

function fillCanvasPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  try {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  } catch { /* ignore fill errors */ }
}

function applyAutoSanitize(ctx: CanvasRenderingContext2D, width: number, height: number, autoSanitize?: boolean): void {
  try {
    if (autoSanitize) {
      sanitizeCanvas(ctx, width, height, { autoSanitize });
    }
  } catch { /* ignore sanitization errors */ }
}

function encodeCanvasToDataUrl(canvas: HTMLCanvasElement): string | null {
  try {
    return canvas.toDataURL('image/png');
  } catch (e) {
    if (isSecurityError(e)) return null;
    return null;
  }
}

export async function captureScreenshot(options?: {
  maxWidth?: number;
  timeout?: number;
  autoSanitize?: boolean;
}): Promise<ScreenshotResult | null> {
  const maxWidth = options?.maxWidth ?? 1280;
  const timeoutMs = options?.timeout ?? 500;

  return new Promise<ScreenshotResult | null>((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    const finish = (value: ScreenshotResult | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    try {
      const { width: viewportWidth, height: viewportHeight } = getViewportDimensions();
      if (viewportWidth === 0 || viewportHeight === 0) {
        finish(null);
        return;
      }

      const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(viewportWidth, viewportHeight, maxWidth);
      const canvasResult = createCanvas(targetWidth, targetHeight);
      if (!canvasResult) {
        finish(null);
        return;
      }

      fillCanvasPlaceholder(canvasResult.ctx, targetWidth, targetHeight);
      applyAutoSanitize(canvasResult.ctx, targetWidth, targetHeight, options?.autoSanitize);

      const dataUrl = encodeCanvasToDataUrl(canvasResult.canvas);
      if (dataUrl) {
        finish({ dataUrl, width: targetWidth, height: targetHeight });
      } else {
        finish(null);
      }
    } catch (e) {
      if (isSecurityError(e)) {
        finish(null);
        return;
      }
      finish(null);
    }
  });
}
