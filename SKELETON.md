# SKELETON.md — the Walking Skeleton (plan 01-01)

> The state of the monorepo after the 01-01 Walking Skeleton. Every seam named
> here is real, committed, and proven by the one Playwright suite — later plans
> extend these seams, not replace them.

## Run it

```bash
cp .env.example .env          # then: npm run key:gen → paste into WATCHBUG_PROJECT_KEY
npm install
docker compose up -d --build   # exactly three services: db, api, panel
npm run verify                # deploy + ingest e2e on chromium, firefox, webkit
```

Panel: <http://127.0.0.1:8080> · API health: <http://127.0.0.1:8080/api/health>
(same-origin through the nginx proxy — A-10 groundwork for Phase-5 cookies).

## Layout

| Workspace | What exists after 01-01 |
|---|---|
| `packages/contracts` | The single official CA-01 contract: `constants.ts` (A-06 bounds + R-13 masking constants, zero Zod import), `schema.ts` (`z.strictObject` reportSchema), `types.ts` (`import type` only), `scripts/emit-schema.mjs` → committed `schema/report.schema.json` |
| `packages/sdk` | Build shell only: 6 esbuild artifacts (IIFE + ESM × core / lazy-editor / optional-adapter lanes), `SHADOW_MODE: 'closed'` define, zero runtime deps. Widget behavior is Phase 2 |
| `apps/api` | Fastify 5 composition root, fail-fast `config.ts`, Drizzle schema + first migration, `routes/incidents.ts` (the CA-01 chain), five ingest stages, `FsStorage` on the `Storage` seam |
| `apps/panel` | Vite 8 + React 19 static SPA: two-column list/detail, design tokens (light/dark), text-node-only rendering |

## The ingest chain (`POST /api/incidents`)

```
multipart parse (A-06 limits, throwFileSizeLimit)
  → validate-meta   (JSON + reportSchema; 400 lists issues in schema field order)
  → project key     (X-Project-Key → projects row; unknown → 401)
  → sniff           (magic bytes only; SVG/GIF/anything → 400)
  → guard           (dims from IHDR/VP8X/VP8/VP8L header BEFORE any decode)
  → harden          (zero-dep structural strip/rebuild: allowlisted chunks only,
                     CRCs verified, metadata/EXIF/XMP/trailing data dropped)
  → sanitize        (sanitize-html empty allowlist → plain text, then re-validate)
  → Storage.put     (server-generated uuid key, tmp → fsync → rename, api-only volume)
  → idempotent insert (UNIQUE (project_id, idempotency_key); conflict → delete
                     the fresh blob, replay the original id: 201 create / 200 replay)
```

`Idempotency-Key` missing → 400 (Q6 absence policy — the wire shape never
accepts a keyless request). `sharp`-based re-encode drops into the same
`hardenImage(bytes) → { bytes, ext, w, h }` seam at the 01-02 checkpoint (P1-D-10).

## Serving (`GET /api/incidents/:id/image`)

Key resolved **from the database row only** — the request never names a file.
Headers: `Content-Type` from the server-side ext→MIME allowlist, `nosniff`,
fixed ASCII `Content-Disposition`, `CSP: default-src 'none'; sandbox`,
`CORP: same-origin`, `Cache-Control: private, max-age=3600`.

## Gates (R-12: e2e + build gates, no unit tests)

| Command | Asserts |
|---|---|
| `npm run check:size` | core ≤ 45 KB gz, lazy ≤ 25 KB, adapter ≤ 14 KB, runtime ≤ 80 KB — and prints the A-12 worst case **45+25+14 = 84 > 80 KB** on every run |
| `npm run check:compose` | exactly three services; attachments volume mounted only in `api` |
| `npm run verify` | deploy (DEP-01/02 incl. the fail-fast boot contracts) + ingest (ING-01/03, ENR-06, SEC-05 both passes) on all three browsers |
| `npm run lint` | per-workspace `tsc` (type-only devDeps, A-13) |

## Deliberately not here yet

Rate-limit and CORS plugins (plan 01-03), hostile-image fixtures and the
`sharp` harden backend (01-02), i18n dictionaries and the language switcher
(01-04), panel auth (Phase 5), the widget itself (Phase 2).
