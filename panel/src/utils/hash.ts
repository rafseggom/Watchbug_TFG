export type Route =
  | { name: "login" }
  | { name: "list"; query: Record<string, string> }
  | { name: "detail"; id: string }
  | { name: "not-found" };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/login";
  const [pathPart, qs] = raw.split("?");
  // pathPart is like "/login", "/incidents", "/incidents/abc-123"
  const query = qs ? Object.fromEntries(new URLSearchParams(qs)) : {};

  if (pathPart === "/login" || pathPart === "" || pathPart === "/") {
    return { name: "login" };
  }
  if (pathPart === "/incidents") {
    return { name: "list", query };
  }
  const m = pathPart.match(/^\/incidents\/([^/]+)$/);
  if (m) {
    return { name: "detail", id: m[1] };
  }
  return { name: "not-found" };
}

export function buildHash(route: Route): string {
  if (route.name === "login") return "#/login";
  if (route.name === "list") {
    const qs = new URLSearchParams(route.query || {}).toString();
    return qs ? `#/incidents?${qs}` : "#/incidents";
  }
  if (route.name === "detail") return `#/incidents/${route.id}`;
  return "#/login";
}

export function navigate(hash: string): void {
  // Ensure hash starts with #
  if (!hash.startsWith("#")) hash = "#" + hash;
  location.hash = hash;
}
