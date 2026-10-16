/**
 * Core lane (RNF-01 lane 1 — the injected `watchbug.js`, hard budget 45 KB gz).
 *
 * **Build/size shell only.** Widget behavior (capture, annotation host,
 * redaction, transport, `WidgetHost`) is Phase-2 scope; this lane exists now so
 * the size gate, the IIFE/ESM dual build and the `SHADOW_MODE` flag are real
 * from day one (A-12/M-2, INV-01/INV-02).
 *
 * The IIFE build exposes exactly one global — `window.Watchbug` (INV-02: no
 * prototype patching, no host styles, single entry point).
 */

/** Bundle identity, surfaced on the IIFE global for support/debug. */
export const WATCHBUG_VERSION = '0.1.0';

export default { WATCHBUG_VERSION };
