import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeCanvas } from '../../sdk/src/editor/sanitizer';
import * as maskMod from '../../sdk/src/editor/tools/mask';

function makeMockCtx() {
  return {
    canvas: { width: 800, height: 600 },
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(16), width: 4, height: 4 } as unknown as ImageData)),
    putImageData: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('sanitizeCanvas', () => {
  let maskSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    maskSpy = vi.spyOn(maskMod, 'maskRegion').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('sanitizeCanvas masks password input elements', () => {
    const ctx = makeMockCtx();
    const input = document.createElement('input');
    input.type = 'password';
    document.body.appendChild(input);
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({ x: 10, y: 20, width: 100, height: 20, top: 20, left: 10, right: 110, bottom: 40, toJSON: () => {} } as unknown as DOMRect);
    sanitizeCanvas(ctx, 800, 600, { autoSanitize: true });
    expect(maskSpy).toHaveBeenCalledWith(ctx, 10, 20, 100, 20, 'solid');
  });

  it('sanitizeCanvas masks data-watchbug-sensitive elements', () => {
    const ctx = makeMockCtx();
    const div = document.createElement('div');
    div.setAttribute('data-watchbug-sensitive', 'true');
    document.body.appendChild(div);
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({ x: 5, y: 5, width: 50, height: 50, top: 5, left: 5, right: 55, bottom: 55, toJSON: () => {} } as unknown as DOMRect);
    sanitizeCanvas(ctx, 800, 600, { autoSanitize: true });
    expect(maskSpy).toHaveBeenCalledWith(ctx, 5, 5, 50, 50, 'solid');
  });

  it('sanitizeCanvas does nothing when autoSanitize is false', () => {
    const ctx = makeMockCtx();
    const input = document.createElement('input');
    input.type = 'password';
    document.body.appendChild(input);
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10, toJSON: () => {} } as unknown as DOMRect);
    sanitizeCanvas(ctx, 800, 600, { autoSanitize: false });
    expect(maskSpy).not.toHaveBeenCalled();
    sanitizeCanvas(ctx, 800, 600);
    expect(maskSpy).not.toHaveBeenCalled();
    sanitizeCanvas(ctx, 800, 600, {});
    expect(maskSpy).not.toHaveBeenCalled();
  });

  it('sanitizeCanvas calls maskRegion for each sensitive element', () => {
    const ctx = makeMockCtx();
    const pwd1 = document.createElement('input');
    pwd1.type = 'password';
    const pwd2 = document.createElement('input');
    pwd2.type = 'password';
    const sens = document.createElement('div');
    sens.setAttribute('data-watchbug-sensitive', '');
    document.body.appendChild(pwd1);
    document.body.appendChild(pwd2);
    document.body.appendChild(sens);
    vi.spyOn(pwd1, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10, toJSON: () => {} } as unknown as DOMRect);
    vi.spyOn(pwd2, 'getBoundingClientRect').mockReturnValue({ x: 20, y: 20, width: 10, height: 10, top: 20, left: 20, right: 30, bottom: 30, toJSON: () => {} } as unknown as DOMRect);
    vi.spyOn(sens, 'getBoundingClientRect').mockReturnValue({ x: 40, y: 40, width: 10, height: 10, top: 40, left: 40, right: 50, bottom: 50, toJSON: () => {} } as unknown as DOMRect);
    sanitizeCanvas(ctx, 800, 600, { autoSanitize: true });
    expect(maskSpy).toHaveBeenCalledTimes(3);
  });
});
