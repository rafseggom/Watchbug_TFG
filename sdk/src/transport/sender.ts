import type { ReportPayload } from '../capture/batcher';
import { validatePayload } from './validation';

export type SendResult = {
  success: boolean;
  error?: string;
};

/**
 * Send a report to the backend per SDK-05 / SEC-03 / TRN-01.
 * All fetch calls use credentials: 'omit' — never leaks host cookies/tokens.
 */
export async function sendReport(
  apiUrl: string,
  projectKey: string,
  payload: ReportPayload,
): Promise<SendResult> {
  // Client-side validation per TRN-02 before network
  const validation = validatePayload(payload as unknown);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  const endpoint = `${apiUrl.replace(/\/+$/, '')}/api/incidents`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'omit' as RequestCredentials,
      headers: {
        'Content-Type': 'application/json',
        'X-Watchbug-Key': projectKey,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return { success: true };
    }

    let errorMessage = `Request failed with status ${res.status}`;
    try {
      const text = await res.text();
      if (text) errorMessage = text;
    } catch {
      // ignore text parse failure
    }
    return { success: false, error: errorMessage };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
