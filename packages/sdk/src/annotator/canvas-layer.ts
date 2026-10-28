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
 * second copy: a redraw is `rebakeMasks` — `putImageData(base)` + replay of the
 * committed vector strokes + replay of every mask patch LAST (T3) — so a
 * pre-mask or per-stroke pixel snapshot never exists (Pitfall 4) and the
 * memory at the 16 MP ceiling stays ~64 MB instead of ~128 MB.
 * `createImageBitmap` on the base is deliberately NOT used: an immutable
 * second copy held for the session is exactly the offscreen base layer C-2
 * forbids.
 *
 * Pointer discipline (Pitfall 5): `setPointerCapture` on `pointerdown`,
 * release on `pointerup`/`pointercancel`; a cancel ABORTS the in-progress
 * stroke, a `pointerup` inside the canvas commits it.
 */

import { transformFor } from '../redact/geometry.ts';
import type { MaskPatch } from '../redact/masks.ts';
import { setEditorLocale } from '../strings.editor.ts';
import type { AnnotatorOpenOptions, AnnotatorResult } from '../annotator.ts';
import {
  createEditorShell,
  currentMaskStyle,
  injectEditorCss,
  isMaskConfirmed,
  markMaskConfirmed,
  type ToolName,
} from './editor-dom.ts';
import { bakeMask, blockSizeFor, capHeightPx, rebakeMasks } from './masks.ts';
import {
  drawFreehandSegment,
  drawStroke,
  LABEL_FONT_PX,
  type Stroke,
} from './tools.ts';

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

    const shell = createEditorShell(options.maskConfirm);
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

    // ---- baked masks: append-only post-mask patches (T2 / P3-D-12) ----
    // Seeded from the previous round-trip (Review -> Edit -> Annotate must not
    // lose masks) and returned by `finish()`. This array is NEVER pushed onto
    // the stroke stack and the undo stack never pops it: a mask is irreversible
    // by construction, not by convention (C-2, ANN-06). The only pixel data it
    // holds is destroyed bytes (research Pitfall 4).
    const masks: MaskPatch[] = Array.from(options.masks);

    const redraw = (): void => {
      rebakeMasks(context, base, strokes, masks);
    };
    redraw();

    /**
     * Cap at `UNDO_LIMIT` (P3-D-11: "~20 strokes"). The cap bounds the UNDO
     * HISTORY, never the ink: the canvas is stateless between drags (every
     * commit ends in `redraw()`, which repaints `base` + the vector list), so
     * dropping a record without first flattening would delete that stroke from
     * the canvas and from the exported image — silent loss of the user's
     * annotation. At the cap, snapshot the whole canvas into `base` (the same
     * readback `finish()` does) and restart the list: the evicted strokes have
     * already merged into the only redraw source. Mask patches re-bake LAST in
     * that snapshot, so T3 and the irreversibility of C-2 both hold.
     */
    const pushStroke = (stroke: Stroke): void => {
      strokes.push(stroke);
      if (strokes.length > UNDO_LIMIT) {
        redraw();
        base.data.set(context.getImageData(0, 0, base.width, base.height).data);
        strokes.length = 0;
      }
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
      // The CSS-keyed `.mask-mode` toggle visibility (P3-D-10: shown only
      // while the mask tool is active) hangs off this attribute.
      shell.root.setAttribute('data-wb-active-tool', tool);
      shell.canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
      for (const [name, button] of shell.tools) {
        button.setAttribute('aria-pressed', String(name === tool));
      }
    };
    selectTool('freehand');

    // ---- in-progress drag state ----
    type PendingDrag =
      | { tool: 'freehand'; points: number[] }
      | { tool: 'arrow'; from: [number, number]; to: [number, number] }
      | { tool: 'rectangle'; from: [number, number]; to: [number, number] }
      | { tool: 'mask'; from: [number, number]; to: [number, number] };
    let pending: PendingDrag | null = null;

    const commitStrokeWidth = (): number => LOGICAL_STROKE_PX * canvasTransform().scaleX;

    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // While the mask confirmation is open it owns the interaction — no new
      // drag starts behind the modal (P3-D-09).
      if (shell.maskDialog.isOpen()) return;
      // The text tool anchors a label on `click`, NOT on `pointerdown`: the
      // same click's mousedown would otherwise steal focus from the freshly
      // opened input and its blur-commit would close it empty. `labelDown`
      // just remembers the bitmap point the click should open the label at.
      if (activeTool === 'text') {
        const anchored = toBitmapPoint(event);
        labelDown = [anchored.x, anchored.y];
        return;
      }
      labelDown = null;
      const point = toBitmapPoint(event);
      canvas.setPointerCapture(event.pointerId);
      if (activeTool === 'freehand') {
        pending = { tool: 'freehand', points: [point.x, point.y] };
      } else {
        pending = {
          tool: activeTool,
          from: [point.x, point.y],
          to: [point.x, point.y],
        };
      }
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (pending === null) return;
      const point = toBitmapPoint(event);
      if (pending.tool === 'freehand') {
        const list = pending.points;
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
          commitStrokeWidth(),
          options.ink,
        );
        list.push(point.x, point.y);
        return;
      }
      // arrow/rectangle/mask preview: the SAME one-bitmap path as a commit —
      // the base is restored, every committed stroke replayed and every mask
      // patch re-baked, then the shape in progress draws on top. No second
      // bitmap, no snapshot (Pitfall 4). The mask previews as a plain rect
      // outline; the destruction itself lands only on commit.
      if (point.x === pending.to[0] && point.y === pending.to[1]) return;
      pending.to = [point.x, point.y];
      redraw();
      drawStroke(context, {
        tool: pending.tool === 'mask' ? 'rectangle' : pending.tool,
        from: pending.from,
        to: pending.to,
        width: commitStrokeWidth(),
        ink: options.ink,
      });
    };

    /**
     * Destroy `rect` now (T2). The confirmation gate wraps the DRAG decision,
     * the bake itself is one function. FAIL CLOSED: a geometry throw or a
     * degenerate rect ABORTS the mask (nothing baked, drag discarded, the
     * next redraw restores the preview) — never fill an approximate region
     * while the real one stays visible.
     */
    const bakeRect = (rect: { left: number; top: number; right: number; bottom: number }): void => {
      try {
        const style = currentMaskStyle();
        // Pixelate measures the platform's own cap height per bake (never an
        // assumed constant) and converts it from logical px into BITMAP px with
        // the draft frame's scale (HG-02): on a DPR-2 capture the page's glyphs
        // are twice as tall in bitmap space, and the R-13 floor ("a block
        // swallows at least two glyph rows") is a bitmap-space property. Fill
        // ignores the block size.
        const blockPx =
          style === 'pixelate'
            ? blockSizeFor(capHeightPx(context) * options.bitmapPerCssPx)
            : 0;
        // Append-only: the patch is destroyed pixels only, and it NEVER
        // touches the stroke stack (ANN-06 / Pitfall 4).
        masks.push(bakeMask(base, context, rect, style, blockPx));
        // The refusal line only describes the LAST bake: a later success clears
        // it (LW-02).
        shell.clearMaskError();
      } catch {
        // Aborted — fail closed, the region stays as it was. A silently
        // unmasked region is the one outcome a privacy tool must not hide: the
        // user is told the mask did NOT land (LW-02), never left believing a
        // secret is covered.
        shell.showMaskError();
      }
    };

    /** A mask drag awaiting its once-per-session confirmation. */
    let pendingMask: { left: number; top: number; right: number; bottom: number } | null = null;

    const maskToolButton = shell.tools.get('mask');
    const closeMaskDialog = (): void => {
      shell.maskDialog.hide();
      // Focus returns to the mask tool button on close (UI-SPEC a11y).
      maskToolButton?.focus();
    };

    shell.maskDialog.action.addEventListener('click', () => {
      if (pendingMask === null) return;
      const rect = pendingMask;
      pendingMask = null;
      bakeRect(rect);
      // Every LATER mask of the session bakes on release without asking
      // (P3-D-09) — the irreversibility moment is made explicit exactly once.
      markMaskConfirmed();
      closeMaskDialog();
      redraw();
    });
    shell.maskDialog.cancel.addEventListener('click', () => {
      // `Not now`: the pending mask is cancelled — nothing baked, the drag
      // discarded; the next redraw restores the untouched region.
      pendingMask = null;
      closeMaskDialog();
      redraw();
    });

    /**
     * Commit the dragged rect: bake immediately once the session has
     * confirmed, otherwise raise the alertdialog over the editor (focus on
     * the `Mask` action, `Escape` = `Not now`; the dialog owns Escape while
     * open — its keydown handler stops the event before the document-level
     * Escape-to-Done listener, Pitfall 11).
     */
    const requestMaskCommit = (from: [number, number], to: [number, number]): void => {
      const rect = {
        left: Math.min(from[0], to[0]),
        top: Math.min(from[1], to[1]),
        right: Math.max(from[0], to[0]) + 1,
        bottom: Math.max(from[1], to[1]) + 1,
      };
      if (isMaskConfirmed()) {
        bakeRect(rect);
        return;
      }
      pendingMask = rect;
      shell.maskDialog.show();
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (pending === null) return;
      const dragged = pending;
      pending = null;
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
      if (inside) {
        if (dragged.tool === 'freehand' && dragged.points.length >= 4) {
          pushStroke({
            tool: 'freehand',
            points: dragged.points,
            width: commitStrokeWidth(),
            ink: options.ink,
          });
        } else if (dragged.tool === 'mask') {
          const moved =
            dragged.to[0] !== dragged.from[0] || dragged.to[1] !== dragged.from[1];
          if (moved) requestMaskCommit(dragged.from, dragged.to);
        } else if (
          dragged.tool === 'arrow' ||
          dragged.tool === 'rectangle'
        ) {
          const moved =
            dragged.to[0] !== dragged.from[0] || dragged.to[1] !== dragged.from[1];
          if (moved) {
            pushStroke({
              tool: dragged.tool,
              from: dragged.from,
              to: dragged.to,
              width: commitStrokeWidth(),
              ink: options.ink,
            });
          }
        }
      }
      // The replay (width resolved once at commit) replaces the incremental
      // preview pixels on either branch — base + strokes + every mask patch,
      // patches LAST — so the canvas always ends a drag in exactly the
      // committed state, ink never above a mask (T3).
      redraw();
    };

    const onPointerCancel = (event: PointerEvent): void => {
      // A cancel ABORTS — never commits (Pitfall 5).
      if (pending === null) return;
      pending = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      redraw();
    };

    // ---- the text tool's inline label (P3-D-08: click -> type -> Enter;
    // Enter OR click-outside commits, Escape cancels, no modal) ----
    let labelAnchor: [number, number] | null = null;
    let labelDown: [number, number] | null = null;

    const closeLabel = (): void => {
      labelAnchor = null;
      shell.labelInput.value = '';
      shell.labelInput.setAttribute('data-shown', 'false');
    };

    const commitLabel = (): void => {
      if (labelAnchor === null) return;
      const text = shell.labelInput.value;
      const anchor = labelAnchor;
      closeLabel();
      // An EMPTY commit pushes nothing and leaves the decoded image unchanged
      // (ANN-04 empty). Whitespace is a label like any other — drawn verbatim.
      if (text.length === 0) return;
      pushStroke({
        tool: 'text',
        at: anchor,
        text,
        size: LABEL_FONT_PX * canvasTransform().scaleX,
        ink: options.ink,
      });
      redraw();
    };

    const openLabel = (anchor: [number, number]): void => {
      labelAnchor = anchor;
      const canvasRect = canvas.getBoundingClientRect();
      const rootRect = shell.root.getBoundingClientRect();
      const cssPerBitmap = canvasRect.width / canvas.width;
      shell.labelInput.value = '';
      shell.labelInput.style.left = `${canvasRect.left - rootRect.left + anchor[0] * cssPerBitmap}px`;
      shell.labelInput.style.top = `${canvasRect.top - rootRect.top + anchor[1] * cssPerBitmap - 14}px`;
      shell.labelInput.setAttribute('data-shown', 'true');
      shell.labelInput.focus();
    };

    // The label anchors on `click`, NOT on `pointerdown`: the same trusted
    // click's mousedown would otherwise steal focus from the freshly opened
    // input and its blur-commit would close it empty before a key is typed.
    const onClick = (): void => {
      if (activeTool !== 'text' || labelDown === null) return;
      openLabel(labelDown);
      labelDown = null;
    };

    shell.labelInput.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        commitLabel();
      } else if (event.key === 'Escape') {
        // The input owns Escape while open (Pitfall 11): cancel the label,
        // and stop the event so the editor's Escape-to-Done never fires.
        event.preventDefault();
        event.stopPropagation();
        closeLabel();
      }
    });
    shell.labelInput.addEventListener('blur', commitLabel);

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);

    // ---- rail wiring: tools are aria-pressed toggles; undo is an action ----
    for (const [name, button] of shell.tools) {
      button.addEventListener('click', () => {
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
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('keydown', onKeyDown);
      shell.root.remove();
      // C-2/A-04: the SAME instance that came in — mutated in place. The
      // masks array carries every baked patch (destroyed pixels only) back
      // to the draft, so a Review -> Edit -> Annotate round trip keeps them.
      resolve({ img: base, masks });
    };

    shell.done.addEventListener('click', finish);
    document.addEventListener('keydown', onKeyDown);
  });
}
