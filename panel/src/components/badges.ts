const ALLOWED_TYPES = new Set(["Bug", "Feedback"]);
const ALLOWED_STATUSES = new Set(["Pending", "In Progress", "Resolved"]);

export function renderTypeBadge(type: string): HTMLElement {
  const safe = ALLOWED_TYPES.has(type) ? type : type;
  const span = document.createElement("span");
  const normalized = safe.toLowerCase();
  // Provide both CSS schemes: badge--* (existing CSS) and type-* (plan spec)
  span.className = `badge badge--${normalized} type-${safe}`;
  span.textContent = safe;
  return span;
}

export function renderStatusBadge(status: string): HTMLElement {
  const safe = ALLOWED_STATUSES.has(status) ? status : status;
  const slug = safe.replace(" ", "-").toLowerCase();
  const normalized = safe === "In Progress" ? "progress" : safe.toLowerCase();
  const span = document.createElement("span");
  span.className = `badge badge--${normalized} pill status-${slug}`;
  span.textContent = safe;
  return span;
}
