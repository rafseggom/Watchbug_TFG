# API Coverage — Phase 1 (Contracts & Ingest Slice)

No external API integration: the phase builds Watchbug's own ingest API (`POST /api/incidents`) and its own panel; the only external surface consumed is the browser's own `fetch`/`getDisplayMedia`, which arrive with the SDK in later phases.

Detector note (recorded, not asserted): the deterministic probe fired `detected: true` on the surface term `sdk` in the ROADMAP header text — that is Watchbug's own product name, not a third-party integration. No capability matrix is produced for this phase.
