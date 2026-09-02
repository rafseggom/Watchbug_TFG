import { apiFetch } from "../api";
import { renderHeader } from "../components/header";
import { renderTypeBadge, renderStatusBadge } from "../components/badges";
import { renderSkeletonRows } from "../components/skeleton";
import { formatDate } from "../utils/format";
import { t } from "../i18n/index";
import { buildHash } from "../utils/hash";
import { showToast } from "../components/toast";

const PAGE_SIZE = 20;

type IncidentItem = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  has_screenshot?: boolean;
  payload?: Record<string, unknown> | null;
};

type PaginatedResponse = {
  items: IncidentItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

function buildApiQuery(page: number, typeFilter: string | null, statusFilter: string | null): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("size", String(PAGE_SIZE));
  if (typeFilter) params.set("type", typeFilter);
  if (statusFilter) params.set("status", statusFilter);
  return `?${params.toString()}`;
}

function buildHashQuery(typeVal: string, statusVal: string, page: number): Record<string, string> {
  const q: Record<string, string> = {};
  if (typeVal !== "All") q.type = typeVal;
  if (statusVal !== "All") q.status = statusVal;
  if (page !== 1) q.page = String(page);
  return q;
}

export async function renderList(root: HTMLElement, query: Record<string, string>): Promise<void> {
  root.textContent = "";
  renderHeader(root);

  const container = document.createElement("div");
  container.style.padding = "24px";
  container.style.maxWidth = "1200px";
  container.style.margin = "0 auto";
  container.style.width = "100%";

  const title = document.createElement("h2");
  title.textContent = t("list.title");
  title.style.marginBottom = "16px";
  container.appendChild(title);

  // Filter bar
  const filterBar = document.createElement("div");
  filterBar.className = "filter-bar";
  filterBar.style.display = "flex";
  filterBar.style.gap = "12px";
  filterBar.style.marginBottom = "16px";
  filterBar.style.alignItems = "center";

  const typeLabel = document.createElement("label");
  typeLabel.textContent = t("list.filterType");
  typeLabel.style.fontSize = "13px";
  typeLabel.style.fontWeight = "600";
  const typeSelect = document.createElement("select");
  typeSelect.setAttribute("aria-label", t("list.filterType"));
  typeSelect.style.padding = "6px 8px";
  typeSelect.style.borderRadius = "6px";
  typeSelect.style.border = "1px solid var(--color-border)";
  for (const opt of ["All", "Bug", "Feedback"]) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt === "All" ? t("list.all") : opt;
    if ((query.type ?? "All") === opt) o.selected = true;
    // also handle TitleCase normalization: if query has lowercase, still match
    if (query.type && query.type.toLowerCase() === opt.toLowerCase() && opt !== "All") o.selected = true;
    typeSelect.appendChild(o);
  }
  // If query.type is present but not matching, select All fallback; ensure correct selected
  if (query.type && !["All", "Bug", "Feedback"].includes(query.type)) {
    // if lowercase bug/feedback, normalize to TitleCase selection
    const norm = query.type.toLowerCase();
    for (const o of Array.from(typeSelect.options)) {
      if (o.value.toLowerCase() === norm) o.selected = true;
    }
  }

  const statusLabel = document.createElement("label");
  statusLabel.textContent = t("list.filterStatus");
  statusLabel.style.fontSize = "13px";
  statusLabel.style.fontWeight = "600";
  const statusSelect = document.createElement("select");
  statusSelect.setAttribute("aria-label", t("list.filterStatus"));
  statusSelect.style.padding = "6px 8px";
  statusSelect.style.borderRadius = "6px";
  statusSelect.style.border = "1px solid var(--color-border)";
  for (const opt of ["All", "Pending", "In Progress", "Resolved"]) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt === "All" ? t("list.all") : opt;
    if ((query.status ?? "All") === opt) o.selected = true;
    statusSelect.appendChild(o);
  }

  const typeWrap = document.createElement("div");
  typeWrap.style.display = "flex";
  typeWrap.style.gap = "6px";
  typeWrap.style.alignItems = "center";
  typeWrap.appendChild(typeLabel);
  typeWrap.appendChild(typeSelect);

  const statusWrap = document.createElement("div");
  statusWrap.style.display = "flex";
  statusWrap.style.gap = "6px";
  statusWrap.style.alignItems = "center";
  statusWrap.appendChild(statusLabel);
  statusWrap.appendChild(statusSelect);

  filterBar.appendChild(typeWrap);
  filterBar.appendChild(statusWrap);
  container.appendChild(filterBar);

  // Table wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "table-wrapper";
  wrapper.style.overflowX = "auto";

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.background = "var(--color-surface)";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.style.position = "sticky";
  headRow.style.top = "0";
  headRow.style.background = "var(--color-surface)";
  headRow.style.borderBottom = "1px solid var(--color-border)";
  for (const key of ["colType", "colStatus", "colDate", "colPreview"] as const) {
    const th = document.createElement("th");
    th.textContent = t(`list.${key}`);
    th.style.textAlign = "left";
    th.style.padding = "10px 12px";
    th.style.fontSize = "13px";
    th.style.fontWeight = "600";
    th.style.whiteSpace = "nowrap";
    if (key === "colPreview") th.className = "col-thumbnail";
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  wrapper.appendChild(table);
  container.appendChild(wrapper);

  // Status areas (empty/error) below table
  const stateArea = document.createElement("div");
  container.appendChild(stateArea);

  // Footer pagination
  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.justifyContent = "space-between";
  footer.style.alignItems = "center";
  footer.style.marginTop = "16px";
  footer.style.flexWrap = "wrap";
  footer.style.gap = "12px";

  const pageInfo = document.createElement("span");
  pageInfo.style.fontSize = "13px";
  pageInfo.style.color = "var(--color-text-muted)";

  const btnPrev = document.createElement("button");
  btnPrev.textContent = t("list.prev");
  btnPrev.style.padding = "6px 12px";
  btnPrev.style.border = "1px solid var(--color-border)";
  btnPrev.style.borderRadius = "6px";
  btnPrev.style.cursor = "pointer";
  btnPrev.disabled = true;

  const btnNext = document.createElement("button");
  btnNext.textContent = t("list.next");
  btnNext.style.padding = "6px 12px";
  btnNext.style.border = "1px solid var(--color-border)";
  btnNext.style.borderRadius = "6px";
  btnNext.style.cursor = "pointer";
  btnNext.disabled = true;

  const btnGroup = document.createElement("div");
  btnGroup.style.display = "flex";
  btnGroup.style.gap = "8px";
  btnGroup.appendChild(btnPrev);
  btnGroup.appendChild(btnNext);

  footer.appendChild(pageInfo);
  footer.appendChild(btnGroup);
  container.appendChild(footer);

  root.appendChild(container);

  let currentPage = parseInt(query.page ?? "1", 10);
  if (isNaN(currentPage) || currentPage < 1) currentPage = 1;

  let currentTotal = 0;
  let currentPages = 1;

  function updateFooter(page: number, pages: number, total: number): void {
    currentPage = page;
    currentTotal = total;
    currentPages = pages || 1;
    const tpl = t("list.pageInfo");
    // Replace placeholders: Page {page} of {pages} (Total {total})
    let text = tpl;
    text = text.replace("{page}", String(page));
    text = text.replace("{pages}", String(pages || 1));
    text = text.replace("{total}", String(total));
    // Fallback if template not replaced
    if (!text.includes(String(page))) {
      text = `Page ${page} of ${pages || 1} (Total ${total})`;
    }
    pageInfo.textContent = text;
    btnPrev.disabled = page <= 1;
    btnNext.disabled = page >= (pages || 1);
  }

  function showEmpty(total: number): void {
    stateArea.textContent = "";
    // Only show empty when truly empty; do not duplicate table rows
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.style.textAlign = "center";
    empty.style.padding = "32px 16px";
    empty.style.color = "var(--color-text-muted)";

    const icon = document.createElement("div");
    icon.textContent = "📭";
    icon.style.fontSize = "32px";
    icon.style.marginBottom = "8px";
    empty.appendChild(icon);

    const hasFilter = typeSelect.value !== "All" || statusSelect.value !== "All";
    const p = document.createElement("p");
    p.textContent = hasFilter ? t("list.emptyNoResults") : t("list.emptyNoIncidents");
    p.style.marginBottom = "12px";
    empty.appendChild(p);

    if (hasFilter) {
      const clearBtn = document.createElement("button");
      clearBtn.textContent = t("list.clearFilters");
      clearBtn.style.padding = "6px 12px";
      clearBtn.style.border = "1px solid var(--color-border)";
      clearBtn.style.borderRadius = "6px";
      clearBtn.style.cursor = "pointer";
      clearBtn.addEventListener("click", () => {
        typeSelect.value = "All";
        statusSelect.value = "All";
        const newHash = buildHash({ name: "list", query: {} });
        if (location.hash !== newHash) location.hash = newHash;
        void fetchAndRender(1);
      });
      empty.appendChild(clearBtn);
    }

    stateArea.appendChild(empty);
  }

  function showError(message: string, retryPage: number): void {
    stateArea.textContent = "";
    const err = document.createElement("div");
    err.className = "error";
    err.style.textAlign = "center";
    err.style.padding = "24px 16px";
    err.style.color = "var(--color-bug)";

    const p = document.createElement("p");
    p.textContent = message;
    p.style.marginBottom = "12px";
    err.appendChild(p);

    const retryBtn = document.createElement("button");
    retryBtn.textContent = t("list.retry");
    retryBtn.style.padding = "6px 12px";
    retryBtn.style.border = "1px solid var(--color-border)";
    retryBtn.style.borderRadius = "6px";
    retryBtn.style.cursor = "pointer";
    retryBtn.addEventListener("click", () => {
      void fetchAndRender(retryPage);
    });
    err.appendChild(retryBtn);
    stateArea.appendChild(err);
  }

  function renderRows(items: IncidentItem[]): void {
    tbody.textContent = "";
    stateArea.textContent = "";
    for (const item of items) {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--color-border)";
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        location.hash = `#/incidents/${item.id}`;
      });

      const tdType = document.createElement("td");
      tdType.style.padding = "10px 12px";
      tdType.appendChild(renderTypeBadge(item.type));

      const tdStatus = document.createElement("td");
      tdStatus.style.padding = "10px 12px";
      tdStatus.appendChild(renderStatusBadge(item.status));

      const tdDate = document.createElement("td");
      tdDate.style.padding = "10px 12px";
      tdDate.style.fontSize = "13px";
      tdDate.style.whiteSpace = "nowrap";
      tdDate.textContent = formatDate(item.created_at ?? "");

      const tdPreview = document.createElement("td");
      tdPreview.className = "col-thumbnail";
      tdPreview.style.padding = "10px 12px";
      tdPreview.style.textAlign = "center";
      // has_screenshot boolean -> placeholder icon
      const hasShot = Boolean(item.has_screenshot);
      tdPreview.textContent = hasShot ? "◉" : "—";

      tr.appendChild(tdType);
      tr.appendChild(tdStatus);
      tr.appendChild(tdDate);
      tr.appendChild(tdPreview);
      tbody.appendChild(tr);
    }
  }

  async function fetchAndRender(page: number): Promise<void> {
    // Show skeleton while loading
    tbody.textContent = "";
    stateArea.textContent = "";
    tbody.appendChild(renderSkeletonRows(5));
    // Reset footer to loading disabled
    btnPrev.disabled = true;
    btnNext.disabled = true;

    const typeVal = typeSelect.value !== "All" ? typeSelect.value : null;
    const statusVal = statusSelect.value !== "All" ? statusSelect.value : null;
    const q = buildApiQuery(page, typeVal, statusVal);

    try {
      const res = await apiFetch(`/api/incidents${q}`);
      if (res.ok) {
        const data = (await res.json()) as PaginatedResponse;
        currentTotal = data.total;
        currentPages = data.pages;
        if (data.items.length === 0 || data.total === 0) {
          tbody.textContent = "";
          updateFooter(data.page ?? page, data.pages, data.total);
          showEmpty(data.total);
          return;
        }
        renderRows(data.items);
        updateFooter(data.page ?? page, data.pages, data.total);
        return;
      }
      // Error handling
      tbody.textContent = "";
      if (res.status === 422) {
        let detail = t("errors.invalidFilter");
        try {
          const body = (await res.json()) as { detail?: unknown };
          if (body && typeof body.detail === "string") detail = body.detail;
          else if (Array.isArray(body.detail) && body.detail.length) {
            const first = body.detail[0] as { msg?: string };
            if (first?.msg) detail = first.msg;
          }
        } catch {
          // ignore json parse
        }
        updateFooter(page, currentPages, currentTotal);
        showError(detail, page);
        showToast(detail);
        return;
      }
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        let msg = t("errors.rateLimited");
        if (retryAfter) msg = `${msg} (Retry-After: ${retryAfter}s)`;
        msg = `${msg} (429)`;
        updateFooter(page, currentPages, currentTotal);
        showError(msg, page);
        showToast(msg);
        return;
      }
      // Generic error
      let msg = t("errors.network");
      try {
        const body = (await res.json()) as { detail?: string };
        if (body?.detail) msg = body.detail;
      } catch {
        // keep generic
      }
      if (res.status) msg = `${msg} (${res.status})`;
      updateFooter(page, currentPages, currentTotal);
      showError(msg, page);
      return;
    } catch (e) {
      tbody.textContent = "";
      const msg = e instanceof Error ? e.message : t("errors.network");
      const display = msg || t("errors.network");
      updateFooter(page, currentPages, currentTotal);
      showError(display, page);
    }
  }

  // Pagination handlers
  btnPrev.addEventListener("click", () => {
    if (currentPage <= 1) return;
    const newPage = currentPage - 1;
    const q = buildHashQuery(typeSelect.value, statusSelect.value, newPage);
    const newHash = buildHash({ name: "list", query: q });
    if (location.hash !== newHash) location.hash = newHash;
    void fetchAndRender(newPage);
  });

  btnNext.addEventListener("click", () => {
    if (currentPage >= currentPages) return;
    const newPage = currentPage + 1;
    const q = buildHashQuery(typeSelect.value, statusSelect.value, newPage);
    const newHash = buildHash({ name: "list", query: q });
    if (location.hash !== newHash) location.hash = newHash;
    void fetchAndRender(newPage);
  });

  // Filter change handlers
  const onFilterChange = (): void => {
    const q = buildHashQuery(typeSelect.value, statusSelect.value, 1);
    const newHash = buildHash({ name: "list", query: q });
    if (location.hash !== newHash) location.hash = newHash;
    void fetchAndRender(1);
  };
  typeSelect.addEventListener("change", onFilterChange);
  statusSelect.addEventListener("change", onFilterChange);

  // Initial fetch
  await fetchAndRender(currentPage);
}
