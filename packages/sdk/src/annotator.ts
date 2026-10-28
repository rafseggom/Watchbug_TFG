/**
 * Lazy editor lane (RNF-01 lane 2 — ≤ 25 KB gz, loaded on demand).
 *
 * The hand-rolled canvas annotator (D-05 closed `fabric.js`/`konva` — ≈85 KB /
 * ≈45 KB gz — as over-budget). Emitted as its own entry point so the core lane
 * never carries editor bytes (esbuild splitting works for ESM only; the IIFE
 * lane loads this chunk through one non-analyzable dynamic `import()` from
 * `widget/loader.ts`, and the `.mjs` twin is what `import()` always evaluates).
 *
 * **C-2 contract (architecture-locked, ROADMAP § Phase 3):** exactly ONE
 * flattened working bitmap. `open()` receives the draft's own `ImageData` as
 * `options.base`, mutates it in place with the flattened annotation ink, and
 * resolves with THAT SAME instance — there is no second bitmap, no offscreen
 * base layer, and no pre-mask pixel snapshot anywhere (A-04). The encode sink
 * stays in core: the editor returns `ImageData` + `MaskPatch[]` and never
 * names the canvas encode API (the `sdk-single-encode-sink` gate counts text,
 * comments included).
 *
 * Masks bake destructively and are never undoable (T2): 03-06 wired the bake —
 * `open()` seeds the editor from `options.masks` (a Review -> Edit round trip
 * keeps them) and returns the accumulated patches alongside the mutated base.
 * Strokes are vector records; undo is a redraw (P3-D-11/12) that never pops a
 * mask, and every redraw re-bakes the patches last (T3).
 */

import { createEditor } from './annotator/canvas-layer.ts';
import type { MaskPatch } from './redact/masks.ts';

/** Lane identity for the size gate. */
export const ANNOTATOR_LANE = 'lazy-editor' as const;

/** Everything core hands the editor — resolved OUTSIDE the lazy lane so the
 * chunk carries no second dictionary, no second locale switch and no colour
 * literal (P3-D-07, OQ-1/OQ-4 resolutions). */
export interface AnnotatorOpenOptions {
  /** The draft's OWN `ImageData` — mutated in place, the one working bitmap. */
  base: ImageData;
  /** Core's resolved locale — the editor chrome cannot disagree with it. */
  locale: 'en' | 'es';
  /** Post-mask patches from a previous editor round-trip (round-trip carry). */
  masks: readonly MaskPatch[];
  /** A container core created inside `.wrap` — the editor never touches
   * `document.body` and stays inside the same closed shadow root (INV-01). */
  mount: HTMLElement;
  /** The accent ink, resolved from `--wb-color-accent` by core (P3-D-07). */
  ink: string;
  /** The four core-owned `mask.confirm.*` strings for 03-06's dialog. */
  maskConfirm: {
    title: string;
    body: string;
    action: string;
    cancel: string;
  };
}

/** What one editor session returns: the mutated base + every mask baked in
 *  this session (post-mask patches only, creation order). `img` IS
 *  `options.base` — same instance. */
export interface AnnotatorResult {
  img: ImageData;
  masks: readonly MaskPatch[];
}

/** The chunk's public surface as seen by the core loader. */
export interface AnnotatorModule {
  open(options: AnnotatorOpenOptions): Promise<AnnotatorResult>;
}

/** Open a fullscreen annotation session over the draft's bitmap. */
export function open(options: AnnotatorOpenOptions): Promise<AnnotatorResult> {
  return createEditor(options);
}
