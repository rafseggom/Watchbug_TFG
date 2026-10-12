/**
 * Panel → API client (plain `fetch`, same-origin through the nginx proxy).
 *
 * SEC-05 pass 2: this module only produces **data**. Every value it returns is
 * rendered by the components as a React text node — no HTML string ever crosses
 * this boundary, so there is no rendering sink of any kind.
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
  contentType: string;
  createdAt: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`${path} responded ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fetchIncidents(): Promise<Incident[]> {
  return getJson<Incident[]>('/api/incidents');
}

/** The blob route — served by the API with the hardened header set. */
export function incidentImageUrl(id: string): string {
  return `/api/incidents/${encodeURIComponent(id)}/image`;
}
