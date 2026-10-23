/**
 * Floating status panel — the rendering half of the UI-SPEC state machine
 * (P2-D-02, UI-SPEC § Interaction & State Contract).
 *
 * This module owns *what* a state looks like; the transitions (`capturing` →
 * `sending` → …) belong to the pipeline that lands in 02-02 and calls
 * `render(view)`. Copy comes exclusively from the locked `strings` map via
 * `t()` (P2-D-04). Server-supplied text (a 4xx reason) is written with
 * `textContent` only and truncated to `MAX_REASON_CHARS` — the SDK renders
 * text, it never has an HTML sink (T-02-01 / SEC-05).
 *
 * Motion is CSS-only: the entrance is a 120 ms keyframe and the spinner a
 * 700 ms rotation, both removed or frozen under `prefers-reduced-motion`.
 */

import { t } from '../strings.ts';

/** Server reasons are capped so the 320 px panel stays bounded (UI-SPEC A-6). */
export const MAX_REASON_CHARS = 240;

/** Automatic retry budget (P2-D-03) — the `{max}` in `Retrying ({n} of {max})…`. */
export const RETRY_MAX_ATTEMPTS = 3;

/** The terminal failure classes of the state machine. */
export type StatusFailure = 'capture' | 'blank' | 'network' | 'rejected';

/** Everything the panel can be asked to render. */
export type StatusView =
  | { kind: 'idle' }
  | { kind: 'capturing' }
  | { kind: 'sending' }
  | { kind: 'retrying'; attempt: number; max?: number }
  | { kind: 'sent' }
  | { kind: 'failed'; failure: StatusFailure; reason?: string };

export interface StatusPanelHandlers {
  /** Same-turn `Try again` (a capture retry needs the click's activation). */
  onRetry: () => void;
  onDismiss: () => void;
}

export interface StatusPanel {
  readonly element: HTMLElement;
  render(view: StatusView): void;
  destroy(): void;
}

export const PANEL_CSS = `
.panel {
  position: fixed;
  right: var(--wb-space-4);
  bottom: 88px;
  box-sizing: border-box;
  width: min(320px, calc(100vw - 48px));
  margin: 0;
  padding: 16px;
  border: 1px solid var(--wb-color-border);
  border-radius: 8px;
  background: var(--wb-color-surface);
  box-shadow: 0 8px 24px rgba(27, 31, 38, 0.18);
  color: var(--wb-color-ink);
  font-family: inherit;
  font-size: 15px;
  font-weight: 400;
  line-height: 1.5;
  text-align: left;
  pointer-events: auto;
  animation: wb-panel-in 120ms ease-out;
}
.panel[data-hidden='true'] { display: none; }
.text { display: block; }
.head { display: flex; align-items: center; gap: 4px; }
.headline {
  margin: 0;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--wb-color-ink);
}
.panel--terminal .headline {
  font-size: 19px;
  line-height: 1.2;
}
.panel--failed .headline { color: var(--wb-color-danger); }
.glyph-success { color: var(--wb-color-success); }
.glyph-failure {
  color: var(--wb-color-danger);
  font-size: 19px;
  line-height: 1.2;
}
.hint, .reason {
  margin: 8px 0 0;
  font-family: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--wb-color-muted);
}
.reason {
  overflow-wrap: break-word;
  word-break: normal;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.action {
  height: 36px;
  box-sizing: border-box;
  margin: 0;
  padding: 0 16px;
  border: 1px solid var(--wb-color-border);
  border-radius: 6px;
  background: var(--wb-color-surface-alt);
  color: var(--wb-color-ink);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}
.action--primary {
  border-color: var(--wb-color-accent);
  background: var(--wb-color-accent);
  color: var(--wb-color-on-accent);
}
.action--primary:hover { background: var(--wb-color-accent-hover); }
.action--primary:active { background: var(--wb-color-accent-active); }
.action:focus-visible {
  outline: 2px solid var(--wb-color-accent);
  outline-offset: 2px;
}
.spinner {
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  border: 2px solid var(--wb-color-border);
  border-top-color: var(--wb-color-accent);
  border-radius: 6px;
  animation: wb-spin 700ms linear infinite;
}
@keyframes wb-panel-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes wb-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .panel { animation: none; }
  .spinner { animation: none; }
}
`;

