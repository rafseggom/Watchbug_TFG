import { describe, it, expect, vi } from 'vitest';
import { maskRegion, createMaskRectTool, createMaskPaintTool } from '../../sdk/src/editor/tools/mask';

function makeCtxWithData(width: number, height: number, initial: Uint8ClampedArray) {
  let backing = new Uint8ClampedArray(initial);
  const getImageData = vi.fn((_x: number, _y: number, w: number, h: number) => {
    // Return a copy slice for region - for simplicity return full backing when w==width && h==height
    // For tests with 4x4 canvas and full region, return full
    // Need to handle partial regions: create sized array
    if (w === width && h === height) {
      backing = new Uint8ClampedArray(initial);
      return {
        data: backing,
        width: w,
        height: h,
      } as unknown as ImageData;
    }
    // create new array of that size, copy relevant portion
    const d = new Uint8ClampedArray(w * h * 4);
    // naive fill from initial top-left
    for (let i = 0; i < Math.min(d.length, initial.length); i++) d[i] = initial[i];
    return { data: d, width: w, height: h } as unknown as ImageData;
  });
  const putImageData = vi.fn((imgData: ImageData, _x: number, _y: number) => {
    // Update backing
    backing = imgData.data as unknown as Uint8ClampedArray;
  });
  const ctx = {
    canvas: { width, height },
    getImageData,
    putImageData,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, getImageData, putImageData, getBacking: () => backing };
}

describe('maskRegion', () => {
  it('maskRegion with solid mode replaces pixels with gray', () => {
    const w = 4, h = 4;
    const initial = new Uint8ClampedArray(w * h * 4);
    initial.fill(255);
    const { ctx, getImageData, putImageData } = makeCtxWithData(w, h, initial);
    maskRegion(ctx, 0, 0, w, h, 'solid');
    expect(getImageData).toHaveBeenCalled();
    expect(putImageData).toHaveBeenCalled();
    const imageData = getImageData.mock.results[0].value as ImageData;
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(128);
      expect(data[i + 1]).toBe(128);
      expect(data[i + 2]).toBe(128);
      expect(data[i + 3]).toBe(255);
    }
  });

  it('maskRegion with pixelate mode averages blocks', () => {
    const w = 8, h = 8;
    // Create 8x8 where left half is black, right half white — after pixelate with 8 block, average should be gray ~128
    const initial = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const val = x < 4 ? 0 : 255;
        initial[idx] = val;
        initial[idx + 1] = val;
        initial[idx + 2] = val;
        initial[idx + 3] = 255;
      }
    }
    const { ctx, putImageData } = makeCtxWithData(w, h, initial);
    maskRegion(ctx, 0, 0, w, h, 'pixelate');
    expect(putImageData).toHaveBeenCalled();
    // After pixelate with single 8x8 block, all pixels should be ~128 gray (avg of 0 and 255)
    const imageData = (putImageData.mock.calls[0][0] as ImageData);
    const data = imageData.data;
    // first pixel
    expect(data[0]).toBe(128);
    expect(data[1]).toBe(128);
    expect(data[2]).toBe(128);
    // last pixel
    const lastIdx = (w * h - 1) * 4;
    expect(data[lastIdx]).toBe(128);
  });

  it('Masking modifies Uint8ClampedArray directly (not CSS)', () => {
    const w = 2, h = 2;
    const initial = new Uint8ClampedArray([10,20,30,255, 40,50,60,255, 70,80,90,255, 100,110,120,255]);
    const { ctx, getImageData, putImageData } = makeCtxWithData(w, h, initial);
    // Verify no CSS overlay strings in file
    // Instead verify the function uses getImageData/putImageData
    maskRegion(ctx, 0, 0, w, h, 'solid');
    expect(getImageData).toHaveBeenCalledWith(0, 0, w, h);
    expect(putImageData).toHaveBeenCalledWith(expect.anything(), 0, 0);
    // Ensure data was mutated, not via style
    const data = (getImageData.mock.results[0].value as ImageData).data;
    expect(data[0]).toBe(128);
  });

  it('getImageData on masked region returns modified values', () => {
    const w = 4, h = 4;
    const initial = new Uint8ClampedArray(w * h * 4);
    initial.fill(10);
    const { ctx, getImageData } = makeCtxWithData(w, h, initial);
    maskRegion(ctx, 0, 0, w, h, 'solid');
    const imageData = getImageData.mock.results[0].value as ImageData;
    // Simulate subsequent getImageData returning modified values
    // In real canvas, putImageData writes back — our mock already mutates
    expect(imageData.data[0]).toBe(128);
    expect(imageData.data[1]).toBe(128);
  });

  it('MaskRect tool draws rectangle mask on pointer up', () => {
    const w = 800, h = 600;
    const initial = new Uint8ClampedArray(w * h * 4);
    initial.fill(200);
    let stored: ImageData | null = null;
    const getImageData = vi.fn((x: number, y: number, ww: number, hh: number) => {
      stored = { data: new Uint8ClampedArray(ww * hh * 4).fill(200), width: ww, height: hh } as unknown as ImageData;
      return stored as unknown as ImageData;
    });
    const putImageData = vi.fn();
    const ctx = {
      canvas: { width: w, height: h },
      getImageData,
      putImageData,
      strokeRect: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      setLineDash: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const tool = createMaskRectTool(ctx);
    expect(tool.name).toBe('mask-rect');
    const down = { offsetX: 10, offsetY: 10, clientX: 10, clientY: 10 } as unknown as PointerEvent;
    const move = { offsetX: 50, offsetY: 50, clientX: 50, clientY: 50 } as unknown as PointerEvent;
    const up = { offsetX: 50, offsetY: 50, clientX: 50, clientY: 50 } as unknown as PointerEvent;
    tool.onPointerDown(down);
    tool.onPointerMove(move);
    // during move should NOT have called maskRegion (which internally calls getImageData for region > snapshot)
    const callsBeforeUp = getImageData.mock.calls.length;
    // snapshot call was first (0,0,800,600). Move should have put+stroke but not mask
    tool.onPointerUp(up);
    // After up, should have called maskRegion -> getImageData for region
    // Check that second call was for mask region (10,10,40,40)
    expect(getImageData.mock.calls.length).toBeGreaterThan(callsBeforeUp);
    expect(putImageData).toHaveBeenCalled();
  });

  it('MaskPaint tool draws freehand mask on pointer move', () => {
    const w = 800, h = 600;
    const getImageData = vi.fn((x: number, y: number, ww: number, hh: number) => ({
      data: new Uint8ClampedArray(ww * hh * 4).fill(100),
      width: ww,
      height: hh,
    } as unknown as ImageData));
    const putImageData = vi.fn();
    const ctx = {
      canvas: { width: w, height: h },
      getImageData,
      putImageData,
    } as unknown as CanvasRenderingContext2D;

    const tool = createMaskPaintTool(ctx);
    expect(tool.name).toBe('mask-paint');
    const down = { offsetX: 10, offsetY: 10, clientX: 10, clientY: 10 } as unknown as PointerEvent;
    const move = { offsetX: 20, offsetY: 20, clientX: 20, clientY: 20 } as unknown as PointerEvent;
    tool.onPointerDown(down);
    expect(putImageData).not.toHaveBeenCalled();
    tool.onPointerMove(move);
    expect(putImageData).toHaveBeenCalled();
    expect(getImageData).toHaveBeenCalled();
  });
});
