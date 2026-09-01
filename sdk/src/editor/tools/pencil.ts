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
    // offsetX/Y is relative to target when target is canvas
    return { x: anyE.offsetX, y: anyE.offsetY };
  }
  if (target) {
    const rect = target.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  return { x: e.clientX, y: e.clientY };
}

export function createPencilTool(ctx: CanvasRenderingContext2D): Tool {
  let drawing = false;
  const canvas = ctx.canvas as unknown as HTMLElement;

  const start = (e: PointerEvent): void => {
    drawing = true;
    const { x, y } = getPos(e, canvas as HTMLElement);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: PointerEvent): void => {
    if (!drawing) return;
    const { x, y } = getPos(e, canvas as HTMLElement);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = (): void => {
    if (!drawing) return;
    drawing = false;
    // close path implicitly
  };

  return {
    name: 'pencil',
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: end,
    onPointerLeave: end,
  };
}
