import { WIDGET_CSS } from './styles';
import { createI18n, type I18nInstance, type SupportedLanguage } from './i18n';
import { CanvasEditor } from '../editor/CanvasEditor';
import { captureScreenshot } from '../capture/screenshot';
import { collectMetadata } from '../capture/metadata';
import { validatePayload } from '../transport/validation';
import { sendReport } from '../transport/sender';
import { retrySend } from '../transport/retry';
import { saveDraft } from '../transport/draft';
import type { ReportPayload } from '../capture/batcher';

export class WatchbugWidget extends HTMLElement {
  private _shadow: ShadowRoot | null = null;
  private _overlay: HTMLElement | null = null;
  private _i18n: I18nInstance = createI18n('en');
  private _editor: CanvasEditor | null = null;
  private _reportType: 'bug' | 'feedback' = 'bug';
  private _isSending = false;

  constructor() {
    super();

    // INV-01: Shadow DOM with mode closed — not accessible via element.shadowRoot
    const shadow = this.attachShadow({ mode: 'closed' });
    this._shadow = shadow;

    // Scoped styles via adoptedStyleSheets with fallback
    this._applyStyles(shadow);

    // Build shadow DOM
    shadow.innerHTML = this._buildHTML();

    // Wire up interactions
    this._bindEvents(shadow);
  }

