/**
 * The review screen (PRV-07, P3-D-16) — the literal "this is what will be
 * sent" moment before the irreversible send.
 *
 * It receives the draft whose `encoded` artifact `encodeFinal` already
 * produced at Review entry, decodes that blob back (`createImageBitmap`) and
 * paints it — so the pixels on screen ARE the bytes about to leave the
 * browser (T-03-17), not a re-render from the live draft. `Send report`
 * transmits the same blob; nothing here ever encodes.
 *
 * Same module skeleton as `status-panel.ts` / `composer.ts`: one `REVIEW_CSS`
 * literal (tokens + px only), `createReview(handlers)` returning
 * `{ element, render, destroy }`, all copy via `t()`, every string written
 * through `textContent` (no HTML sink, T-03-14 — the host-controlled title
 * included), and exactly one document-level `Escape` listener owned by the
 * visible surface (Pitfall 11).
 *
 * Per UI-SPEC a11y, focus moves to `Edit report` on open — `Send report` is
 * deliberately not the default focus target.
 */
import type { Draft } from '../capture/pipeline.ts';
import { truncateReason } from './status-panel.ts';
import { t } from '../strings.ts';

/** Review-summary note display cap; the FULL note still rides the wire. */
export const REVIEW_NOTE_DISPLAY_CHARS = 280;

export interface ReviewHandlers {
  /** Back to the composer with the draft untouched (lossless round-trip). */
  onEdit: (draft: Draft) => void;
  /** Transmit the encoded artifact exactly as reviewed — one request. */
  onSend: (draft: Draft) => void;
}

export interface Review {
  readonly element: HTMLElement;
  /** Show one drafted-and-encoded report; `null` hides and releases Escape. */
  render(draft: Draft | null): void;
  destroy(): void;
}

