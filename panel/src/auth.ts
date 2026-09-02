import { apiFetch } from "./api";
import { t } from "./i18n/index";
import { showToast } from "./components/toast";

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

export async function authGuard(): Promise<boolean> {
  const res = await apiFetch("/api/incidents?size=1");
  if (res.ok) return true;
  if (res.status === 401) {
    // apiFetch already tried refresh internally; if still 401, probe failed
    // Try explicit refresh once more for guard path coverage (ensures exact /api/auth/refresh path)
    try {
      const r = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (r.ok) {
        const retry = await apiFetch("/api/incidents?size=1");
        if (retry.ok) return true;
      }
    } catch {
      // ignore
    }
    location.hash = "#/login";
    return false;
  }
  // non-401 errors: allow navigation but still consider guarded (network error)
  return true;
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore
  }
  location.hash = "#/login";
  showToast(t("header.loggedOut") || t("toast.loggedOut"));
}

export function scheduleRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
  }, 55 * 60 * 1000);
}

export function clearRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = undefined;
}
