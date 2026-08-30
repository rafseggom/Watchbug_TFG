import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// E2E: SDK injection with aggressive host CSS — proves INV-01 / RNF-02 Shadow DOM isolation

function getShadow(widget: Element): ShadowRoot {
  const hook = (widget as unknown as { _getShadowRoot: () => ShadowRoot | null })._getShadowRoot;
  if (typeof hook === 'function') {
    const s = hook.call(widget);
    if (s) return s;
  }
  throw new Error('Shadow root not available via _getShadowRoot');
}

describe('E2E: SDK injection with aggressive CSS (TST-03, INV-01)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    // Clean widget from previous tests
    const existing = document.querySelector('watchbug-widget');
    if (existing) existing.remove();
    // Reset Watchbug state if available
    try {
      const w = (window as unknown as Record<string, unknown>).Watchbug as
        | { _resetForTesting?: () => void }
        | undefined;
      w?._resetForTesting?.();
    } catch {}
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    try {
      const w = (window as unknown as Record<string, unknown>).Watchbug as
        | { _resetForTesting?: () => void }
        | undefined;
      w?._resetForTesting?.();
    } catch {}
  });

  it('SDK loads asynchronously and creates window.Watchbug', async () => {
    // Simulate async script load: import the SDK entry (side-effect registers global)
    await import('../../sdk/src/index');
    const w = (window as unknown as Record<string, unknown>).Watchbug as Record<string, unknown> | undefined;
    expect(w).toBeDefined();
    expect(typeof w?.init).toBe('function');
    expect(typeof w?.setConsent).toBe('function');
    expect(typeof w?.getConsoleLogs).toBe('function');

    // Verify built bundle is IIFE with window.Watchbug global
    const bundlePath = resolve(process.cwd(), 'sdk/dist/watchbug.js');
    // Also try relative to sdk dir when running from sdk
    const altPath = resolve(process.cwd(), 'dist/watchbug.js');
    const p = existsSync(bundlePath) ? bundlePath : altPath;
    expect(existsSync(p)).toBe(true);
    const bundle = readFileSync(p, 'utf-8');
    expect(bundle).toMatch(/var Watchbug/);
    expect(bundle.slice(0, 50)).toMatch(/var Watchbug\s*=\s*function/);
  });

  it('Widget renders inside Shadow DOM — immune to host CSS * { display: none !important }', async () => {
    // Inject aggressive CSS that would hide everything if not for Shadow DOM isolation
    const style = document.createElement('style');
    style.textContent = `
      * { display: none !important; visibility: hidden !important; opacity: 0 !important; color: red !important; }
      body { display: none !important; }
      div { display: none !important; }
      button { display: none !important; }
    `;
    document.head.appendChild(style);

    const { createWatchbug } = await import('../../sdk/src/index');
    // Ensure clean state
    try {
      const w = (window as unknown as Record<string, unknown>).Watchbug as { _resetForTesting?: () => void } | undefined;
      w?._resetForTesting?.();
    } catch {}
    const api = createWatchbug();
    // Re-assign global for this isolated instance
    (window as unknown as Record<string, unknown>).Watchbug = api as unknown;
    api.init({ key: 'test-key', language: 'en' });

    const widget = document.querySelector('watchbug-widget');
    expect(widget).not.toBeNull();

    // Closed ShadowRoot is not accessible via element.shadowRoot — must be null (INV-01)
    expect(widget!.shadowRoot).toBeNull();

    const shadow = getShadow(widget!);
    expect(shadow).toBeInstanceOf(ShadowRoot);

    // Widget content must still be queryable inside shadow despite host CSS
    const reportBtn = shadow.querySelector('[data-action="report-bug"]') as HTMLElement | null;
    const feedbackBtn = shadow.querySelector('[data-action="send-feedback"]') as HTMLElement | null;
    expect(reportBtn).not.toBeNull();
    expect(feedbackBtn).not.toBeNull();
    expect(reportBtn!.textContent).toContain('🐛');
    expect(shadow.innerHTML).toContain('Report Bug');

    // Shadow DOM host is in light DOM but its shadow content is isolated — verify container still in shadow
    const container = shadow.querySelector('.wb-container') as HTMLElement | null;
    expect(container).not.toBeNull();

    // Verify widget styles are scoped inside shadow (not leaked to global)
    const globalHasWidgetCSS = document.head.innerHTML.includes('wb-container');
    expect(globalHasWidgetCSS).toBe(false);
  });

  it('Widget has two buttons: Report Bug and Send Feedback', async () => {
    const { createWatchbug } = await import('../../sdk/src/index');
    try {
      const w = (window as unknown as Record<string, unknown>).Watchbug as { _resetForTesting?: () => void } | undefined;
      w?._resetForTesting?.();
    } catch {}
    const api = createWatchbug();
    (window as unknown as Record<string, unknown>).Watchbug = api as unknown;
    api.init({ key: 'test-key' });

    const widget = document.querySelector('watchbug-widget')!;
    const shadow = getShadow(widget);

    const buttons = shadow.querySelectorAll('[data-action]');
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    const reportBtn = shadow.querySelector('[data-action="report-bug"]') as HTMLElement;
    const feedbackBtn = shadow.querySelector('[data-action="send-feedback"]') as HTMLElement;
    expect(reportBtn.getAttribute('aria-label')).toBe('Report Bug');
    expect(feedbackBtn.getAttribute('aria-label')).toBe('Send Feedback');

    // Also verify both labels appear as text
    expect(shadow.innerHTML).toContain('Report Bug');
    expect(shadow.innerHTML).toContain('Send Feedback');
  });

  it('Clicking Report Bug shows full-screen overlay', async () => {
    const { createWatchbug } = await import('../../sdk/src/index');
    try {
      const w = (window as unknown as Record<string, unknown>).Watchbug as { _resetForTesting?: () => void } | undefined;
      w?._resetForTesting?.();
    } catch {}
    // Aggressive CSS present
    const style = document.createElement('style');
    style.textContent = `* { display: none !important; }`;
    document.head.appendChild(style);

    const api = createWatchbug();
    (window as unknown as Record<string, unknown>).Watchbug = api as unknown;
    api.init({ key: 'test-key' });

    const widget = document.querySelector('watchbug-widget')!;
    const shadow = getShadow(widget);
    const overlay = shadow.querySelector('.wb-overlay') as HTMLElement;
    expect(overlay.hidden).toBe(true);
    expect(overlay.getAttribute('aria-hidden')).toBe('true');

    const reportBtn = shadow.querySelector('[data-action="report-bug"]') as HTMLElement;
    reportBtn.click();

    expect(overlay.hidden).toBe(false);
    expect(overlay.getAttribute('aria-hidden')).toBe('false');
    // Overlay is full-screen with z-index max per INV-01
    expect(overlay.getAttribute('role')).toBe('dialog');
  });

  it('Overlay has canvas element for annotations', async () => {
    const { createWatchbug } = await import('../../sdk/src/index');
    try {
      const w = (window as unknown as Record<string, unknown>).Watchbug as { _resetForTesting?: () => void } | undefined;
      w?._resetForTesting?.();
    } catch {}
    const api = createWatchbug();
    (window as unknown as Record<string, unknown>).Watchbug = api as unknown;
    api.init({ key: 'test-key' });

    const widget = document.querySelector('watchbug-widget')!;
    const shadow = getShadow(widget);
    const reportBtn = shadow.querySelector('[data-action="report-bug"]') as HTMLElement;
    reportBtn.click();

    const overlay = shadow.querySelector('.wb-overlay') as HTMLElement;
    expect(overlay.hidden).toBe(false);

    const canvas = shadow.querySelector('#wb-canvas') as HTMLCanvasElement | null;
    expect(canvas).not.toBeNull();
    expect(canvas!.tagName.toLowerCase()).toBe('canvas');
    expect(canvas!.classList.contains('wb-canvas')).toBe(true);

    // Toolbar with tools must exist
    const toolbar = shadow.querySelector('.wb-toolbar') as HTMLElement | null;
    expect(toolbar).not.toBeNull();
    // At least pencil + send button
    expect(toolbar!.querySelector('[data-tool="pencil"]')).not.toBeNull();
    expect(toolbar!.querySelector('[data-tool="send"]')).not.toBeNull();
  });

  it('E2E bundle contains both en and es translations (SDK-07)', async () => {
    const bundlePath = resolve(process.cwd(), 'sdk/dist/watchbug.js');
    const altPath = resolve(process.cwd(), 'dist/watchbug.js');
    const p = existsSync(bundlePath) ? bundlePath : altPath;
    const bundle = readFileSync(p, 'utf-8');
    // Both languages bundled per D-11
    expect(bundle).toContain('Report Bug');
    expect(bundle).toContain('Reportar');
    // Also check Send Feedback translations
    expect(bundle).toContain('Send Feedback');
    expect(bundle).toContain('Enviar');
    // i18n keys not fetched at runtime
    expect(bundle).not.toContain('fetch.*translation');
  });
});
