import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch } from "./api";

describe("credentials", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("calls fetch with credentials:include and Content-Type", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await apiFetch("/api/incidents", { method: "GET" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/incidents",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });

  it("401 triggers POST /api/auth/refresh with credentials:include exact path and retries", async () => {
    const first401 = new Response(null, { status: 401 });
    const refreshOk = new Response(JSON.stringify({ message: "refreshed" }), { status: 200 });
    const retryOk = new Response(JSON.stringify({ ok: true }), { status: 200 });

    fetchMock
      .mockResolvedValueOnce(first401) // first apiFetch call
      .mockResolvedValueOnce(refreshOk) // refresh POST
      .mockResolvedValueOnce(retryOk); // retry

    const res = await apiFetch("/api/incidents?size=1", {});

    // first call credentials include
    expect(fetchMock.mock.calls[0][0]).toBe("/api/incidents?size=1");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include" });

    // second call is refresh exact path
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/refresh");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });

    // third is retry with credentials include
    expect(fetchMock.mock.calls[2][0]).toBe("/api/incidents?size=1");
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ credentials: "include" });

    expect(res.status).toBe(200);
  });

  it("does not retry refresh path itself", async () => {
    const r401 = new Response(null, { status: 401 });
    fetchMock.mockResolvedValue(r401);
    const res = await apiFetch("/api/auth/refresh", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
  });

  it("if refresh also 401, returns original 401", async () => {
    const first401 = new Response(null, { status: 401 });
    const refresh401 = new Response(null, { status: 401 });
    fetchMock.mockResolvedValueOnce(first401).mockResolvedValueOnce(refresh401);
    const res = await apiFetch("/api/incidents", {});
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
