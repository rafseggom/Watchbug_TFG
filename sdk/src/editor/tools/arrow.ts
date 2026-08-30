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

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 12;
  // arrowhead lines at 30 degrees (PI/6)
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

export function createArrowTool(ctx: CanvasRenderingContext2D): Tool {
  let startX = 0;
  let startY = 0;
  let drawing = false;
  let snapshot: ImageData | null = null;
  const canvasEl = ctx.canvas as HTMLCanvasElement;
  const arrows: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  const redrawAll = (): void => {
    for (const a of arrows) {
      drawArrow(ctx, a.x1, a.y1, a.x2, a.y2);
    }
  };

  return {
    name: 'arrow',
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
        if (snapshot) {
          ctx.putImageData(snapshot, 0, 0);
        } else {
          // fallback: clear and redraw completed arrows
          // attempt to clear by filling? just redraw
        }
        // redraw completed arrows after restoring snapshot already contains them if snapshot taken after they were drawn
        // but if snapshot was null, redraw manually
        if (!snapshot) {
          redrawAll();
        }
      } catch {
        // ignore putImageData errors in test mocks
      }
      drawArrow(ctx, startX, startY, x, y);
    },
    onPointerUp(e: PointerEvent) {
      if (!drawing) return;
      const { x, y } = getPos(e, canvasEl as unknown as HTMLElement);
      drawing = false;
      try {
        if (snapshot) {
          ctx.putImageData(snapshot, 0, 0);
        }
      } catch {
        // ignore
      }
      // if snapshot existed, completed arrows are already in canvas; still need to draw all plus new one
      // To ensure deterministic, redraw all completed then new one
      if (snapshot) {
        // snapshot already has completed arrows, just draw new arrow
        drawArrow(ctx, startX, startY, x, y);
      } else {
        // manual
        redrawAll();
        drawArrow(ctx, startX, startY, x, y);
      }
      arrows.push({ x1: startX, y1: startY, x2: x, y2: y });
      snapshot = null;
    },
    onPointerLeave() {
      // do not finalize on leave, just keep drawing state? treat as up
      if (drawing) {
        drawing = false;
        snapshot = null;
      }
    },
  };
}
