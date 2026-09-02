import { apiFetch } from "../api";
import { t } from "../i18n/index";
import { showToast } from "../components/toast";
import { scheduleRefresh } from "../auth";
import { renderHeader } from "../components/header";

export function renderLogin(root: HTMLElement): void {
  root.textContent = "";

  // Header with lang toggle (re-uses header component but without auth guard)
  const headerHost = document.createElement("div");
  renderHeader(headerHost);
  root.appendChild(headerHost);

  const wrapper = document.createElement("div");
  wrapper.className = "login-wrapper";

  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("h1");
  title.textContent = t("login.title");
  card.appendChild(title);

  const form = document.createElement("form");
  form.setAttribute("novalidate", "true");

  const emailInput = document.createElement("input");
  emailInput.type = "text";
  emailInput.placeholder = t("login.email");
  emailInput.autocomplete = "email";
  emailInput.setAttribute("aria-label", t("login.email"));

  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.placeholder = t("login.password");
  passwordInput.autocomplete = "current-password";
  passwordInput.setAttribute("aria-label", t("login.password"));

  const errorDiv = document.createElement("div");
  errorDiv.className = "inline-error";
  errorDiv.setAttribute("role", "alert");

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn-primary";

  const btnText = document.createElement("span");
  btnText.textContent = t("login.submit");

  const spinner = document.createElement("span");
  spinner.className = "spinner hidden";
  spinner.setAttribute("aria-hidden", "true");

  submitBtn.appendChild(btnText);
  submitBtn.appendChild(spinner);

  form.appendChild(emailInput);
  form.appendChild(passwordInput);
  form.appendChild(errorDiv);
  form.appendChild(submitBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      errorDiv.textContent = t("login.errorRequired");
      return;
    }

    errorDiv.textContent = "";
    submitBtn.disabled = true;
    btnText.textContent = t("login.loggingIn");
    spinner.className = "spinner";

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        scheduleRefresh();
        location.hash = "#/incidents";
        return;
      }

      if (res.status === 401) {
        errorDiv.textContent = t("login.errorInvalid");
        showToast(t("login.errorInvalid"), "error");
      } else {
        errorDiv.textContent = t("errors.network");
        showToast(t("errors.network"), "error");
      }
    } catch {
      errorDiv.textContent = t("errors.network");
      showToast(t("errors.network"), "error");
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = t("login.submit");
      spinner.className = "spinner hidden";
    }
  });

  card.appendChild(form);
  wrapper.appendChild(card);
  root.appendChild(wrapper);
}
