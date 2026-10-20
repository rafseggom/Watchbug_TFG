/**
 * Toast Notification Utility
 */

interface ToastOptions {
  type?: 'default' | 'success' | 'error';
  duration?: number;
}

function createContainer(): HTMLElement {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }
  return container;
}

export const toast = {
  init(): void {
    createContainer();
  },

  show(message: string, options: ToastOptions = {}): void {
    const container = createContainer();
    const { type = 'default', duration = 4000 } = options;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, duration);
  },

  success(message: string, duration?: number): void {
    this.show(message, { type: 'success', duration });
  },

  error(message: string, duration?: number): void {
    this.show(message, { type: 'error', duration });
  }
};