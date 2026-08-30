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

export function createTextTool(ctx: CanvasRenderingContext2D): Tool {
  const canvasEl = ctx.canvas as unknown as HTMLElement;
  const annotations: Array<{ x: number; y: number; text: string }> = [];

  const place = (e: PointerEvent): void => {
    const { x, y } = getPos(e, canvasEl as HTMLElement);
    let text: string | null = null;
    try {
      // Use window.prompt — mockable in tests
      text = (window as unknown as { prompt?: (msg?: string) => string | null }).prompt?.call(window, 'Enter text:') ?? null;
    } catch {
      text = null;
    }
    // For testing without prompt, allow e to carry text via custom property
    if (text === null || text === '') {
      const custom = (e as unknown as { _testText?: string })._testText;
      if (typeof custom === 'string' && custom.length > 0) {
        text = custom;
      } else {
        return;
      }
    }
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#ff0000';
    ctx.textAlign = 'left';
    ctx.fillText(text, x, y);
    annotations.push({ x, y, text });
  };

  return {
    name: 'text',
    onPointerDown: place,
    onPointerMove() {
      // no-op for text tool
    },
    onPointerUp() {},
    onPointerLeave() {},
  };
}
