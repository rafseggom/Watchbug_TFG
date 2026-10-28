/**
 * Stroke records + per-tool rendering (ANN-01..ANN-04 data model).
 *
 * Every record is SELF-CONTAINED (research Pattern: Code Examples "Stroke
 * records"): `width` and `ink` are resolved at creation from the canvas scale
 * and the core-supplied accent, so a later locale/theme change can never
 * restyle history, and a replay is a pure function of the record — never a
 * function of ambient canvas state (Pitfall 10: every replay starts with an
 * explicit state reset).
 *
 * Strokes are the ONLY undoable history (P3-D-11/12: masks never enter this
 * model); undo is "pop the record, redraw from the base" — there is no pixel
 * snapshot anywhere, which is what keeps C-2/A-04 true by construction.
 */

/** A committed annotation, in BITMAP space (H-1: one geometry authority). */
export type Stroke =
  | { tool: 'freehand'; points: number[]; width: number; ink: string }
  | { tool: 'arrow'; from: [number, number]; to: [number, number]; width: number; ink: string }
  | {
      tool: 'rectangle';
      from: [number, number];
      to: [number, number];
      width: number;
      ink: string;
    }
  | { tool: 'text'; at: [number, number]; text: string; size: number; ink: string };

/**
 * The label font size in LOGICAL pixels (UI-SPEC A-5 / P3-D-08: a 15 px
 * accent label). `canvas-layer` scales it into bitmap space at creation, the
 * same single expression that scales stroke width.
 */
export const LABEL_FONT_PX = 15;

/**
 * Assign the label font and READ IT BACK (Pitfall 6): the canvas parses
 * `font` with the CSS shorthand grammar and silently keeps the previous
 * value on a parse failure — engines disagree on family lists. If the size
 * did not land, reassign the minimal `${size}px sans-serif` form.
 */
export function resolveFont(ctx: CanvasRenderingContext2D, sizePx: number): void {
  const preferred = `${sizePx}px system-ui, sans-serif`;
  ctx.font = preferred;
  if (!ctx.font.includes(`${sizePx}px`)) {
    ctx.font = `${sizePx}px sans-serif`;
  }
}

/**
 * Explicitly declare the six drawing state values the stroke depends on
 * before painting — the anti-leak discipline Pitfall 10 names (transform,
 * alpha, dash, width, style, caps) — so replaying after an undo reproduces
 * the original pixels exactly.
 */
function resetForStroke(ctx: CanvasRenderingContext2D, width: number, ink: string): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.lineWidth = width;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** Paint one committed stroke. Pure: reads only `ctx` and the record. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  switch (stroke.tool) {
    case 'freehand': {
      // A single point paints nothing (no drag, no commit); two points and up
      // draw as one polyline so the join style is uniform along the path.
      if (stroke.points.length < 4) return;
      resetForStroke(ctx, stroke.width, stroke.ink);
      ctx.beginPath();
      ctx.moveTo(stroke.points[0], stroke.points[1]);
      for (let at = 2; at + 1 < stroke.points.length; at += 2) {
        ctx.lineTo(stroke.points[at], stroke.points[at + 1]);
      }
      ctx.stroke();
      break;
    }
    case 'arrow': {
      // ANN-02: a `3 * scaleX` shaft from tail to head plus a FILLED head
      // ~12 px (bitmap space) long and wider than the shaft — the head is a
      // triangle centred on the line direction (UI-SPEC § Annotation editor).
      resetForStroke(ctx, stroke.width, stroke.ink);
      const [fx, fy] = stroke.from;
      const [tx, ty] = stroke.to;
      const dx = tx - fx;
      const dy = ty - fy;
      const length = Math.hypot(dx, dy);
      if (length < 1) return;
      const ux = dx / length;
      const uy = dy / length;
      const headLen = Math.min(12, length);
      const bx = tx - ux * headLen;
      const by = ty - uy * headLen;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(bx, by);
      ctx.stroke();
      const half = Math.max(7, stroke.width * 2.5);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(bx - uy * half, by + ux * half);
      ctx.lineTo(bx + uy * half, by - ux * half);
      ctx.closePath();
      ctx.fillStyle = stroke.ink;
      ctx.fill();
      break;
    }
    case 'rectangle': {
      // ANN-03: four edges, no fill — the interior stays untouched.
      const x = Math.min(stroke.from[0], stroke.to[0]);
      const y = Math.min(stroke.from[1], stroke.to[1]);
      const width = Math.abs(stroke.to[0] - stroke.from[0]);
      const height = Math.abs(stroke.to[1] - stroke.from[1]);
      if (width < 1 || height < 1) return;
      resetForStroke(ctx, stroke.width, stroke.ink);
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.stroke();
      break;
    }
    case 'text': {
      // ANN-04 / P3-D-08: the committed value is drawn VERBATIM with
      // `fillText` — textContent-safe by construction, no HTML sink, no
      // escaping path, no modal (the record's own `text` is the whole story).
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      resolveFont(ctx, stroke.size);
      ctx.fillStyle = stroke.ink;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(stroke.text, stroke.at[0], stroke.at[1]);
      break;
    }
  }
}

/**
 * Draw one freehand SEGMENT incrementally during an active drag (the plan's
 * pointermove discipline: incremental canvas painting, never a full redraw
 * per move). Same explicit state declaration as the replay path, so the live
 * preview and the committed stroke are pixel-identical.
 */
export function drawFreehandSegment(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  width: number,
  ink: string,
): void {
  resetForStroke(ctx, width, ink);
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
}
