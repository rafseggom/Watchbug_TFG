import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

vi.mock("../components/toast", async () => {
  const actual = await vi.importActual<typeof import("../components/toast")>("../components/toast");
  return {
    ...actual,
    showToast: vi.fn(),
  };
});

import { apiFetch } from "../api";
import { renderDetail } from "./detail";
import { showToast } from "../components/toast";

function makeRoot(): HTMLElement {
  const r = document.createElement("div");
  r.id = "app";
  document.body.appendChild(r);
  return r;
}

function makeDetailPayload(overrides: Record<string, unknown> = {}) {
  const base = {
    id: "111e4567-e89b-12d3-a456-426614174000",
    type: "Bug",
    status: "Pending",
    created_at: "2026-09-02T10:00:00Z",
    project_id: "proj-123",
    screenshot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
    payload: {
      metadata: {
        url: "https://example.com/page",
        userAgent: "Mozilla/5.0",
        viewport: "1920x1080",
        resolution: "1920x1080",
        timestamp: "2026-09-02T10:00:00Z",
        project_id: "proj-123",
      },
      consoleLogs: [
        { level: "error", args: ["boom", "<script>alert(1)</script>"], timestamp: "2026-09-02T10:01:00Z" },
        { level: "log", args: ["hi"], timestamp: "2026-09-02T10:02:00Z" },
      ],
    },
  };
  return { ...base, ...overrides } as unknown as Record<string, unknown>;
}

describe("detail view", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(showToast).mockReset();
    document.body.textContent = "";
    localStorage.clear();
    location.hash = "";
  });

  afterEach(() => {
    document.body.textContent = "";
    vi.restoreAllMocks();
    localStorage.clear();
    location.hash = "";
    // remove lightbox if any
    document.querySelectorAll(".lightbox").forEach((el) => el.remove());
  });

  it("renders status dropdown with TitleCase options and current selected", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify(makeDetailPayload({ status: "Pending" })), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const root = makeRoot();
    await renderDetail(root, "111e4567-e89b-12d3-a456-426614174000");

    const select = root.querySelector("select.status-select") as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    const opts = Array.from(select!.options).map((o) => o.value);
    expect(opts).toEqual(["Pending", "In Progress", "Resolved"]);
    // textContent TitleCase
    const texts = Array.from(select!.options).map((o) => o.textContent);
    expect(texts).toEqual(["Pending", "In Progress", "Resolved"]);
    expect(select!.value).toBe("Pending");
  });

  it("skeleton while loading detail", async () => {
    let resolveFetch!: (v: Response) => void;
    const pending = new Promise<Response>((res) => {
      resolveFetch = res;
    });
    vi.mocked(apiFetch).mockReturnValue(pending as Promise<Response>);

    const root = makeRoot();
    const promise = renderDetail(root, "abc-id");
    // Microtask allows sync skeleton to be rendered before await
    await new Promise((r) => setTimeout(r, 0));
    const skeletons = root.querySelectorAll(".skeleton");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
    const skeleton = root.querySelector('[data-testid="detail-skeleton"]');
    expect(skeleton).not.toBeNull();

    resolveFetch(new Response(JSON.stringify(makeDetailPayload()), { status: 200, headers: { "Content-Type": "application/json" } }));
    await promise;
    expect(root.querySelector('[data-testid="detail-skeleton"]')).toBeNull();
  });

  it("renders screenshot data URL with lightbox and metadata cards via textContent", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify(makeDetailPayload()), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const root = makeRoot();
    await renderDetail(root, "111e4567-e89b-12d3-a456-426614174000");

    // Screenshot img with data URL
    const img = root.querySelector('img[src^="data:image/png;base64"]') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toContain("data:image/png;base64");
    expect(img!.style.maxWidth).toBe("100%");
    expect(img!.style.objectFit).toBe("contain");
    expect(img!.loading).toBe("lazy");

    // Click opens lightbox overlay
    img!.click();
    const lightbox = document.body.querySelector(".lightbox");
    expect(lightbox).not.toBeNull();
    const lbImg = lightbox!.querySelector("img") as HTMLImageElement | null;
    expect(lbImg?.src).toContain("data:image/png;base64");
    // Dismiss on overlay click
    (lightbox as HTMLElement).click();
    expect(document.body.querySelector(".lightbox")).toBeNull();

    // Two-column layout exists
    expect(root.querySelector(".detail-layout")).not.toBeNull();
    expect(root.querySelector(".screenshot-pane")).not.toBeNull();
    expect(root.querySelector(".metadata-pane")).not.toBeNull();

    // Back link
    const back = root.querySelector('a[href="#/incidents"]') as HTMLAnchorElement | null;
    expect(back).not.toBeNull();
    expect(back!.textContent).toBeTruthy();

    // Metadata cards use textContent never innerHTML
    expect(root.innerHTML).not.toContain("<script>alert");
    expect(root.textContent).toContain("<script>alert(1)</script>"); // consoleLogs args escaped via textContent

    // ConsoleLogs collapsible details per entry with level badge
    const details = root.querySelectorAll("details");
    expect(details.length).toBe(2);
    const badges = root.querySelectorAll(".badge");
    expect(Array.from(badges).some((b) => b.textContent === "error")).toBe(true);
  });

  it("xss via metadata url javascript: scheme not set as href", async () => {
    const payload = makeDetailPayload({
      payload: {
        metadata: {
          url: "javascript:alert(1)",
          userAgent: "Mozilla/5.0",
          timestamp: "2026-09-02T10:00:00Z",
        },
      },
    });
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const root = makeRoot();
    await renderDetail(root, "xss-id");
    // Find url card: should contain text javascript:alert but not as href
    const anchors = Array.from(root.querySelectorAll("a")) as HTMLAnchorElement[];
    const xssAnchor = anchors.find((a) => a.textContent === "javascript:alert(1)");
    // If safe, xssAnchor should be null (rendered as span not a)
    // If buggy it would be an anchor with javascript href
    if (xssAnchor) {
      expect(xssAnchor.getAttribute("href")).not.toBe("javascript:alert(1)");
      // href should not contain javascript
      expect(xssAnchor.href).not.toContain("javascript:");
    } else {
      // Expect span with textContent containing url
      expect(root.textContent).toContain("javascript:alert(1)");
      // Ensure no anchor has javascript href
      anchors.forEach((a) => expect(a.href).not.toContain("javascript:"));
    }
  });

  it("404 shows Incident not found localized with Back", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 404 }));
    const root = makeRoot();
    await renderDetail(root, "invalid-uuid");
    expect(root.textContent).toContain("Incident not found");
    const back = root.querySelector('a[href="#/incidents"]');
    expect(back).not.toBeNull();
  });

  it("network error shows Retry and re-fetches on click", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("Network failure"));
    const root = makeRoot();
    await renderDetail(root, "abc");
    expect(root.textContent).toContain("Network error");
    const retryBtn = Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.includes("Retry") || b.textContent?.includes("Reintentar"));
    expect(retryBtn).toBeTruthy();

    vi.mocked(apiFetch).mockResolvedValueOnce(
      new Response(JSON.stringify(makeDetailPayload()), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    (retryBtn as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 20));
    // After retry, detail content should appear
    expect(root.querySelector('img[src^="data:image"]')).not.toBeNull();
  });

  it("401 triggers login redirect via location.hash", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    const root = makeRoot();
    await renderDetail(root, "abc");
    expect(location.hash).toBe("#/login");
  });
});

