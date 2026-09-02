export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };

  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });

  if (res.status === 401 && !path.includes("/auth/refresh")) {
    const refreshRes = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (refreshRes.ok) {
      return fetch(path, {
        ...init,
        credentials: "include",
        headers,
      });
    }
  }

  return res;
}

export async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, init);
}
