/**
 * The editor dictionary (WDG-06 editor lane). It lives in the LAZY lane — the
 * only `editor.*` copy the chunk carries — and is imported exclusively by
 * `annotator.ts` and its internals (PATTERNS §7: "imported **only** from
 * `annotator.ts`, or the editor copy lands in core"). The annotate button's
 * `editor.loading` / `editor.load.error*` states are CORE copy (03-03, OQ-4):
 * they render while no chunk exists.
 *
 * EN+ES, verbatim from `03-UI-SPEC.md` § Full string map. `stringsEs` is typed
 * `Record<EditorStringId, string>` so a missing Spanish twin is a **compile
 * error**, mirroring `strings.ts` (P2-D-04 discipline, R-18 one shape).
 *
 * The locale arrives through `AnnotatorOpenOptions.locale` — core resolves it
 * and hands it over, so the two dictionaries cannot disagree (WDG-06). The
 * lazy lane never value-imports `strings.ts`: that would inline a second copy
 * of the core dictionary and a second locale switch into the chunk.
 */

/** The locales the editor speaks — identical to core's `Locale`. */
export type EditorLocale = 'en' | 'es';

const editorEn = {
  'editor.title': 'Annotate',
  'editor.done': 'Done',
  'editor.canvas.label': 'Screenshot with annotations',
  'editor.tool.freehand': 'Draw',
  'editor.tool.arrow': 'Arrow',
  'editor.tool.rectangle': 'Rectangle',
  'editor.tool.text': 'Text',
  'editor.tool.mask': 'Mask',
  'editor.tool.undo': 'Undo',
  'editor.mask.mode.label': 'Mask style',
  'editor.mask.fill': 'Fill',
  'editor.mask.pixelate': 'Pixelate',
} as const;

/** Every editor string key — derived from the English dictionary. */
export type EditorStringId = keyof typeof editorEn;

/** The Spanish twin — a missing translation here is a compile error. */
const editorEs: Record<EditorStringId, string> = {
  'editor.title': 'Anotar',
  'editor.done': 'Listo',
  'editor.canvas.label': 'Captura con anotaciones',
  'editor.tool.freehand': 'Dibujar',
  'editor.tool.arrow': 'Flecha',
  'editor.tool.rectangle': 'Rectángulo',
  'editor.tool.text': 'Texto',
  'editor.tool.mask': 'Enmascarar',
  'editor.tool.undo': 'Deshacer',
  'editor.mask.mode.label': 'Estilo de máscara',
  'editor.mask.fill': 'Relleno',
  'editor.mask.pixelate': 'Pixelar',
};

/** Both locales, one shape (the `strings.ts` map discipline, lazy lane). */
export const STRINGS_EDITOR: Record<EditorLocale, Record<EditorStringId, string>> = {
  en: editorEn,
  es: editorEs,
};

/**
 * The locale `tEditor` reads. Set at every `open()` from the value core passed
 * in, so editor chrome and core surfaces always render the same language.
 */
let activeEditorLocale: EditorLocale = 'en';

export function setEditorLocale(locale: EditorLocale): void {
  activeEditorLocale = locale;
}

/** Look up one editor string in the active locale. No placeholders needed. */
export function tEditor(id: EditorStringId): string {
  return STRINGS_EDITOR[activeEditorLocale][id];
}
