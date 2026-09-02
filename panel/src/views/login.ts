// Placeholder for tracer — full login view implemented in Task 2
export function renderLogin(root: HTMLElement): void {
  root.textContent = "";
  const wrapper = document.createElement("div");
  wrapper.className = "login-wrapper";
  const card = document.createElement("div");
  card.className = "card";
  const h = document.createElement("h1");
  h.textContent = "Sign in to Watchbug";
  card.appendChild(h);
  const p = document.createElement("p");
  p.textContent = "Login placeholder — full implementation in Task 2";
  card.appendChild(p);
  wrapper.appendChild(card);
  root.appendChild(wrapper);
}