export const REVIEW_CSS = `
.review {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  width: min(720px, calc(100vw - 32px));
  max-height: min(90vh, calc(100vh - 32px));
  overflow-y: auto;
  margin: 0;
  padding: 16px;
  border: 1px solid var(--wb-color-border);
  border-radius: 8px;
  background: var(--wb-color-surface);
  box-shadow: 0 8px 24px rgba(27, 31, 38, 0.18);
  color: var(--wb-color-ink);
  font-family: inherit;
  font-size: 15px;
  line-height: 1.5;
  text-align: left;
  pointer-events: auto;
  animation: wb-panel-in 120ms ease-out;
}
.review[data-hidden='true'] { display: none; }
.review-header { margin-bottom: 16px; }
.review-heading {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.review-send-note {
  margin: 4px 0 0;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--wb-color-muted);
}
.review-image {
  display: block;
  box-sizing: border-box;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 420px;
  margin: 0 auto;
  border: 1px solid var(--wb-color-border);
  background: var(--wb-color-surface-alt);
}
.review-summary {
  margin: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.review-summary-row {
  margin: 0;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.summary-label {
  display: block;
  font-size: 13px;
  font-weight: 400;
  color: var(--wb-color-muted);
}
.summary-value {
  font-size: 15px;
  font-weight: 400;
  color: var(--wb-color-ink);
}
.review-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.review-button {
  height: 36px;
  box-sizing: border-box;
  margin: 0;
  padding: 0 16px;
  border: 1px solid var(--wb-color-border);
  border-radius: 6px;
  background: var(--wb-color-surface-alt);
  color: var(--wb-color-ink);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}
.review-button--primary {
  border-color: var(--wb-color-accent);
  background: var(--wb-color-accent);
  color: var(--wb-color-on-accent);
}
.review-button--primary:hover { background: var(--wb-color-accent-hover); }
.review-button--primary:active { background: var(--wb-color-accent-active); }
.review-button:focus-visible {
  outline: 2px solid var(--wb-color-accent);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .review { animation: none; }
}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className.length > 0) node.className = className;
  return node;
}

/** One `data-wb-summary` row: a muted 13 px label over the inked value. */
function summaryRow(kind: string): { row: HTMLElement; label: HTMLElement; value: HTMLElement } {
  const row = el('p', 'review-summary-row');
  row.setAttribute('data-wb-summary', kind);
  const label = el('span', 'summary-label');
  const value = el('span', 'summary-value');
  row.appendChild(label);
  row.appendChild(value);
  return { row, label, value };
}

export function createReview(handlers: ReviewHandlers): Review {
  const review = el('section', 'review');
  review.setAttribute('data-hidden', 'true');

  const header = el('div', 'review-header');
  const heading = el('h2', 'review-heading');
  const sendNoteLine = el('p', 'review-send-note');
  header.appendChild(heading);
  header.appendChild(sendNoteLine);

  const canvas = document.createElement('canvas');
  canvas.className = 'review-image';
  canvas.setAttribute('role', 'img');

  const summary = el('div', 'review-summary');
  const typeRow = summaryRow('type');
  const titleRow = summaryRow('title');
  const noteRow = summaryRow('note');
  const imageRow = summaryRow('image');
  summary.appendChild(typeRow.row);
  summary.appendChild(titleRow.row);
  summary.appendChild(noteRow.row);
  summary.appendChild(imageRow.row);

  const footer = el('div', 'review-footer');
  const editButton = el('button', 'review-button review-edit');
  const sendButton = el('button', 'review-button review-button--primary review-send');
  for (const button of [editButton, sendButton]) button.setAttribute('type', 'button');
  footer.appendChild(editButton);
  footer.appendChild(sendButton);

  review.appendChild(header);
  review.appendChild(canvas);
  review.appendChild(summary);
  review.appendChild(footer);

  const context = canvas.getContext('2d');

  let draft: Draft | null = null;
  let open = false;
  let escapeListening = false;
  let drawing = 0;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    if (!open || draft === null) return;
    event.preventDefault();
    // Escape leaves the review the same way `Edit report` does: the draft
    // survives, the composer shows it again (UI-SPEC exit table).
    handlers.onEdit(draft);
  };

  const setEscapeListening = (listening: boolean): void => {
    if (listening === escapeListening) return;
    escapeListening = listening;
    if (listening) document.addEventListener('keydown', onKeyDown);
    else document.removeEventListener('keydown', onKeyDown);
  };

  const onEdit = (): void => {
    if (draft !== null) handlers.onEdit(draft);
  };
  const onSend = (): void => {
    if (draft !== null) handlers.onSend(draft);
  };
  editButton.addEventListener('click', onEdit);
  sendButton.addEventListener('click', onSend);

  /**
   * The review canvas is the DECODED outgoing blob, not the draft bitmap: one
   * `createImageBitmap` of the exact artifact `encodeFinal` produced, drawn
   * back at its encoded dimensions (the ladder may have downscaled it). The
   * generation token discards a decode that finished after a re-render or a
   * close; a failed decode leaves the summary usable and never invents a
   * preview.
   */
  const paintEncoded = async (current: Draft): Promise<void> => {
    const encoded = current.encoded;
    const token = ++drawing;
    if (encoded === null) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    try {
      const bitmap = await createImageBitmap(encoded.blob);
      if (token !== drawing) {
        bitmap.close();
        return;
      }
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      if (context !== null) context.drawImage(bitmap, 0, 0);
      bitmap.close();
    } catch {
      if (token === drawing) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  };

  const render = (next: Draft | null): void => {
    if (next === null) {
      open = false;
      draft = null;
      drawing += 1;
      review.setAttribute('data-hidden', 'true');
      setEscapeListening(false);
      return;
    }
    const reopened = !open || draft !== next;
    draft = next;
    open = true;
    review.setAttribute('data-hidden', 'false');

    heading.textContent = t('review.title');
    sendNoteLine.textContent = t('review.sendNote');
    canvas.setAttribute('aria-label', t('composer.image.label'));

    typeRow.label.textContent = t('composer.type.label');
    typeRow.value.textContent = next.type === 'bug' ? t('composer.type.bug') : t('composer.type.feedback');
    titleRow.label.textContent = t('review.summary.title');
    // Untrusted host content — `textContent` only, never markup (T-03-14).
    titleRow.value.textContent = next.title;
    noteRow.label.textContent = t('review.summary.note');
    noteRow.value.textContent =
      next.note.length > 0 ? truncateReason(next.note, REVIEW_NOTE_DISPLAY_CHARS) : '—';
    imageRow.label.textContent = t('composer.image.label');
    imageRow.value.textContent =
      next.encoded !== null
        ? `${next.encoded.width} × ${next.encoded.height}`
        : t('review.summary.noImage');

    editButton.textContent = t('review.edit');
    sendButton.textContent = t('review.send');

    void paintEncoded(next);

    if (reopened) {
      // UI-SPEC: focus moves to `Edit report` on open — never onto the send CTA.
      editButton.focus();
    }
    setEscapeListening(true);
  };

  return {
    element: review,
    render,
    destroy(): void {
      drawing += 1;
      setEscapeListening(false);
      editButton.removeEventListener('click', onEdit);
      sendButton.removeEventListener('click', onSend);
      review.remove();
    },
  };
}
