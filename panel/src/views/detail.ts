import { apiFetch } from "../api";
import { renderHeader } from "../components/header";
import { renderTypeBadge, renderStatusBadge } from "../components/badges";
import { t, getLang } from "../i18n/index";
import { isSafeHref } from "../utils/sanitize";
import { formatDate } from "../utils/format";

const ALLOWED_STATUSES = ["Pending", "In Progress", "Resolved"] as const;

type ConsoleEntry = {
  level: string;
  args: string[];
  timestamp: string;
};

type DetailResponse = {
  id: string;
  type: string;
  status: string;
  payload?: {
    metadata?: Record<string, unknown>;
    consoleLogs?: ConsoleEntry[];
    [k: string]: unknown;
  } | null;
  screenshot?: string | null;
  project_id?: string | null;
  created_at?: string | null;
};

function clearRoot(root: HTMLElement): void {
  root.textContent = "";
}

function createSkeleton(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.setAttribute("data-testid", "detail-skeleton");
  wrap.style.padding = "24px";
  for (let i = 0; i < 3; i++) {
    const sk = document.createElement("div");
    sk.className = "skeleton";
    sk.style.height = "20px";
    sk.style.marginBottom = "12px";
    wrap.appendChild(sk);
  }
  const loading = document.createElement("p");
  loading.textContent = t("detail.loading");
  loading.style.color = "var(--color-text-muted)";
  loading.style.fontSize = "13px";
  wrap.appendChild(loading);
  return wrap;
}

function renderNotFound(root: HTMLElement): void {
  clearRoot(root);
  renderHeader(root);
  const container = document.createElement("div");
  container.style.textAlign = "center";
  container.style.padding = "48px 16px";
  const p = document.createElement("p");
  p.textContent = t("detail.notFound");
  p.style.marginBottom = "16px";
  p.style.color = "var(--color-text-muted)";
  const back = document.createElement("a");
  back.href = "#/incidents";
  back.textContent = t("detail.back");
  back.style.display = "inline-block";
  back.style.padding = "8px 14px";
  back.style.border = "1px solid var(--color-border)";
  back.style.borderRadius = "6px";
  back.style.textDecoration = "none";
  back.style.color = "var(--color-text)";
  container.appendChild(p);
  container.appendChild(back);
  root.appendChild(container);
}

function renderError(root: HTMLElement, id: string, message: string): void {
  clearRoot(root);
  renderHeader(root);
  const container = document.createElement("div");
  container.style.textAlign = "center";
  container.style.padding = "48px 16px";
  const p = document.createElement("p");
  p.textContent = message || t("errors.network");
  p.style.marginBottom = "16px";
  p.style.color = "var(--color-bug)";
  const btn = document.createElement("button");
  btn.textContent = t("detail.retry");
  btn.style.padding = "8px 14px";
  btn.style.border = "1px solid var(--color-border)";
  btn.style.borderRadius = "6px";
  btn.style.cursor = "pointer";
  btn.addEventListener("click", () => {
    void renderDetail(root, id);
  });
  container.appendChild(p);
  container.appendChild(btn);
  root.appendChild(container);
}

function createCard(label: string, valueNode: HTMLElement | string): HTMLElement {
  const card = document.createElement("div");
  card.className = "meta-card";
  const labelEl = document.createElement("div");
  labelEl.textContent = label;
  labelEl.style.fontSize = "12px";
  labelEl.style.fontWeight = "600";
  labelEl.style.color = "var(--color-text-muted)";
  labelEl.style.marginBottom = "4px";
  card.appendChild(labelEl);
  if (typeof valueNode === "string") {
    const v = document.createElement("div");
    v.textContent = valueNode;
    v.style.fontSize = "13px";
    v.style.wordBreak = "break-all";
    card.appendChild(v);
  } else {
    valueNode.style.fontSize = "13px";
    valueNode.style.wordBreak = "break-all";
    card.appendChild(valueNode);
  }
  return card;
}

