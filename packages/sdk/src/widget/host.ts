/**
 * `WidgetHost` adapter — the isolation primitive every widget surface renders
 * into (INV-01, INV-02, RNF-02; UI-SPEC § Widget Geometry & Isolation Contract).
 *
 * Three layers of hardening, each fixing a different attack:
 *
 *  1. **Inline `!important` on the host element.** Inline `!important` outranks
 *     an author `!important` rule, so a hostile `* { display: none !important }`
 *     cannot hide the widget (probe-verified on chromium/firefox/webkit).
 *  2. **A closed shadow root** (`mode: SHADOW_MODE`) whose single `<style>`
 *     element starts with `all: initial` and re-declares every property the
 *     widget uses — nothing inherits out of the hostile host page. The e2e build
 *     substitutes `SHADOW_MODE = 'open'` so Playwright can pierce the root
 *     (R-14, Pitfall 10); production never does.
 *  3. **Last child of `documentElement`** with a light MutationObserver that
 *     re-appends the host if the page removes or buries it.
 *
 * The host element is deliberately **not** registered with `customElements`:
 * registration would mutate the host page's global custom-element registry
 * (which a hostile page could pre-empt with the same tag name), and WDG-03/04
 * require the widget to leave no trace in host-controlled global state. An
 * unregistered hyphenated element still supports `attachShadow()` and carries
 * the same tag, so the isolation is strictly stronger at the same cost.
 */

import { locale, type Locale } from '../strings.ts';

/** The exact UI-SPEC host style — inline, `!important`, px-only. */
export const HOST_STYLE = [
  // `display` is load-bearing, not cosmetic: a hostile `* { display: none
  // !important }` is an **author-origin important** declaration, which outranks
  // the shadow tree's normal `:host { display: block }`. Only an inline
  // `!important` on the host element itself wins that contest (CA-04/WDG-02).
  // `hideSync()` appends `display: none !important` after this list, so the
  // capture-time hide still wins over this declaration.
  'display: block !important',
  'position: fixed !important',
  'z-index: 2147483647 !important',
  'right: 24px !important',
  'bottom: 24px !important',
  'margin: 0 !important',
  'padding: 0 !important',
  'border: 0 !important',
  'background: transparent !important',
  'width: auto !important',
  'height: auto !important',
  'pointer-events: none !important',
].join('; ');

/**
 * Base shadow CSS: the reset plus the design tokens. Component CSS
 * (`LAUNCHER_CSS`, `PANEL_CSS`) is concatenated into the same single `<style>`
 * element by `index.ts` — the UI-SPEC forbids a second stylesheet and forbids
 * `adoptedStyleSheets`.
 *
 * `all: initial` strips every inherited host style, so each property the widget
 * actually uses is re-declared below (typography, ink, direction, cursor,
 * text-align). Units are px-only: `rem`/`em` would key off the hostile host's
 * font-size (H-2/H-3).
 */
export const HOST_CSS = `
:host, .wrap { all: initial; }
:host { display: block; }
.wrap {
  display: block;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 15px;
  font-weight: 400;
  line-height: 1.5;
  color: #1b1f26;
  direction: ltr;
  cursor: default;
  text-align: left;
  pointer-events: none;
  --wb-color-surface: #ffffff;
  --wb-color-surface-alt: #eef0f4;
  --wb-color-border: #d6dae1;
  --wb-color-accent: #2f6feb;
  --wb-color-accent-hover: #2962cf;
  --wb-color-accent-active: #2456b8;
  --wb-color-ink: #1b1f26;
  --wb-color-muted: #5b6472;
  --wb-color-success: #1e7a46;
  --wb-color-danger: #b3261e;
  --wb-color-on-accent: #ffffff;
  --wb-space-1: 4px;
  --wb-space-2: 8px;
  --wb-space-3: 16px;
  --wb-space-4: 24px;
  --wb-space-5: 32px;
  --wb-space-6: 48px;
  --wb-space-7: 64px;
}
button { font: inherit; }
`;

/**
 * Shadow roots of the open-mode build only. The production bundle
 * (`SHADOW_MODE = 'closed'`) never populates it; esbuild folds the `if` away.
 */
const openRoots: ShadowRoot[] = [];

/** Shadow roots exposed to the e2e build (R-14). Empty in production. */
export function getShadowRoots(): readonly ShadowRoot[] {
  return openRoots;
}

