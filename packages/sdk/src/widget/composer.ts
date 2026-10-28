/**
 * The report composer — the composition surface of the state machine
 * (P3-D-01/02/03/04, PRV-07, UI-SPEC § Composer).
 *
 * One launcher gesture captures immediately and opens THIS large overlay with
 * the image in it: header (heading + EN/ES pair), the bug/feedback segmented
 * control, the editable prefilled title, the optional note with its code-point
 * counter, the image zone, and the footer (Review report / Attach / Discard).
 * The 320 px status panel is left for in-flight and terminal send states
 * (P3-D-04); while the composer is open the panel reports itself hidden and
 * exactly one surface is visible.
 *
 * The module follows the `status-panel.ts` skeleton exactly: one `COMPOSER_CSS`
 * template literal using only `--wb-*` tokens and px units, a `create*`
 * factory returning `{ element, render, destroy }`, an `el()` helper, every
 * string via `t()`, and ONE document-level `Escape` listener installed when
 * the surface opens and removed when it closes (research Pitfall 11).
 *
 * No HTML sink (T-02-01 / SEC-05 / T-03-14): every visible string — copy,
 * the host-controlled `document.title` prefill — is written with
 * `textContent`, `value` or `setAttribute`. The preview draws the draft's
 * `ImageData` with `putImageData`; it never encodes (the encode happens once,
 * at Review entry).
 *
 * Later plans mount into this frame: `Annotate image` / `Replace image` gain
 * their behaviour with the editor (03-05), `Attach image` / `Continue with
 * text only` with the degraded and text-only paths (03-04) — the buttons and
 * the `data-wb-state` / `data-wb-zone` contract exist here already.
 */
import { MAX_NOTE_CHARS, MAX_TITLE_CHARS } from '@watchbug/contracts/constants';
import type { Draft } from '../capture/pipeline.ts';
import { locale, t } from '../strings.ts';

/** The counter surfaces from this many CODE POINTS up (UI-SPEC overflow). */
export const NOTE_COUNTER_VISIBLE_FROM = 4_000;

/** The composer's DOM contract ids; the error is wired to the title field. */
const TITLE_ERROR_ID = 'wb-composer-title-error';

/** The locale codes the EN/ES pair switches between (03-03 Task 3 wires it). */
export type LocaleCode = 'en' | 'es';

export interface ComposerHandlers {
  /** Validation passed: encode + show the review (router owns the encode). */
  onReview: (draft: Draft) => void;
  /** `✕` / `Escape`: discard the draft, no confirmation (UI-SPEC A-4). */
  onDiscard: (draft: Draft) => void;
  /** The editor's entry points (03-05) and the file lane (03-04). */
  onAnnotate?: (draft: Draft) => void;
  onReplace?: (draft: Draft) => void;
  onAttach?: (draft: Draft) => void;
  onContinueTextOnly?: (draft: Draft) => void;
  /** The A-7 EN/ES pair; a locale change is a re-render, never a re-lookup. */
  onLocaleChange?: (locale: LocaleCode) => void;
}

export interface Composer {
  readonly element: HTMLElement;
  /** Show and fill for one draft; `null` hides and releases the Escape key. */
  render(draft: Draft | null): void;
  destroy(): void;
}

/**
 * Composer styles — `--wb-*` tokens and px only (H-2/H-3), the 720 px overlay
 * centred near-fullscreen per UI-SPEC § Widget Geometry. The entrance reuses
 * the `wb-panel-in` keyframes the panel declares (one shadow stylesheet).
 */
