/**
 * The editor shell — top bar, vertical toolbar, canvas area, inline label
 * input (P3-D-06, UI-SPEC § Annotation editor).
 *
 * Every node is built with `createElement` / `createElementNS` and written via
 * `textContent` / `setAttribute` — no HTML sink inside the lazy lane either
 * (T-02-01 holds for the whole SDK, not just core). Glyphs are hand-rolled
 * inline SVG (`svgElement` pattern from `widget/launcher.ts`, rebuilt locally
 * because value-importing core modules would drag the dictionary into the
 * chunk), so the toolbar ships zero image bytes.
 *
 * The CSS rides the lazy lane as `EDITOR_CSS` and is APPENDED to the core's
 * single shadow `<style>` element (`host.ts` marks it `data-wb-core`) behind a
 * module flag: one `<style>`, never a second stylesheet, never
 * `adoptedStyleSheets` (UI-SPEC isolation contract, T-03-22).
 */

import { tEditor, type EditorStringId } from '../strings.editor.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The editor's own stylesheet — appended once into the core `<style>`. */
export const EDITOR_CSS = `
.editor {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--wb-color-surface);
  color: var(--wb-color-ink);
  font-family: inherit;
  font-size: 15px;
  line-height: 1.5;
  text-align: left;
  pointer-events: auto;
  animation: wb-editor-in 120ms ease-out;
}
.editor-bar {
  flex: none;
  height: 60px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 16px;
  border-bottom: 1px solid var(--wb-color-border);
  background: var(--wb-color-surface);
}
.editor-title {
  margin: 0;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--wb-color-ink);
  overflow-wrap: anywhere;
}
.editor-done {
  flex: none;
  height: 36px;
  box-sizing: border-box;
  margin: 0;
  padding: 0 16px;
  border: 1px solid var(--wb-color-accent);
  border-radius: 6px;
  background: var(--wb-color-accent);
  color: var(--wb-color-on-accent);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}
.editor-done:hover { background: var(--wb-color-accent-hover); }
.editor-done:active { background: var(--wb-color-accent-active); }
.editor-body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.editor-rail {
  flex: none;
  width: 60px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-right: 1px solid var(--wb-color-border);
  background: var(--wb-color-surface);
  overflow-y: auto;
}
.tool {
  flex: none;
  width: 44px;
  height: 44px;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 1px solid var(--wb-color-border);
  border-radius: 6px;
  background: var(--wb-color-surface-alt);
  color: var(--wb-color-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.tool[aria-pressed='true'] {
  border-color: var(--wb-color-accent);
  background: var(--wb-color-surface);
  color: var(--wb-color-accent);
}
.tool:focus-visible, .editor-done:focus-visible, .text-label:focus-visible {
  outline: 2px solid var(--wb-color-accent);
  outline-offset: 2px;
}
.tool-divider {
  flex: none;
  width: 44px;
  height: 1px;
  margin: 4px 0;
  background: var(--wb-color-border);
}
.editor-area {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: var(--wb-color-surface-alt);
  overflow: hidden;
}
.editor-canvas {
  display: block;
  background: var(--wb-color-surface);
  touch-action: none;
  cursor: crosshair;
  -webkit-user-select: none;
  user-select: none;
}
.text-label {
  position: absolute;
  display: none;
  box-sizing: border-box;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--wb-color-accent);
  border-radius: 4px;
  background: var(--wb-color-surface);
  color: var(--wb-color-ink);
  font-family: inherit;
  font-size: 15px;
  line-height: 1.4;
}
.text-label[data-shown='true'] { display: block; }
.mask-mode {
  display: none;
  flex: none;
  width: 64px;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  border-right: 1px solid var(--wb-color-border);
  background: var(--wb-color-surface);
}
.editor[data-wb-active-tool='mask'] .mask-mode { display: flex; }
.mask-mode-label {
  margin: 0;
  font-size: 11px;
  line-height: 1.3;
  color: var(--wb-color-muted);
  text-align: center;
  overflow-wrap: anywhere;
}
.mask-mode-btn {
  width: 56px;
  height: 32px;
  box-sizing: border-box;
  margin: 0;
  padding: 0 4px;
  border: 1px solid var(--wb-color-border);
  border-radius: 6px;
  background: var(--wb-color-surface-alt);
  color: var(--wb-color-ink);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}
.mask-mode-btn[aria-pressed='true'] {
  border-color: var(--wb-color-accent);
  color: var(--wb-color-accent);
  background: var(--wb-color-surface);
}
.mask-mode-btn:focus-visible {
  outline: 2px solid var(--wb-color-accent);
  outline-offset: 2px;
}
.mask-dialog {
  display: none;
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  width: min(360px, calc(100vw - 32px));
  margin: 0;
  padding: 16px;
  border: 1px solid var(--wb-color-border);
  border-radius: 8px;
  background: var(--wb-color-surface);
  box-shadow: 0 8px 24px rgba(27, 31, 38, 0.18);
  color: var(--wb-color-ink);
  font-size: 15px;
  line-height: 1.5;
  text-align: left;
}
.mask-dialog[data-shown='true'] { display: block; }
.mask-dialog-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--wb-color-ink);
  overflow-wrap: anywhere;
}
.mask-dialog-body {
  margin: 0 0 16px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--wb-color-ink);
}
.mask-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.mask-dialog-action,
.mask-dialog-cancel {
  height: 36px;
  box-sizing: border-box;
  margin: 0;
  padding: 0 16px;
  border: 1px solid var(--wb-color-border);
  border-radius: 6px;
  background: var(--wb-color-surface-alt);
  color: var(--wb-color-ink);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}
.mask-dialog-action {
  border-color: var(--wb-color-accent);
  background: var(--wb-color-accent);
  color: var(--wb-color-on-accent);
}
.mask-dialog-action:hover { background: var(--wb-color-accent-hover); }
.mask-dialog-action:focus-visible,
.mask-dialog-cancel:focus-visible {
  outline: 2px solid var(--wb-color-accent);
  outline-offset: 2px;
}
@keyframes wb-editor-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .editor { animation: none; }
}
`;

