---
phase: 01
slug: sdk-core
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-30
verified: 2026-08-30
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail. SDK Core is client-side isolated widget.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Host Page → Widget | Host DOM/CSS/JS must not leak into Shadow DOM | Widget styles isolated via closed Shadow DOM, adoptedStyleSheets |
| Widget → Backend | Incident payload to /api/incidents | JSON + Base64 screenshot, credentials:omit, X-Watchbug-Key only |
| Canvas → Base64 | Sensitive pixels must be destroyed before encoding | maskRegion via getImageData/putImageData before toDataURL |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Information Disclosure | sanitizer/mask | high | mitigate | sanitizeCanvas masks input[type=password], [data-watchbug-sensitive], credit-card regex via maskRegion solid before toDataURL; maskRegion pixelate/solid destructive via Uint8ClampedArray + putImageData (sdk/src/editor/tools/mask.ts:27, sdk/src/editor/sanitizer.ts:9) — verified in 01-VERIFICATION.md SEC-01/SEC-02 | closed |
| T-01-02 | Spoofing / Tampering | transport/sender | medium | mitigate | sendReport uses credentials:'omit' (sdk/src/transport/sender.ts:29) — no host cookies/tokens sent, only X-Watchbug-Key public; grep verified | closed |
| T-01-03 | Elevation / Pollution | sdk/index.ts | high | mitigate | Single window.Watchbug global, no prototype pollution, exact-keys test in tests/unit/sdk-entry.test.ts — verified INV-02 | closed |
| T-01-04 | Information Disclosure | console | medium | mitigate | SECRET_PATTERNS 7 (password/token/api_key/secret/authorization/Bearer/JWT) + 500-char truncation + redactSecrets in sdk/src/capture/console.ts — verified CAP-03 | closed |
| T-01-05 | Denial of Service | batcher/validation | low | mitigate | client-side validatePayload enforces type/screenshot/metadata/TRN-04 + EventBatcher batchSize 5 / interval 3000ms + re-queue on failure — prevents spam | closed |
| T-01-06 | Information Disclosure | i18n/bundle | low | mitigate | No secrets in bundle, PROJECT_KEY is public write-only per SEC-04 deferred to backend; bundle 8.85KB no credential leakage | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| No accepted risks. | | | | |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-30 | 6 | 6 | 0 | gsd-verifier + ship preflight (automated) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-30
