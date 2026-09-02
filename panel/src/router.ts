import { parseHash, navigate } from "./utils/hash";
import { renderLogin } from "./views/login";
import { renderList } from "./views/list";
import { renderDetail } from "./views/detail";
import { authGuard } from "./auth";
import { renderHeader } from "./components/header";

export { navigate, parseHash };
export type { Route } from "./utils/hash";

function renderNotFound(root: HTMLElement): void {
  root.textContent = "";
  const wrapper = document.createElement("div");
  wrapper.style.textAlign = "center";
  wrapper.style.padding = "48px 16px";
  const h = document.createElement("h2");
  h.textContent = "Not found";
  const a = document.createElement("a");
  a.textContent = "Back to login";
  a.href = "#/login";
  wrapper.appendChild(h);
  wrapper.appendChild(a);
  root.appendChild(wrapper);
}

function renderListPlaceholder(root: HTMLElement): void {
  root.textContent = "";
  renderHeader(root);
  const wrapper = document.createElement("div");
  wrapper.style.padding = "24px";
  const h = document.createElement("h2");
  h.textContent = "Incidents";
  const p = document.createElement("p");
  p.textContent = "Incident list will appear here.";
  wrapper.appendChild(h);
  wrapper.appendChild(p);
  root.appendChild(wrapper);
}

function renderDetailPlaceholder(root: HTMLElement, id: string): void {
  void id;
  void root;
  // Legacy placeholder retained for type compat; actual detail uses renderDetail
}

export async function onRoute(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;
  const route = parseHash(location.hash);

  if (route.name === "login") {
    renderLogin(app);
    return;
  }

  if (route.name === "list") {
    const ok = await authGuard();
    if (!ok) return;
    await renderList(app, route.query);
    return;
  }

  if (route.name === "detail") {
    const ok = await authGuard();
    if (!ok) return;
    await renderDetail(app, route.id);
    return;
  }

  renderNotFound(app);
}

export function initRouter(): void {
  window.addEventListener("hashchange", onRoute);
  // Ensure empty hash defaults to #/login
  if (!location.hash || location.hash === "#") {
    location.hash = "#/login";
  }
  void onRoute();
}
