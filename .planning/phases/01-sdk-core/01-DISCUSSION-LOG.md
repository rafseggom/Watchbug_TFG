# Phase 1: SDK Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-30
**Phase:** 1-SDK Core
**Areas discussed:** SDK entry & lifecycle, Canvas editor UX, Bundle architecture, Console log capture

---

## SDK Entry & Lifecycle

### Init behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Single init() call | Watchbug.init({ key: 'xxx' }) — single call, auto-captures errors and injects widget | |
| Widget first, capture on demand | init() only creates the widget; error capture and screenshot need separate explicit calls | ✓ |

**User's choice:** Widget first, capture on demand
**Notes:** "The most simple without interfering with the original and main site, or the less invasive as possible"

### What init() does
| Option | Description | Selected |
|--------|-------------|----------|
| Fully automatic | init() auto-captures errors, injects widget, and starts console logging — zero config needed | |
| Widget first, capture on demand | init() injects widget only; errors and console logs captured on demand when user triggers report | ✓ |

**User's choice:** Widget first, capture on demand

### Report trigger
| Option | Description | Selected |
|--------|-------------|----------|
| Floating button | Floating button that user clicks to open editor and submit report | ✓ |
| Programmatic API only | Watchbug.report() programmatic call — developer hooks it up to their own UI | |

**User's choice:** Floating button (Recommended)

### Error capture
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-capture errors | Automatically capture uncaught errors (window.onerror) and include in next report | ✓ |
| Manual error capture only | Developer explicitly calls Watchbug.captureError(error) — no global handlers | |

**User's choice:** Auto-capture errors (Recommended)

### Config options (multi-select)
| Option | Selected |
|--------|----------|
| Project key | ✓ |
| Auto-sanitize | ✓ |
| Language | ✓ |

**User's choice:** Project key, Auto-sanitize, Language

### Consent API
| Option | Description | Selected |
|--------|-------------|----------|
| Full consent control | Watchbug.setConsent(false) pauses all capture until setConsent(true) | ✓ |
| Init-time only | init() accepts a consent flag, no runtime toggle | |

**User's choice:** Full consent control (Recommended)

### Button position
| Option | Description | Selected |
|--------|-------------|----------|
| Bottom-right | Fixed bottom-right corner — common convention (like Intercom, Crisp) | ✓ |
| Configurable position | Configurable via init() options: bottom-right, bottom-left, top-right, top-left | |

**User's choice:** Bottom-right (Recommended)

### Button style
| Option | Description | Selected |
|--------|-------------|----------|
| Circle icon | A small circle with a bug/feedback icon — expands the editor on click | ✓ |
| Text label button | A small text button labeled 'Report' or 'Feedback' | |

**User's choice:** Circle icon (Recommended)

---

## Canvas Editor UX

### Editor view
| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen overlay | Full-screen overlay — takes up entire viewport, clear focus on annotation | ✓ |
| Modal panel | Floating panel/modal — doesn't obscure full page, keeps context visible | |

**User's choice:** Full-screen overlay (Recommended)

### Masking tool
| Option | Description | Selected |
|--------|-------------|----------|
| Rectangle brush | User draws a rectangle, all pixels inside are pixelated/blurred permanently | |
| Freehand paint | User paints freely — pixels under brush strokes are masked | |
| Both tools | Both rectangle and freehand options available in toolbar | ✓ |

**User's choice:** Both tools

### Submit flow
| Option | Description | Selected |
|--------|-------------|----------|
| Send → success toast | Click 'Send' button → captures screenshot + metadata → POSTs to backend → shows success toast | ✓ |
| Preview → confirm → send | Click 'Send' → shows preview of what's being sent → confirm → send → success | |

**User's choice:** Send → success toast (Recommended)

### Toolbar position
| Option | Description | Selected |
|--------|-------------|----------|
| Top bar | Top toolbar with tool icons — clean horizontal layout | ✓ |
| Left sidebar | Left sidebar — vertical tool list | |

**User's choice:** Top bar (Recommended)

### Report type selection
| Option | Description | Selected |
|--------|-------------|----------|
| Separate buttons | Two buttons: 'Report Bug' and 'Send Feedback' — different capture behavior | ✓ |
| Single button + picker | Single button → opens editor → user picks Bug or Feedback before sending | |

**User's choice:** Separate buttons (Recommended)

### Network failure
| Option | Description | Selected |
|--------|-------------|----------|
| Retry + local draft | Show retry button + save draft locally so user can retry later | ✓ |
| Retry only | Show retry button only — no local persistence | |
| Auto-retry | Auto-retry silently, only show error after 3 attempts | |

**User's choice:** Retry + local draft (Recommended)

---

## Bundle Architecture

### Build tool
| Option | Description | Selected |
|--------|-------------|----------|
| Rollup | Fast builds, good tree-shaking, native ESM output — most modern SDK choice | ✓ |
| esbuild | Smaller bundles with esbuild, but less ecosystem support for libraries | |
| Vite library mode | All-in-one dev + build tool — fastest DX but heavier output | |

**User's choice:** Rollup (Recommended)

### i18n bundling
| Option | Description | Selected |
|--------|-------------|----------|
| Bundled both | Both lang files in bundle, toggle at runtime — no network request needed | ✓ |
| Lazy-load non-English | Only English in bundle, Spanish loaded on demand via import() | |

**User's choice:** Bundled both (Recommended)

### Output format
| Option | Description | Selected |
|--------|-------------|----------|
| Single script tag | Single self-contained <script> tag — download + execute, simplest integration | ✓ |
| ESM + UMD | ES module + script tag variants — more flexible but more build output | |

**User's choice:** Single script tag (Recommended)

### Distribution
| Option | Description | Selected |
|--------|-------------|----------|
| CDN URL | CDN-hosted — developer copies a script URL, simplest integration | ✓ |
| npm + CDN | npm package + CDN — more options but more complexity | |

**User's choice:** CDN URL (Recommended)
**Notes:** User asked for agent recommendation — CDN URL selected as most versatile without hassle.

---

## Console Log Capture

### Redaction
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-redact | Replace suspected secrets (API keys, tokens, passwords) with [REDACTED] before storing | ✓ |
| No redaction | Store everything raw — developer handles redaction on backend | |

**User's choice:** Auto-redact (Recommended)

### Storage limit
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed ring buffer | Keep last 50-100 entries — small memory footprint, covers most debugging sessions | |
| Configurable limit | Developer configures max entries via init() options | ✓ |

**User's choice:** Configurable limit
**Notes:** "Let it be configurable but make it low by default for low-end devices"

### Console methods (multi-select)
| Option | Selected |
|--------|----------|
| console.log | ✓ |
| console.warn | ✓ |
| console.error | ✓ |
| console.info | ✓ |

**User's choice:** All four methods

### Inclusion in report
| Option | Description | Selected |
|--------|-------------|----------|
| Always include | Console logs always included in the report payload — developer doesn't need to think about it | ✓ |
| Configurable inclusion | Developer toggles console log inclusion via init() or report options | |

**User's choice:** Always include (Recommended)

---

## Agent's Discretion

| Area | Decision deferred to agent |
|------|---------------------------|
| CDN hosting provider | jsDelivr vs unpkg vs self-hosted |
| Redaction regex patterns | Design patterns for API keys, tokens, passwords |
| Canvas editor theme | Color scheme and styling |
| Floating button icon | Bug icon vs feedback icon design |
| Draft persistence | localStorage vs IndexedDB |
| Rollup config | Output format, minification, sourcemaps |

## Deferred Ideas

None — discussion stayed within phase scope
