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

import { HOST_CSS, mountHost, type WatchbugHost } from './widget/host.ts';
import { createLauncher, LAUNCHER_CSS, type Launcher } from './widget/launcher.ts';

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
   * Watchbug API base URL. Defaults to the origin of the loading script, i.e.
   * the developer's own deployment (first-party delivery — PITFALLS.md:383).
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
  config: ResolvedInitOptions;
}

/**
 * The document's loading script URL, captured at module evaluation time.
 * `document.currentScript` is only non-null while the script itself runs, so
 * this cannot be read lazily from inside `init()`.
 */
const LOADING_SCRIPT_URL: string | undefined = (() => {
  const script = document.currentScript;
  return script instanceof HTMLScriptElement && script.src.length > 0 ? script.src : undefined;
})();

let mounted: MountedWidget | null = null;

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.host.length > 0;
  } catch {
    return false;
  }
}

/** Best-effort API base: the loading script's origin, else the document's. */
function defaultEndpoint(): string {
  try {
    const base = LOADING_SCRIPT_URL ?? document.baseURI;
    return new URL(base).origin;
  } catch {
    return '';
  }
}

function resolveOptions(options: WatchbugInitOptions): ResolvedInitOptions {
  const projectKey = options.projectKey;
  if (typeof projectKey !== 'string' || projectKey.trim().length === 0) {
    throw new TypeError('Watchbug.init: `projectKey` must be a non-empty string.');
  }

  const endpoint = options.endpoint;
  if (endpoint !== undefined) {
    if (typeof endpoint !== 'string' || !isAbsoluteHttpUrl(endpoint)) {
      throw new TypeError('Watchbug.init: `endpoint` must be an absolute http(s) URL.');
    }
  }

  const resolvedEndpoint = (endpoint ?? defaultEndpoint()).replace(/\/+$/, '');
  return { projectKey: projectKey.trim(), endpoint: resolvedEndpoint };
}

/**
 * Flow entry seam (P2-D-02/05). Called synchronously by the launcher's click
 * handler, in the same task as the user gesture, so a capture call placed here
 * inherits transient activation.
 *
 * This shell restores the host immediately (there is nothing to capture yet).
 * 02-02 replaces the body with `runCaptureFlow(...)` at this exact call site —
 * no architectural change, no re-sequencing of the gesture.
 */
function enterFlow(): void {
  const current = mounted;
  if (current === null) return;

  current.launcher.setDisabled(true);
  current.host.restore();
  current.launcher.setDisabled(false);
}

/**
 * Mount the widget. Idempotent: the first call wins and a second call is a
 * documented no-op (re-mount guard — ARCHITECTURE.md:248).
 */
export function init(options: WatchbugInitOptions): void {
  if (mounted !== null) return;

  const config = resolveOptions(options);
  const host = mountHost(`${HOST_CSS}\n${LAUNCHER_CSS}`);
  const launcher = createLauncher({
    hide: () => host.hideSync(),
    onActivate: enterFlow,
  });

  host.content.appendChild(launcher.element);
  mounted = { host, launcher, config };
}

export default { WATCHBUG_VERSION, init };
