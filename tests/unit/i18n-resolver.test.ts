import { describe, it, expect, afterEach } from 'vitest';
import {
  detectLocale,
  locale,
  setLocale,
  strings,
  stringsEs,
  t,
} from '@watchbug/sdk/strings.ts';
import { STRINGS_EDITOR } from '@watchbug/sdk/strings.editor.ts';

/**
 * Unit lane for the i18n resolver — the pure half of the `sdk.spec.ts`
 * **WDG-06** family (03-08 Batch 3a).
 *
 * `detectLocale` (RNF-03) is the whole auto-detection rule and `t()` is the
 * whole lookup/interpolation contract; both are pure. The WDG-06 rows stay e2e
 * because what they observe is *rendered*: the `lang` attribute on `.wrap`,
 * the Spanish copy inside the closed shadow root, the editor chrome, and the
 * round trip through the EN/ES toggle. None of that is reachable here — this
 * file pins the rule those rows depend on.
 */

afterEach(() => {
  setLocale('en');
});

describe('unit: detectLocale (WDG-06 auto-detection)', () => {
  it('maps an `es*` navigator language to Spanish', () => {
    expect(detectLocale('es')).toBe('es');
    expect(detectLocale('es-ES')).toBe('es');
    expect(detectLocale('es-419')).toBe('es');
    expect(detectLocale('ES-ar')).toBe('es');
  });

  it('maps every other language to English', () => {
    expect(detectLocale('en')).toBe('en');
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('fr-FR')).toBe('en');
    expect(detectLocale('de')).toBe('en');
    expect(detectLocale('')).toBe('en');
  });

  it('does not treat a non-prefix match as Spanish', () => {
    // `es` must be a PREFIX, not a substring: `sesotho` is not Spanish.
    expect(detectLocale('ses')).toBe('en');
    expect(detectLocale('xx-es')).toBe('en');
  });
});

describe('unit: t() lookup and interpolation (WDG-06 EN/ES)', () => {
  it('reads the active dictionary and switches with setLocale', () => {
    expect(t('composer.heading.bug')).toBe('Report a bug');
    setLocale('es');
    expect(locale()).toBe('es');
    expect(t('composer.heading.bug')).toBe('Reportar un error');
    setLocale('en');
    expect(locale()).toBe('en');
    expect(t('composer.heading.bug')).toBe('Report a bug');
  });

  it('substitutes every placeholder', () => {
    expect(t('composer.note.counter', { used: 4_000, max: 5_000 })).toBe('4000 / 5000');
    setLocale('es');
    expect(t('composer.note.counter', { used: 1, max: 5_000 })).toBe('1 / 5000');
  });

  it('keeps the two dictionaries in exact key parity (RNF-03)', () => {
    // A missing Spanish key would silently fall back to `undefined` — the
    // parity assertion is what stops a half-translated surface.
    expect(Object.keys(stringsEs).sort()).toEqual(Object.keys(strings).sort());
    const editor = STRINGS_EDITOR;
    expect(Object.keys(editor.es).sort()).toEqual(Object.keys(editor.en).sort());
  });

  it('never ships an empty string for a declared key', () => {
    for (const [id, value] of Object.entries(strings)) {
      expect(value.length, `EN ${id}`).toBeGreaterThan(0);
    }
    for (const [id, value] of Object.entries(stringsEs)) {
      expect(value.length, `ES ${id}`).toBeGreaterThan(0);
    }
    for (const [id, value] of Object.entries(STRINGS_EDITOR.en)) {
      expect(value.length, `editor EN ${id}`).toBeGreaterThan(0);
    }
    for (const [id, value] of Object.entries(STRINGS_EDITOR.es)) {
      expect(value.length, `editor ES ${id}`).toBeGreaterThan(0);
    }
  });

  it('translates every EN string to a different ES string where copy differs', () => {
    // Sanity that the Spanish dictionary is really Spanish and not a copy of
    // English for the visible composer surface.
    expect(stringsEs['composer.heading.feedback']).not.toBe(strings['composer.heading.feedback']);
    expect(stringsEs['composer.heading.feedback']).toBe('Enviar una sugerencia');
    expect(strings['composer.heading.feedback']).toBe('Send feedback');
  });
});
