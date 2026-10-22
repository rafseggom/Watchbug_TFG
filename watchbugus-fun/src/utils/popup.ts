/**
 * Popup Modal Utility
 *
 * One overlay is reused for everything. Every popup can be closed by:
 * the X button, the cancel button, Escape, or clicking the backdrop.
 * There is no version of "you are stuck now".
 */

interface PopupOptions {
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

let closeCurrent: (() => void) | null = null;

export const popup = {
  init(): void {
    // Popup HTML is already in index.html.
    window.addEventListener('watchbug:panic', () => {
      closeCurrent?.();
    });
  },

  show(options: PopupOptions): void {
    // Only one popup at a time.
    closeCurrent?.();

    const overlay = document.getElementById('popup')!;
    const title = document.getElementById('popup-title')!;
    const content = document.getElementById('popup-content')!;
    const okBtn = document.getElementById('popup-ok')! as HTMLButtonElement;
    const cancelBtn = document.getElementById('popup-cancel')! as HTMLButtonElement;
    const closeBtn = document.getElementById('popup-x') as HTMLButtonElement | null;

    title.textContent = options.title;
    content.innerHTML = options.content;
    okBtn.textContent = options.confirmText || 'OK';
    cancelBtn.textContent = options.cancelText || 'CLOSE';
    cancelBtn.style.display = options.cancelText || options.onCancel ? 'inline-block' : 'none';

    overlay.hidden = false;

    const cleanup = (): void => {
      document.removeEventListener('keydown', handleKeydown);
      overlay.removeEventListener('click', handleBackdrop);
      overlay.hidden = true;
      closeCurrent = null;
    };

    const handleConfirm = (): void => {
      options.onConfirm?.();
      cleanup();
    };

    const handleCancel = (): void => {
      options.onCancel?.();
      cleanup();
    };

    const handleBackdrop = (event: MouseEvent): void => {
      // Clicking the dark area around the box closes it.
      if (event.target === overlay) handleCancel();
    };

    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel();
        return;
      }

      if (event.key !== 'Tab') return;

      // Focus trap. Query live so replaced/cloned nodes do not matter.
      const focusable = Array.from(
        overlay.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // `onclick` avoids stacking listeners across popups.
    okBtn.onclick = handleConfirm;
    cancelBtn.onclick = handleCancel;
    if (closeBtn) closeBtn.onclick = handleCancel;

    document.addEventListener('keydown', handleKeydown);
    overlay.addEventListener('click', handleBackdrop);

    closeCurrent = cleanup;

    // Focus the primary action, not the X.
    window.setTimeout(() => okBtn.focus(), 0);
  },

  hide(): void {
    closeCurrent?.();
  },
};
