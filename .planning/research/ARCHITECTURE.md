# Architecture Research

**Domain:** Error reporting & visual feedback SDK (self-hosted)
**Researched:** 2026-08-29
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        HOST WEB APPLICATION                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                  Watchbug Client SDK (≤45KB gz)                   │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │ Widget   │  │ Capture      │  │ Canvas   │  │ Event        │  │  │
│  │  │ (Shadow  │  │ Engine       │  │ Editor   │  │ Batcher      │  │  │
│  │  │  DOM)    │  │ (Screenshot  │  │ (Drawing │  │ (Queue +     │  │  │
│  │  │          │  │  + Metadata) │  │  + Mask) │  │  Flush)      │  │  │
│  │  └──────────┘  └──────────────┘  └──────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ HTTP/JSON (POST /api/incidents)
                                   │ Headers: X-Watchbug-Key, Content-Type
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     WATCHBUG BACKEND (FastAPI)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │ CORS     │→ │ Rate     │→ │ Auth     │→ │ Routes   │→ │ Service │  │
│  │ Middleware│  │ Limiter  │  │ (JWT)    │  │ (API)    │  │ Layer   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │
│                                                              │         │
│                                   ┌──────────────────────────┘         │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Database Layer (SQLAlchemy)                    │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │  │
│  │  │ incidents  │  │ users      │  │ projects   │                 │  │
│  │  │ (BYTEA     │  │ (bcrypt    │  │ (PROJECT   │                 │  │
│  │  │  screenshot│  │  hashed    │  │  KEY pub)  │                 │  │
│  │  │  + JSONB   │  │  passwords)│  │            │                 │  │
│  │  │  metadata) │  │            │  │            │                 │  │
│  │  └────────────┘  └────────────┘  └────────────┘                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                   │                                    │
│  ┌────────────────────────────────┘                                    │
│  ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Admin Panel (Static SPA served by FastAPI)          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │  │
│  │  │ Incident │  │ Filter   │  │ Status   │  │ Auth     │        │  │
│  │  │ List     │  │ (Bug/    │  │ Manager  │  │ (Login)  │        │  │
│  │  │          │  │ Feedback)│  │          │  │          │        │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL (Docker Container)                        │
│  Persistent volume: /var/lib/postgresql/data                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Widget (Shadow DOM)** | UI entry point: floating button, modal, i18n rendering. Fully isolated from host CSS/JS. | Custom Element with `attachShadow({ mode: 'closed' })`, scoped stylesheets via `adoptedStyleSheets` |
| **Capture Engine** | Screenshot via `html2canvas`-style DOM→Canvas rendering. Collects URL, User-Agent, screen resolution, JS console logs. | Canvas API `drawImage()` + DOM traversal, console intercept via `console.*` wrapper |
| **Canvas Editor** | Drawing tools (pencil, arrows, text) and destructive pixel masking. User annotates before submit. | Canvas 2D context `strokeRect()`, `fillText()`, `getImageData()`/`putImageData()` for pixel manipulation |
| **Event Batcher** | Queues incident reports, deduplicates, flushes on interval or user trigger. Prevents network flooding. | In-memory queue with `setInterval` flush, configurable batch size |
| **CORS Middleware** | Configurable allowed origins for SDK ingestion endpoints. | FastAPI `CORSMiddleware` with env-configured origins |
| **Rate Limiter** | Per-IP and per-PROJECT_KEY request throttling on ingestion endpoint. | `slowapi` or custom token-bucket middleware |
| **Auth (JWT)** | Session tokens for admin panel login. Short TTL, HttpOnly cookies. | `python-jose` JWT + `passlib` bcrypt/Argon2 password hashing |
| **API Routes** | REST endpoints: `POST /api/incidents`, `GET /api/incidents`, `PATCH /api/incidents/:id/status`, `POST /api/auth/login`. | FastAPI `APIRouter` with Pydantic request/response models |
| **Service Layer** | Business logic: incident creation, status transitions, pagination, image storage. | Pure Python functions, no framework dependencies |
| **Database Layer** | Schema migrations, connection pooling, query execution. | SQLAlchemy 2.0 async + Alembic migrations |
| **Admin Panel** | SPA for incident listing, filtering, status management. | Vanilla JS/TS, served as static files from `/static/panel/` |