/** The five canvas tools; `undo` is the separate action below the divider. */
export type ToolName = 'freehand' | 'arrow' | 'rectangle' | 'text' | 'mask';

/** Rail order per P3-D-06: the tools, a divider, then the undo action. */
export const TOOL_NAMES = ['freehand', 'arrow', 'rectangle', 'text', 'mask'] as const;

/** The two mask styles (P3-D-10): flat fill is the default, pixelate opt-in. */
export type MaskStyle = 'fill' | 'pixelate';

/** The four core-resolved `mask.confirm.*` strings (03-03 keys, OQ-4 shape):
 * the lazy lane renders them verbatim and imports no dictionary of its own. */
export interface MaskConfirmCopy {
  title: string;
  body: string;
  action: string;
  cancel: string;
}

export interface MaskDialog {
  /** `div.mask-dialog` — `role="alertdialog"` + `aria-modal="true"`. */
  readonly root: HTMLElement;
  readonly title: HTMLElement;
  readonly body: HTMLElement;
  /** The `Mask` action button — the focus target on open. */
  readonly action: HTMLButtonElement;
  /** The `Not now` cancel button. */
  readonly cancel: HTMLButtonElement;
  /** Show the dialog and focus the `Mask` action. */
  show(): void;
  /** Hide it (after either outcome). */
  hide(): void;
  readonly isOpen: () => boolean;
}

export interface EditorShell {
  /** The fullscreen editor root — mounted inside the core-provided layer. */
  readonly root: HTMLElement;
  /** The bar title (`editor.title`, localised). */
  readonly title: HTMLElement;
  /** The `Done` button. */
  readonly done: HTMLButtonElement;
  /** The canvas area box — the contain-fit reference for the canvas. */
  readonly area: HTMLElement;
  /** The drawing canvas: `role="img"` + `aria-label={editor.canvas.label}`. */
  readonly canvas: HTMLCanvasElement;
  /** One tool button per rail tool, keyed by `data-wb-tool`. */
  readonly tools: ReadonlyMap<ToolName, HTMLButtonElement>;
  /** The undo action button (also keyed in `tools` as the `undo` name). */
  readonly undo: HTMLButtonElement;
  /** The inline label input for the text tool (P3-D-08, no modal). */
  readonly labelInput: HTMLInputElement;
  /** The Fill/Pixelate mini-toggle column (visible while the mask tool is
   * active — the CSS keys off `root[data-wb-active-tool="mask"]`). */
  readonly maskMode: HTMLElement;
  /** The mask-style pair, keyed by `data-wb-mask`. */
  readonly maskModeButtons: ReadonlyMap<MaskStyle, HTMLButtonElement>;
  /** The once-per-session mask confirmation (P3-D-09). */
  readonly maskDialog: MaskDialog;
  /** Re-resolve every label from `tEditor` — called on mount (WDG-06). */
  renderCopy(): void;
}

