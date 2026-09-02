import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

import { apiFetch } from "../api";
import { renderList } from "./list";

function makeRoot(): HTMLElement {
  const r = document.createElement("div");
  r.id = "app";
  document.body.appendChild(r);
  return r;
}

function mockSuccess(items: unknown[], total = items.length, page = 1, size = 20, pages = 1) {
  return new Response(JSON.stringify({ items, total, page, size, pages }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("list view", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    document.body.textContent = "";
    location.hash = "";
    localStorage.clear();
  });

  afterEach(() => {
    document.body.textContent = "";
    vi.restoreAllMocks();
    location.hash = "";
  });

  it("table renders items with badges and pagination", async () => {
    const items = [
      { id: "111e4567-e89b-12d3-a456-426614174000", type: "Bug", status: "Pending", created_at: "2026-09-02T10:00:00Z", has_screenshot: true },
    ];
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess(items, 1, 1, 20, 1));

    const root = makeRoot();
    await renderList(root, {});

    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/api/incidents"));
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("page=1"));
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("size=20"));
    // Check that credentials:include behavior is via apiFetch wrapper (mocked), not directly

    const rows = root.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);

    // Badges via textContent, never innerHTML
    const typeBadge = root.querySelector(".badge");
    expect(typeBadge?.textContent).toBe("Bug");
    expect(typeBadge?.className).toContain("badge--bug");

    const statusBadges = root.querySelectorAll(".badge");
    // second badge is status
    let foundPending = false;
    statusBadges.forEach((b) => {
      if (b.textContent === "Pending") foundPending = true;
    });
    expect(foundPending).toBe(true);

    // Preview column has ◉ for has_screenshot true
    const previewTd = rows[0].querySelectorAll("td")[3];
    expect(previewTd.textContent).toBe("◉");

    // Footer pagination
    const footerText = root.textContent ?? "";
    expect(footerText).toContain("Page");
    expect(footerText).toContain("1 of 1");

    // Prev disabled on page 1, Next disabled on last page
    const buttons = Array.from(root.querySelectorAll("button"));
    const prev = buttons.find((b) => b.textContent === "Prev" || b.textContent === "Anterior");
    const next = buttons.find((b) => b.textContent === "Next" || b.textContent === "Siguiente");
    expect(prev?.disabled).toBe(true);
    expect(next?.disabled).toBe(true);

    // Row click navigates to detail
    (rows[0] as HTMLElement).click();
    expect(location.hash).toBe("#/incidents/111e4567-e89b-12d3-a456-426614174000");

    // Responsive wrapper
    expect(root.querySelector(".table-wrapper")).not.toBeNull();
    // Table header has 4 cols
    expect(root.querySelectorAll("th").length).toBe(4);

    // No innerHTML usage – check that badges not containing html
    expect(root.innerHTML).not.toContain("<script>");
  });

  it("table renders Feedback variant and dash preview when no screenshot", async () => {
    const items = [
      { id: "222", type: "Feedback", status: "Resolved", created_at: "2026-09-02T11:00:00Z", has_screenshot: false },
    ];
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess(items, 1, 1, 20, 1));
    const root = makeRoot();
    await renderList(root, {});
    const rows = root.querySelectorAll("tbody tr");
    expect(rows[0].querySelectorAll("td")[3].textContent).toBe("—");
    const badge = root.querySelector(".badge--feedback");
    expect(badge?.textContent).toBe("Feedback");
    const resolved = root.querySelector(".badge--resolved");
    expect(resolved?.textContent).toBe("Resolved");
  });

  it("filter sync updates hash", async () => {
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess([], 0, 1, 20, 0));
    const root = makeRoot();
    await renderList(root, {});

    const selects = root.querySelectorAll("select");
    expect(selects.length).toBe(2);
    const typeSelect = selects[0] as HTMLSelectElement;
    const statusSelect = selects[1] as HTMLSelectElement;

    // Simulate filter change to Bug
    vi.mocked(apiFetch).mockClear();
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess([], 0, 1, 20, 0));
    typeSelect.value = "Bug";
    typeSelect.dispatchEvent(new Event("change"));

    // Wait microtask for async fetch
    await new Promise((r) => setTimeout(r, 10));

    expect(location.hash).toContain("type=Bug");
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("type=Bug"));
    // Should have reset page 1
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("page=1"));

    // Status filter sync
    vi.mocked(apiFetch).mockClear();
    statusSelect.value = "Pending";
    statusSelect.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 10));
    expect(location.hash).toContain("status=Pending");
  });

  it("filter values reflect hash query on mount", async () => {
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess([], 0, 1, 20, 0));
    const root = makeRoot();
    await renderList(root, { type: "Bug", status: "In Progress" });
    const selects = root.querySelectorAll("select") as NodeListOf<HTMLSelectElement>;
    expect(selects[0].value).toBe("Bug");
    expect(selects[1].value).toBe("In Progress");
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("type=Bug"));
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("status=In+Progress"));
  });

  it("loading shows 5 skeleton rows", async () => {
    let resolveFetch!: (v: Response) => void;
    const pending = new Promise<Response>((res) => { resolveFetch = res; });
    vi.mocked(apiFetch).mockReturnValue(pending as Promise<Response>);

    const root = makeRoot();
    const renderPromise = renderList(root, {});
    // Immediately after calling, skeleton should be present before fetch resolves
    // Need to allow initial sync part to run
    await new Promise((r) => setTimeout(r, 0));
    const skeletons = root.querySelectorAll(".skeleton");
    expect(skeletons.length).toBe(5);
    // Resolve to avoid pending promise leak
    resolveFetch(mockSuccess([], 0, 1, 20, 0));
    await renderPromise;
  });

  it("empty with Clear Filters", async () => {
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess([], 0, 1, 20, 0));
    const root = makeRoot();
    await renderList(root, {});

    const empty = root.querySelector(".empty");
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain("No incidents yet");

    // With filter active, shows No results + Clear Filters button
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess([], 0, 1, 20, 0));
    const root2 = document.createElement("div");
    document.body.appendChild(root2);
    await renderList(root2, { type: "Bug" });
    const empty2 = root2.querySelector(".empty");
    expect(empty2?.textContent).toContain("No results for this filter");
    const clearBtn = Array.from(root2.querySelectorAll("button")).find((b) => b.textContent?.includes("Clear") || b.textContent?.includes("Limpiar"));
    expect(clearBtn).toBeTruthy();
    if (clearBtn) {
      location.hash = "#/incidents?type=Bug";
      vi.mocked(apiFetch).mockClear();
      vi.mocked(apiFetch).mockResolvedValue(mockSuccess([], 0, 1, 20, 0));
      (clearBtn as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 10));
      expect(location.hash).toBe("#/incidents");
    }
  });

  it("error retry re-fetches", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("Network failure"));
    const root = makeRoot();
    await renderList(root, {});
    const err = root.querySelector(".error");
    expect(err).not.toBeNull();
    expect(err?.textContent).toContain("Network failure");
    const retryBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "Retry" || b.textContent === "Reintentar");
    expect(retryBtn).toBeTruthy();

    // Second click should re-fetch
    vi.mocked(apiFetch).mockClear();
    const items = [{ id: "1", type: "Bug", status: "Pending", created_at: new Date().toISOString(), has_screenshot: false }];
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess(items, 1, 1, 20, 1));
    (retryBtn as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const rows = root.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);
  });

  it("handles 422 invalid filter with inline error", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ detail: [{ loc: ["query", "type"], msg: "invalid type filter value", type: "value_error" }] }), { status: 422 }));
    const root = makeRoot();
    await renderList(root, {});
    const err = root.querySelector(".error");
    expect(err).not.toBeNull();
  });

  it("handles 429 rate limited", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ detail: "rate limited" }), { status: 429, headers: { "Retry-After": "30" } }));
    const root = makeRoot();
    await renderList(root, {});
    const err = root.querySelector(".error");
    expect(err).not.toBeNull();
    expect(err?.textContent).toContain("429");
  });

  it("responsive css table wrapper exists and pagination disabled states", async () => {
    const items = [{ id: "a", type: "Bug", status: "Pending", created_at: new Date().toISOString(), has_screenshot: true }];
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess(items, 10, 1, 20, 1));
    // total 10 but pages 1, Next disabled
    const root = makeRoot();
    await renderList(root, {});
    expect(root.querySelector(".table-wrapper")).not.toBeNull();
    const tds = root.querySelectorAll("td.col-thumbnail");
    expect(tds.length).toBeGreaterThan(0);
    // pagination page 2 scenario: Next disabled only on last page
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess(items, 40, 1, 20, 2));
    const root2 = document.createElement("div");
    document.body.appendChild(root2);
    await renderList(root2, {});
    const btns = Array.from(root2.querySelectorAll("button"));
    const next = btns.find((b) => b.textContent === "Next" || b.textContent === "Siguiente");
    expect(next?.disabled).toBe(false); // not last page
  });

  it("no innerHTML usage in rendered output", async () => {
    const items = [{ id: "x", type: "Bug", status: "Pending", created_at: "2026-09-02T00:00:00Z", has_screenshot: true }];
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess(items, 1, 1, 20, 1));
    const root = makeRoot();
    await renderList(root, {});
    // Ensure badges use textContent, and no script injection would be rendered
    const xssItem = [{ id: "xss", type: "<script>alert(1)</script>", status: "Pending", created_at: "2026-09-02T00:00:00Z", has_screenshot: false }];
    vi.mocked(apiFetch).mockResolvedValue(mockSuccess(xssItem as unknown as typeof items, 1, 1, 20, 1));
    const root2 = document.createElement("div");
    document.body.appendChild(root2);
    await renderList(root2, {});
    expect(root2.innerHTML).not.toContain("<script>alert(1)</script>");
    expect(root2.textContent).toContain("<script>alert(1)</script>");
  });
});
