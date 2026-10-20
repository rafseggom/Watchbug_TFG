/**
 * Splash Screen Component
 */

import { audio } from '../utils/audio';

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

export async function initSplash(_state: AppState): Promise<void> {
  const splash = document.getElementById('splash')!;
  const enterBtn = document.getElementById('splash-enter')!;

  // Play startup sound
  await audio.play('generate-start');

  // Auto-hide after 2.5s or on click
  const hideSplash = () => {
    splash.classList.add('hidden');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 500);
  };

  enterBtn.addEventListener('click', hideSplash);

  // Also hide on Enter/Space
  enterBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      hideSplash();
    }
  });

  // Auto-hide timer
  setTimeout(hideSplash, 2500);
}