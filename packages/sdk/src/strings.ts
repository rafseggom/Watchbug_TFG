/**
 * The single visible-copy map (P2-D-04 / R-03): ID → English, no locale
 * detection, no switcher, no `es` map in this phase (i18n is WDG-06/Phase 3).
 *
 * Every string the widget shows lives here so Phase 3 can add `stringsEs` plus
 * a resolver without touching the widget core. `t()` performs `{placeholder}`
 * replacement only — a few bytes, no formatter machinery.
 *
 * Values are verbatim from `02-UI-SPEC.md` § Copywriting Contract (approved).
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
} as const;

/** The locked copy keys (P2-D-04). */
export type StringId = keyof typeof strings;

/**
 * Look up a locked string, substituting `{name}` placeholders when `vars` is
 * given. Placeholder-only: no pluralisation, no locale negotiation.
 */
export function t(id: StringId, vars?: Record<string, string | number>): string {
  const template: string = strings[id];
  if (vars === undefined) return template;
  let out = template;
  for (const [name, value] of Object.entries(vars)) {
    out = out.split(`{${name}}`).join(String(value));
  }
  return out;
}
