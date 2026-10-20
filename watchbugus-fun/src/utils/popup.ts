/**
 * Popup Modal Utility
 */

interface PopupOptions {
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

let currentPopup: (() => void) | null = null;

export const popup = {
  init(): void {
    // Popup HTML is already in index.html
  },

  show(options: PopupOptions): void {
    const overlay = document.getElementById('popup')!;
    const title = document.getElementById('popup-title')!;
    const content = document.getElementById('popup-content')!;
    const okBtn = document.getElementById('popup-ok')!;
    const cancelBtn = document.getElementById('popup-cancel')!;

    title.textContent = options.title;
    content.innerHTML = options.content;
    okBtn.textContent = options.confirmText || 'OK';
    cancelBtn.textContent = options.cancelText || 'CANCEL';

    cancelBtn.style.display = options.onCancel ? 'inline-block' : 'none';

    overlay.hidden = false;

    // Focus management
    const focusable = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusable[0] as HTMLElement;
    const lastFocusable = focusable[focusable.length - 1] as HTMLElement;

    firstFocusable?.focus();

    // Trap focus
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable?.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable?.focus();
          }
        }
      }
      if (e.key === 'Escape') {
        cleanup();
      }
    };

    document.addEventListener('keydown', handleKeydown);

    const cleanup = () => {
      document.removeEventListener('keydown', handleKeydown);
      overlay.hidden = true;
      currentPopup = null;
    };

    currentPopup = cleanup;

    const handleConfirm = () => {
      options.onConfirm?.();
      cleanup();
    };

    const handleCancel = () => {
      options.onCancel?.();
      cleanup();
    };

    // Replace event listeners
    const newOkBtn = okBtn.cloneNode(true) as HTMLButtonElement;
    const newCancelBtn = cancelBtn.cloneNode(true) as HTMLButtonElement;
    okBtn.parentNode!.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode!.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener('click', handleConfirm);
    newCancelBtn.addEventListener('click', handleCancel);
  },

  hide(): void {
    currentPopup?.();
  }
};