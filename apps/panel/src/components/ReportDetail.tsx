import { incidentImageUrl, type Incident } from '../api';
import { formatCreatedAt } from './ReportList';

/**
 * Right column: the selected report with its screenshot (P1-D-04).
 *
 * SEC-05 pass 2 (C-3 render half): the image is a real `<img>` whose `src`
 * comes **only** from `incidentImageUrl(id)` — the server's blob route, fetched
 * same-origin with the hardened response headers (`nosniff`, attachment
 * disposition, `CORP: same-origin`); a report field can never become an image
 * source. Every report field renders as a React text node (auto-escaped) and
 * nothing is ever linkified: the panel has no HTML-rendering sink of any kind
 * (STACK rejection list). The absence of that sink is enforced by the
 * source-gate row in `e2e/hostile.spec.ts`, its inertness by the DOM rows
 * there — neither alone is the control (Pattern 7, C-3).
 */
export interface ReportDetailProps {
  incident: Incident | null;
}

const STATUS_LABEL: Record<Incident['status'], string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-1) 0' }}>
      <dt style={{ minWidth: 110, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{label}</dt>
      <dd style={{ margin: 0, wordBreak: 'break-word' }}>{value}</dd>
    </div>
  );
}

export function ReportDetail({ incident }: ReportDetailProps) {
  if (incident === null) {
    return (
      <p style={{ padding: 'var(--space-5)', color: 'var(--color-text-muted)' }}>
        Select a report on the left to see its details.
      </p>
    );
  }

  return (
    <div style={{ padding: 'var(--space-5)' }}>
      <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-lg)' }}>{incident.title}</h2>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        {incident.type === 'bug' ? 'Bug' : 'Feedback'} · {STATUS_LABEL[incident.status]} · {formatCreatedAt(incident.createdAt)}
      </div>

      <img
        src={incidentImageUrl(incident.id)}
        alt={`Screenshot for report: ${incident.title}`}
        style={{
          display: 'block',
          margin: 'var(--space-4) 0',
          maxWidth: '100%',
          maxHeight: 480,
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface-alt)',
        }}
      />

      <dl style={{ margin: 0 }}>
        <MetaRow label="Note" value={incident.note} />
        <MetaRow label="Page" value={incident.url} />
        <MetaRow label="Reporter" value={incident.user?.name ?? null} />
        <MetaRow label="Email" value={incident.user?.email ?? null} />
        <MetaRow label="User id" value={incident.user?.id ?? null} />
        <MetaRow label="Report id" value={incident.id} />
      </dl>
    </div>
  );
}