  connectedCallback(): void {
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'application');
    }
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', 'Watchbug bug reporting widget');
    }

    const langAttr = this.getAttribute('data-language') as SupportedLanguage | null;
    if (langAttr === 'en' || langAttr === 'es') {
      try {
        if (this._i18n.getLanguage() !== langAttr) {
          this._i18n.setLanguage(langAttr);
          this._updateTexts();
        }
      } catch {
        // ignore invalid language — fallback to default
      }
    }
  }

  private _applyStyles(shadow: ShadowRoot): void {
    try {
      if (
        'adoptedStyleSheets' in shadow &&
        typeof CSSStyleSheet !== 'undefined' &&
        'replaceSync' in CSSStyleSheet.prototype
      ) {
        const sheet = new CSSStyleSheet();
        (sheet as unknown as { replaceSync: (css: string) => void }).replaceSync(WIDGET_CSS);
        (shadow as unknown as { adoptedStyleSheets: CSSStyleSheet[] }).adoptedStyleSheets = [sheet as unknown as CSSStyleSheet];
        return;
      }
    } catch {
      // fallback to <style> injection inside shadow DOM
    }

    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    shadow.appendChild(style);
  }

  private _buildHTML(): string {
    const t = this._i18n.t.bind(this._i18n);
    return `
      <div class="wb-container" part="container">
        <div class="wb-button-wrapper">
          <span class="wb-button-label">${t('reportBug')}</span>
          <button class="wb-button" data-action="report-bug" aria-label="${t('reportBug')}" title="${t('reportBug')}">🐛</button>
        </div>
        <div class="wb-button-wrapper">
          <span class="wb-button-label">${t('sendFeedback')}</span>
          <button class="wb-button" data-action="send-feedback" aria-label="${t('sendFeedback')}" title="${t('sendFeedback')}">💬</button>
        </div>
      </div>

      <div class="wb-overlay" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Watchbug editor">
        <div class="wb-overlay-header">
          <span class="wb-overlay-title">Watchbug</span>
          <button class="wb-close" aria-label="${t('close')}" title="${t('close')}">×</button>
        </div>
        <div class="wb-toolbar" role="toolbar" aria-label="Annotation tools">
          <button data-tool="pencil" aria-label="${t('pencil')}">✏️ ${t('pencil')}</button>
          <button data-tool="arrow" aria-label="${t('arrow')}">↗ ${t('arrow')}</button>
          <button data-tool="text" aria-label="${t('text')}">T ${t('text')}</button>
          <button data-tool="mask-rect" aria-label="${t('maskRect')}">▭ ${t('maskRect')}</button>
          <button data-tool="mask-paint" aria-label="${t('maskPaint')}">🖌 ${t('maskPaint')}</button>
          <button data-tool="send" aria-label="${t('submit')}">${t('submit')}</button>
        </div>
        <canvas id="wb-canvas" class="wb-canvas" width="800" height="600" aria-label="Screenshot canvas"></canvas>
        <textarea class="wb-notes" placeholder="Describe the issue..." aria-label="Issue description"></textarea>
        <div class="wb-actions">
          <button class="wb-retry" hidden aria-label="Retry">Retry</button>
        </div>
        <div class="wb-toast" hidden role="status" aria-live="polite"></div>
      </div>
    `;
  }

  private _bindEvents(shadow: ShadowRoot): void {
    const reportBtn = shadow.querySelector('[data-action="report-bug"]');
    const feedbackBtn = shadow.querySelector('[data-action="send-feedback"]');
    const closeBtn = shadow.querySelector('.wb-close');
    const overlay = shadow.querySelector('.wb-overlay') as HTMLElement | null;

    this._overlay = overlay;

    const ensureEditor = (): void => {
      if (this._editor) return;
      if (!overlay) return;
      const canvas = shadow.querySelector('#wb-canvas') as HTMLCanvasElement | null;
      const toolbar = shadow.querySelector('.wb-toolbar') as HTMLElement | null;
      if (!canvas || !toolbar) return;
      try {
        this._editor = new CanvasEditor(canvas, toolbar);
      } catch {
        this._editor = null;
      }
    };

    const showOverlayFor = (type: 'bug' | 'feedback'): void => {
      if (!overlay) return;
      this._reportType = type;
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      ensureEditor();
      // Capture screenshot and load onto canvas for annotation (async, best-effort)
      this._loadScreenshotForEditor();
    };

    const hideOverlay = (): void => {
      if (!overlay) return;
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      if (this._editor) {
        try {
          this._editor.destroy();
        } catch {}
        this._editor = null;
      }
      this._hideToast();
      this._hideRetry();
    };

    reportBtn?.addEventListener('click', () => showOverlayFor('bug'));
    feedbackBtn?.addEventListener('click', () => showOverlayFor('feedback'));
    closeBtn?.addEventListener('click', hideOverlay);

    // Toolbar delegation — send handled separately
    const toolbar = shadow.querySelector('.wb-toolbar') as HTMLElement | null;
    toolbar?.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.('[data-tool]') as HTMLElement | null;
      if (!btn) return;
      const tool = btn.getAttribute('data-tool');
      if (tool === 'send') {
        e.preventDefault();
        e.stopPropagation();
        void this._handleSend();
        return;
      }
      // Other tools handled by CanvasEditor's own listener
    });

    const retryBtn = shadow.querySelector('.wb-retry') as HTMLElement | null;
    retryBtn?.addEventListener('click', () => {
      void this._handleSend(true);
    });

    shadow.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Escape' && overlay && !overlay.hidden) {
        hideOverlay();
      }
    });
  }

  private async _loadScreenshotForEditor(): Promise<void> {
    if (!this._editor) return;
    try {
      const res = await captureScreenshot({ autoSanitize: this.getAttribute('data-auto-sanitize') !== 'false' });
      if (res && res.dataUrl) {
        await this._editor.loadImage(res.dataUrl);
      }
    } catch {
      // ignore
    }
  }

  private _getApiConfig(): { apiUrl: string; projectKey: string } {
    const apiUrl = this.getAttribute('data-api-url') ?? (this.getAttribute('data-apiUrl') ?? '');
    const projectKey = this.getAttribute('data-key') ?? '';
    // Fallback to global Watchbug config if available
    if (!apiUrl || !projectKey) {
      try {
        const w = (window as unknown as Record<string, unknown>).Watchbug as { _getConfig?: () => { apiUrl?: string; key?: string } } | undefined;
        const cfg = w?._getConfig?.();
        return { apiUrl: apiUrl || cfg?.apiUrl || '', projectKey: projectKey || cfg?.key || '' };
      } catch {
        return { apiUrl, projectKey };
      }
    }
    return { apiUrl, projectKey };
  }

  private async _captureScreenshot(): Promise<string> {
    if (this._editor) {
      try {
        const canvas = this._editor.getCanvas();
        return canvas.toDataURL('image/png');
      } catch { /* continue to fallback */ }
    }
    try {
      const cap = await captureScreenshot();
      if (cap) return cap.dataUrl;
    } catch { /* ignore */ }
    return 'data:image/png;base64,placeholder';
  }

  private _collectConsoleLogs(): ReportPayload['consoleLogs'] {
    try {
      const w = (window as unknown as Record<string, unknown>).Watchbug as { getConsoleLogs?: () => ReportPayload['consoleLogs'] } | undefined;
      if (w?.getConsoleLogs) return w.getConsoleLogs();
    } catch { /* ignore */ }
    return [];
  }

  private _buildPayload(screenshot: string, notes: string, consoleLogs: ReportPayload['consoleLogs']): ReportPayload {
    const metadata = collectMetadata();
    const errors: string[] = consoleLogs.filter((l) => l.level === 'error').map((l) => l.message);
    return {
      type: this._reportType,
      screenshot,
      metadata: metadata as unknown as Record<string, unknown>,
      consoleLogs,
      errors,
      notes,
    };
  }

  private _handleSendSuccess(): void {
    this._showToast('Report sent!', false);
    this._hideRetry();
    setTimeout(() => {
      this._hideOverlay();
    }, 1200);
    try {
      window.dispatchEvent(new CustomEvent('watchbug:toast', { detail: { message: 'Report sent' } }));
    } catch { /* ignore */ }
  }

  private _handleSendFailure(payload: ReportPayload, error: string | undefined): void {
    try {
      saveDraft(payload);
    } catch { /* ignore */ }
    this._showRetry();
    this._showToast(error || 'Failed to send. Draft saved.', true);
    try {
      window.dispatchEvent(new CustomEvent('watchbug:retry', { detail: { payload } }));
    } catch { /* ignore */ }
  }

  private async _handleSend(isRetry = false): Promise<void> {
    if (this._isSending) return;
    if (this.getAttribute('data-consent') === 'false') return;
    const shadow = this._shadow;
    if (!shadow) return;
    const sendBtn = shadow.querySelector('[data-tool="send"]') as HTMLElement | null;
    const notesEl = shadow.querySelector('.wb-notes') as HTMLTextAreaElement | null;

    this._isSending = true;
    if (sendBtn) sendBtn.setAttribute('disabled', 'true');

    try {
      const screenshot = await this._captureScreenshot();
      const consoleLogs = this._collectConsoleLogs();
      const notes = notesEl?.value ?? '';
      const payload = this._buildPayload(screenshot, notes, consoleLogs);

      const validation = validatePayload(payload as unknown);
      if (!validation.valid) {
        this._showToast('Invalid payload: ' + validation.errors.join(', '), true);
        return;
      }

      const { apiUrl, projectKey } = this._getApiConfig();
      const result = await retrySend(() => sendReport(apiUrl || 'https://api.example.com', projectKey || 'test-key', payload));

      if (result.success) {
        this._handleSendSuccess();
      } else {
        this._handleSendFailure(payload, result.error);
      }
      void isRetry;
    } finally {
      this._isSending = false;
      if (sendBtn) sendBtn.removeAttribute('disabled');
    }
  }

  private _showToast(message: string, isError: boolean): void {
    if (!this._shadow) return;
    const el = this._shadow.querySelector('.wb-toast') as HTMLElement | null;
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.setAttribute('data-error', String(isError));
    el.setAttribute('aria-hidden', 'false');
    setTimeout(() => this._hideToast(), 3000);
  }

  private _hideToast(): void {
    if (!this._shadow) return;
    const el = this._shadow.querySelector('.wb-toast') as HTMLElement | null;
    if (!el) return;
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
  }

  private _showRetry(): void {
    if (!this._shadow) return;
    const el = this._shadow.querySelector('.wb-retry') as HTMLElement | null;
    if (!el) return;
    el.hidden = false;
  }

  private _hideRetry(): void {
    if (!this._shadow) return;
    const el = this._shadow.querySelector('.wb-retry') as HTMLElement | null;
    if (!el) return;
    el.hidden = true;
  }

  /** Returns the closed shadow root for testing — not available via element.shadowRoot */
  _getShadowRoot(): ShadowRoot | null {
    return this._shadow;
  }

  /** Returns editor instance for testing */
  _getEditor(): CanvasEditor | null {
    return this._editor;
  }

  /** Returns current report type for testing */
  _getReportType(): 'bug' | 'feedback' {
    return this._reportType;
  }

  /** Programmatically show overlay (for testing) */
  _showOverlay(): void {
    if (this._overlay) {
      this._overlay.hidden = false;
      this._overlay.setAttribute('aria-hidden', 'false');
      if (!this._editor && this._shadow) {
        const canvas = this._shadow.querySelector('#wb-canvas') as HTMLCanvasElement | null;
        const toolbar = this._shadow.querySelector('.wb-toolbar') as HTMLElement | null;
        if (canvas && toolbar) {
          try {
            this._editor = new CanvasEditor(canvas, toolbar);
          } catch {
            this._editor = null;
          }
        }
      }
    }
  }

  /** Programmatically hide overlay (for testing) */
  _hideOverlay(): void {
    if (this._overlay) {
      this._overlay.hidden = true;
      this._overlay.setAttribute('aria-hidden', 'true');
      if (this._editor) {
        try {
          this._editor.destroy();
        } catch {}
        this._editor = null;
      }
    }
  }

  setLanguage(lang: SupportedLanguage): void {
    this._i18n.setLanguage(lang);
    this._updateTexts();
  }

  getLanguage(): SupportedLanguage {
    return this._i18n.getLanguage();
  }

  private _updateButtonLabel(shadow: ShadowRoot, selector: string, label: string, icon?: string): void {
    const btn = shadow.querySelector(selector) as HTMLElement | null;
    if (!btn) return;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    if (icon) btn.textContent = `${icon} ${label}`;
  }

  private _updateToolbarButtonText(shadow: ShadowRoot, tool: string, label: string): void {
    const btn = shadow.querySelector(`[data-tool="${tool}"]`) as HTMLElement | null;
    if (!btn) return;
    btn.setAttribute('aria-label', label);
    const icons: Record<string, string> = {
      'pencil': '✏️',
      'arrow': '↗',
      'text': 'T',
      'mask-rect': '▭',
      'mask-paint': '🖌',
    };
    btn.textContent = icons[tool] ? `${icons[tool]} ${label}` : label;
  }

  private _updateTexts(): void {
    if (!this._shadow) return;
    const t = this._i18n.t.bind(this._i18n);
    const shadow = this._shadow;

    const reportBtn = shadow.querySelector('[data-action="report-bug"]') as HTMLElement | null;
    const feedbackBtn = shadow.querySelector('[data-action="send-feedback"]') as HTMLElement | null;
    const reportLabel = reportBtn?.previousElementSibling as HTMLElement | null;
    const feedbackLabel = feedbackBtn?.previousElementSibling as HTMLElement | null;

    this._updateButtonLabel(shadow, '[data-action="report-bug"]', t('reportBug'));
    this._updateButtonLabel(shadow, '[data-action="send-feedback"]', t('sendFeedback'));
    if (reportLabel) reportLabel.textContent = t('reportBug');
    if (feedbackLabel) feedbackLabel.textContent = t('sendFeedback');

    this._updateButtonLabel(shadow, '.wb-close', t('close'));

    const toolbarTools: Record<string, string> = {
      'pencil': t('pencil'),
      'arrow': t('arrow'),
      'text': t('text'),
      'mask-rect': t('maskRect'),
      'mask-paint': t('maskPaint'),
      'send': t('submit'),
    };

    for (const [tool, label] of Object.entries(toolbarTools)) {
      this._updateToolbarButtonText(shadow, tool, label);
    }
  }
}

// Single registration — guard against double-define in tests (jsdom re-runs modules)
if (typeof customElements !== 'undefined' && !customElements.get('watchbug-widget')) {
  customElements.define('watchbug-widget', WatchbugWidget);
}
