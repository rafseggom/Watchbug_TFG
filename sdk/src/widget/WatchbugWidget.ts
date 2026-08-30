import { WIDGET_CSS } from './styles';

export class WatchbugWidget extends HTMLElement {
  private _shadow: ShadowRoot | null = null;
  private _overlay: HTMLElement | null = null;

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
    return `
      <div class="wb-container" part="container">
        <div class="wb-button-wrapper">
          <span class="wb-button-label">Report Bug</span>
          <button class="wb-button" data-action="report-bug" aria-label="Report Bug" title="Report Bug">🐛</button>
        </div>
        <div class="wb-button-wrapper">
          <span class="wb-button-label">Send Feedback</span>
          <button class="wb-button" data-action="send-feedback" aria-label="Send Feedback" title="Send Feedback">💬</button>
        </div>
      </div>

      <div class="wb-overlay" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Watchbug editor">
        <div class="wb-overlay-header">
          <span class="wb-overlay-title">Watchbug</span>
          <button class="wb-close" aria-label="Close" title="Close">×</button>
        </div>
        <div class="wb-toolbar" role="toolbar" aria-label="Annotation tools">
          <button data-tool="pencil" aria-label="Pencil">✏️ Pencil</button>
          <button data-tool="arrow" aria-label="Arrow">↗ Arrow</button>
          <button data-tool="text" aria-label="Text">T Text</button>
          <button data-tool="mask-rect" aria-label="Mask Rectangle">▭ Mask</button>
          <button data-tool="mask-paint" aria-label="Mask Paint">🖌 Mask Paint</button>
          <button data-tool="send" aria-label="Send Report">Send</button>
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

  /** Language switching hook — Task 3 will wire i18n; stub now for forward-compat */
  setLanguage(_lang: 'en' | 'es'): void {
    // Will be implemented in Task 3 with i18n integration
  }
}

// Single registration — guard against double-define in tests (jsdom re-runs modules)
if (typeof customElements !== 'undefined' && !customElements.get('watchbug-widget')) {
  customElements.define('watchbug-widget', WatchbugWidget);
}
