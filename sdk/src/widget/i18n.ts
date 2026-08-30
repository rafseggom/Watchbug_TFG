export type SupportedLanguage = 'en' | 'es';

export type Translations = Record<string, { en: string; es: string }>;

export const TRANSLATIONS: Translations = {
  reportBug: { en: 'Report Bug', es: 'Reportar Error' },
  sendFeedback: { en: 'Send Feedback', es: 'Enviar Comentarios' },
  close: { en: 'Close', es: 'Cerrar' },
  submit: { en: 'Send Report', es: 'Enviar Reporte' },
  pencil: { en: 'Pencil', es: 'Lápiz' },
  arrow: { en: 'Arrow', es: 'Flecha' },
  text: { en: 'Text', es: 'Texto' },
  maskRect: { en: 'Mask Rectangle', es: 'Máscara Rectangle' },
  maskPaint: { en: 'Mask Paint', es: 'Máscara Pintura' },
  success: { en: 'Report sent!', es: '¡Reporte enviado!' },
  retry: { en: 'Retry', es: 'Reintentar' },
  error: { en: 'Something went wrong', es: 'Algo salió mal' },
};

export type I18nInstance = {
  t(key: string): string;
  setLanguage(lang: SupportedLanguage): void;
  getLanguage(): SupportedLanguage;
};

export function createI18n(defaultLang: SupportedLanguage = 'en'): I18nInstance {
  let current: SupportedLanguage = defaultLang === 'es' ? 'es' : 'en';

  function assertValidLang(lang: string): asserts lang is SupportedLanguage {
    if (lang !== 'en' && lang !== 'es') {
      throw new Error(`[Watchbug i18n] Unsupported language: ${lang}. Supported: en, es`);
    }
  }

  return {
    t(key: string): string {
      const entry = TRANSLATIONS[key];
      if (!entry) return key;
      return entry[current] ?? entry.en ?? key;
    },
    setLanguage(lang: SupportedLanguage): void {
      if (lang !== 'en' && lang !== 'es') {
        // Per acceptance: throws or falls back to en — we throw for explicit invalid
        // but also handle graceful fallback for runtime misuse
        throw new Error(`[Watchbug i18n] Unsupported language: ${lang}`);
      }
      current = lang;
    },
    getLanguage(): SupportedLanguage {
      return current;
    },
  };
}
