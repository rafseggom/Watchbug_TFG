import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasEditor } from '../../sdk/src/editor/CanvasEditor';
import { createPencilTool } from '../../sdk/src/editor/tools/pencil';
import { createArrowTool } from '../../sdk/src/editor/tools/arrow';
import { createTextTool } from '../../sdk/src/editor/tools/text';

function makeMockCtx(overrides: Record<string, unknown> = {}) {
  const ctx: Record<string, unknown> = {
    canvas: { width: 800, height: 600 },
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(800 * 600 * 4),
      width: 800,
      height: 600,
    })),
    putImageData: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    ...overrides,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

function makeCanvasAndToolbar(ctx: CanvasRenderingContext2D) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as ReturnType<HTMLCanvasElement['getContext']>);
  const toolbar = document.createElement('div');
  toolbar.innerHTML = `
    <button data-tool="pencil" aria-label="pencil">pencil</button>
    <button data-tool="arrow" aria-label="arrow">arrow</button>
    <button data-tool="text" aria-label="text">text</button>
    <button data-tool="mask-rect" aria-label="maskRect">mask-rect</button>
    <button data-tool="mask-paint" aria-label="maskPaint">mask-paint</button>
    <button data-tool="send" aria-label="submit">send</button>
  `;
  return { canvas, toolbar };
}

describe('CanvasEditor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CanvasEditor initializes with a canvas and context', () => {
    const ctx = makeMockCtx();
    const { canvas, toolbar } = makeCanvasAndToolbar(ctx);
    const editor = new CanvasEditor(canvas, toolbar);
    expect(editor.getCanvas()).toBe(canvas);
    expect(editor.getContext()).toBe(ctx);
    editor.destroy();
  });

  it('setTool switches active tool', () => {
    const ctx = makeMockCtx();
    const { canvas, toolbar } = makeCanvasAndToolbar(ctx);
    const editor = new CanvasEditor(canvas, toolbar);
    expect(editor.getActiveTool()).toBe('pencil');
    editor.setTool('arrow');
    expect(editor.getActiveTool()).toBe('arrow');
    editor.setTool('text');
    expect(editor.getActiveTool()).toBe('text');
    editor.destroy();
  });

  it('loadImage draws image onto canvas', async () => {
    const ctx = makeMockCtx();
    const { canvas, toolbar } = makeCanvasAndToolbar(ctx);

    // Mock Image
    const mockImg: Record<string, unknown> = {};
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      get src() { return this._src; }
      set src(v: string) {
        this._src = v;
        // simulate async load
        setTimeout(() => this.onload?.(), 0);
      }
      width = 800;
      height = 600;
    }
    const origImage = (window as unknown as Record<string, unknown>).Image;
    (window as unknown as Record<string, unknown>).Image = MockImage as unknown;

    const editor = new CanvasEditor(canvas, toolbar);
    await editor.loadImage('data:image/png;base64,abc');
    expect(ctx.drawImage).toHaveBeenCalled();
    editor.destroy();
    (window as unknown as Record<string, unknown>).Image = origImage;
  });

  it('Pencil tool creates path on pointer events', () => {
    const ctx = makeMockCtx();
    const tool = createPencilTool(ctx);
    expect(tool.name).toBe('pencil');
    const down = { offsetX: 10, offsetY: 10, clientX: 10, clientY: 10 } as unknown as PointerEvent;
    const move = { offsetX: 20, offsetY: 20, clientX: 20, clientY: 20 } as unknown as PointerEvent;
    tool.onPointerDown(down);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 10);
    tool.onPointerMove(move);
    expect(ctx.lineTo).toHaveBeenCalledWith(20, 20);
    expect(ctx.stroke).toHaveBeenCalled();
    tool.onPointerUp(move);
  });

  it('Arrow tool draws arrow from start to end', () => {
    const ctx = makeMockCtx();
    // Ensure getImageData/putImageData are tracked
    const getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 800,
      height: 600,
    }));
    const putImageData = vi.fn();
    (ctx as unknown as Record<string, unknown>).getImageData = getImageData;
    (ctx as unknown as Record<string, unknown>).putImageData = putImageData;
    // canvas mock for arrow needs width/height via ctx.canvas
    (ctx as unknown as Record<string, unknown>).canvas = { width: 800, height: 600 };

    const tool = createArrowTool(ctx);
    expect(tool.name).toBe('arrow');
    const down = { offsetX: 0, offsetY: 0, clientX: 0, clientY: 0 } as unknown as PointerEvent;
    const move = { offsetX: 50, offsetY: 50, clientX: 50, clientY: 50 } as unknown as PointerEvent;
    const up = { offsetX: 100, offsetY: 10, clientX: 100, clientY: 10 } as unknown as PointerEvent;
    tool.onPointerDown(down);
    tool.onPointerMove(move);
    // should have called stroke at least
    expect(ctx.stroke).toHaveBeenCalled();
    const strokeCallsBeforeUp = (ctx.stroke as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    tool.onPointerUp(up);
    expect((ctx.stroke as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(strokeCallsBeforeUp);
  });

  it('Text tool places text at click position', () => {
    const ctx = makeMockCtx();
    const tool = createTextTool(ctx);
    expect(tool.name).toBe('text');
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Hello');
    const e = { offsetX: 30, offsetY: 40, clientX: 30, clientY: 40 } as unknown as PointerEvent;
    // ensure canvas for text tool
    (ctx as unknown as Record<string, unknown>).canvas = { width: 800, height: 600, getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLCanvasElement;
    tool.onPointerDown(e);
    expect(ctx.fillText).toHaveBeenCalledWith('Hello', 30, 40);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    promptSpy.mockRestore();
  });

  it('toolbar has buttons for pencil, arrow, text', () => {
    const ctx = makeMockCtx();
    const { canvas, toolbar } = makeCanvasAndToolbar(ctx);
    const editor = new CanvasEditor(canvas, toolbar);
    const pencilBtn = toolbar.querySelector('[data-tool="pencil"]');
    const arrowBtn = toolbar.querySelector('[data-tool="arrow"]');
    const textBtn = toolbar.querySelector('[data-tool="text"]');
    expect(pencilBtn).not.toBeNull();
    expect(arrowBtn).not.toBeNull();
    expect(textBtn).not.toBeNull();
    editor.destroy();
  });

  it('CanvasEditor registers pencil, arrow, text, maskRect, maskPaint', () => {
    const ctx = makeMockCtx();
    const { canvas, toolbar } = makeCanvasAndToolbar(ctx);
    const editor = new CanvasEditor(canvas, toolbar);
    const names = editor.getToolNames();
    expect(names).toContain('pencil');
    expect(names).toContain('arrow');
    expect(names).toContain('text');
    expect(names).toContain('mask-rect');
    expect(names).toContain('mask-paint');
    editor.destroy();
  });
});
