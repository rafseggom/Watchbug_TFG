import type { Incident } from '../api';

/**
 * Left column: the incident list (P1-D-04). Selection is lifted to `App` so
 * the detail pane and the list share one source of truth.
 *
 * SEC-05 pass 2: every interpolated value is a React text node — the type,
 * title and date below are escaped by React, never concatenated into HTML.
 */
export interface ReportListProps {
  incidents: Incident[];
  selectedId: string | null;
  onSelect(id: string): void;
}

const TYPE_LABEL: Record<Incident['type'], string> = { bug: 'Bug', feedback: 'Feedback' };
const STATUS_LABEL: Record<Incident['status'], string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

export function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function ReportList({ incidents, selectedId, onSelect }: ReportListProps) {
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
              {TYPE_LABEL[incident.type]}
            </span>
            <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {STATUS_LABEL[incident.status]}
            </span>
            <div style={{ marginTop: 'var(--space-1)' }}>{incident.title}</div>
            <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {formatCreatedAt(incident.createdAt)}
            </div>
          </button>
        </li>
      ))}
      {incidents.length === 0 && (
        <li style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)' }}>No reports yet.</li>
      )}
    </ul>
  );
}
