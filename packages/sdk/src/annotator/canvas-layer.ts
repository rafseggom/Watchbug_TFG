/**
 * The editor's canvas layer — one bitmap-sized canvas, CSS-fitted, with every
 * pointer coordinate mapped through the canvas's OWN bounding box (research
 * Pattern 2 / Pitfall 7):
 *
 *   canvas.getBoundingClientRect() -> transformFor(canvas.width, canvas.height,
 *   box.width, box.height) -> bitmap point
 *
 * `transformFor` and `toBitmapRect` are imported from `redact/geometry.ts` —
 * the single geometry authority (R-18, H-1). NEVER pass the window viewport
 * here: the canvas is letterboxed inside the editor area, so the canvas box
 * is the only valid scale (Pitfall 7).
 *
 * ONE working bitmap (C-2 / A-04, plan-flagged decision): the redraw source is
 * `options.base` — the draft's own `ImageData` — mutated in place. There is no
 * second copy: a redraw is `putImageData(base)` + replay of the committed
 * vector strokes, so a pre-mask or per-stroke pixel snapshot never exists
 * (Pitfall 4) and the memory at the 16 MP ceiling stays ~64 MB instead of
 * ~128 MB. `createImageBitmap` on the base is deliberately NOT used: an
 * immutable second copy held for the session is exactly the offscreen base
 * layer C-2 forbids.
 *
 * Pointer discipline (Pitfall 5): `setPointerCapture` on `pointerdown`,
 * release on `pointerup`/`pointercancel`; a cancel ABORTS the in-progress
 * stroke, a `pointerup` inside the canvas commits it.
 */

import { transformFor } from '../redact/geometry.ts';
import { setEditorLocale } from '../strings.editor.ts';
import type { AnnotatorOpenOptions, AnnotatorResult } from '../annotator.ts';
import { createEditorShell, injectEditorCss, type ToolName } from './editor-dom.ts';
import { drawFreehandSegment, drawStroke, type Stroke } from './tools.ts';

/** The bounded undo stack (P3-D-11: "~20 strokes"; oldest is dropped). */
export const UNDO_LIMIT = 20;

/** Logical stroke width, scaled into bitmap space at stroke creation (A-5). */
export const LOGICAL_STROKE_PX = 3;

/** The editor's own `.editor` element is mounted INSIDE the given container
 * (which core creates inside `.wrap`), never into `document.body` (INV-01). */