## Recommended Project Structure

```
watchbug/
├── sdk/                          # Client SDK (TypeScript → bundled JS)
│   ├── src/
│   │   ├── index.ts              # Entry point, window.Watchbug init
│   │   ├── widget/
│   │   │   ├── ShadowWidget.ts   # Custom Element with Shadow DOM
│   │   │   ├── styles.ts         # Scoped CSS (adoptedStyleSheets)
│   │   │   └── i18n.ts           # en/es translations
│   │   ├── capture/
│   │   │   ├── screenshot.ts     # Canvas-based screenshot capture
│   │   │   ├── metadata.ts       # URL, UA, screen, console logs
│   │   │   └── console.ts        # Console intercept wrapper
│   │   ├── editor/
│   │   │   ├── CanvasEditor.ts   # Drawing tools + canvas management
│   │   │   ├── tools/
│   │   │   │   ├── pencil.ts     # Freehand drawing
│   │   │   │   ├── arrow.ts      # Arrow annotations
│   │   │   │   ├── text.ts       # Text overlay
│   │   │   │   └── mask.ts       # Destructive pixel masking
│   │   │   └── sanitizer.ts      # Auto-mask passwords, sensitive data
│   │   ├── transport/
│   │   │   ├── batcher.ts        # Event queue + flush logic
│   │   │   └── sender.ts         # HTTP POST to backend API
│   │   └── utils/
│   │       ├── dom.ts            # DOM traversal helpers
│   │       └── crypto.ts         # PROJECT_KEY handling
│   ├── package.json
│   ├── tsconfig.json
│   └── rollup.config.js          # Bundle config (IIFE + ESM)
│
├── api/                          # FastAPI backend
│   ├── main.py                   # App factory, lifespan, middleware
│   ├── config.py                 # Pydantic Settings from .env
│   ├── dependencies.py           # DB session, auth dependencies
│   ├── routers/
│   │   ├── incidents.py          # POST/GET/PATCH /api/incidents
│   │   ├── auth.py               # POST /api/auth/login, /logout
│   │   └── health.py             # GET /api/health
│   ├── services/
│   │   ├── incident_service.py   # Incident CRUD + business logic
│   │   ├── auth_service.py       # Password hashing, JWT creation
│   │   └── storage_service.py    # Image storage (BYTEA or FS)
│   ├── models/
│   │   ├── incident.py           # SQLAlchemy Incident model
│   │   ├── user.py               # SQLAlchemy User model
│   │   └── project.py            # SQLAlchemy Project model
│   ├── schemas/
│   │   ├── incident.py           # Pydantic request/response schemas
│   │   ├── auth.py               # Login/token schemas
│   │   └── common.py             # Pagination, error responses
│   └── migrations/               # Alembic migrations
│       ├── env.py
│       └── versions/
│
├── panel/                        # Admin SPA (static files)
│   ├── src/
│   │   ├── index.html            # SPA shell
│   │   ├── app.ts                # Router, state management
│   │   ├── api.ts                # Backend API client
│   │   ├── components/
│   │   │   ├── IncidentList.ts   # Paginated incident table
│   │   │   ├── IncidentDetail.ts # Full incident view + image
│   │   │   ├── FilterBar.ts      # Bug/Feedback/Status filters
│   │   │   └── Login.ts          # Authentication form
│   │   └── utils/
│   │       └── dom.ts            # DOM rendering helpers
│   ├── package.json
│   └── vite.config.ts            # Build → ../api/static/panel/
│
├── core/                         # Shared types & utilities
│   ├── types.ts                  # TypeScript interfaces shared SDK↔API
│   ├── constants.py              # Python constants (shared config)
│   └── i18n/
│       ├── en.json
│       └── es.json
│
├── docker-compose.yml            # Single-file orchestration
├── Dockerfile                    # Multi-stage: API + panel
├── .env.example                  # Documented env vars
├── pyproject.toml                # Python project config
└── sonar-project.properties
```

