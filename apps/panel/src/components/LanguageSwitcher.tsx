import { t, type Lang } from '../i18n';

/**
 * P1-D-05 manual language selector. The choice is persisted by `App` in the
 * panel's own `localStorage` (`watchbug.lang`); labels stay endonyms
 * (English / Español) in both states, everything else around them is
 * translated through the active dictionary.
 */
export interface LanguageSwitcherProps {
  lang: Lang;
  onChange(lang: Lang): void;
}

export function LanguageSwitcher({ lang, onChange }: LanguageSwitcherProps) {
  const label = t(lang, 'languageLabel');
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-muted)',
      }}
    >
      {label}
      <select
        aria-label={label}
        value={lang}
        onChange={(event) => onChange(event.target.value as Lang)}
        style={{
          font: 'inherit',
          color: 'var(--color-text)',
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-1) var(--space-2)',
        }}
      >
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
    </label>
  );
}