export function createEditor(options: AnnotatorOpenOptions): Promise<AnnotatorResult> {
  return new Promise<AnnotatorResult>((resolve) => {
    setEditorLocale(options.locale);
    injectEditorCss(options.mount);

    const shell = createEditorShell();
    options.mount.appendChild(shell.root);

    const canvas = shell.canvas;
    const base = options.base;
    canvas.width = base.width;
    canvas.height = base.height;

    const context = canvas.getContext('2d');
    if (context === null) {
      // Fail closed exactly like `encode.ts`'s `context2d`: no 2D context, no
      // editor. The core surfaces the inline load error.
      shell.root.remove();
      throw new Error('watchbug editor: a 2D canvas is unavailable');
    }

    /** CSS-fit: contain the bitmap inside the area box, px (never %). */
    const fitCanvas = (): void => {
      const padding = 16; // the area's 8 px padding on both axes
      const availWidth = Math.max(1, shell.area.clientWidth - padding);
      const availHeight = Math.max(1, shell.area.clientHeight - padding);
      const scale = Math.min(availWidth / canvas.width, availHeight / canvas.height);
      canvas.style.width = `${Math.max(1, Math.floor(canvas.width * scale))}px`;
      canvas.style.height = `${Math.max(1, Math.floor(canvas.height * scale))}px`;
    };
    fitCanvas();

    // ---- committed strokes: vector records only, never pixel snapshots ----
    const strokes: Stroke[] = [];

    const redraw = (): void => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.putImageData(base, 0, 0);
      for (const stroke of strokes) drawStroke(context, stroke);
    };
    redraw();

    /** Cap at UNDO_LIMIT, dropping the oldest committed stroke (P3-D-11). */
    const pushStroke = (stroke: Stroke): void => {
      strokes.push(stroke);
      if (strokes.length > UNDO_LIMIT) strokes.shift();
    };

    const undoStroke = (): void => {
      if (strokes.length === 0) return;
      strokes.pop();
      redraw();
    };

    // ---- pointer -> bitmap mapping (the ONE authority, Pitfall 7) ----
    const canvasTransform = (): ReturnType<typeof transformFor> => {
      const box = canvas.getBoundingClientRect();
      return transformFor(canvas.width, canvas.height, box.width, box.height);
    };

    const toBitmapPoint = (event: PointerEvent): { x: number; y: number } => {
      const box = canvas.getBoundingClientRect();
      const transform = transformFor(canvas.width, canvas.height, box.width, box.height);
      return {
        x: Math.round((event.clientX - box.left) * transform.scaleX),
        y: Math.round((event.clientY - box.top) * transform.scaleY),
      };
    };

    let activeTool: ToolName = 'freehand';
    const selectTool = (tool: ToolName): void => {
      activeTool = tool;
      shell.canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
      for (const [name, button] of shell.tools) {
        button.setAttribute('aria-pressed', String(name === tool));
      }
    };
    selectTool('freehand');

    // ---- in-progress drag state ----
    let pendingPoints: number[] | null = null;

    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // The mask tool is inert until 03-06 bakes it; freehand is the only
      // committing drag in this slice, and arrow/rect/text land in Task 2.
      if (activeTool === 'mask') return;
      if (activeTool !== 'freehand') return;
      const point = toBitmapPoint(event);
      canvas.setPointerCapture(event.pointerId);
      pendingPoints = [point.x, point.y];
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (pendingPoints === null) return;
      const point = toBitmapPoint(event);
      const list = pendingPoints;
      const lastX = list[list.length - 2];
      const lastY = list[list.length - 1];
      if (point.x === lastX && point.y === lastY) return;
      // Incremental preview: paint only the new segment (the full redraw runs
      // on commit), with the same explicit state the replay declares so the
      // preview and the committed stroke are pixel-identical (Pitfall 10).
      drawFreehandSegment(
        context,
        [lastX, lastY],
        [point.x, point.y],
        LOGICAL_STROKE_PX * canvasTransform().scaleX,
        options.ink,
      );
      list.push(point.x, point.y);
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (pendingPoints === null) return;
      const list = pendingPoints;
      pendingPoints = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      // Commit ONLY on `pointerup` inside the canvas: a release over the
      // toolbar or the bar aborts the unfinished stroke (the capture makes
      // the event fire here regardless — this is the plan's own check).
      const box = canvas.getBoundingClientRect();
      const inside =
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom;
      if (inside && list.length >= 4) {
        pushStroke({
          tool: 'freehand',
          points: list,
          width: LOGICAL_STROKE_PX * transformFor(canvas.width, canvas.height, box.width, box.height).scaleX,
          ink: options.ink,
        });
      }
      // The replay (width resolved once at commit) replaces the incremental
      // preview pixels on either branch, so the canvas always ends a drag in
      // exactly the committed state.
      redraw();
    };

    const onPointerCancel = (event: PointerEvent): void => {
      // A cancel ABORTS — never commits (Pitfall 5).
      if (pendingPoints === null) return;
      pendingPoints = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      redraw();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);

    // ---- rail wiring: tools are aria-pressed toggles; undo is an action ----
    for (const [name, button] of shell.tools) {
      button.addEventListener('click', () => {
        if (name === 'mask') return; // inert until 03-06 wires the drag/bake
        selectTool(name);
      });
    }
    shell.undo.addEventListener('click', undoStroke);

    // ---- finish/Done: the draft's own buffer is the return value ----
    let finished = false;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        // Escape closes the editor exactly like `Done` (UI-SPEC: no other
        // exit while editing); the label input owns its own Escape (Task 2).
        event.preventDefault();
        finish();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'z') {
        if (shell.labelInput.getAttribute('data-shown') === 'true') return; // native text undo
        event.preventDefault();
        undoStroke();
      }
    };

    const finish = (): void => {
      if (finished) return;
      finished = true;
      // C-2 flattening: the committed vector strokes merge into the draft's
      // OWN buffer before returning — a readback of the canvas (which always
      // holds `base` + replay, the redraw invariant) written back into the
      // SAME instance. No second bitmap is retained: the pixels land in
      // `base.data` and the transient readback dies here.
      redraw();
      const flat = context.getImageData(0, 0, canvas.width, canvas.height);
      base.data.set(flat.data);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('keydown', onKeyDown);
      shell.root.remove();
      // C-2/A-04: the SAME instance that came in — mutated in place. The
      // masks round-trip unchanged in this slice (03-06 adds the bake).
      resolve({ img: base, masks: options.masks });
    };

    shell.done.addEventListener('click', finish);
    document.addEventListener('keydown', onKeyDown);
  });
}
