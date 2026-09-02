export function showToast(msg: string, type: "success" | "error" = "success"): void {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = msg;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (container && container.childNodes.length === 0) {
      // keep container for next toast
    }
  }, 3000);
}