/**
 * Module-scoped session state (P3-D-09/P3-D-10): the first mask of the
 * session asks once, later masks bake without re-confirming; the chosen
 * mask style survives between masks (and between editor round trips of the
 * same page — the chunk module evaluates once). Neither ever touches host
 * storage (SEC-03).
 */
let maskConfirmed = false;
let maskStyle: MaskStyle = 'fill';

export function isMaskConfirmed(): boolean {
  return maskConfirmed;
}

/** Set by the `Mask` confirmation — every later mask bakes on release. */
export function markMaskConfirmed(): void {
  maskConfirmed = true;
}

export function currentMaskStyle(): MaskStyle {
  return maskStyle;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className.length > 0) node.className = className;
  return node;
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, value);
  }
  return node;
}

/** A 20x20 stroke glyph — the launcher's builder pattern, no image assets. */
function glyph(paths: readonly string[], extra?: SVGElement): SVGSVGElement {
  const svg = svgElement('svg', {
    viewBox: '0 0 24 24',
    width: '20',
    height: '20',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  for (const d of paths) {
    svg.appendChild(svgElement('path', { d }));
  }
  if (extra !== undefined) svg.appendChild(extra);
  return svg;
}

/**
 * Hand-drawn squiggle: the freehand tool.
 */
function freehandGlyph(): SVGSVGElement {
  return glyph(['M3 17 C6 7, 9 21, 12 11 S18 7, 21 13']);
}

function arrowGlyph(): SVGSVGElement {
  return glyph(['M4 20 L17 7', 'M10 7 L17 7 L17 14']);
}

function rectangleGlyph(): SVGSVGElement {
  return glyph(['M4 6 H20 V18 H4 Z']);
}

function textGlyph(): SVGSVGElement {
  return glyph(['M5 7 V5 H19 V7', 'M12 5 V19', 'M9 19 H15']);
}

/** A solid block: mask fills opaque (R-13), so the glyph is a filled rect. */
function maskGlyph(): SVGSVGElement {
  return glyph([], svgElement('rect', { x: '4', y: '6', width: '16', height: '12', fill: 'currentColor', stroke: 'none' }));
}

function undoGlyph(): SVGSVGElement {
  return glyph(['M8 7 L4 11 L8 15', 'M4 11 H15 A5 5 0 0 1 15 21 H11']);
}

const GLYPHS: Record<'undo' | ToolName, () => SVGSVGElement> = {
  freehand: freehandGlyph,
  arrow: arrowGlyph,
  rectangle: rectangleGlyph,
  text: textGlyph,
  mask: maskGlyph,
  undo: undoGlyph,
};

/** `aria-label` + `title` come from the editor dictionary (WDG-06). */
const TOOL_STRING: Record<'undo' | ToolName, EditorStringId> = {
  freehand: 'editor.tool.freehand',
  arrow: 'editor.tool.arrow',
  rectangle: 'editor.tool.rectangle',
  text: 'editor.tool.text',
  mask: 'editor.tool.mask',
  undo: 'editor.tool.undo',
};

function createToolButton(name: 'undo' | ToolName): HTMLButtonElement {
  const button = el('button', 'tool');
  button.setAttribute('type', 'button');
  button.setAttribute('data-wb-tool', name);
  if (name !== 'undo') button.setAttribute('aria-pressed', 'false');
  button.appendChild(GLYPHS[name]());
  return button;
}

/**
 * Build the editor DOM (detached — the caller appends it into the layer the
 * core created inside `.wrap`, so the editor never touches `document.body`
 * and stays inside the same closed shadow root).
 */
export function createEditorShell(maskConfirm: MaskConfirmCopy): EditorShell {
  const root = el('section', 'editor');

  const bar = el('div', 'editor-bar');
  const title = el('h1', 'editor-title');
  const done = el('button', 'editor-done');
  done.setAttribute('type', 'button');
  bar.appendChild(title);
  bar.appendChild(done);

  const body = el('div', 'editor-body');
  const rail = el('div', 'editor-rail');
  rail.setAttribute('role', 'toolbar');
  rail.setAttribute('aria-orientation', 'vertical');

  const tools = new Map<ToolName, HTMLButtonElement>();
  for (const name of TOOL_NAMES) {
    const button = createToolButton(name);
    rail.appendChild(button);
    tools.set(name, button);
  }
  rail.appendChild(el('div', 'tool-divider'));
  const undo = createToolButton('undo');
  rail.appendChild(undo);

  // The Fill/Pixelate mini-toggle (P3-D-10): a segmented pair beside the rail,
  // shown only while the mask tool is active (CSS keys off the root's
  // data-wb-active-tool). `fill` is the default; the selection survives
  // between masks of the session (module state).
  const maskMode = el('div', 'mask-mode');
  const maskModeLabel = el('p', 'mask-mode-label');
  const maskModeButtons = new Map<MaskStyle, HTMLButtonElement>();
  for (const style of ['fill', 'pixelate'] as const) {
    const button = el('button', 'mask-mode-btn');
    button.setAttribute('type', 'button');
    button.setAttribute('data-wb-mask', style);
    button.setAttribute('aria-pressed', String(style === maskStyle));
    button.addEventListener('click', () => {
      maskStyle = style;
      for (const [name, other] of maskModeButtons) {
        other.setAttribute('aria-pressed', String(name === maskStyle));
      }
    });
    maskMode.appendChild(button);
    maskModeButtons.set(style, button);
  }
  maskMode.insertBefore(maskModeLabel, maskMode.firstChild);

  const area = el('div', 'editor-area');
  const canvas = el('canvas', 'editor-canvas');
  canvas.setAttribute('role', 'img');
  area.appendChild(canvas);

  body.appendChild(rail);
  body.appendChild(maskMode);
  body.appendChild(area);

  const labelInput = el('input', 'text-label');
  labelInput.setAttribute('type', 'text');
  labelInput.setAttribute('autocomplete', 'off');
  labelInput.setAttribute('data-shown', 'false');

  // The once-per-session mask confirmation (P3-D-09, T-03-26): an alertdialog
  // over the editor with the four core-resolved strings. The dialog owns
  // `Escape` WHILE OPEN — its handler sits on the dialog element itself, so
  // the event never bubbles to the document where the editor's
  // Escape-to-Done listener sits (Pitfall 11: one owner, not a race). `Tab`
  // is trapped between the two buttons; focus starts on the `Mask` action.
  const maskDialogRoot = el('div', 'mask-dialog');
  maskDialogRoot.setAttribute('role', 'alertdialog');
  maskDialogRoot.setAttribute('aria-modal', 'true');
  maskDialogRoot.setAttribute('data-shown', 'false');
  const maskDialogTitle = el('h2', 'mask-dialog-title');
  const maskDialogBody = el('p', 'mask-dialog-body');
  maskDialogTitle.id = 'wb-mask-dialog-title';
  maskDialogBody.id = 'wb-mask-dialog-body';
  maskDialogRoot.setAttribute('aria-labelledby', 'wb-mask-dialog-title');
  maskDialogRoot.setAttribute('aria-describedby', 'wb-mask-dialog-body');
  const maskDialogActions = el('div', 'mask-dialog-actions');
  const maskDialogCancel = el('button', 'mask-dialog-cancel');
  const maskDialogAction = el('button', 'mask-dialog-action');
  for (const button of [maskDialogAction, maskDialogCancel]) {
    button.setAttribute('type', 'button');
  }
  maskDialogActions.appendChild(maskDialogCancel);
  maskDialogActions.appendChild(maskDialogAction);
  maskDialogRoot.appendChild(maskDialogTitle);
  maskDialogRoot.appendChild(maskDialogBody);
  maskDialogRoot.appendChild(maskDialogActions);
  maskDialogTitle.textContent = maskConfirm.title;
  maskDialogBody.textContent = maskConfirm.body;
  maskDialogAction.textContent = maskConfirm.action;
  maskDialogCancel.textContent = maskConfirm.cancel;

  const maskDialogIsOpen = (): boolean =>
    maskDialogRoot.getAttribute('data-shown') === 'true';
  maskDialogRoot.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!maskDialogIsOpen()) return;
    if (event.key === 'Escape') {
      // `Escape` means `Not now` — owned here, the editor must not also act.
      event.preventDefault();
      event.stopPropagation();
      maskDialogCancel.click();
      return;
    }
    if (event.key !== 'Tab') return;
    // The ~15-line focus trap: the dialog has exactly two tab stops. The
    // active element is read from the dialog's OWN root node — inside a
    // shadow root `document.activeElement` would only show the host.
    event.preventDefault();
    const order: HTMLButtonElement[] = [maskDialogAction, maskDialogCancel];
    const scope = maskDialogRoot.getRootNode() as ShadowRoot | Document;
    const current = order.indexOf(scope.activeElement as HTMLButtonElement);
    const step = event.shiftKey ? -1 : 1;
    const next = current < 0 ? order[0] : order[(current + step + order.length) % order.length];
    next.focus();
  });
  const maskDialog: MaskDialog = {
    root: maskDialogRoot,
    title: maskDialogTitle,
    body: maskDialogBody,
    action: maskDialogAction,
    cancel: maskDialogCancel,
    show(): void {
      maskDialogRoot.setAttribute('data-shown', 'true');
      maskDialogAction.focus();
    },
    hide(): void {
      maskDialogRoot.setAttribute('data-shown', 'false');
    },
    isOpen: maskDialogIsOpen,
  };

  root.appendChild(bar);
  root.appendChild(body);
  root.appendChild(labelInput);
  root.appendChild(maskDialogRoot);

  /** Re-resolve every `tEditor`-derived label (mount + locale re-render). */
  const renderCopy = (): void => {
    title.textContent = tEditor('editor.title');
    done.textContent = tEditor('editor.done');
    canvas.setAttribute('aria-label', tEditor('editor.canvas.label'));
    for (const name of TOOL_NAMES) {
      const button = tools.get(name);
      if (button === undefined) continue;
      const label = tEditor(TOOL_STRING[name]);
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    }
    const undoLabel = tEditor(TOOL_STRING.undo);
    undo.setAttribute('aria-label', undoLabel);
    undo.setAttribute('title', undoLabel);
    labelInput.setAttribute('aria-label', tEditor('editor.tool.text'));
    rail.setAttribute('aria-label', tEditor('editor.title'));
    // The mask lane's copy (the keys WDG-06 required complete in 03-05, now
    // referenced for the first time). The dialog copy is core-resolved and
    // never re-looked-up here.
    maskModeLabel.textContent = tEditor('editor.mask.mode.label');
    maskMode.setAttribute('aria-label', tEditor('editor.mask.mode.label'));
    const fillButton = maskModeButtons.get('fill');
    const pixelateButton = maskModeButtons.get('pixelate');
    if (fillButton !== undefined) {
      fillButton.textContent = tEditor('editor.mask.fill');
    }
    if (pixelateButton !== undefined) {
      pixelateButton.textContent = tEditor('editor.mask.pixelate');
    }
  };
  renderCopy();

  return {
    root,
    title,
    done,
    area,
    canvas,
    tools,
    undo,
    labelInput,
    maskMode,
    maskModeButtons,
    maskDialog,
    renderCopy,
  };
}

/**
 * Module flag: `EDITOR_CSS` is appended ONCE per page (the chunk module
 * evaluates once; a second `open()` reuses the already-appended rules rather
 * than duplicating them into the stylesheet).
 */
let cssInjected = false;

/**
 * Append the editor's CSS to the core's single `<style>` element — the one
 * `host.ts` marks `data-wb-core`. Finding it through the mount's root node
 * keeps the editor inside the SAME shadow root and the stylesheet count at
 * exactly one (UI-SPEC isolation; T-03-22). A missing marker is a build
 * regression, not something to paper over: it throws, and the core surfaces
 * the inline load error.
 */
export function injectEditorCss(mount: HTMLElement): void {
  if (cssInjected) return;
  const node = mount.getRootNode();
  const scope = node instanceof ShadowRoot || node instanceof Document ? node : null;
  const style = scope?.querySelector('style[data-wb-core]');
  if (style === null || style === undefined) {
    throw new Error('watchbug editor: the core stylesheet is missing its data-wb-core marker');
  }
  style.textContent = `${style.textContent ?? ''}\n${EDITOR_CSS}`;
  cssInjected = true;
}
