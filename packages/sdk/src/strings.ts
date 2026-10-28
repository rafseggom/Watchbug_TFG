/**
 * The single visible-copy map (P2-D-04 / R-03). Every string the widget shows
 * lives here; `t()` performs `{placeholder}` replacement only — a few bytes,
 * no formatter machinery.
 *
 * Values are verbatim from the approved copy maps:
 *  - EN: `02-UI-SPEC.md` § Copywriting Contract (Phase 2) and
 *        `03-UI-SPEC.md` § Copywriting Contract (Phase 3).
 *  - ES: `03-UI-SPEC.md` § Full string map, typed as
 *        `Record<StringId, string>` so a key without its Spanish twin is a
 *        **compile error**, not a silent fallback (the same discipline as
 *        `apps/panel/src/i18n.ts`).
 *
 * Dictionary placement (plan 03-03 flagged decision, resolving the ROADMAP
 * "dictionaries live in the lazy chunk" note): CORE carries
 * launcher / status / action / composer / review / mask-confirm / i18n copy in
 * both locales, because A-2 loads the editor chunk only at `Annotate image`
 * and the composer — including its degraded and text-only states — must
 * localise without it. The lazy chunk carries `editor.*` only (`strings.
 * editor.ts`, plan 03-05); the four `mask.confirm.*` keys and the annotate
 * button's `editor.loading` / `editor.load.error*` states stay here because
 * the core composer renders those states before any chunk exists. The lazy
 * lane must never value-import this module: it would inline a second copy of
 * the dictionary and a second locale switch.
 *
 * The locale resolver (`detectLocale` / `setLocale` / `locale`) lands in this
 * file with plan 03-03 Task 3; `t()`'s signature is stable throughout.
 */
export const strings = {
  'launcher.label': 'Report a bug',
  'status.capturing': 'Capturing…',
  'status.sending': 'Sending…',
  'status.retrying': 'Retrying ({n} of {max})…',
  'status.sent': 'Report sent ✓',
  'status.captureFailed': "Couldn't capture the screen.",
  'status.captureFailed.hint': 'Nothing was sent. Allow screen sharing, then try again.',
  'status.blankCapture': 'The capture came back blank.',
  'status.blankCapture.hint':
    'Nothing was sent. Try again — if it keeps failing, the page may be too large to capture.',
  'status.sendFailed': "Couldn't send the report.",
  'status.sendFailed.hint': 'Nothing was sent. Check your connection, then try again.',
  'status.rejected': 'The server rejected the report.',
  'action.retry': 'Try again',
  'action.dismiss': 'Dismiss',
  'composer.heading.bug': 'Report a bug',
  'composer.heading.feedback': 'Send feedback',
  'composer.type.label': 'What is this?',
  'composer.type.bug': 'Bug',
  'composer.type.feedback': 'Feedback',
  'composer.title.label': 'Title',
  'composer.title.error': 'Add a title to continue.',
  'composer.note.label': 'Details (optional)',
  'composer.note.placeholder': 'What were you doing? What did you expect?',
  'composer.note.counter': '{used} / {max}',
  'composer.image.label': 'Screenshot',
  'composer.image.none': 'Capture unavailable',
  'composer.image.none.hint': 'Attach an image, or continue with text only.',
  'composer.annotate': 'Annotate image',
  'composer.replace': 'Replace image',
  'composer.attach': 'Attach image',
  'composer.continueTextOnly': 'Continue with text only',
  'composer.attach.error': "That file can't be attached.",
  'composer.attach.error.hint': 'Use a PNG, WebP or JPEG image under 16 MP.',
  'composer.review': 'Review report',
  'composer.discard': 'Discard report',
  'review.title': 'Ready to send',
  'review.sendNote': 'This is what will be sent.',
  'review.summary.title': 'Title',
  'review.summary.note': 'Details',
  'review.summary.noImage': 'No image',
  'review.edit': 'Edit report',
  'review.send': 'Send report',
  'i18n.label': 'Language',
  'i18n.en': 'English',
  'i18n.es': 'Español',
  // The annotate button's states live in the core composer (before the chunk
  // exists), so these three keys are core copy; the editor's own dictionary is
  // the lazy `strings.editor.ts` (03-05).
  'editor.loading': 'Loading…',
  'editor.load.error': "Couldn't load the editor.",
  'editor.load.error.hint': 'Nothing was changed. Check your connection, then try again.',
  // The mask dialog renders in the lazy lane; core resolves these through
  // `t()` and passes them to `AnnotatorOpenOptions.maskConfirm` (03-05).
  'mask.confirm.title': 'Masking is permanent',
  'mask.confirm.body':
    "A masked region is destroyed at the pixel level and can't be recovered — by you or anyone else.",
  'mask.confirm.action': 'Mask',
  'mask.confirm.cancel': 'Not now',
} as const;

/** The locked copy keys (P2-D-04 / the Phase 3 string map). */
export type StringId = keyof typeof strings;