describe("status patch optimistic workflow", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(showToast).mockReset();
    document.body.textContent = "";
    localStorage.clear();
    location.hash = "";
  });

  afterEach(() => {
    document.body.textContent = "";
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("PATCH 200 optimistic update shows toast and caches with watchbug:status-updated event", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(makeDetailPayload({ status: "Pending" })), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "111e4567-e89b-12d3-a456-426614174000", status: "Resolved" }), { status: 200 }));
    const root = makeRoot();
    const eventSpy = vi.fn();
    window.addEventListener("watchbug:status-updated", eventSpy as EventListener);
    await renderDetail(root, "111e4567-e89b-12d3-a456-426614174000");

    const select = root.querySelector("select.status-select") as HTMLSelectElement;
    expect(select.value).toBe("Pending");
    // Change to Resolved
    select.value = "Resolved";
    select.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/incidents/111e4567-e89b-12d3-a456-426614174000/status",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "Resolved" }) }),
    );
    expect(showToast).toHaveBeenCalledWith("Status updated");
    expect(select.value).toBe("Resolved");
    expect(localStorage.getItem("watchbug:inc-111e4567-e89b-12d3-a456-426614174000:status")).toBe("Resolved");
    expect(eventSpy).toHaveBeenCalled();
    const ev = eventSpy.mock.calls[0][0] as CustomEvent;
    expect(ev.detail.status).toBe("Resolved");
    window.removeEventListener("watchbug:status-updated", eventSpy as EventListener);
  });

  it("PATCH 422 reverts to prior with inline error", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(makeDetailPayload({ status: "Pending" })), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: [{ loc: ["body", "status"], msg: "invalid", type: "value_error" }] }), { status: 422 }),
      );
    const root = makeRoot();
    await renderDetail(root, "id-422");
    const select = root.querySelector("select.status-select") as HTMLSelectElement;
    select.value = "Resolved";
    select.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));

    expect(select.value).toBe("Pending");
    // Inline error should contain invalid status text
    expect(root.textContent).toContain("Invalid status");
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("Invalid"), "error");
  });

  it("PATCH network error reverts and shows inline error", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(makeDetailPayload({ status: "In Progress" })), { status: 200 }))
      .mockRejectedValueOnce(new Error("Network failure"));
    const root = makeRoot();
    await renderDetail(root, "net-id");
    const select = root.querySelector("select.status-select") as HTMLSelectElement;
    expect(select.value).toBe("In Progress");
    select.value = "Resolved";
    select.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));
    expect(select.value).toBe("In Progress");
    expect(root.textContent).toContain("Network error");
  });

  it("Any->Any transition allowed (Pending->Resolved, Resolved->Pending)", async () => {
    // First detail is Resolved, change to Pending should succeed
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(makeDetailPayload({ status: "Resolved" })), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "Pending" }), { status: 200 }));
    const root = makeRoot();
    await renderDetail(root, "any-id");
    const select = root.querySelector("select.status-select") as HTMLSelectElement;
    expect(select.value).toBe("Resolved");
    select.value = "Pending";
    select.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));
    expect(select.value).toBe("Pending");
    expect(showToast).toHaveBeenCalledWith("Status updated");
  });
});