function createLevelBadge(level: string): HTMLElement {
  const span = document.createElement("span");
  span.textContent = level;
  const allowed = new Set(["log", "warn", "error", "info"]);
  const safe = allowed.has(level) ? level : "log";
  span.className = `badge badge--${safe}`;
  span.style.marginRight = "6px";
  return span;
}

function openLightbox(src: string): void {
  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,.8)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "1000";
  overlay.style.cursor = "zoom-out";
  const img = document.createElement("img");
  img.src = src;
  img.alt = t("detail.screenshotAlt");
  img.style.maxWidth = "90vw";
  img.style.maxHeight = "90vh";
  img.style.objectFit = "contain";
  img.style.borderRadius = "8px";
  img.style.boxShadow = "0 8px 24px rgba(0,0,0,.4)";
  overlay.appendChild(img);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  // Also close on Escape
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      overlay.remove();
      window.removeEventListener("keydown", onKey);
    }
  };
  window.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
}

export async function renderDetail(root: HTMLElement, id: string): Promise<void> {
  clearRoot(root);
  renderHeader(root);

  const container = document.createElement("div");
  container.style.padding = "24px";
  container.style.maxWidth = "1200px";
  container.style.margin = "0 auto";
  container.style.width = "100%";

  // Top bar: Back link + status dropdown placeholder
  const topBar = document.createElement("div");
  topBar.style.display = "flex";
  topBar.style.justifyContent = "space-between";
  topBar.style.alignItems = "center";
  topBar.style.marginBottom = "16px";
  topBar.style.flexWrap = "wrap";
  topBar.style.gap = "12px";

  const backLink = document.createElement("a");
  backLink.href = "#/incidents";
  backLink.textContent = t("detail.back");
  backLink.style.fontSize = "13px";
  backLink.style.color = "var(--color-primary)";
  backLink.style.textDecoration = "none";
  topBar.appendChild(backLink);

  // Status dropdown placeholder (filled after fetch)
  const statusWrap = document.createElement("div");
  statusWrap.style.display = "flex";
  statusWrap.style.alignItems = "center";
  statusWrap.style.gap = "8px";

  const statusLabel = document.createElement("label");
  statusLabel.textContent = t("detail.labels.status");
  statusLabel.style.fontSize = "13px";
  statusLabel.style.fontWeight = "600";
  statusWrap.appendChild(statusLabel);

  const statusSelect = document.createElement("select");
  statusSelect.className = "status-select";
  statusSelect.style.padding = "6px 8px";
  statusSelect.style.borderRadius = "6px";
  statusSelect.style.border = "1px solid var(--color-border)";
  statusSelect.style.fontSize = "13px";
  for (const opt of ALLOWED_STATUSES) {
    const o = document.createElement("option");
    o.value = opt;
    const translated = t(`status.${opt}`);
    o.textContent = translated !== `status.${opt}` ? translated : opt;
    statusSelect.appendChild(o);
  }
  // Disabled until data loads
  statusSelect.disabled = true;
  statusWrap.appendChild(statusSelect);

  // Inline error for status patch (hidden by default)
  const inlineError = document.createElement("div");
  inlineError.style.color = "var(--color-bug)";
  inlineError.style.fontSize = "12px";
  inlineError.style.marginTop = "4px";
  const statusCol = document.createElement("div");
  statusCol.appendChild(statusWrap);
  statusCol.appendChild(inlineError);

  topBar.appendChild(statusCol);
  container.appendChild(topBar);

  // Two-column layout
  const layout = document.createElement("div");
  layout.className = "detail-layout";

  const leftPane = document.createElement("div");
  leftPane.className = "screenshot-pane";

  const rightPane = document.createElement("div");
  rightPane.className = "metadata-pane";

  layout.appendChild(leftPane);
  layout.appendChild(rightPane);
  container.appendChild(layout);

  root.appendChild(container);

  // Skeleton while loading
  const skeleton = createSkeleton();
  rightPane.appendChild(skeleton);
  const leftSkeleton = document.createElement("div");
  leftSkeleton.className = "skeleton";
  leftSkeleton.style.height = "280px";
  leftPane.appendChild(leftSkeleton);

  let detail: DetailResponse;
  try {
    const res = await apiFetch(`/api/incidents/${id}`);
    if (res.status === 404) {
      renderNotFound(root);
      return;
    }
    if (res.status === 401) {
      // apiFetch already attempted refresh; if still 401 redirect to login
      location.hash = "#/login";
      return;
    }
    if (!res.ok) {
      // For other errors, show generic error with retry
      let msg = t("errors.network");
      try {
        const body = (await res.json()) as { detail?: string };
        if (body?.detail) msg = body.detail;
      } catch {
        // keep generic
      }
      renderError(root, id, `${msg} (${res.status})`);
      return;
    }
    detail = (await res.json()) as DetailResponse;
  } catch {
    renderError(root, id, t("errors.network"));
    return;
  }

  // Remove skeletons
  skeleton.remove();
  leftSkeleton.remove();

  // Enable and set status dropdown
  statusSelect.disabled = false;
  if (ALLOWED_STATUSES.includes(detail.status as typeof ALLOWED_STATUSES[number])) {
    statusSelect.value = detail.status;
  }

  // Left pane: screenshot
  if (detail.screenshot && typeof detail.screenshot === "string" && detail.screenshot.startsWith("data:image")) {
    const img = document.createElement("img");
    img.src = detail.screenshot;
    img.alt = t("detail.screenshotAlt");
    img.loading = "lazy";
    img.style.maxWidth = "100%";
    img.style.width = "100%";
    img.style.objectFit = "contain";
    img.style.borderRadius = "8px";
    img.style.border = "1px solid var(--color-border)";
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => openLightbox(detail.screenshot as string));
    leftPane.appendChild(img);
  } else {
    const noShot = document.createElement("div");
    noShot.textContent = t("detail.noScreenshot");
    noShot.style.textAlign = "center";
    noShot.style.padding = "32px 16px";
    noShot.style.color = "var(--color-text-muted)";
    noShot.style.border = "1px dashed var(--color-border)";
    noShot.style.borderRadius = "8px";
    leftPane.appendChild(noShot);
  }

  // Right pane: metadata cards
  const meta = (detail.payload?.metadata as Record<string, unknown>) ?? {};
  const urlVal = typeof meta.url === "string" ? meta.url : "";
  const userAgentVal = typeof meta.userAgent === "string" ? meta.userAgent : (typeof meta.user_agent === "string" ? meta.user_agent : "");
  const viewportVal = meta.viewport ? String(meta.viewport) : "";
  const resolutionVal = meta.resolution ? String(meta.resolution) : "";
  const timestampVal = typeof meta.timestamp === "string" ? meta.timestamp : (detail.created_at ?? "");
  const projectIdVal = detail.project_id ?? (typeof meta.project_id === "string" ? meta.project_id : "");

  // URL card with href guard
  if (urlVal) {
    const urlNode = document.createElement(urlVal && isSafeHref(urlVal) ? "a" : "span");
    urlNode.textContent = urlVal;
    if (urlNode instanceof HTMLAnchorElement && isSafeHref(urlVal)) {
      urlNode.href = urlVal;
      urlNode.target = "_blank";
      urlNode.rel = "noopener noreferrer";
      urlNode.style.color = "var(--color-primary)";
    }
    rightPane.appendChild(createCard(t("detail.labels.url"), urlNode));
  }

  if (userAgentVal) {
    rightPane.appendChild(createCard(t("detail.labels.userAgent"), String(userAgentVal)));
  }

  // Viewport vs resolution: prefer viewport if exists
  if (viewportVal) {
    rightPane.appendChild(createCard(t("detail.labels.viewport"), viewportVal));
  } else if (resolutionVal) {
    rightPane.appendChild(createCard(t("detail.labels.resolution"), resolutionVal));
  }

  if (timestampVal) {
    const formatted = formatDate(String(timestampVal), getLang());
    rightPane.appendChild(createCard(t("detail.labels.timestamp"), formatted));
  }

  if (projectIdVal) {
    rightPane.appendChild(createCard(t("detail.labels.project"), String(projectIdVal)));
  }

  // Type and status badges as cards
  {
    const typeCard = document.createElement("div");
    typeCard.className = "meta-card";
    const label = document.createElement("div");
    label.textContent = t("detail.labels.type");
    label.style.fontSize = "12px";
    label.style.fontWeight = "600";
    label.style.color = "var(--color-text-muted)";
    label.style.marginBottom = "4px";
    typeCard.appendChild(label);
    typeCard.appendChild(renderTypeBadge(detail.type));
    rightPane.appendChild(typeCard);
  }
  {
    const statusCard = document.createElement("div");
    statusCard.className = "meta-card";
    const label = document.createElement("div");
    label.textContent = t("detail.labels.status");
    label.style.fontSize = "12px";
    label.style.fontWeight = "600";
    label.style.color = "var(--color-text-muted)";
    label.style.marginBottom = "4px";
    statusCard.appendChild(label);
    statusCard.appendChild(renderStatusBadge(detail.status));
    rightPane.appendChild(statusCard);
  }

  if (detail.created_at) {
    const formatted = formatDate(detail.created_at, getLang());
    rightPane.appendChild(createCard(t("detail.labels.createdAt"), formatted));
  }

  // ConsoleLogs collapsible
  const logs = detail.payload?.consoleLogs;
  if (Array.isArray(logs) && logs.length > 0) {
    const logsWrap = document.createElement("div");
    logsWrap.style.marginTop = "12px";
    const header = document.createElement("h4");
    header.textContent = t("detail.consoleLogsCount").replace("{count}", String(logs.length));
    if (header.textContent.includes("{count}")) {
      header.textContent = `${t("detail.consoleLogs")} (${logs.length})`;
    }
    header.style.fontSize = "13px";
    header.style.fontWeight = "600";
    header.style.marginBottom = "8px";
    logsWrap.appendChild(header);

    for (const entry of logs) {
      const detailsEl = document.createElement("details");
      detailsEl.style.marginBottom = "8px";
      detailsEl.style.border = "1px solid var(--color-border)";
      detailsEl.style.borderRadius = "6px";
      detailsEl.style.padding = "8px";

      const summary = document.createElement("summary");
      summary.style.cursor = "pointer";
      summary.style.fontSize = "13px";
      summary.style.display = "flex";
      summary.style.alignItems = "center";
      summary.style.gap = "8px";
      summary.style.listStyle = "none";

      const badge = createLevelBadge(String(entry.level ?? "log"));
      summary.appendChild(badge);

      const timeSpan = document.createElement("span");
      timeSpan.textContent = entry.timestamp ? formatDate(entry.timestamp, getLang()) : "";
      timeSpan.style.fontSize = "12px";
      timeSpan.style.color = "var(--color-text-muted)";
      timeSpan.style.marginLeft = "auto";
      summary.appendChild(timeSpan);

      detailsEl.appendChild(summary);

      const argsDiv = document.createElement("div");
      argsDiv.style.marginTop = "8px";
      argsDiv.style.fontSize = "12px";
      argsDiv.style.fontFamily = "monospace";
      argsDiv.style.whiteSpace = "pre-wrap";
      argsDiv.style.wordBreak = "break-all";
      const joined = Array.isArray(entry.args) ? entry.args.join(" ") : String(entry.args ?? "");
      argsDiv.textContent = joined.slice(0, 2000);

      detailsEl.appendChild(argsDiv);
      logsWrap.appendChild(detailsEl);
    }
    rightPane.appendChild(logsWrap);
  }
}
