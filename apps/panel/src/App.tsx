import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, fetchIncidents, PAGE_SIZE, type ApiErrorCode, type Incident } from './api';
import { ReportList } from './components/ReportList';
import { ReportDetail } from './components/ReportDetail';
import { EmptyState } from './components/EmptyState';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { initialLang, storeLang, t, type Lang, type StringKey } from './i18n';

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
 *
 * S-6: the list is a bounded, paged read — one `PAGE_SIZE` page on mount, and
 * further rows only through the explicit "Load more" control (never the whole
 * table in one render). A failed request surfaces a localized failure category
 * (`ApiError.code`), never a raw exception message.
 */

/** Closed map from a failure category to its localized reason (T-m3x-02). */
const ERROR_KEY: Record<ApiErrorCode, StringKey> = {
  http: 'errServer',
  timeout: 'errTimeout',
  'invalid-json': 'errInvalidJson',
  network: 'errNetwork',
};

export function App() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<{ code: ApiErrorCode } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(initialLang);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const mountedRef = useRef(true);
  // Mirrors `incidents` for the load-more dedup without a nested state update.
  const incidentsRef = useRef<Incident[] | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    incidentsRef.current = incidents;
  }, [incidents]);

  useEffect(() => {
    let cancelled = false;
    fetchIncidents({ limit: PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setIncidents(page.rows);
        incidentsRef.current = page.rows;
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
        setSelectedId((current) => current ?? page.rows[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError({ code: err instanceof ApiError ? err.code : 'network' });
      });
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  /** Appends the next page; self-heals to hidden when a page yields nothing new. */
  const loadMore = (): void => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchIncidents({ limit: PAGE_SIZE, cursor })
      .then((page) => {
        if (!mountedRef.current) return;
        const existing = incidentsRef.current ?? [];
        const seen = new Set(existing.map((row) => row.id));
        const fresh = page.rows.filter((row) => !seen.has(row.id));
        if (fresh.length === 0) {
          setHasMore(false);
          return;
        }
        const next = [...existing, ...fresh];
        incidentsRef.current = next;
        setIncidents(next);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        setError({ code: err instanceof ApiError ? err.code : 'network' });
      })
      .finally(() => {
        if (mountedRef.current) setLoadingMore(false);
      });
  };

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
            {t(lang, 'loadError')}: {t(lang, ERROR_KEY[error.code])}
          </p>
        )}
        {incidents === null && error === null && (
          <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)' }}>{t(lang, 'loading')}</p>
        )}
        {incidents !== null && incidents.length === 0 && error === null && <EmptyState lang={lang} />}
        {incidents !== null && incidents.length > 0 && (
          <ReportList
            incidents={incidents}
            selectedId={selectedId}
            onSelect={setSelectedId}
            lang={lang}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />
        )}
      </aside>

      <main style={{ flex: 1, minWidth: 0, background: 'var(--color-bg)' }}>
        <ReportDetail incident={selected} lang={lang} />
      </main>
    </div>
  );
}
