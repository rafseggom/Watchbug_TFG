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
 * Phase 3 adds the screen router (research Pattern 5): one `Screen` union
 * decides which surface owns the widget — the launcher (`idle`), the 320 px
 * status panel (`status`, in-flight and terminal SEND states only, P3-D-04),
 * the composer overlay, the (03-05) editor slot, or the review overlay. The
 * surfaces are appended once and shown/hidden by the router; exactly one is
 * visible at a time and the launcher is disabled while any overlay is open.
 * `onView` feeds the panel exactly as in Phase 2 — the panel's `StatusView`
 * union is untouched. CAPTURE failures are not panel states: a failed capture
 * opens the composer in its degraded state (P3-D-13) and nothing posts until
 * the user chooses attach or text-only (CAP-03).
 */

import {
  createCaptureFlow,
  encodeFinal,
  type CaptureFlow,
  type Draft,
} from './capture/pipeline.ts';
import type { EncodedImage } from './image/encode.ts';
import { HOST_CSS, mountHost, type WatchbugHost } from './widget/host.ts';
import { createLauncher, LAUNCHER_CSS, type Launcher } from './widget/launcher.ts';
import {
  createStatusPanel,
  PANEL_CSS,
  type StatusPanel,
  type StatusView,
} from './widget/status-panel.ts';
import { createComposer, COMPOSER_CSS, type Composer, type LocaleCode } from './widget/composer.ts';
import { createReview, REVIEW_CSS, type Review } from './widget/review.ts';
import { detectLocale, locale, setLocale } from './strings.ts';

/** Bundle identity, surfaced on the IIFE global for support/debug. */
export const WATCHBUG_VERSION = '0.1.0';

/** The surface the router currently shows. `editor` mounts with 03-05. */
export type Screen = 'idle' | 'status' | 'composer' | 'editor' | 'review';

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
  composer: Composer;
  review: Review;
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

/**
 * The core bundle's OWN URL — the only base the annotator chunk resolves
 * against (T-03-20: never `init()` options, never a `data-` attribute, never
 * `document.baseURI`). The IIFE lane reads `LOADING_SCRIPT_URL`
 * (`document.currentScript` at module eval); the ESM lane reads
 * `import.meta.url`, which esbuild compiles to a property read of an empty
 * object in the IIFE lane — i.e. `undefined` there (Pitfall 2, verified on
 * this repo's esbuild 0.28.2), so the `??` chain simply falls through the
 * other way per lane. An unresolved base never reaches `new URL`: the loader
 * rejects and the composer surfaces the inline load error.
 */
const CORE_BUNDLE_URL: string | undefined =
  LOADING_SCRIPT_URL ?? (typeof import.meta === 'object' ? import.meta.url : undefined);

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
 * Flow wiring (P2-D-02/05, P3-D-01). The capture call still runs in the
 * launcher click's own task (transient activation), but the gesture now ends
 * at the composer, not at the wire: `onDraft` hands the already-redacted
 * frame to the router, `Review report` runs the single `encodeFinal`, and
 * only `Send report` posts. `flowRef` exists because the launcher and the
 * panel are constructed before the flow can be; the indirection never
 * introduces an `await` in the click's task.
 */
