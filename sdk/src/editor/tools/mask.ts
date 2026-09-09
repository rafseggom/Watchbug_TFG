export type Tool = {
  name: string;
  onPointerDown(e: PointerEvent): void;
  onPointerMove(e: PointerEvent): void;
  onPointerUp(e: PointerEvent): void;
  onPointerLeave(e: PointerEvent): void;
};

function getPos(e: PointerEvent, target?: HTMLElement): { x: number; y: number } {
  const anyE = e as unknown as { offsetX?: number; offsetY?: number; clientX: number; clientY: number };
  if (typeof anyE.offsetX === 'number' && typeof anyE.offsetY === 'number' && target) {
    return { x: anyE.offsetX, y: anyE.offsetY };
  }
  if (target) {
    const rect = target.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  return { x: e.clientX, y: e.clientY };
}

/**
 * Destructively mask a region of the canvas.
 * - solid: replace all pixels with opaque gray (128,128,128,255)
 * - pixelate: divide into 8x8 blocks, average each block's color
 * Uses getImageData -> modify Uint8ClampedArray -> putImageData per SEC-02/EDT-02
 */
export function maskRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  mode: 'pixelate' | 'solid' = 'solid',
): void {
  const { nx, ny, nw, nh } = normalizeAndClampCoordinates(ctx, x, y, width, height);
  if (nw === 0 || nh === 0) return;

  const imageData = ctx.getImageData(nx, ny, nw, nh);
  const data = imageData.data;

  if (mode === 'solid') {
    applySolidMask(data);
  } else if (mode === 'pixelate') {
    applyPixelateMask(data, imageData.width, imageData.height);
  }

  ctx.putImageData(imageData, nx, ny);
}

function normalizeAndClampCoordinates(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): { nx: number; ny: number; nw: number; nh: number } {
  let nx = Math.round(x);
  let ny = Math.round(y);
  let nw = Math.round(width);
  let nh = Math.round(height);

  if (nw < 0) {
    nx += nw;
    nw = Math.abs(nw);
  }
  if (nh < 0) {
    ny += nh;
    nh = Math.abs(nh);
  }

  try {
    const canvas = ctx.canvas as HTMLCanvasElement;
    if (canvas && typeof canvas.width === 'number' && typeof canvas.height === 'number') {
      if (nx < 0) {
        nw += nx;
        nx = 0;
      }
      if (ny < 0) {
        nh += ny;
        ny = 0;
      }
      if (nx + nw > canvas.width) nw = canvas.width - nx;
      if (ny + nh > canvas.height) nh = canvas.height - ny;
      if (nw <= 0 || nh <= 0) return { nx: 0, ny: 0, nw: 0, nh: 0 };
    }
  } catch { /* ignore clamping errors */ }

  return { nx, ny, nw, nh };
}

function applySolidMask(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }
}

function applyPixelateMask(data: Uint8ClampedArray, width: number, height: number): void {
  const blockSize = 8;
  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      const blockW = Math.min(blockSize, width - bx);
      const blockH = Math.min(blockSize, height - by);
      const avg = calculateBlockAverage(data, bx, by, blockW, blockH, width);
      applyBlockAverage(data, bx, by, blockW, blockH, width, avg);
    }
  }
}

function calculateBlockAverage(
  data: Uint8ClampedArray,
  startX: number,
  startY: number,
  blockW: number,
  blockH: number,
  stride: number,
): { r: number; g: number; b: number; a: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let count = 0;

  for (let py = 0; py < blockH; py++) {
    for (let px = 0; px < blockW; px++) {
      const idx = ((startY + py) * stride + (startX + px)) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      a += data[idx + 3];
      count++;
    }
  }

  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
    a: Math.round(a / count),
  };
}

function applyBlockAverage(
  data: Uint8ClampedArray,
  startX: number,
  startY: number,
  blockW: number,
  blockH: number,
  stride: number,
  avg: { r: number; g: number; b: number; a: number },
): void {
  for (let py = 0; py < blockH; py++) {
    for (let px = 0; px < blockW; px++) {
      const idx = ((startY + py) * stride + (startX + px)) * 4;
      data[idx] = avg.r;
      data[idx + 1] = avg.g;
      data[idx + 2] = avg.b;
      data[idx + 3] = avg.a;
    }
  }
}

export function createMaskRectTool(ctx: CanvasRenderingContext2D): Tool {
  let startX = 0;
  let startY = 0;
  let drawing = false;
  let snapshot: ImageData | null = null;
  const canvasEl = ctx.canvas as HTMLCanvasElement;

  return {
    name: 'mask-rect',
    onPointerDown(e: PointerEvent) {
      const { x, y } = getPos(e, canvasEl as unknown as HTMLElement);
      startX = x;
      startY = y;
      drawing = true;
      try {
        snapshot = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      } catch {
        snapshot = null;
      }
    },
    onPointerMove(e: PointerEvent) {
      if (!drawing) return;
      const { x, y } = getPos(e, canvasEl as unknown as HTMLElement);
      try {
        if (snapshot) ctx.putImageData(snapshot, 0, 0);
      } catch {}
      // preview rectangle — dashed border, does not modify pixels yet
      ctx.save?.();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 1;
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash([6, 4]);
      const w = x - startX;
      const h = y - startY;
      ctx.strokeRect(startX, startY, w, h);
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
      ctx.restore?.();
    },
    onPointerUp(e: PointerEvent) {
      if (!drawing) return;
      drawing = false;
      const { x, y } = getPos(e, canvasEl as unknown as HTMLElement);
      try {
        if (snapshot) ctx.putImageData(snapshot, 0, 0);
      } catch {}
      snapshot = null;
      const w = x - startX;
      const h = y - startY;
      // Destructive pixelation per EDT-02/03
      maskRegion(ctx, startX, startY, w, h, 'pixelate');
    },
    onPointerLeave() {
      if (!drawing) return;
      drawing = false;
      try {
        if (snapshot) ctx.putImageData(snapshot, 0, 0);
      } catch {}
      snapshot = null;
    },
  };
}

export function createMaskPaintTool(ctx: CanvasRenderingContext2D): Tool {
  let drawing = false;
  const canvasEl = ctx.canvas as HTMLCanvasElement;
  const brushSize = 16;

  return {
    name: 'mask-paint',
    onPointerDown(_e: PointerEvent) {
      drawing = true;
    },
    onPointerMove(e: PointerEvent) {
      if (!drawing) return;
      const { x, y } = getPos(e, canvasEl as unknown as HTMLElement);
      // Apply destructive pixelation at brush position — freehand
      maskRegion(ctx, x - brushSize / 2, y - brushSize / 2, brushSize, brushSize, 'pixelate');
    },
    onPointerUp() {
      drawing = false;
    },
    onPointerLeave() {
      drawing = false;
    },
  };
}
