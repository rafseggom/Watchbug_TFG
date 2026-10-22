/**
 * "Close everything" button.
 *
 * The parody throws a lot of overlays at the reader. This guarantees there is
 * always one obvious way out, no matter which modal got stuck or which state
 * flag believes it is still open.
 */

import { toast } from '../utils/toast.ts';

const OVERLAY_IDS = [
  'popup',
  'virus-scanner',
  'prize-wheel',
  'phone-call',
  'captcha-modal',
  'chat-widget',
  'cookie-banner',
  'clippy',
  'notifications-panel',
];

export function initPanicButton(): void {
  const button = document.getElementById('panic-btn');
  if (!button) return;

  button.addEventListener('click', () => {
    for (const id of OVERLAY_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.hidden = true;
      el.classList.add('hidden');
      el.classList.remove('show', 'shake');
    }

    for (const el of Array.from(document.querySelectorAll('#error-container > *'))) {
      el.remove();
    }

    window.dispatchEvent(new CustomEvent('watchbug:panic'));
    toast.show('Every popup closed. You are free. For now.', { type: 'success', duration: 3000 });
  });
}
