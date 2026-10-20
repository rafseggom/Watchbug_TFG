/**
 * Music Toggle Component
 */

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

export function initMusic(state: AppState, audio: any): void {
  const toggle = document.getElementById('music-toggle')!;

  toggle.addEventListener('click', async () => {
    state.musicPlaying = !state.musicPlaying;
    toggle.setAttribute('aria-pressed', state.musicPlaying.toString());

    if (state.musicPlaying) {
      await audio.playMusic('shop-bossa-loop');
      toggle.textContent = '🎵 MUSIC ON';
    } else {
      audio.stopMusic();
      toggle.textContent = '🔇 MUSIC OFF';
    }
  });

  // Pause music during phone call
  window.addEventListener('watchbugus:call', () => {
    if (state.musicPlaying) {
      audio.pauseMusic();
    }
  });
}