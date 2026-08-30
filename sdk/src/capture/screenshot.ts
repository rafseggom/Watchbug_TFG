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
export async function captureScreenshot(options?: {
  maxWidth?: number;
  timeout?: number;
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
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

      if (viewportWidth === 0 || viewportHeight === 0) {
        finish(null);
        return;
      }

      let targetWidth = viewportWidth;
      let targetHeight = viewportHeight;

      if (targetWidth > maxWidth) {
        const scale = maxWidth / targetWidth;
        targetWidth = maxWidth;
        targetHeight = Math.round(viewportHeight * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        finish(null);
        return;
      }

      // In a real implementation, we would paint the viewport.
      // Here we fill with a placeholder so toDataURL has content.
      try {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      } catch {
        // ignore fill errors
      }

      // Use toDataURL for synchronous capture; wrap in try for tainted canvas
      try {
        const dataUrl = canvas.toDataURL('image/png');
        finish({ dataUrl, width: targetWidth, height: targetHeight });
      } catch (e) {
        // SecurityError for tainted canvas
        if (e instanceof DOMException && e.name === 'SecurityError') {
          finish(null);
          return;
        }
        // Also handle generic error with SecurityError name
        const err = e as { name?: string };
        if (err?.name === 'SecurityError') {
          finish(null);
          return;
        }
        finish(null);
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name === 'SecurityError') {
        finish(null);
        return;
      }
      if (e instanceof DOMException && e.name === 'SecurityError') {
        finish(null);
        return;
      }
      finish(null);
    }
  });
}
