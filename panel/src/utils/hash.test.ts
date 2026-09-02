import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseHash, buildHash, navigate } from "./hash";

describe("parseBuild hash", () => {
  it("parse #/login -> login", () => {
    expect(parseHash("#/login")).toEqual({ name: "login" });
    expect(parseHash("")).toEqual({ name: "login" });
    expect(parseHash("#")).toEqual({ name: "login" });
  });

  it("parse #/incidents?type=Bug -> list query Bug", () => {
    const r = parseHash("#/incidents?type=Bug") as { name: string; query: Record<string, string> };
    expect(r.name).toBe("list");
    expect(r.query.type).toBe("Bug");
  });

  it("parse #/incidents?type=bug lower forwarded", () => {
    const r = parseHash("#/incidents?type=bug") as { name: string; query: Record<string, string> };
    expect(r.name).toBe("list");
    expect(r.query.type).toBe("bug");
  });

  it("parse comma-separated status", () => {
    const r = parseHash("#/incidents?status=Pending,In%20Progress") as { name: string; query: Record<string, string> };
    expect(r.name).toBe("list");
    expect(r.query.status).toBe("Pending,In Progress");
  });

  it("buildHash round-trip", () => {
    const route = { name: "list" as const, query: { type: "Bug", status: "Pending,In Progress" } };
    const hash = buildHash(route);
    const parsed = parseHash(hash) as { name: string; query: Record<string, string> };
    expect(parsed.name).toBe("list");
    expect(parsed.query.type).toBe("Bug");
    expect(parsed.query.status).toBe("Pending,In Progress");
  });

  it("parse #/incidents/:id detail", () => {
    const r = parseHash("#/incidents/123e4567-e89b-12d3-a456-426614174000") as { name: string; id: string };
    expect(r.name).toBe("detail");
    expect(r.id).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("navigate helper sets location.hash", () => {
    navigate("#/incidents");
    expect(location.hash).toBe("#/incidents");
    navigate("/login");
    expect(location.hash).toBe("#/login");
  });

  it("buildHash for detail and not-found", () => {
    expect(buildHash({ name: "detail", id: "abc" })).toBe("#/incidents/abc");
    expect(buildHash({ name: "login" })).toBe("#/login");
  });
});
