import { describe, it, expect } from 'vitest';
import { createI18n, TRANSLATIONS } from '../../sdk/src/widget/i18n';
import { WatchbugWidget } from '../../sdk/src/widget/WatchbugWidget';

describe('i18n', () => {
  it('createI18n() defaults to English', () => {
    const i18n = createI18n();
    expect(i18n.getLanguage()).toBe('en');
    expect(i18n.t('reportBug')).toBe('Report Bug');
  });

  it("t('reportBug') returns 'Report Bug' in English", () => {
    const i18n = createI18n('en');
    expect(i18n.t('reportBug')).toBe('Report Bug');
  });

  it("setLanguage('es') changes t('reportBug') to 'Reportar Error'", () => {
    const i18n = createI18n('en');
    i18n.setLanguage('es');
    expect(i18n.t('reportBug')).toBe('Reportar Error');
  });

  it('getLanguage() returns current language', () => {
    const i18n = createI18n('en');
    expect(i18n.getLanguage()).toBe('en');
    i18n.setLanguage('es');
    expect(i18n.getLanguage()).toBe('es');
    i18n.setLanguage('en');
    expect(i18n.getLanguage()).toBe('en');
  });

  it('All translation keys have both en and es values', () => {
    const keys = Object.keys(TRANSLATIONS);
    expect(keys.length).toBeGreaterThanOrEqual(10);
    for (const key of keys) {
      const entry = TRANSLATIONS[key];
      expect(entry.en, `missing en for ${key}`).toBeDefined();
      expect(entry.es, `missing es for ${key}`).toBeDefined();
      expect(typeof entry.en).toBe('string');
      expect(typeof entry.es).toBe('string');
      expect(entry.en.length).toBeGreaterThan(0);
      expect(entry.es.length).toBeGreaterThan(0);
    }
  });

  it('setLanguage with invalid language throws or falls back to en', () => {
    const i18n = createI18n('en');
    // Our implementation throws
    expect(() => (i18n as unknown as { setLanguage: (l: string) => void }).setLanguage('fr')).toThrow();
    // Still remains on previous language after throw
    expect(i18n.getLanguage()).toBe('en');
  });

  it('unknown key returns key itself', () => {
    const i18n = createI18n('en');
    expect(i18n.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('WatchbugWidget uses i18n for button text and updates on setLanguage', () => {
    const widget = new WatchbugWidget();
    document.body.appendChild(widget);
    const shadow = (widget as unknown as { _getShadowRoot: () => ShadowRoot })._getShadowRoot();
    expect(shadow).not.toBeNull();

    // Default should be English
    const reportBtn = shadow.querySelector('[data-action="report-bug"]') as HTMLElement;
    expect(reportBtn.getAttribute('aria-label')).toBe('Report Bug');

    // Switch to Spanish via widget API
    widget.setLanguage('es');
    expect(reportBtn.getAttribute('aria-label')).toBe('Reportar Error');
    expect(widget.getLanguage()).toBe('es');

    // Switch back
    widget.setLanguage('en');
    expect(reportBtn.getAttribute('aria-label')).toBe('Report Bug');
  });

  it('WatchbugWidget reads data-language attribute on connect', () => {
    // Simulate init() flow: create element, set attribute, append
    const widget = document.createElement('watchbug-widget') as WatchbugWidget;
    widget.setAttribute('data-language', 'es');
    document.body.appendChild(widget);

    // After connectedCallback, language should be es
    expect(widget.getLanguage()).toBe('es');
    const shadow = (widget as unknown as { _getShadowRoot: () => ShadowRoot })._getShadowRoot();
    const reportBtn = shadow.querySelector('[data-action="report-bug"]') as HTMLElement;
    expect(reportBtn.getAttribute('aria-label')).toBe('Reportar Error');
  });
});