export function init(options: WatchbugInitOptions): void {
  if (mounted !== null) return;

  // WDG-06: resolve the locale ONCE, before anything is constructed — the
  // launcher/panel/composer read `t()` at creation, and `mountHost` declares
  // `.wrap[lang]` from the same module state (session-scoped, never host
  // storage: SEC-03 / UI-SPEC A-1).
  setLocale(detectLocale(navigator.language));

  const config = resolveOptions(options);
  // One shadow `<style>` carries every surface (UI-SPEC: never a second
  // stylesheet, never `adoptedStyleSheets`).
  const host = mountHost(`${HOST_CSS}\n${LAUNCHER_CSS}\n${PANEL_CSS}\n${COMPOSER_CSS}\n${REVIEW_CSS}`);
  host.setLang(locale());

  const flowRef: { current: CaptureFlow | null } = { current: null };
  const launcher = createLauncher({
    hide: () => host.hideSync(),
    onActivate: () => flowRef.current?.start(),
  });

  // --- router state (one widget instance: module-level would be ceremony) ---
  let screen: Screen = 'idle';
  let draft: Draft | null = null;
  let lastView: StatusView = { kind: 'idle' };

  /** The single transition point: exactly one surface visible, Escape owned
   * by the visible one (its listener installs when it opens). */
  const showScreen = (next: Screen): void => {
    screen = next;
    host.content.setAttribute('data-wb-screen', next);
    panel.render(next === 'status' ? lastView : { kind: 'idle' });
    composer.render(next === 'composer' && draft !== null ? draft : null);
    review.render(
      // A review opens on an encoded artifact OR on a text-only draft (no
      // pixels, `encoded` stays null — the summary then shows `No image`).
      // A degraded draft never reaches `review`: the composer blocks Review
      // until the user picks attach or text-only (P3-D-13).
      next === 'review' && draft !== null && (draft.encoded !== null || draft.image === null)
        ? draft
        : null,
    );
    if (next === 'idle') launcher.setDisabled(false);
    if (next === 'composer' || next === 'review' || next === 'editor') launcher.setDisabled(true);
  };

  /** `onView` feeds the status panel exactly as in Phase 2 (Pattern 5). */
  const onView = (view: StatusView): void => {
    lastView = view;
    if (view.kind === 'idle') {
      showScreen('idle');
      return;
    }
    showScreen('status');
  };

  const panel: StatusPanel = createStatusPanel({
    onRetry: () => flowRef.current?.retry(),
    // Dismiss (button, Escape or the 5 s auto-dismiss) returns to the idle
    // launcher, re-arms it, and drops the finished draft (UI-SPEC A-5/A-7).
    onDismiss: () => {
      draft = null;
      showScreen('idle');
    },
  });

  /** Review entry encodes ONCE per entry (T-03-17); the review shows these
   * exact bytes. Returning from the review re-validates the draft fields.
   * A text-only draft has no pixels: `encodeFinal` is skipped, `encoded`
   * stays null and the summary's `No image` line keeps the "this is what
   * will be sent" moment honest (CAP-03, UI-SPEC A-3). */
  const reviewDraft = async (): Promise<void> => {
    const current = draft;
    if (current === null) return;
    if (screen !== 'composer' && screen !== 'review') return;
    // The encode is the one long await in this lane (the ladder runs up to
    // eighteen passes) and every surface stays live during it: Discard, a new
    // gesture and the editor can all move the machine underneath. Remember
    // the generation this resolution belongs to and re-validate AFTER the
    // await — the same guard `composer.runAnnotate` already applies (P3-D-13).
    const screenAtStart = screen;
    const imageAtStart = current.image;
    if (imageAtStart !== null) {
      let encoded: EncodedImage;
      try {
        encoded = await encodeFinal(imageAtStart, current.t1, current.masks);
      } catch {
        // A stale failure surfaces nothing: the draft it belonged to is gone.
        if (draft !== current || screen !== screenAtStart || current.image !== imageAtStart) {
          return;
        }
        // No sendable artifact (a fail-closed pixel replay or an engine that
        // will not encode): the loud capture-failure state, nothing sent (M-6).
        onView({ kind: 'failed', failure: 'capture' });
        return;
      }
      // Generation check: a discard (`draft === null`), a replacement draft, a
      // screen change or a swapped frame during the encode abandons this
      // resolution entirely. Without it a stale artifact could flip the router
      // to `review` over a dead draft (every surface hidden, launcher disabled
      // — a soft lock), or land `encoded` on a draft the user never reviewed.
      if (draft !== current || screen !== screenAtStart || current.image !== imageAtStart) {
        return;
      }
      current.encoded = encoded;
    } else {
      // The composer only calls onReview outside the degraded state; belt
      // and braces, normalize an un-chosen draft to text-only here so no
      // stale encode can ride a replaced frame.
      current.encoded = null;
      current.captureNote = null;
    }
    showScreen('review');
  };

  const composer: Composer = createComposer(
    {
      onReview: () => {
        void reviewDraft();
      },
      // Discard (button or Escape) drops the draft without confirmation
      // (UI-SPEC A-4) and re-arms the launcher (P3-D-04).
      onDiscard: () => {
        draft = null;
        showScreen('idle');
      },
      // The editor screen (03-05): `showScreen('editor')` hides the composer
      // (its own `data-hidden` contract) while the fullscreen editor owns the
      // shadow root; `Done` lands back on the composer with the draft's frame
      // mutated in place, so the preview re-draws with the ink on it.
      onEditorOpen: () => {
        showScreen('editor');
      },
      onEditorClosed: () => {
        showScreen('composer');
      },
      // WDG-06 manual override: flip the module locale, re-declare `lang`, and
      // RE-RENDER the mounted surface — a locale change is never a re-lookup of
      // cached strings, and nothing here touches host storage (SEC-03 / A-1).
      onLocaleChange: (code: LocaleCode) => {
        setLocale(code);
        host.setLang(code);
        launcher.render();
        if (screen === 'composer' && draft !== null) composer.render(draft);
        else if (
          screen === 'review' &&
          draft !== null &&
          (draft.encoded !== null || draft.image === null)
        )
          review.render(draft);
        else if (screen === 'status') panel.render(lastView);
      },
    },
    {
      // The chunk resolves ONLY from the core bundle's own URL (T-03-20), and
      // the editor mounts ONLY inside `.wrap` (INV-01 — same closed shadow
      // root, never `document.body`).
      coreUrl: () => CORE_BUNDLE_URL,
      wrap: host.content,
    },
  );

  const review: Review = createReview({
    // The round-trip is lossless: the draft object is untouched between the
    // two surfaces, so `Edit report` lands back on the same fields/image.
    onEdit: () => showScreen('composer'),
    onSend: (current) => {
      void flowRef.current?.send(current);
    },
  });

  const flow = createCaptureFlow({
    host,
    launcher,
    config,
    onView,
    onDraft: (created) => {
      draft = created;
      showScreen('composer');
    },
  });
  flowRef.current = flow;

  showScreen('idle');
  host.content.appendChild(launcher.element);
  host.content.appendChild(panel.element);
  host.content.appendChild(composer.element);
  host.content.appendChild(review.element);
  mounted = { host, launcher, panel, composer, review, config };
}

export default { WATCHBUG_VERSION, init };
