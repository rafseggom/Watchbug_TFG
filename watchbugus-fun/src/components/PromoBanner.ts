/**
 * Promo Banner Component - the loud strip at the top of the page
 */

import { audio } from '../utils/audio.ts';
import { chaos } from '../utils/chaos.ts';
import { popup } from '../utils/popup.ts';

export interface AppState {
  credits: number;
  visitCount: number;
  chatOpen: boolean;
  musicPlaying: boolean;
  clippyShown: boolean;
  virusShown: boolean;
  wheelShown: boolean;
  callActive: boolean;
}

export function initPromoBanner(_state: AppState): void {
  const banner = document.getElementById('promo-banner')!;
  const link = document.getElementById('promo-link')!;
  const closeBtn = document.getElementById('promo-close')!;

  closeBtn.addEventListener('click', () => {
    banner.classList.add('is-gone');
    banner.hidden = true;
  });

  link.addEventListener('click', () => {
    void audio.play('coupon-expired');
    chaos.triggerConfetti();
    popup.show({
      title: '🌭 FREE HOTDOG 🌭',
      content: `
        <p>Congratulations! You've won a <strong>VIRTUAL HOTDOG</strong>!</p>
        <p>Redemption code: <code>HOTDOG-4-LIFE</code></p>
        <p><small>Valid at participating imaginations only. No nutritional value.</small></p>
      `,
      confirmText: 'DELICIOUS',
      cancelText: 'I WANT A REFUND',
      onConfirm: () => {
        void audio.play('generate-done');
      },
    });
  });

  // Also trigger on Enter/Space for accessibility.
  link.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      link.click();
    }
  });
}
