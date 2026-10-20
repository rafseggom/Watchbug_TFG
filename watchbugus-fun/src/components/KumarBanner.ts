/**
 * Kumar Banner Component - Sticky top banner
 */

import { audio } from '../utils/audio';
import { chaos } from '../utils/chaos';
import { popup } from '../utils/popup';

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

export function initKumarBanner(_state: AppState): void {
  const link = document.getElementById('kumar-link')!;

  link.addEventListener('click', async () => {
    await audio.play('coupon-expired');
    chaos.triggerConfetti();
    popup.show({
      title: '🌭 FREE HOTDOG 🌭',
      content: `
        <p>Congratulations! You've won a <strong>VIRTUAL HOTDOG</strong>!</p>
        <p>Redemption code: <code>HOTDOG-4-LIFE</code></p>
        <p><small>Valid at participating imaginations only. No nutritional value.</small></p>
      `,
      onConfirm: () => {
        audio.play('generate-done');
      }
    });
  });

  // Also trigger on Enter/Space for accessibility
  link.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      link.click();
    }
  });
}