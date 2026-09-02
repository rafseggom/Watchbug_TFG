import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We mock ../api module for guard tests
vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

import { apiFetch } from "./api";
import { authGuard } from "./auth";

describe("auth guard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    location.hash = "";
    vi.mocked(apiFetch).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    location.hash = "";
  });

  it("probe 200 -> true", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 200 }));
    const ok = await authGuard();
    expect(ok).toBe(true);
    expect(apiFetch).toHaveBeenCalledWith("/api/incidents?size=1");
    expect(location.hash).not.toBe("#/login");
  });

  it("probe 401 then refresh 200 then retry 200 -> true", async () => {
    // first probe returns 401, guard will try fetch refresh then retry
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // first probe
      .mockResolvedValueOnce(new Response(null, { status: 200 })); // retry after refresh

    fetchMock.mockResolvedValue(new Response(null, { status: 200 })); // refresh ok

    const ok = await authGuard();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/refresh", expect.objectContaining({ method: "POST", credentials: "include" }));
    expect(ok).toBe(true);
  });

  it("probe 401 refresh 401 -> redirect #/login", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    fetchMock.mockResolvedValue(new Response(null, { status: 401 })); // refresh fails

    const ok = await authGuard();
    expect(ok).toBe(false);
    expect(location.hash).toBe("#/login");
  });

  it("logout POSTs /api/auth/logout with credentials:include and redirects with toast", async () => {
    // need to import logout dynamically after mock setup
    const { logout } = await import("./auth");
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    location.hash = "#/incidents";
    await logout();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST", credentials: "include" }));
    expect(location.hash).toBe("#/login");
    // toast should be in DOM
    const toast = document.querySelector(".toast");
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toBeTruthy();
  });
});

// Additional credentials check already in api.test, but also ensure guard uses credentials via apiFetch mock
describe("credentials", () => {
  it("authGuard fetch refresh uses credentials:include exact path", async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", f);
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    location.hash = "";
    await authGuard();
    expect(f).toHaveBeenCalledWith("/api/auth/refresh", expect.objectContaining({ credentials: "include", method: "POST" }));
    vi.unstubAllGlobals();
  });
});
