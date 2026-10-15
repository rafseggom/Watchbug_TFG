/**
 * Panel i18n — hand-rolled `en`/`es` dictionaries (P1-D-05, RNF-03).
 *
 * No i18n library (STACK rejection list): two locales with no interpolation
 * complexity do not justify a dependency in the panel's bundle. Every visible
 * string in `App` / `ReportList` / `ReportDetail` / `EmptyState` /
 * `LanguageSwitcher` is looked up here — the `es` dictionary is typed as
 * `Record<keyof typeof en, string>`, so adding a key to `en` without its
 * Spanish twin is a **compile error**, not a runtime fallback.
 *
 * Language resolution order (P1-D-05):
 * 1. the manual choice persisted under `watchbug.lang` in the **panel's own**
 *    `localStorage` (the panel's storage never touches host-app storage —
 *    SEC-03 is about the SDK, not this operator UI);
 * 2. otherwise `navigator.language` — `es*` → Spanish, everything else →
 *    English.
 *
 * Only a manual switch persists; a first-visit user who never touches the
 * selector keeps auto-detecting on every load.
 */

export type Lang = 'en' | 'es';

export const LANG_STORAGE_KEY = 'watchbug.lang';

const en = {
  reports: 'Reports',
  loadError: 'Failed to load reports',
  errServer: 'the server returned an error',
  errTimeout: 'the request timed out',
  errInvalidJson: 'the server returned an unexpected response',
  errNetwork: 'could not reach the server',
  loading: 'Loading…',
  typeBug: 'Bug',
  typeFeedback: 'Feedback',
  statusPending: 'Pending',
  statusInProgress: 'In progress',
  statusResolved: 'Resolved',
  selectPrompt: 'Select a report on the left to see its details.',
  labelNote: 'Note',
  labelPage: 'Page',
  labelReporter: 'Reporter',
  labelEmail: 'Email',
  labelUserId: 'User id',
  labelReportId: 'Report id',
  screenshotAlt: 'Screenshot for report',
  emptyTitle: 'Send your first report',
  emptyBody: 'Copy this curl and run it in your terminal to push your first report.',
  emptyReload: 'Then reload this page — it will appear in the list.',
  emptyLoadingKey: 'Loading the onboarding snippet…',
  emptyKeyError: 'Could not load the project key from /api/setup.',
  languageLabel: 'Language',
} as const;

export type StringKey = keyof typeof en;

const es: Record<StringKey, string> = {
  reports: 'Reportes',
  loadError: 'Error al cargar los reportes',
  errServer: 'el servidor devolvió un error',
  errTimeout: 'la petición superó el tiempo de espera',
  errInvalidJson: 'el servidor devolvió una respuesta inesperada',
  errNetwork: 'no se pudo conectar con el servidor',
  loading: 'Cargando…',
  typeBug: 'Error',
  typeFeedback: 'Sugerencia',
  statusPending: 'Pendiente',
  statusInProgress: 'En curso',
  statusResolved: 'Resuelto',
  selectPrompt: 'Selecciona un reporte de la izquierda para ver sus detalles.',
  labelNote: 'Nota',
  labelPage: 'Página',
  labelReporter: 'Autor',
  labelEmail: 'Email',
  labelUserId: 'ID de usuario',
  labelReportId: 'ID del reporte',
  screenshotAlt: 'Captura del reporte',
  emptyTitle: 'Envía tu primer reporte',
  emptyBody: 'Copia este curl y ejecútalo en tu terminal para enviar tu primer reporte.',
  emptyReload: 'Luego recarga esta página — aparecerá en la lista.',
  emptyLoadingKey: 'Cargando el snippet de onboarding…',
  emptyKeyError: 'No se pudo cargar la clave del proyecto desde /api/setup.',
  languageLabel: 'Idioma',
};

export const STRINGS: Record<Lang, Record<StringKey, string>> = { en, es };

/** Dictionary lookup — the only way a panel string reaches the UI. */
export function t(lang: Lang, key: StringKey): string {
  return STRINGS[lang][key];
}

/** P1-D-05 detection: `es*` → Spanish, anything else (including no API) → English. */
export function detectLang(
  navigatorLanguage: string | undefined = globalThis.navigator?.language,
): Lang {
  return (navigatorLanguage ?? '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** The persisted manual choice, or `null` when the user never picked one. */
export function readStoredLang(): Lang | null {
  try {
    const stored = globalThis.localStorage?.getItem(LANG_STORAGE_KEY);
    return stored === 'es' || stored === 'en' ? stored : null;
  } catch {
    return null; // storage disabled (private mode) — fall back to detection
  }
}

/** Persists a **manual** choice; never called by auto-detection. */
export function storeLang(lang: Lang): void {
  try {
    globalThis.localStorage?.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* storage disabled — the choice still applies to this session */
  }
}

/** Startup resolution: persisted manual choice wins, then `navigator.language`. */
export function initialLang(): Lang {
  return readStoredLang() ?? detectLang();
}