### Structure Rationale

- **`sdk/`:** Self-contained client SDK with clear internal module boundaries (widget → capture → editor → transport). Each module has a single responsibility. The SDK compiles to a single IIFE bundle via Rollup.
- **`api/`:** Standard FastAPI project layout following the "bigger applications" pattern with `routers/`, `services/`, `models/`, `schemas/` separation. Services contain business logic; routers handle HTTP concerns.
- **`panel/`:** Separate SPA project that builds into `api/static/panel/` for deployment. Decoupled from backend except through API contracts.
- **`core/`:** Shared type definitions avoid drift between SDK and API. TypeScript interfaces are the source of truth for the incident payload contract.

## Architectural Patterns

### Pattern 1: Shadow DOM Encapsulation

**What:** Create a closed Shadow DOM root on a custom host element. All widget UI lives inside the shadow tree, invisible to host page JS and immune to host CSS.

**When to use:** Always — this is the core isolation invariant (INV-01).

**Trade-offs:**
- + Complete CSS/JS isolation from host
- + No global namespace pollution
- - Cannot use `element.shadowRoot` from outside (closed mode)
- - Must use `adoptedStyleSheets` for efficient style sharing within shadow tree

**Example:**
```typescript
class WatchbugWidget extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'closed' });
    
    // Scoped styles via adoptedStyleSheets (efficient, cacheable)
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(WIDGET_CSS);
    shadow.adoptedStyleSheets = [sheet];
    
    // All widget DOM lives here
    shadow.innerHTML = `
      <button id="wb-trigger" aria-label="Report issue">🐛</button>
      <div id="wb-modal" hidden>
        <div id="wb-editor">
          <canvas id="wb-canvas"></canvas>
          <div id="wb-toolbar"></div>
        </div>
        <textarea id="wb-notes" placeholder="Describe the issue..."></textarea>
        <button id="wb-submit">Send Report</button>
      </div>
    `;
  }
}

// Single global entry point (INV-02)
customElements.define('watchbug-widget', WatchbugWidget);
window.Watchbug = {
  init: (config: { projectKey: string; apiUrl: string }) => { /* ... */ }
};
```

### Pattern 2: Destructive Canvas Pixel Masking

**What:** Apply irreversible pixel-level modification to canvas `ImageData` before encoding. Never use CSS overlays — the final PNG must have sensitive data permanently destroyed.

**When to use:** Always when user applies masking in the editor (SEC-02).

**Trade-offs:**
- + GDPR-compliant: sensitive pixels are irrecoverable
- + Simple implementation: direct array manipulation
- - Must process before `toDataURL()` / `toBlob()` — masking after encoding is pointless
- - Performance: large canvases need efficient pixel iteration

**Example:**
```typescript
function maskRegion(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  width: number, height: number,
  mode: 'blur' | 'solid' = 'solid'
): void {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data; // Uint8ClampedArray [R,G,B,A, R,G,B,A, ...]
  
  if (mode === 'solid') {
    // Replace all pixels with opaque gray
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;     // R
      data[i + 1] = 128; // G
      data[i + 2] = 128; // B
      data[i + 3] = 255; // A (fully opaque)
    }
  }
  
  // CRITICAL: putImageData writes permanently to canvas
  ctx.putImageData(imageData, x, y);
}

// After masking, encode to Base64
const maskedDataUrl = canvas.toDataURL('image/png');
// This PNG has the masked region permanently altered
```

### Pattern 3: Event Batching with Graceful Degradation

**What:** Queue incident reports in memory and flush periodically or on user action. Prevents network flooding and handles offline scenarios.

