import type { Incident } from '../api';
import { t, type Lang, type StringKey } from '../i18n';

/**
 * Left column: the incident list (P1-D-04). Selection is lifted to `App` so
 * the detail pane and the list share one source of truth. An empty list never
 * renders here — `App` shows `EmptyState` instead (P1-D-07).
 *
 * SEC-05 pass 2: every interpolated value is a React text node — the type,
 * status, title and date below are escaped by React, never concatenated into
 * HTML, never linkified.
 */
export interface ReportListProps {
  incidents: Incident[];
  selectedId: string | null;
  onSelect(id: string): void;
  lang: Lang;
  /** S-6: whether a further page exists behind the Load-more control. */
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore(): void;
}

const TYPE_KEY: Record<Incident['type'], StringKey> = { bug: 'typeBug', feedback: 'typeFeedback' };
const STATUS_KEY: Record<Incident['status'], StringKey> = {
  pending: 'statusPending',
  in_progress: 'statusInProgress',
  resolved: 'statusResolved',
};

export function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function ReportList({ incidents, selectedId, onSelect, lang, hasMore, loadingMore, onLoadMore }: ReportListProps) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 'var(--space-2)' }}>
      {incidents.map((incident) => (
        <li key={incident.id}>
          <button
            type="button"
            onClick={() => onSelect(incident.id)}
            aria-current={incident.id === selectedId ? 'true' : undefined}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: incident.id === selectedId ? 'var(--color-surface-alt)' : 'transparent',
              border: '1px solid transparent',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-2)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                color: incident.type === 'bug' ? 'var(--color-bug)' : 'var(--color-feedback)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {t(lang, TYPE_KEY[incident.type])}
            </span>
            <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {t(lang, STATUS_KEY[incident.status])}
            </span>
            <div style={{ marginTop: 'var(--space-1)' }}>{incident.title}</div>
            <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {formatCreatedAt(incident.createdAt)}
            </div>
          </button>
        </li>
      ))}
      {hasMore && (
        <li>
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              background: 'transparent',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              color: 'var(--color-text-muted)',
              cursor: loadingMore ? 'default' : 'pointer',
              font: 'inherit',
            }}
          >
            {loadingMore ? t(lang, 'loading') : t(lang, 'loadMore')}
          </button>
        </li>
      )}
    </ul>
  );
}