/** The Spanish twin — a missing translation here is a compile error. */
export const stringsEs: Record<StringId, string> = {
  'launcher.label': 'Reportar un error',
  'status.capturing': 'Capturando…',
  'status.sending': 'Enviando…',
  'status.retrying': 'Reintentando ({n} de {max})…',
  'status.sent': 'Informe enviado ✓',
  'status.captureFailed': 'No se pudo capturar la pantalla.',
  'status.captureFailed.hint':
    'No se envió nada. Permite compartir pantalla e inténtalo de nuevo.',
  'status.blankCapture': 'La captura salió en blanco.',
  'status.blankCapture.hint':
    'No se envió nada. Inténtalo de nuevo; si sigue fallando, la página puede ser demasiado grande para capturar.',
  'status.sendFailed': 'No se pudo enviar el informe.',
  'status.sendFailed.hint':
    'No se envió nada. Revisa tu conexión e inténtalo de nuevo.',
  'status.rejected': 'El servidor rechazó el informe.',
  'action.retry': 'Reintentar',
  'action.dismiss': 'Cerrar',
  'composer.heading.bug': 'Reportar un error',
  'composer.heading.feedback': 'Enviar una sugerencia',
  'composer.type.label': '¿Qué es esto?',
  'composer.type.bug': 'Error',
  'composer.type.feedback': 'Sugerencia',
  'composer.title.label': 'Título',
  'composer.title.error': 'Añade un título para continuar.',
  'composer.note.label': 'Detalles (opcional)',
  'composer.note.placeholder': '¿Qué estabas haciendo? ¿Qué esperabas?',
  'composer.note.counter': '{used} / {max}',
  'composer.image.label': 'Captura',
  'composer.image.none': 'Captura no disponible',
  'composer.image.none.hint': 'Adjunta una imagen o continúa solo con texto.',
  'composer.annotate': 'Anotar imagen',
  'composer.replace': 'Reemplazar imagen',
  'composer.attach': 'Adjuntar imagen',
  'composer.continueTextOnly': 'Continuar solo con texto',
  'composer.attach.error': 'Ese archivo no se puede adjuntar.',
  'composer.attach.error.hint':
    'Usa una imagen PNG, WebP o JPEG de menos de 16 MP.',
  'composer.review': 'Revisar informe',
  'composer.discard': 'Descartar informe',
  'review.title': 'Listo para enviar',
  'review.sendNote': 'Esto es lo que se enviará.',
  'review.summary.title': 'Título',
  'review.summary.note': 'Detalles',
  'review.summary.noImage': 'Sin imagen',
  'review.edit': 'Editar informe',
  'review.send': 'Enviar informe',
  'i18n.label': 'Idioma',
  'i18n.en': 'Inglés',
  'i18n.es': 'Español',
  'editor.loading': 'Cargando…',
  'editor.load.error': 'No se pudo cargar el editor.',
  'editor.load.error.hint':
    'No se cambió nada. Revisa tu conexión e inténtalo de nuevo.',
  'mask.confirm.title': 'La máscara es permanente',
  'mask.confirm.body':
    'La región enmascarada se destruye a nivel de píxel y no se puede recuperar, ni por ti ni por nadie más.',
  'mask.confirm.action': 'Enmascarar',
  'mask.confirm.cancel': 'Ahora no',
};

/**
 * Look up a locked string in the ACTIVE locale (set once at `init()` from
 * `detectLocale`, switched only by the composer's EN/ES pair), substituting
 * `{name}` placeholders when `vars` is given. Placeholder-only: no
 * pluralisation, no `Intl` machinery. The dictionary is the single source of
 * copy, never a literal.
 */
export function t(id: StringId, vars?: Record<string, string | number>): string {
  const template: string = STRINGS[activeLocale][id];
  if (vars === undefined) return template;
  let out = template;
  for (const [name, value] of Object.entries(vars)) {
    out = out.split(`{${name}}`).join(String(value));
  }
  return out;
}

/** The two shipped locales (RNF-03). */
export type Locale = 'en' | 'es';

const STRINGS: Record<Locale, Record<StringId, string>> = {
  en: strings,
  es: stringsEs,
};

/**
 * The active locale. Session-scoped IN MEMORY on purpose: an injected
 * third-party script may not read or write the host page's storage (SEC-03 /
 * the `sdk-no-host-storage` gate), so the manual override applies to this page
 * load only and the next load re-detects. UI-SPEC A-1 records the deviation
 * from the panel's persisted-selector pattern for exactly this reason.
 */
let activeLocale: Locale = 'en';

/** WDG-06 auto-detection: `es*` → Spanish, everything else → English. */
export function detectLocale(navigatorLanguage?: string): Locale {
  const language =
    navigatorLanguage ?? (typeof navigator === 'undefined' ? undefined : navigator.language);
  return (language ?? '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** The switcher's entry — after it, `t()` reads the new dictionary. */
export function setLocale(locale: Locale): void {
  activeLocale = locale;
}

/** The locale currently in force — the declared `lang` must agree with it. */
export function locale(): Locale {
  return activeLocale;
}
