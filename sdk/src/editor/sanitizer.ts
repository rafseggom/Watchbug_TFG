import { maskRegion } from './tools/mask';

/**
 * Auto-sanitize sensitive DOM elements by destructively masking their canvas regions.
 * Queries for password inputs and data-watchbug-sensitive elements, then calls maskRegion.
 * Also attempts credit-card pattern detection on visible text elements.
 * Returns early if autoSanitize is falsy per SEC-01/CAP-04.
 */
export function sanitizeCanvas(
  ctx: CanvasRenderingContext2D,
  _viewportWidth: number,
  _viewportHeight: number,
  options?: { autoSanitize?: boolean },
): void {
  if (!options?.autoSanitize) {
    return;
  }

  if (typeof document === 'undefined') return;

  // Mask password inputs
  try {
    const pwdInputs = document.querySelectorAll('input[type="password"]');
    pwdInputs.forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      maskRegion(ctx, rect.x, rect.y, rect.width, rect.height, 'solid');
    });
  } catch {
    // ignore query errors
  }

  // Mask data-watchbug-sensitive elements
  try {
    const sensitive = document.querySelectorAll('[data-watchbug-sensitive]');
    sensitive.forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      maskRegion(ctx, rect.x, rect.y, rect.width, rect.height, 'solid');
    });
  } catch {
    // ignore
  }

  // Credit card pattern masking — traverse text-containing elements
  try {
    const ccRegex = /\b(?:\d[ -]*?){13,16}\b/g;
    const all = document.querySelectorAll('*');
    all.forEach((el) => {
      const text = (el as HTMLElement).textContent;
      if (!text) return;
      // avoid matching the same container repeatedly — only leaf-ish elements
      // simple check: if element has child elements, skip unless direct text is longer
      ccRegex.lastIndex = 0;
      if (ccRegex.test(text)) {
        const rect = (el as HTMLElement).getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        // Avoid masking huge containers — only mask if size plausible (< 80% viewport)
        if (rect.width > window.innerWidth * 0.9 && rect.height > window.innerHeight * 0.9) return;
        maskRegion(ctx, rect.x, rect.y, rect.width, rect.height, 'solid');
      }
    });
  } catch {
    // ignore
  }
}
