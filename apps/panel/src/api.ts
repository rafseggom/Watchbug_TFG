/**
 * Panel → API client (plain `fetch`, same-origin through the nginx proxy).
 *
 * SEC-05 pass 2: this module only produces **data**. Every value it returns is
 * rendered by the components as a React text node — no HTML string ever crosses
 * this boundary, so there is no rendering sink of any kind.
 *
 * L-1 findings 4+5: every `fetch` carries an `AbortSignal.timeout` and every
 * body parse happens inside a try/catch. Failures surface as a coded `ApiError`
 * — raw exception messages are never the UI's data source.
 */

export type IncidentType = 'bug' | 'feedback';
export type IncidentStatus = 'pending' | 'in_progress' | 'resolved';

export interface ReportUser {
  id: string | null;
  name: string | null;
  email: string | null;
}

export interface Incident {
  id: string;
  type: IncidentType;
  title: string;
  note: string | null;
  url: string | null;
  user: ReportUser | null;
  status: IncidentStatus;
  /** `null` for a CAP-03 text-only report — no screenshot was ever captured. */
  contentType: string | null;
  createdAt: string;
}

/** Failure categories the panel maps to localized strings (never raw messages). */
export type ApiErrorCode = 'network' | 'timeout' | 'http' | 'invalid-json';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | undefined;

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 10_000;

interface JsonResponse {
  body: unknown;
  nextCursor: string | null;
}

async function requestJson(path: string): Promise<JsonResponse> {
  let res: Response;
  try {
    res = await fetch(path, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new ApiError('timeout', `request to ${path} timed out after ${REQUEST_TIMEOUT_MS} ms`);
    }
    throw new ApiError('network', `request to ${path} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    throw new ApiError('http', `${path} responded ${res.status}`, res.status);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch (err: unknown) {
    throw new ApiError('invalid-json', `${path} returned a non-JSON body: ${err instanceof Error ? err.message : String(err)}`, res.status);
  }
  const header = res.headers.get('x-next-cursor');
  return { body, nextCursor: header !== null && header !== '' ? header : null };
}

async function getJson<T>(path: string): Promise<T> {
  return (await requestJson(path)).body as T;
}

/** One page of incidents plus the opaque cursor for the next page (null = no more). */
export interface IncidentPage {
  rows: Incident[];
  nextCursor: string | null;
}

/** Rows the panel requests per page; the server allows 1..200 (261014-m3w). */
export const PAGE_SIZE = 50;

export function fetchIncidents(opts?: { limit?: number; cursor?: string | null }): Promise<IncidentPage> {
  const limit = opts?.limit ?? PAGE_SIZE;
  const cursor = opts?.cursor;
  let path = `/api/incidents?limit=${limit}`;
  if (typeof cursor === 'string' && cursor !== '') {
    path += `&cursor=${encodeURIComponent(cursor)}`;
  }
  return requestJson(path).then(({ body, nextCursor }) => {
    // `GET /api/incidents` emits one shape: a bare array with the cursor in
    // `x-next-cursor`. Accepting a `{ rows }` envelope too would be a second
    // contract this client cannot keep honest.
    if (!Array.isArray(body)) {
      throw new ApiError('invalid-json', `${path} returned a non-array body`);
    }
    return { rows: body as Incident[], nextCursor };
  });
}

/**
 * `GET /api/setup` — the instance's public **write-only** project key
 * (H-7/DEP-03 semantics: it gates ingest and never reads). Used by the
 * empty state to pre-fill the onboarding curl (P1-D-07).
 */
export interface SetupInfo {
  projectKey: string;
}

export function fetchSetup(): Promise<SetupInfo> {
  return getJson<SetupInfo>('/api/setup');
}

/** The blob route — served by the API with the hardened header set. */
export function incidentImageUrl(id: string): string {
  return `/api/incidents/${encodeURIComponent(id)}/image`;
}
