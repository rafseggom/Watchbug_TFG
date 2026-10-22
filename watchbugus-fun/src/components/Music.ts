/**
 * Music Toggle Component
 */

import { audio } from '../utils/audio.ts';

interface AppState {
  musicPlaying: boolean;
}

export function initMusic(state: AppState, _audio?: unknown): void {
  const toggle = document.getElementById('music-toggle')! as HTMLButtonElement;

  const render = (playing: boolean): void => {
    state.musicPlaying = playing;
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.textContent = playing ? '🎵 MUSIC ON' : '🔇 MUSIC OFF';
    toggle.classList.toggle('music-playing', playing);
  };

  window.addEventListener('watchbug:music', (event) => {
    const detail = (event as CustomEvent<{ playing: boolean }>).detail;
    render(!!detail?.playing);
  });

  toggle.addEventListener('click', async () => {
    const playing = await audio.toggleMusic();
    render(playing);
  });

  render(audio.musicPlaying);
}
