/**
 * Core lane entry (RNF-01 lane 1 — the injected `watchbug.js`, hard budget
 * 45 KB gz). One async script tag boots the widget (INT-01); the ESM twin
 * (`watchbug.mjs`) exports the same surface (INT-05).
 *
 * **Invariants fixed here, at first build:**
 *  - INV-02 — exactly one global: the IIFE `globalName: 'Watchbug'` makes this
 *    module namespace the only window property the SDK adds. No prototype
 *    patching, no host styles, no second global. `init` is a *named* export for
 *    that reason: the namespace is what the page sees.
 *  - INV-01 — every surface renders inside the closed shadow root owned by
 *    `widget/host.ts`; the e2e build only swaps the shadow mode (R-14).
 *  - PRF-04 — zero runtime dependencies. Imports from `@watchbug/contracts`
 *    must be `import type` (or its Zod-free `constants` module) so Zod is
 *    erased at compile time.
 *
 * `init()` is a thin, validated mount: it owns the config and the launcher's
 * flow-entry seam. The capture → redaction → encode → send pipeline lands in
 * 02-02 behind that same seam, at the same call site the gesture handler
 * already invokes in the click's task (P2-D-02/05 — transient activation).
 */

import { createCaptureFlow, type CaptureFlow } from './capture/pipeline.ts';
import { HOST_CSS, mountHost, type WatchbugHost } from './widget/host.ts';
import { createLauncher, LAUNCHER_CSS, type Launcher } from './widget/launcher.ts';
import { createStatusPanel, PANEL_CSS, type StatusPanel } from './widget/status-panel.ts';

/** Bundle identity, surfaced on the IIFE global for support/debug. */
export const WATCHBUG_VERSION = '0.1.0';

/** Public options for `Watchbug.init()` (INT-02). */
export interface WatchbugInitOptions {
  /**
   * The project's public, write-only key. Sent as `X-Project-Key`; never a
   * secret and never anything the host page has to protect (SEC-03).
   */
  projectKey: string;
  /**
   * Watchbug API base URL. Defaults to **the origin of the document**:
   * a report must never leave the developer's infrastructure, so a bundle
   * served from a third-party origin (a CDN) cannot supply the default.
   * `init()` then refuses to run rather than post captures there -- pass
   * `endpoint` explicitly (S-8 / WR-02).
   */
  endpoint?: string;
}

/** Options after normalisation: `endpoint` is resolved and slash-free. */
interface ResolvedInitOptions {
  projectKey: string;
  endpoint: string;
}

interface MountedWidget {
  host: WatchbugHost;
  launcher: Launcher;
  panel: StatusPanel;
  config: ResolvedInitOptions;
}

/**
 * The document's loading script URL, captured at module evaluation time.
 * `document.currentScript` is only non-null while the script itself runs,
 * and is ALWAYS null for a module script -- so the ESM lane has none and
 * `loadingScriptOrigin()` returns null there.
 */
const LOADING_SCRIPT_URL: string | undefined = (() => {
  const script = document.currentScript;
  return script instanceof HTMLScriptElement && script.src.length > 0 ? script.src : undefined;
})();

/** Origin of the loading script, or `null` when it cannot be determined. */
function loadingScriptOrigin(): string | null {
  if (LOADING_SCRIPT_URL === undefined) return null;
  try {
    return new URL(LOADING_SCRIPT_URL).origin;
  } catch {
    return null;
  }
}

let mounted: MountedWidget | null = null;

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.host.length > 0;
  } catch {
    return false;
  }
}

/**
 * The default API base is **always the document's own origin** (S-8).
 * Never the loading script's: a bundle served from a CDN would otherwise
 * post captures to the CDN, breaking the promise that a report never
 * leaves the developer's infrastructure. Any other destination is an
 * explicit integrator decision (`endpoint`).
 */
function defaultEndpoint(): string {
  return location.origin;
}

/**
 * Resolve the API base (S-8 / WR-02). The document origin is the only safe
 * default; when the loading script came from somewhere else there is no
 * default to make and the integrator must say where the API is.
 */
function resolveEndpoint(endpoint: string | undefined): string {
  // A non-string `endpoint` -- `null` out of a JSON config is the realistic
  // case -- is a hard error, NOT "absent". Treating it as absent would let it
  // slip past the cross-origin refusal below and silently fall back to the
  // document origin (FX-03), and would also lose the TypeError the API has
  // always thrown for a malformed `endpoint`.
  if (endpoint !== undefined && typeof endpoint !== 'string') {
    throw new TypeError('Watchbug.init: `endpoint` must be an absolute http(s) URL.');
  }
  if (endpoint === undefined) {
    const scriptOrigin = loadingScriptOrigin();
    if (scriptOrigin !== null && scriptOrigin !== location.origin) {
      throw new TypeError(
        'Watchbug.init: the loading script origin differs from the document origin; pass `endpoint` explicitly.',
      );
    }
  }
  const resolved = (endpoint ?? defaultEndpoint()).replace(/\/+$/, '');
  if (!isAbsoluteHttpUrl(resolved)) {
    throw new TypeError('Watchbug.init: `endpoint` must be an absolute http(s) URL.');
  }
  return resolved;
}

function resolveOptions(options: WatchbugInitOptions): ResolvedInitOptions {
  const projectKey = options.projectKey;
  if (typeof projectKey !== 'string' || projectKey.trim().length === 0) {
    throw new TypeError('Watchbug.init: `projectKey` must be a non-empty string.');
  }
  return { projectKey: projectKey.trim(), endpoint: resolveEndpoint(options.endpoint) };
}

/**
 * Flow wiring (P2-D-02/05). `runCaptureFlow` is invoked *synchronously* by the
 * launcher's click handler, in the same task as the user gesture, so the
 * capture call placed at the top of the pipeline inherits transient activation.
 * `flowRef` exists only because the launcher and the panel are constructed
 * before the flow can be; the indirection never introduces an `await`.
 */
export function init(options: WatchbugInitOptions): void {
  if (mounted !== null) return;

  const config = resolveOptions(options);
  const host = mountHost(`${HOST_CSS}\n${LAUNCHER_CSS}\n${PANEL_CSS}`);

  const flowRef: { current: CaptureFlow | null } = { current: null };
  const launcher = createLauncher({
    hide: () => host.hideSync(),
    onActivate: () => flowRef.current?.start(),
  });
  const panel: StatusPanel = createStatusPanel({
    onRetry: () => flowRef.current?.retry(),
    // Dismiss (button, Escape or the 5 s auto-dismiss) returns to the idle
    // launcher and re-arms it (UI-SPEC A-5/A-7).
    onDismiss: () => {
      panel.render({ kind: 'idle' });
      launcher.setDisabled(false);
    },
  });

  const flow = createCaptureFlow({
    host,
    launcher,
    config,
    onView: (view) => panel.render(view),
  });
  flowRef.current = flow;

  panel.render({ kind: 'idle' });
  host.content.appendChild(launcher.element);
  host.content.appendChild(panel.element);
  mounted = { host, launcher, panel, config };
}

export default { WATCHBUG_VERSION, init };
