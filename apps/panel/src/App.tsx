import { useEffect, useMemo, useState } from 'react';
import { fetchIncidents, type Incident } from './api';
import { ReportList } from './components/ReportList';
import { ReportDetail } from './components/ReportDetail';

/**
 * The triage screen (P1-D-04): a fixed left list and a right detail pane.
 * Data loads once on mount through the same-origin `/api` client; there is no
 * router and no state library — the panel is deliberately one screen (STACK
 * rejection list). First-run strings are English literals; the en/es
 * dictionaries land in 01-04 (P1-D-05).
 */
export function App() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        setError(err instanceof Error ? err.message : 'failed to load reports');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => incidents?.find((incident) => incident.id === selectedId) ?? null,
    [incidents, selectedId],
  );

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
        <header style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
          <h1 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Watchbug</h1>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Reports</div>
        </header>

        {error !== null && (
          <p style={{ padding: 'var(--space-4)', color: 'var(--color-bug)' }}>Failed to load reports: {error}</p>
        )}
        {incidents === null && error === null && (
          <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)' }}>Loading…</p>
        )}
        {incidents !== null && (
          <ReportList incidents={incidents} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </aside>

      <main style={{ flex: 1, minWidth: 0, background: 'var(--color-bg)' }}>
        <ReportDetail incident={selected} />
      </main>
    </div>
  );
}
