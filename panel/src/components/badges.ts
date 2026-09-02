const ALLOWED_TYPES = new Set(["Bug", "Feedback"]);
const ALLOWED_STATUSES = new Set(["Pending", "In Progress", "Resolved"]);

function sanitizeClass(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

export function renderTypeBadge(type: string): HTMLElement {
  const span = document.createElement("span");
  span.textContent = type;
  // Class allowlist: only Bug/Feedback get specific badge color; others fallback to generic badge
  if (ALLOWED_TYPES.has(type)) {
    const normalized = type.toLowerCase();
    span.className = `badge badge--${normalized} type-${type}`;
  } else {
    span.className = `badge badge--unknown type-${sanitizeClass(type)}`;
  }
  return span;
}

export function renderStatusBadge(status: string): HTMLElement {
  const span = document.createElement("span");
  span.textContent = status;
  if (ALLOWED_STATUSES.has(status)) {
    const normalized = status === "In Progress" ? "progress" : status.toLowerCase();
    const slug = status.replace(" ", "-").toLowerCase();
    span.className = `badge badge--${normalized} pill status-${slug}`;
  } else {
    span.className = `badge badge--unknown pill status-${sanitizeClass(status)}`;
  }
  return span;
}
