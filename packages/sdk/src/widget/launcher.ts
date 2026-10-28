/**
 * The floating launcher — the widget's only end-user affordance (WDG-01,
 * P2-D-01/02).
 *
 * One click **is** the transient user activation for `getDisplayMedia`, so the
 * handler is deliberately synchronous: hide the host, then call the flow entry,
 * in the same task. No `await`, no timer, no microtask between the two — an
 * `await` here loses activation and the browser throws `InvalidStateError`
 * (P2-D-02/05, Pitfall 5). The shell is fixed now; 02-02 fills the flow entry
 * with `runCaptureFlow` at the same call site.
 *
 * Geometry and a11y are the UI-SPEC contract: a real 48×48 `<button>` with a
 * 24×24 inline-SVG bug glyph, `aria-label` from the locked string map, and the
 * 2 px / 2 px-offset focus ring. The glyph is built with `createElementNS` —
 * never `innerHTML` (T-02-01: no HTML sink in the SDK).
 */

import { t } from '../strings.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Launcher styles, concatenated into the host's single shadow `<style>`. */
export const LAUNCHER_CSS = `
.launcher {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 48px;
  height: 48px;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 24px;
  background: var(--wb-color-accent);
  color: var(--wb-color-on-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  transition: background-color 120ms ease-out;
}
.launcher:hover { background: var(--wb-color-accent-hover); }
.launcher:active { background: var(--wb-color-accent-active); }
.launcher:focus-visible {
  outline: 2px solid var(--wb-color-accent);
  outline-offset: 2px;
}
.launcher:disabled {
  opacity: 0.6;
  cursor: default;
}
`;

export interface LauncherOptions {
  /** Hide the host synchronously (P2-D-05). Runs before `onActivate`. */
  hide: () => void;
  /** The flow entry — must be called in the same task as the click. */
  onActivate: () => void;
}

export interface Launcher {
  readonly element: HTMLButtonElement;
  /** Disabled/dimmed while a status panel is open (UI-SPEC re-entrancy). */
  setDisabled(disabled: boolean): void;
  /** Re-apply the `t()`-derived accessible label (a locale change re-renders). */
  render(): void;
  destroy(): void;
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, value);
  }
  return node;
}

/** A 24×24 bug glyph, stroke-only so it reads at any density. */
function createBugGlyph(): SVGSVGElement {
  const svg = svgElement('svg', {
    viewBox: '0 0 24 24',
    width: '24',
    height: '24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.6',
    'stroke-linecap': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  });

  svg.appendChild(svgElement('circle', { cx: '12', cy: '6.4', r: '2.1' }));
  svg.appendChild(svgElement('ellipse', { cx: '12', cy: '14', rx: '4', ry: '5' }));

  for (const d of [
    'M10.6 4.9 L9 2.6',
    'M13.4 4.9 L15 2.6',
    'M8.3 10.6 L4.6 8.8',
    'M8 14 L4 14',
    'M8.3 17.4 L4.6 19.2',
    'M15.7 10.6 L19.4 8.8',
    'M16 14 L20 14',
    'M15.7 17.4 L19.4 19.2',
  ]) {
    svg.appendChild(svgElement('path', { d }));
  }

  return svg;
}

export function createLauncher(options: LauncherOptions): Launcher {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'launcher';
  /**
   * The label is `t()`-derived and re-applied on every render and disable,
   * so a locale change after mount updates it (WDG-06). The glyph-only button
   * carries no visible text — the accessible name IS the label.
   */
  const refreshLabel = (): void => {
    button.setAttribute('aria-label', t('launcher.label'));
  };
  refreshLabel();
  button.appendChild(createBugGlyph());

  const onClick = (): void => {
    if (button.disabled) return;
    // P2-D-05: hidden before the capture call, synchronously. P2-D-02/05: the
    // flow entry runs in this same handler turn — no `await` may be introduced
    // between these two statements.
    options.hide();
    options.onActivate();
  };

  button.addEventListener('click', onClick);

  return {
    element: button,
    setDisabled(disabled: boolean): void {
      button.disabled = disabled;
      refreshLabel();
    },
    render(): void {
      refreshLabel();
    },
    destroy(): void {
      button.removeEventListener('click', onClick);
      button.remove();
    },
  };
}