/** Truncate to `max` chars total, ending in an ellipsis, at a word boundary. */
export function truncateReason(text: string, max: number = MAX_REASON_CHARS): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${base}…`;
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  if (className.length > 0) node.className = className;
  return node;
}

/**
 * Build the panel. It starts hidden (`idle` renders only the launcher).
 */
export function createStatusPanel(handlers: StatusPanelHandlers): StatusPanel {
  const panel = el('section', 'panel');
  panel.setAttribute('data-hidden', 'true');

  const text = el('div', 'text');
  text.setAttribute('role', 'status');
  text.setAttribute('aria-live', 'polite');

  const head = el('div', 'head');
  const spinner = el('span', 'spinner');
  spinner.setAttribute('aria-hidden', 'true');
  const failureGlyph = el('span', 'glyph-failure');
  failureGlyph.textContent = '✕';
  failureGlyph.setAttribute('aria-hidden', 'true');
  const headline = el('p', 'headline');

  head.appendChild(spinner);
  head.appendChild(failureGlyph);
  head.appendChild(headline);

  const hint = el('p', 'hint');
  const reason = el('p', 'reason');

  text.appendChild(head);
  text.appendChild(hint);
  text.appendChild(reason);

  const actions = el('div', 'actions');
  const retryButton = el('button', 'action action--primary');
  retryButton.setAttribute('type', 'button');
  retryButton.textContent = t('action.retry');
  const dismissButton = el('button', 'action');
  dismissButton.setAttribute('type', 'button');
  dismissButton.textContent = t('action.dismiss');
  actions.appendChild(retryButton);
  actions.appendChild(dismissButton);

  panel.appendChild(text);
  panel.appendChild(actions);

  const onRetry = (): void => {
    handlers.onRetry();
  };
  const onDismiss = (): void => {
    handlers.onDismiss();
  };
  retryButton.addEventListener('click', onRetry);
  dismissButton.addEventListener('click', onDismiss);

  const show = (node: HTMLElement, visible: boolean): void => {
    node.style.display = visible ? '' : 'none';
  };

  /**
   * Render the terminal success headline, colouring only the `✓` glyph while
   * keeping the locked copy string intact.
   */
  const renderSentHeadline = (): void => {
    const copy = t('status.sent');
    const at = copy.indexOf('✓');
    headline.textContent = '';
    if (at === -1) {
      headline.textContent = copy;
      return;
    }
    headline.appendChild(document.createTextNode(copy.slice(0, at)));
    const glyph = document.createElement('span');
    glyph.className = 'glyph-success';
    glyph.textContent = '✓';
    headline.appendChild(glyph);
    headline.appendChild(document.createTextNode(copy.slice(at + 1)));
  };

  const render = (view: StatusView): void => {
    const inFlight = view.kind === 'capturing' || view.kind === 'sending' || view.kind === 'retrying';
    const terminal = view.kind === 'sent' || view.kind === 'failed';
    const failed = view.kind === 'failed';

    panel.setAttribute('data-hidden', view.kind === 'idle' ? 'true' : 'false');
    panel.classList.toggle('panel--terminal', terminal);
    panel.classList.toggle('panel--failed', failed);

    if (view.kind === 'idle') {
      headline.textContent = '';
      hint.textContent = '';
      reason.textContent = '';
      return;
    }

    show(spinner, inFlight);
    show(failureGlyph, failed);
    show(actions, terminal);
    show(retryButton, failed);
    show(dismissButton, terminal);

    headline.textContent = '';
    hint.textContent = '';
    reason.textContent = '';

    if (failed) {
      headline.setAttribute('role', 'alert');
    } else {
      headline.removeAttribute('role');
    }

    switch (view.kind) {
      case 'capturing':
        headline.textContent = t('status.capturing');
        break;
      case 'sending':
        headline.textContent = t('status.sending');
        break;
      case 'retrying':
        headline.textContent = t('status.retrying', {
          n: view.attempt,
          max: view.max ?? RETRY_MAX_ATTEMPTS,
        });
        break;
      case 'sent':
        renderSentHeadline();
        break;
      case 'failed': {
        switch (view.failure) {
          case 'capture':
            headline.textContent = t('status.captureFailed');
            hint.textContent = t('status.captureFailed.hint');
            break;
          case 'blank':
            headline.textContent = t('status.blankCapture');
            hint.textContent = t('status.blankCapture.hint');
            break;
          case 'network':
            headline.textContent = t('status.sendFailed');
            hint.textContent = t('status.sendFailed.hint');
            break;
          case 'rejected': {
            headline.textContent = t('status.rejected');
            const serverReason = view.reason?.trim() ?? '';
            if (serverReason.length > 0) {
              reason.textContent = truncateReason(serverReason);
            }
            break;
          }
        }
        break;
      }
    }

    show(hint, (hint.textContent ?? '').length > 0);
    show(reason, (reason.textContent ?? '').length > 0);
  };

  return {
    element: panel,
    render,
    destroy(): void {
      retryButton.removeEventListener('click', onRetry);
      dismissButton.removeEventListener('click', onDismiss);
      panel.remove();
    },
  };
}
