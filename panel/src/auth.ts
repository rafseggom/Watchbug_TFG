// Placeholder for tracer — full probe+refresh guard implemented in Task 2
export async function authGuard(): Promise<boolean> {
  return true;
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    // ignore
  }
  location.hash = "#/login";
}

export function scheduleRefresh(): void {}
