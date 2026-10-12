import { useEffect, useMemo, useState } from 'react';
import { fetchIncidents, type Incident } from './api';
import { ReportList } from './components/ReportList';
import { ReportDetail } from './components/ReportDetail';
import { EmptyState } from './components/EmptyState';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { initialLang, storeLang, t, type Lang } from './i18n';

/**
 * The triage screen (P1-D-04): a fixed left list and a right detail pane.
 * Data loads once on mount through the same-origin `/api` client; there is no
 * router and no state library — the panel is deliberately one screen (STACK
 * rejection list).
 *
 * P1-D-05: the UI language starts from the persisted manual choice or
 * `navigator.language` (`i18n.initialLang`); switching through
 * `LanguageSwitcher` persists to the panel's own `localStorage`. P1-D-07:
 * an empty list renders `EmptyState` — the onboarding curl — instead of the
 * list, so a fresh instance converts to a first report in seconds.
 */
export function App() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    let cancelled = false;
    fetchIncidents()
      .then((rows) => {
        if (cancelled) return;
        setIncidents(rows);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'fetch failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => incidents?.find((incident) => incident.id === selectedId) ?? null,
    [incidents, selectedId],
  );

  /** Manual switch — the only path that writes `watchbug.lang`. */
  const switchLang = (next: Lang): void => {
    storeLang(next);
    setLang(next);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 'var(--layout-list-width)',
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          overflowY: 'auto',
        }}
      >
        <header
          style={{
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Watchbug</h1>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {t(lang, 'reports')}
            </div>
          </div>
          <LanguageSwitcher lang={lang} onChange={switchLang} />
        </header>

        {error !== null && (
          <p style={{ padding: 'var(--space-4)', color: 'var(--color-bug)' }}>
            {t(lang, 'loadError')}: {error}
          </p>
        )}
        {incidents === null && error === null && (
          <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)' }}>{t(lang, 'loading')}</p>
        )}
        {incidents !== null && incidents.length === 0 && <EmptyState lang={lang} />}
        {incidents !== null && incidents.length > 0 && (
          <ReportList incidents={incidents} selectedId={selectedId} onSelect={setSelectedId} lang={lang} />
        )}
      </aside>

      <main style={{ flex: 1, minWidth: 0, background: 'var(--color-bg)' }}>
        <ReportDetail incident={selected} lang={lang} />
      </main>
    </div>
  );
}