**When to use:** For SDK transport layer — batch reports before sending.

**Trade-offs:**
- + Reduces HTTP requests (batch multiple events)
- + Handles network failures gracefully (retry queue)
- - In-memory queue lost on page unload (acceptable for error reports)
- - Slight delay before report reaches backend

**Example:**
```typescript
class EventBatcher {
  private queue: IncidentReport[] = [];
  private flushInterval: number;
  
  constructor(
    private apiUrl: string,
    private projectKey: string,
    private batchSize: number = 5,
    private flushMs: number = 3000
  ) {
    this.flushInterval = setInterval(() => this.flush(), flushMs);
  }
  
  enqueue(report: IncidentReport): void {
    this.queue.push(report);
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }
  
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.batchSize);
    try {
      await fetch(`${this.apiUrl}/api/incidents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Watchbug-Key': this.projectKey,
        },
        body: JSON.stringify({ incidents: batch }),
      });
    } catch (err) {
      // Re-queue failed reports (up to retry limit)
      this.queue.unshift(...batch);
    }
  }
}
```

### Pattern 4: FastAPI Dependency Injection for Auth

**What:** Use FastAPI's `Depends()` system to inject authenticated user context into protected routes. Middleware handles CORS/rate limiting; dependencies handle auth.

**When to use:** All protected endpoints (`/api/incidents/*` for admin, not for ingestion).

**Trade-offs:**
- + Clean separation: middleware for cross-cutting, deps for route-specific
- + Testable: override dependencies in tests
- + Pydantic validation automatic on request/response

**Example:**
```python
# dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    config: Settings = Depends(get_settings),
) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials,
            config.JWT_SECRET,
            algorithms=["HS256"]
        )
        user = await get_user_by_id(payload["sub"])
        if user is None:
            raise HTTPException(status_code=401)
        return user
    except JWTError:
        raise HTTPException(status_code=401)

# routers/incidents.py
@router.get("/api/incidents")
async def list_incidents(
    user: User = Depends(get_current_user),  # Auth enforced
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    status: Optional[str] = None,
):
    return await incident_service.list(db, page, status)
```

### Pattern 5: Docker Multi-Stage Build

**What:** Single Dockerfile that builds the panel SPA in a Node stage, then copies the output into a Python stage. Final image contains only runtime dependencies.

**When to use:** Always — single `docker-compose.yml` deployment (INV-03).

**Trade-offs:**
- + Small final image (no Node.js runtime)
- + Single build artifact
- - More complex Dockerfile
- - Build cache invalidation on panel changes

**Example:**
```dockerfile
# Stage 1: Build panel SPA
FROM node:20-alpine AS panel-builder
WORKDIR /app/panel
COPY panel/package*.json ./
RUN npm ci
COPY panel/ ./
RUN npm run build  # Outputs to ../api/static/panel/

# Stage 2: Production API
FROM python:3.10-slim AS production
WORKDIR /app

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Copy API code + built panel
COPY api/ ./api/
COPY --from=panel-builder /app/api/static/panel/ ./api/static/panel/

# Health check
HEALTHCHECK --interval=30s --timeout=5s \
  CMD curl -f http://localhost:8000/api/health || exit 1

EXPOSE 8000
CMD ["uvicorn", "watchbug.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Data Flow

### Incident Submission Flow

```
User clicks 🐛 button
    ↓
Widget opens modal in Shadow DOM
    ↓
Capture Engine runs:
    1. html2canvas-style DOM → Canvas screenshot
    2. Collect metadata (URL, UA, screen, console logs)
    3. Auto-sanitize password inputs, data-watchbug-sensitive elements
    ↓
Canvas Editor activates:
    1. User draws annotations (pencil, arrows, text)
    2. User applies mask regions (destructive pixel modification)
    3. User writes description notes
    ↓
User clicks "Send Report"
    ↓
SDK encodes:
    1. canvas.toDataURL('image/png') → Base64 string
    2. Package as JSON: { screenshot, metadata, notes, type }
    ↓
Event Batcher queues:
    1. Add to in-memory queue
    2. If queue ≥ batch size OR flush timer → send
    ↓
Transport sends:
    1. POST /api/incidents with X-Watchbug-Key header
    2. Backend validates payload schema
    3. Backend sanitizes all text fields (XSS prevention)
    4. Backend stores incident in PostgreSQL:
       - Screenshot as BYTEA (Base64-decoded PNG bytes)
       - Metadata as JSONB
       - Created timestamp, project key, status
    5. Backend returns 201 Created with incident ID
    ↓
Event Batcher clears sent items from queue
```

### Admin Panel Data Flow

```
Admin navigates to /panel/
    ↓
SPA loads from /api/static/panel/
    ↓
Login form → POST /api/auth/login
    ↓
Backend validates credentials (bcrypt check)
    ↓
Backend issues JWT token (short TTL, HttpOnly cookie)
    ↓
SPA stores token, redirects to dashboard
    ↓
Dashboard → GET /api/incidents?page=1&status=pending
    ↓
Backend authenticates via JWT dependency
    ↓
Backend queries PostgreSQL with filters + pagination
    ↓
SPA renders incident table (list view)
    ↓
Admin clicks incident → GET /api/incidents/:id
    ↓
Backend returns full incident + screenshot
    ↓
SPA renders detail view with image preview
    ↓
Admin changes status → PATCH /api/incidents/:id/status
    ↓
Backend updates status in database
    ↓
SPA reflects updated status
```

### State Management (Admin Panel)

```
┌─────────────────────────────────────────────┐
│              Application State               │
│  {                                           │
│    auth: { token, user },                    │
│    incidents: { items[], page, total },      │
│    filters: { type, status, search },        │
│    ui: { loading, error, selectedId }        │
│  }                                           │
└──────────────────────┬──────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Incident │ │ Filter   │ │ Detail   │
    │ List     │ │ Bar      │ │ View     │
    │ (reads   │ │ (reads   │ │ (reads   │
    │  items)  │ │  filters)│ │  selected│
    │          │ │          │ │  item)   │
    └──────────┘ └──────────┘ └──────────┘
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0–100 incidents/day** | Current architecture is fine. PostgreSQL handles this trivially. BYTEA screenshots work well. |
| **100–1K incidents/day** | Add database indexes on `(project_key, created_at)` and `(status)`. Consider connection pooling (asyncpg pool). |
| **1K–10K incidents/day** | Move screenshots to object storage (S3/MinIO) — PostgreSQL BYTEA hits performance wall. Add Redis for rate limiting. Consider read replicas for admin panel queries. |
| **10K+ incidents/day** | This is a different product category. Consider event streaming (Kafka), time-series DB for metadata, CDN for image serving. **Out of scope for v1.** |

### Scaling Priorities

1. **First bottleneck:** Database query performance on `incidents` table → Add composite indexes, then connection pooling.
2. **Second bottleneck:** Screenshot storage size in PostgreSQL BYTEA → Move to filesystem or MinIO object storage, keep metadata in DB.
3. **Third bottleneck:** Admin panel query latency with large datasets → Add pagination cursors, then read replicas.

## Anti-Patterns

### Anti-Pattern 1: CSS Overlay Masking

**What people do:** Use a `<div>` with `background-color: gray` positioned over sensitive canvas regions.

**Why it's wrong:** The underlying canvas pixel data is unchanged. When `canvas.toDataURL()` is called, the original sensitive image is encoded — the CSS overlay is not part of the pixel data. The "masked" screenshot contains the original sensitive content.

**Do this instead:** Use `ctx.getImageData()` → modify the `Uint8ClampedArray` directly → `ctx.putImageData()`. The pixel data itself must be altered before encoding.

### Anti-Pattern 2: Global Style Injection

**What people do:** Inject `<style>` tags into `document.head` for widget styling.

**Why it's wrong:** Breaks INV-01 (total isolation). Host page CSS can override widget styles. Widget styles can leak to host elements. Creates maintenance nightmares.

**Do this instead:** Use `adoptedStyleSheets` on the Shadow DOM root. Styles are scoped to the shadow tree and cannot leak.

### Anti-Pattern 3: Storing Raw Base64 in DB

**What people do:** Store `canvas.toDataURL()` output (a `data:image/png;base64,...` string) directly in a TEXT column.

**Why it's wrong:** Base64 encoding adds ~33% overhead. TEXT columns are slower to query than BYTEA. You lose PostgreSQL's binary storage optimizations.

**Do this instead:** Decode Base64 to bytes before storage: `bytes = base64.b64decode(data_url.split(',')[1])`. Store as BYTEA. Decode on read for serving.

### Anti-Pattern 4: Sending Host App Credentials

**What people do:** SDK reads `document.cookie` or `localStorage` and includes tokens in the report payload.

**Why it's wrong:** Violates SEC-03. The SDK runs in the host's context — it has access to everything. But Watchbug's backend should never receive host app secrets.

**Do this instead:** SDK only sends `PROJECT_KEY` (a public, write-only key). The SDK explicitly filters out any `Authorization`, `Cookie`, or `Set-Cookie` headers from captured data.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **html2canvas** (or equivalent) | NPM dependency, bundled into SDK | Must stay under 45KB total bundle. Evaluate `html2canvas` vs `dom-to-image` vs custom Canvas API solution. |
| **PostgreSQL** | SQLAlchemy async + asyncpg | Connection string from `.env` (`DATABASE_URL`). Use async session for non-blocking I/O. |
| **Docker** | Single `docker-compose.yml` | Three services: `api`, `panel` (static files from api), `db`. Volumes for DB persistence. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **SDK ↔ Backend** | HTTP/JSON over network | SDK sends `POST /api/incidents` with `X-Watchbug-Key` header. Backend validates, stores. |
| **Backend ↔ Database** | SQLAlchemy async session | All DB access through service layer. No raw SQL in routers. |
| **Panel ↔ Backend** | HTTP/JSON with JWT auth | Panel sends `Authorization: Bearer <token>` header. Backend validates via `get_current_user` dependency. |
| **Panel build → API static** | Docker multi-stage copy | Panel builds to `api/static/panel/`. FastAPI serves via `StaticFiles` mount. |

## Build Order Implications

Based on component dependencies, the recommended build order is:

1. **Database schema + migrations** — Foundation. All other components depend on data model.
2. **Backend API (routers + services)** — Core ingestion and retrieval. Can be tested independently.
3. **Auth system (JWT + bcrypt)** — Required before admin panel works.
4. **Admin panel SPA** — Depends on API endpoints being defined.
5. **Client SDK** — Independent of backend details (just needs API contract).
6. **Docker orchestration** — Ties everything together for deployment.

**Rationale:** Each layer depends on the one below it. SDK and panel can be built in parallel once the API contract (schemas) is defined. Docker integration comes last as it's a deployment concern, not a feature concern.

## Sources

- MDN Web Docs: ShadowRoot API (https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot)
- MDN Web Docs: Pixel manipulation with canvas (https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas)
- FastAPI Documentation: First Steps, Middleware, CORS, SQL Databases (https://fastapi.tiangolo.com/)
- PostgreSQL BLOB handling patterns (thelinuxcode.com, 2026)
- Database schema design for error tracking (absolutejs/errors-adapters, PostHog error_tracking_issues)
- Blob storage best practices: metadata-first, BYTEA for <5MB, object storage for larger (github.com/yonatangross/orchestkit)
- Docker multi-stage build patterns for Python + SPA (FastAPI Docker docs)

---
*Architecture research for: Watchbug SDK (error reporting & visual feedback)*
*Researched: 2026-08-29*