export interface WatchbugHost {
  /** The host element (already appended to `documentElement`). */
  readonly element: HTMLElement;
  /** The shadow root — closed in production, open in the e2e build. */
  readonly root: ShadowRoot;
  /** Mount point for widget surfaces inside the shadow root. */
  readonly content: HTMLElement;
  /**
   * Declare the language of the copy currently rendered (F-08 / WDG-06).
   * `all: initial` on `.wrap` strips inherited properties — `lang` included —
   * so the attribute must be RE-ASSERTED here on every locale change rather
   * than set once at mount and trusted: it is what keeps the declared language
   * in lockstep with the dictionary `t()` is actually reading.
   */
  setLang(lang: Locale): void;
  /** Hide synchronously, before `getDisplayMedia` (P2-D-05). */
  hideSync(): void;
  /** Undo `hideSync()` once raw `ImageData` exists (P2-D-05). */
  restore(): void;
  /** The P2-D-06 pipeline invariant, read immediately before pixel reads. */
  isHidden(): boolean;
  /** Detach and stop observing (teardown; also used by tests). */
  destroy(): void;
}

function createHostElement(): HTMLElement {
  const element = document.createElement('watchbug-host');
  element.setAttribute('style', HOST_STYLE);
  return element;
}

/**
 * Mount a widget host with the given component CSS. The host is appended as
 * the last child of `documentElement` and kept there.
 */
export function mountHost(css: string): WatchbugHost {
  const element = createHostElement();
  const root = element.attachShadow({ mode: SHADOW_MODE });

  const style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);

  const content = document.createElement('div');
  content.className = 'wrap';
  // F-08: `all: initial` clears the inherited `lang`, so without this the widget
  // copy would be annotated with the host page's (or the user's default)
  // language — e.g. English strings pronounced with Spanish phonetics on a
  // `lang="es"` page. Phase 3 resolves the locale before the first render, so
  // the declaration now comes from the dictionary actually in use — and every
  // later change re-asserts it through `setLang`, never a caller-side literal.
  content.setAttribute('lang', locale());
  root.appendChild(content);

  let hidden = false;
  let disposed = false;
  let reappendQueued = false;

  const styleValue = (): string => (hidden ? `${HOST_STYLE}; display: none !important` : HOST_STYLE);

  /** Re-assert the inline contract; also survives a hostile page rewriting it. */
  const applyStyle = (): void => {
    if (disposed) return;
    const next = styleValue();
    if (element.getAttribute('style') !== next) element.setAttribute('style', next);
  };

  const ensureMounted = (): void => {
    if (disposed || reappendQueued) return;
    reappendQueued = true;
    queueMicrotask(() => {
      reappendQueued = false;
      if (disposed) return;
      const html = document.documentElement;
      if (element.parentNode !== html || html.lastElementChild !== element) {
        html.appendChild(element);
      }
      applyStyle();
    });
  };

  // Two non-subtree observers (cheap): one for "host removed / buried", one for
  // "documentElement replaced". Neither fires on arbitrary page mutations.
  const documentObserver = new MutationObserver(ensureMounted);
  documentObserver.observe(document, { childList: true });

  const rootObserver = new MutationObserver(ensureMounted);
  rootObserver.observe(document.documentElement, { childList: true });

  // Host-page JS may strip the inline style; restore it (and the hidden state).
  const selfObserver = new MutationObserver(applyStyle);
  selfObserver.observe(element, { attributes: true, attributeFilter: ['style'] });

  document.documentElement.appendChild(element);
  if (SHADOW_MODE === 'open') openRoots.push(root);

  return {
    element,
    root,
    content,
    setLang(lang: Locale): void {
      // The only writer of the declaration: `init()` resolves the locale
      // before the first render and the composer's EN/ES pair calls this on
      // every switch, so `.wrap[lang]` can never drift from the dictionary
      // `t()` is reading (F-08: `all: initial` makes the re-assert load-bearing).
      content.setAttribute('lang', lang);
    },
    hideSync(): void {
      hidden = true;
      applyStyle();
    },
    restore(): void {
      hidden = false;
      applyStyle();
    },
    isHidden(): boolean {
      return hidden;
    },
    destroy(): void {
      disposed = true;
      documentObserver.disconnect();
      rootObserver.disconnect();
      selfObserver.disconnect();
      element.remove();
      const at = openRoots.indexOf(root);
      if (at !== -1) openRoots.splice(at, 1);
    },
  };
}
