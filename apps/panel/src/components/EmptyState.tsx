import { useEffect, useMemo, useState } from 'react';
import { fetchSetup, type SetupInfo } from '../api';
import { t, type Lang } from '../i18n';

/**
 * P1-D-07 — the empty state **is** the product's onboarding: a copy-paste
 * `curl`, pre-filled with this instance's real project key, that pushes a
 * first report in seconds (paste → run → reload → it is in the list).
 *
 * The snippet is rendered as a React text node inside `<pre><code>` — never
 * as markup, never as a link (SEC-05 pass 2 applies to onboarding copy too).
 * The key comes from `GET /api/setup` (the public write-only capability), and
 * the command is built for the panel's own `location.origin`, so it always
 * targets the deployment the operator is looking at (same-origin through the
 * nginx proxy, A-10).
 */

/** RFC-4122 v4 id for the snippet's `Idempotency-Key` header. */
function newIdempotencyKey(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();
  // Insecure origins (plain-HTTP LAN deployments) lack randomUUID but keep
  // getRandomValues — same 128 bits, same v4 layout.
  const bytes = new Uint8Array(16);
  webCrypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The ready-to-copy command: CA-01's wire form verbatim — `POST
 * <origin>/api/incidents` with `X-Project-Key`, an `Idempotency-Key`, a
 * `meta` form part (small valid JSON body) and an `image` form part
 * referencing a local file.
 *
 * `curl -F 'meta={…}'` marks the field `Content-Type: application/json`,
 * which the ingest edge re-stringifies before validation (the onboarding
 * shape is covered by e2e, including an executed copy of this snippet).
 */
export function buildOnboardingCurl(origin: string, projectKey: string): string {
  const meta = JSON.stringify({
    type: 'bug',
    title: 'Hello from Watchbug',
    note: 'Sent by the onboarding curl from the panel empty state',
    url: '/',
  });
  return [
    `curl -X POST ${origin}/api/incidents \\`,
    `  -H "X-Project-Key: ${projectKey}" \\`,
    `  -H "Idempotency-Key: ${newIdempotencyKey()}" \\`,
    `  -F 'meta=${meta}' \\`,
    `  -F 'image=@screenshot.png'`,
  ].join('\n');
}

export interface EmptyStateProps {
  lang: Lang;
}

export function EmptyState({ lang }: EmptyStateProps) {
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSetup()
      .then((info) => {
        if (!cancelled) setSetup(info);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // One snippet per mount: re-renders must not reshuffle the copyable text.
  const curl = useMemo(
    () => (setup === null ? null : buildOnboardingCurl(globalThis.location.origin, setup.projectKey)),
    [setup],
  );

  return (
    <div style={{ padding: 'var(--space-5)', maxWidth: 760 }}>
      <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-lg)' }}>{t(lang, 'emptyTitle')}</h2>
      <p style={{ margin: '0 0 var(--space-3)', color: 'var(--color-text-muted)' }}>{t(lang, 'emptyBody')}</p>

      {curl !== null && (
        <pre
          style={{
            margin: '0 0 var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflowX: 'auto',
            fontSize: 'var(--font-size-sm)',
            whiteSpace: 'pre',
          }}
        >
          <code>{curl}</code>
        </pre>
      )}
      {curl === null && !failed && (
        <p style={{ margin: '0 0 var(--space-3)', color: 'var(--color-text-muted)' }}>{t(lang, 'emptyLoadingKey')}</p>
      )}
      {curl === null && failed && (
        <p style={{ margin: '0 0 var(--space-3)', color: 'var(--color-bug)' }}>{t(lang, 'emptyKeyError')}</p>
      )}

      <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{t(lang, 'emptyReload')}</p>
    </div>
  );
}