export const COMPOSER_CSS = `
.composer {
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
.composer[data-hidden='true'] { display: none; }
.composer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.composer-heading {
  margin: 0;
  min-width: 0;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--wb-color-ink);
  overflow-wrap: anywhere;
}
.locale-pair { display: flex; flex: none; gap: 4px; }
.locale-toggle {
  height: 28px;
  box-sizing: border-box;
  margin: 0;
  padding: 0 8px;
  border: 1px solid var(--wb-color-border);
  border-radius: 6px;
  background: var(--wb-color-surface-alt);
  color: var(--wb-color-ink);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}
.locale-toggle[aria-pressed='true'] {
  border-color: var(--wb-color-accent);
  color: var(--wb-color-accent);
}
.locale-toggle:focus-visible {
  outline: 2px solid var(--wb-color-accent);
  outline-offset: 2px;
}
.composer-field { margin-bottom: 16px; }
.field-label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--wb-color-ink);
}
.segment-group {
  display: flex;
  width: 100%;
  height: 36px;
  box-sizing: border-box;
  border: 1px solid var(--wb-color-border);
  border-radius: 6px;
  background: var(--wb-color-surface-alt);
  overflow: hidden;
}
.segment {
  flex: 1 1 0;
  height: 36px;
  box-sizing: border-box;
  margin: 0;
  padding: 0 16px;
  border: 0;
  background: transparent;
  color: var(--wb-color-ink);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}
.segment[aria-pressed='true'] {
  background: var(--wb-color-accent);
  color: var(--wb-color-on-accent);
}
.composer-title {
  display: block;
  width: 100%;
  height: 36px;
  box-sizing: border-box;
  margin: 0;
  padding: 0 8px;
  border: 1px solid var(--wb-color-border);
  border-radius: 6px;
  background: var(--wb-color-surface-alt);
  color: var(--wb-color-ink);
  font-size: 15px;
  line-height: 1.5;
}
.composer-note {
  display: block;
  width: 100%;
  min-height: 88px;
  box-sizing: border-box;
  margin: 0;
  padding: 8px;
  border: 1px solid var(--wb-color-border);
  border-radius: 6px;
  background: var(--wb-color-surface-alt);
  color: var(--wb-color-ink);
  font-size: 15px;
  line-height: 1.5;
  resize: vertical;
}
.composer-title:focus-visible, .composer-note:focus-visible {
  outline: 2px solid var(--wb-color-accent);
  outline-offset: 2px;
}
.composer-title[aria-invalid='true'] { border-color: var(--wb-color-danger); }
.field-error {
  display: none;
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--wb-color-danger);
  overflow-wrap: anywhere;
}
.field-error[data-shown='true'] { display: block; }
.composer-counter {
  display: none;
  margin: 4px 0 0;
  text-align: right;
  font-size: 13px;
  line-height: 1.4;
  color: var(--wb-color-muted);
}
.composer-counter[data-shown='true'] { display: block; }
.image-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  margin-bottom: 16px;
  padding: 8px;
  border: 1px solid var(--wb-color-border);
  border-radius: 6px;
  background: var(--wb-color-surface-alt);
}
.composer-preview {
  display: block;
  box-sizing: border-box;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 320px;
  border: 1px solid var(--wb-color-border);
  background: var(--wb-color-surface);
}
.zone-notice { display: none; }
.image-zone[data-wb-zone='none'] .composer-preview,
.image-zone[data-wb-zone='none'] .composer-annotate,
.image-zone[data-wb-zone='none'] .composer-replace { display: none; }
.image-zone[data-wb-zone='none'] .zone-notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.zone-notice-heading {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--wb-color-muted);
  text-align: center;
}
.zone-notice-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--wb-color-muted);
  text-align: center;
}
.button {
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
.button:focus-visible {
  outline: 2px solid var(--wb-color-accent);
  outline-offset: 2px;
}
.button--primary {
  border-color: var(--wb-color-accent);
  background: var(--wb-color-accent);
  color: var(--wb-color-on-accent);
}
.button--primary:hover { background: var(--wb-color-accent-hover); }
.button--primary:active { background: var(--wb-color-accent-active); }
.composer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.composer-attach { margin-right: auto; }
.composer-discard {
  width: 36px;
  padding: 0;
  font-size: 15px;
  color: var(--wb-color-muted);
}
.composer-discard:hover {
  color: var(--wb-color-danger);
  border-color: var(--wb-color-danger);
}
@media (prefers-reduced-motion: reduce) {
  .composer { animation: none; }
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

/**
 * Count Unicode CODE POINTS, not UTF-16 units — the same semantics the
 * server's Zod `.max()` applies (Phase 1 decision 01-04). `maxlength` counts
 * units, so it stays a hint (or absent) and this clamp is the authority
 * (research Pitfall 13).
 */
function codePoints(value: string): number {
  return [...value].length;
}

/** Clamp to `max` code points without ever splitting a surrogate pair. */
function clampCodePoints(value: string, max: number): string {
  const units = [...value];
  return units.length > max ? units.slice(0, max).join('') : value;
}

export function createComposer(handlers: ComposerHandlers): Composer {
  const composer = el('section', 'composer');
  composer.setAttribute('data-hidden', 'true');
  composer.setAttribute('data-wb-state', 'image');

  // Header: heading + the A-7 EN/ES pair (task 3 wires the switch).
  const header = el('div', 'composer-header');
  const heading = el('h2', 'composer-heading');
  const localePair = el('div', 'locale-pair');
  localePair.setAttribute('role', 'group');
  const enButton = el('button', 'locale-toggle');
  const esButton = el('button', 'locale-toggle');
  for (const [button, code] of [
    [enButton, 'en'],
    [esButton, 'es'],
  ] as const) {
    button.setAttribute('type', 'button');
    button.setAttribute('data-wb-locale', code);
    button.textContent = code === 'en' ? t('i18n.en') : t('i18n.es');
    button.setAttribute('aria-pressed', String(code === locale()));
  }
  localePair.appendChild(enButton);
  localePair.appendChild(esButton);
  header.appendChild(heading);
  header.appendChild(localePair);

  // Type: segmented bug/feedback control, `bug` is the default (P3-D-03).
  const typeField = el('div', 'composer-field composer-type');
  const typeLabel = el('p', 'field-label');
  const segmentGroup = el('div', 'segment-group');
  const bugSegment = el('button', 'segment');
  const feedbackSegment = el('button', 'segment');
  for (const [button, value] of [
    [bugSegment, 'bug'],
    [feedbackSegment, 'feedback'],
  ] as const) {
    button.setAttribute('type', 'button');
    button.setAttribute('data-wb-type', value);
    button.setAttribute('aria-pressed', String(value === 'bug'));
  }
  segmentGroup.appendChild(bugSegment);
  segmentGroup.appendChild(feedbackSegment);
  typeField.appendChild(typeLabel);
  typeField.appendChild(segmentGroup);

  // Title: prefilled, editable; review is blocked only when emptied (P3-D-02).
  const titleField = el('div', 'composer-field');
  const titleLabel = el('label', 'field-label');
  titleLabel.setAttribute('for', 'wb-composer-title');
  const titleInput = el('input', 'composer-title');
  titleInput.id = 'wb-composer-title';
  titleInput.setAttribute('type', 'text');
  titleInput.setAttribute('autocomplete', 'off');
  const titleError = el('span', 'field-error');
  titleError.id = TITLE_ERROR_ID;
  titleError.setAttribute('data-wb-error', 'title');
  titleError.setAttribute('role', 'alert');
  titleError.setAttribute('data-shown', 'false');
  titleField.appendChild(titleLabel);
  titleField.appendChild(titleInput);
  titleField.appendChild(titleError);

  // Note: optional, code-point clamped, counter from 4,000 up.
  const noteField = el('div', 'composer-field');
  const noteLabel = el('label', 'field-label');
  noteLabel.setAttribute('for', 'wb-composer-note');
  const noteInput = el('textarea', 'composer-note');
  noteInput.id = 'wb-composer-note';
  const noteCounter = el('span', 'composer-counter');
  noteCounter.setAttribute('data-shown', 'false');
  noteCounter.setAttribute('aria-live', 'polite');
  noteField.appendChild(noteLabel);
  noteField.appendChild(noteInput);
  noteField.appendChild(noteCounter);

  // Image zone: preview + annotate/replace (image) or notice (degraded).
  const imageZone = el('div', 'image-zone');
  imageZone.setAttribute('data-wb-zone', 'image');
  const preview = el('canvas', 'composer-preview');
  preview.setAttribute('role', 'img');
  const annotateButton = el('button', 'button composer-annotate');
  const replaceButton = el('button', 'button composer-replace');
  const notice = el('div', 'zone-notice');
  const noticeHeading = el('p', 'zone-notice-heading');
  const noticeHint = el('p', 'zone-notice-hint');
  const continueButton = el('button', 'button composer-continue');
  notice.appendChild(noticeHeading);
  notice.appendChild(noticeHint);
  notice.appendChild(continueButton);
  imageZone.appendChild(preview);
  imageZone.appendChild(annotateButton);
  imageZone.appendChild(replaceButton);
  imageZone.appendChild(notice);

  // Footer: the one accent CTA, the secondary attach, the discard.
  const footer = el('div', 'composer-footer');
  const attachButton = el('button', 'button composer-attach');
  const reviewButton = el('button', 'button button--primary composer-review');
  const discardButton = el('button', 'button composer-discard');
  discardButton.textContent = '✕';
  for (const button of [annotateButton, replaceButton, attachButton, continueButton, reviewButton, discardButton]) {
    button.setAttribute('type', 'button');
  }
  footer.appendChild(attachButton);
  footer.appendChild(reviewButton);
  footer.appendChild(discardButton);

  composer.appendChild(header);
  composer.appendChild(typeField);
  composer.appendChild(titleField);
  composer.appendChild(noteField);
  composer.appendChild(imageZone);
  composer.appendChild(footer);

  let draft: Draft | null = null;
  let open = false;
  let escapeListening = false;

  /** The preview canvas's drawing context; created once, sized on draw. */
  const previewContext = preview.getContext('2d');

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    if (!open || draft === null) return;
    event.preventDefault();
    handlers.onDiscard(draft);
  };

  const setEscapeListening = (listening: boolean): void => {
    if (listening === escapeListening) return;
    escapeListening = listening;
    if (listening) document.addEventListener('keydown', onKeyDown);
    else document.removeEventListener('keydown', onKeyDown);
  };

  /** Paint the draft's already-redacted frame into the preview. No encode. */
  const drawPreview = (image: ImageData): void => {
    preview.width = image.width;
    preview.height = image.height;
    if (previewContext === null) return;
    previewContext.putImageData(image, 0, 0);
  };

  const clearTitleError = (): void => {
    titleError.textContent = '';
    titleError.setAttribute('data-shown', 'false');
    titleInput.removeAttribute('aria-invalid');
    titleInput.removeAttribute('aria-describedby');
  };

  const showTitleError = (): void => {
    titleError.textContent = t('composer.title.error');
    titleError.setAttribute('data-shown', 'true');
    titleInput.setAttribute('aria-invalid', 'true');
    titleInput.setAttribute('aria-describedby', TITLE_ERROR_ID);
  };

  const updateCounter = (): void => {
    if (draft === null) return;
    const used = codePoints(draft.note);
    if (used >= NOTE_COUNTER_VISIBLE_FROM) {
      noteCounter.textContent = t('composer.note.counter', { used, max: MAX_NOTE_CHARS });
      noteCounter.setAttribute('data-shown', 'true');
    } else {
      noteCounter.textContent = '';
      noteCounter.setAttribute('data-shown', 'false');
    }
  };

  const selectType = (type: Draft['type']): void => {
    if (draft === null) return;
    draft.type = type;
    bugSegment.setAttribute('aria-pressed', String(type === 'bug'));
    feedbackSegment.setAttribute('aria-pressed', String(type === 'feedback'));
    heading.textContent = t(type === 'bug' ? 'composer.heading.bug' : 'composer.heading.feedback');
  };

  // Field edits write straight through to the draft: the composer owns the
  // final values (P3-D-02/03), the router reads the draft on Review/Send.
  titleInput.addEventListener('input', () => {
    if (draft === null) return;
    draft.title = titleInput.value;
    if (titleInput.value.trim().length > 0) clearTitleError();
  });
  noteInput.addEventListener('input', () => {
    if (draft === null) return;
    // Clamp on input at the contract cap, never splitting a surrogate pair
    // (Pitfall 13; `maxlength` counts UTF-16 units so it is not the clamp).
    const clamped = clampCodePoints(noteInput.value, MAX_NOTE_CHARS);
    if (clamped !== noteInput.value) noteInput.value = clamped;
    draft.note = noteInput.value;
    updateCounter();
  });
  bugSegment.addEventListener('click', () => selectType('bug'));
  feedbackSegment.addEventListener('click', () => selectType('feedback'));
  enButton.addEventListener('click', () => handlers.onLocaleChange?.('en'));
  esButton.addEventListener('click', () => handlers.onLocaleChange?.('es'));
  annotateButton.addEventListener('click', () => {
    if (draft !== null) handlers.onAnnotate?.(draft);
  });
  replaceButton.addEventListener('click', () => {
    if (draft !== null) handlers.onReplace?.(draft);
  });
  attachButton.addEventListener('click', () => {
    if (draft !== null) handlers.onAttach?.(draft);
  });
  continueButton.addEventListener('click', () => {
    if (draft !== null) handlers.onContinueTextOnly?.(draft);
  });
  reviewButton.addEventListener('click', () => {
    if (draft === null) return;
    // Review/send is blocked ONLY when the field is emptied (P3-D-02): reveal
    // the inline error, keep focus in the field, do not navigate.
    const trimmed = titleInput.value.trim();
    if (trimmed.length === 0) {
      draft.title = titleInput.value;
      showTitleError();
      titleInput.focus();
      return;
    }
    draft.title = clampCodePoints(trimmed, MAX_TITLE_CHARS);
    draft.note = noteInput.value;
    handlers.onReview(draft);
  });
  discardButton.addEventListener('click', () => {
    if (draft !== null) handlers.onDiscard(draft);
  });

  /** Refresh every t()-derived label — the locale re-render path (task 3). */
  const renderCopy = (current: Draft): void => {
    heading.textContent = t(
      current.type === 'bug' ? 'composer.heading.bug' : 'composer.heading.feedback',
    );
    bugSegment.textContent = t('composer.type.bug');
    feedbackSegment.textContent = t('composer.type.feedback');
    bugSegment.setAttribute('aria-pressed', String(current.type === 'bug'));
    feedbackSegment.setAttribute('aria-pressed', String(current.type === 'feedback'));
    typeLabel.textContent = t('composer.type.label');
    titleLabel.textContent = t('composer.title.label');
    noteLabel.textContent = t('composer.note.label');
    noteInput.placeholder = t('composer.note.placeholder');
    preview.setAttribute('aria-label', t('composer.image.label'));
    annotateButton.textContent = t('composer.annotate');
    replaceButton.textContent = t('composer.replace');
    attachButton.textContent = t('composer.attach');
    continueButton.textContent = t('composer.continueTextOnly');
    reviewButton.textContent = t('composer.review');
    discardButton.setAttribute('aria-label', t('composer.discard'));
    noticeHeading.textContent = t('composer.image.none');
    noticeHint.textContent = t('composer.image.none.hint');
    localePair.setAttribute('aria-label', t('i18n.label'));
    enButton.textContent = t('i18n.en');
    esButton.textContent = t('i18n.es');
    enButton.setAttribute('aria-label', t('i18n.label'));
    esButton.setAttribute('aria-label', t('i18n.label'));
    enButton.setAttribute('aria-pressed', String(locale() === 'en'));
    esButton.setAttribute('aria-pressed', String(locale() === 'es'));
  };

  const render = (next: Draft | null): void => {
    if (next === null) {
      open = false;
      draft = null;
      composer.setAttribute('data-hidden', 'true');
      setEscapeListening(false);
      return;
    }
    const reopened = !open || draft !== next;
    draft = next;
    open = true;
    composer.setAttribute('data-hidden', 'false');
    composer.setAttribute(
      'data-wb-state',
      next.image !== null ? 'image' : next.captureNote !== null ? 'degraded' : 'text-only',
    );

    renderCopy(next);
    // Inputs are state: set `.value` only when it differs (no focus loss).
    if (titleInput.value !== next.title) titleInput.value = next.title;
    if (noteInput.value !== next.note) noteInput.value = next.note;
    clearTitleError();
    updateCounter();

    if (next.image !== null) {
      imageZone.setAttribute('data-wb-zone', 'image');
      drawPreview(next.image);
    } else {
      imageZone.setAttribute('data-wb-zone', 'none');
    }

    if (reopened) {
      // Composer opens with focus on the title input (UI-SPEC a11y).
      titleInput.focus();
    }
    setEscapeListening(true);
  };

  return {
    element: composer,
    render,
    destroy(): void {
      setEscapeListening(false);
      composer.remove();
    },
  };
}
