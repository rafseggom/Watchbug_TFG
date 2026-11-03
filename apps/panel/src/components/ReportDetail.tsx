import { incidentImageUrl, type Incident } from '../api';
import { t, type Lang, type StringKey } from '../i18n';
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
  lang: Lang;
}

const STATUS_KEY: Record<Incident['status'], StringKey> = {
  pending: 'statusPending',
  in_progress: 'statusInProgress',
  resolved: 'statusResolved',
};
const TYPE_KEY: Record<Incident['type'], StringKey> = { bug: 'typeBug', feedback: 'typeFeedback' };

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-1) 0' }}>
      <dt style={{ minWidth: 110, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{label}</dt>
      <dd style={{ margin: 0, wordBreak: 'break-word' }}>{value}</dd>
    </div>
  );
}

export function ReportDetail({ incident, lang }: ReportDetailProps) {
  if (incident === null) {
    return (
      <p style={{ padding: 'var(--space-5)', color: 'var(--color-text-muted)' }}>{t(lang, 'selectPrompt')}</p>
    );
  }

  return (
    <div style={{ padding: 'var(--space-5)' }}>
      <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-lg)' }}>{incident.title}</h2>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        {t(lang, TYPE_KEY[incident.type])} · {t(lang, STATUS_KEY[incident.status])} · {formatCreatedAt(incident.createdAt)}
      </div>

      {/* CAP-03 tolerance: a text-only report carries `contentType: null` and
          has no blob behind the route — render no screenshot element at all
          (never a broken image). Tolerance only; no new panel feature. */}
      {incident.contentType !== null && (
        <img
          src={incidentImageUrl(incident.id)}
          alt={`${t(lang, 'screenshotAlt')}: ${incident.title}`}
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
      )}

      <dl style={{ margin: 0 }}>
        <MetaRow label={t(lang, 'labelNote')} value={incident.note} />
        <MetaRow label={t(lang, 'labelPage')} value={incident.url} />
        <MetaRow label={t(lang, 'labelReporter')} value={incident.user?.name ?? null} />
        <MetaRow label={t(lang, 'labelEmail')} value={incident.user?.email ?? null} />
        <MetaRow label={t(lang, 'labelUserId')} value={incident.user?.id ?? null} />
        <MetaRow label={t(lang, 'labelReportId')} value={incident.id} />
      </dl>
    </div>
  );
}
