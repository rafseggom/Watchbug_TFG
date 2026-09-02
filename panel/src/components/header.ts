import { getLang, setLang, t } from "../i18n/index";
import { logout } from "../auth";

export function renderHeader(container: HTMLElement): void {
  const header = document.createElement("div");
  header.className = "app-header";

  const brand = document.createElement("div");
  brand.className = "app-header__brand";
  brand.textContent = "Watchbug";

  const right = document.createElement("div");
  right.className = "app-header__right";

  // Language toggle EN/ES
  const langToggle = document.createElement("div");
  langToggle.className = "lang-toggle";

  const btnEn = document.createElement("button");
  btnEn.textContent = "EN";
  if (getLang() === "en") btnEn.className = "active";

  const btnEs = document.createElement("button");
  btnEs.textContent = "ES";
  if (getLang() === "es") btnEs.className = "active";

  btnEn.addEventListener("click", () => {
    setLang("en");
    window.dispatchEvent(new Event("hashchange"));
  });
  btnEs.addEventListener("click", () => {
    setLang("es");
    window.dispatchEvent(new Event("hashchange"));
  });

  langToggle.appendChild(btnEn);
  langToggle.appendChild(btnEs);

  const userSpan = document.createElement("span");
  userSpan.textContent = "Admin";
  userSpan.style.fontSize = "13px";
  userSpan.style.color = "var(--color-text-muted)";

  const logoutBtn = document.createElement("button");
  logoutBtn.className = "btn-logout";
  logoutBtn.textContent = t("header.logout");
  logoutBtn.addEventListener("click", () => {
    void logout();
  });

  right.appendChild(langToggle);
  right.appendChild(userSpan);
  right.appendChild(logoutBtn);

  header.appendChild(brand);
  header.appendChild(right);

  container.appendChild(header);
}
