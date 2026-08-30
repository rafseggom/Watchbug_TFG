import { WIDGET_CSS } from './styles';
import { createI18n, type I18nInstance, type SupportedLanguage } from './i18n';

export class WatchbugWidget extends HTMLElement {
  private _shadow: ShadowRoot | null = null;
  private _overlay: HTMLElement | null = null;
  private _i18n: I18nInstance = createI18n('en');

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
    // ARIA attributes for accessibility — set here (not in constructor) to avoid
    // jsdom NotSupportedError when element is created via document.createElement
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'application');
    }
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', 'Watchbug bug reporting widget');
    }

    // Pick up language from attribute set by init() — supports runtime config
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
      // Prefer adoptedStyleSheets for efficiency (cacheable, no <style> parse per instance)
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

    // Fallback: <style> element inside shadow (still scoped)
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
      </div>
    `;
  }

  private _bindEvents(shadow: ShadowRoot): void {
    const reportBtn = shadow.querySelector('[data-action="report-bug"]');
    const feedbackBtn = shadow.querySelector('[data-action="send-feedback"]');
    const closeBtn = shadow.querySelector('.wb-close');
    const overlay = shadow.querySelector('.wb-overlay') as HTMLElement | null;

    this._overlay = overlay;

    const showOverlay = (): void => {
      if (!overlay) return;
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
    };

    const hideOverlay = (): void => {
      if (!overlay) return;
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    };

    reportBtn?.addEventListener('click', showOverlay);
    feedbackBtn?.addEventListener('click', showOverlay);
    closeBtn?.addEventListener('click', hideOverlay);

    // Allow closing via Escape
    shadow.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Escape' && overlay && !overlay.hidden) {
        hideOverlay();
      }
    });
  }

  /** Returns the closed shadow root for testing — not available via element.shadowRoot */
  _getShadowRoot(): ShadowRoot | null {
    return this._shadow;
  }

  /** Programmatically show overlay (for testing) */
  _showOverlay(): void {
    if (this._overlay) {
      this._overlay.hidden = false;
      this._overlay.setAttribute('aria-hidden', 'false');
    }
  }

  /** Programmatically hide overlay (for testing) */
  _hideOverlay(): void {
    if (this._overlay) {
      this._overlay.hidden = true;
      this._overlay.setAttribute('aria-hidden', 'true');
    }
  }

  setLanguage(lang: SupportedLanguage): void {
    this._i18n.setLanguage(lang);
    this._updateTexts();
  }

  getLanguage(): SupportedLanguage {
    return this._i18n.getLanguage();
  }

  private _updateTexts(): void {
    if (!this._shadow) return;
    const t = this._i18n.t.bind(this._i18n);
    const shadow = this._shadow;

    // Update floating buttons
    const reportBtn = shadow.querySelector('[data-action="report-bug"]') as HTMLElement | null;
    const feedbackBtn = shadow.querySelector('[data-action="send-feedback"]') as HTMLElement | null;
    const reportLabel = reportBtn?.previousElementSibling as HTMLElement | null;
    const feedbackLabel = feedbackBtn?.previousElementSibling as HTMLElement | null;

    if (reportBtn) {
      reportBtn.setAttribute('aria-label', t('reportBug'));
      reportBtn.setAttribute('title', t('reportBug'));
    }
    if (reportLabel) reportLabel.textContent = t('reportBug');
    if (feedbackBtn) {
      feedbackBtn.setAttribute('aria-label', t('sendFeedback'));
      feedbackBtn.setAttribute('title', t('sendFeedback'));
    }
    if (feedbackLabel) feedbackLabel.textContent = t('sendFeedback');

    // Update toolbar and overlay
    const closeBtn = shadow.querySelector('.wb-close') as HTMLElement | null;
    if (closeBtn) {
      closeBtn.setAttribute('aria-label', t('close'));
      closeBtn.setAttribute('title', t('close'));
    }

    const toolbarMap: Record<string, string> = {
      'pencil': t('pencil'),
      'arrow': t('arrow'),
      'text': t('text'),
      'mask-rect': t('maskRect'),
      'mask-paint': t('maskPaint'),
      'send': t('submit'),
    };

    for (const [tool, label] of Object.entries(toolbarMap)) {
      const btn = shadow.querySelector(`[data-tool="${tool}"]`) as HTMLElement | null;
      if (btn) {
        btn.setAttribute('aria-label', label);
        // Keep icon prefix where present
        if (tool === 'pencil') btn.textContent = `✏️ ${label}`;
        else if (tool === 'arrow') btn.textContent = `↗ ${label}`;
        else if (tool === 'text') btn.textContent = `T ${label}`;
        else if (tool === 'mask-rect') btn.textContent = `▭ ${label}`;
        else if (tool === 'mask-paint') btn.textContent = `🖌 ${label}`;
        else btn.textContent = label;
      }
    }
  }
}

// Single registration — guard against double-define in tests (jsdom re-runs modules)
if (typeof customElements !== 'undefined' && !customElements.get('watchbug-widget')) {
  customElements.define('watchbug-widget', WatchbugWidget);
}
