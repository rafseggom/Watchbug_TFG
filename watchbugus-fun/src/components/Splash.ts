/**
 * Splash Screen Component
 *
 * The listeners are attached synchronously, before any network work happens.
 * That is the whole fix for "I click ENTER and nothing happens": the old
 * version awaited a 1.1 MB MP3 decode before binding the click handler.
 */

import { audio } from '../utils/audio.ts';

interface AppState {
  musicPlaying: boolean;
}

export function initSplash(_state: AppState): void {
  const splash = document.getElementById('splash')!;
  const enterBtn = document.getElementById('splash-enter')! as HTMLButtonElement;

  let dismissed = false;

  const enter = (): void => {
    if (dismissed) return;
    dismissed = true;

    // Move focus out before hiding, otherwise assistive tech warns that a
    // focused control is inside an aria-hidden subtree.
    enterBtn.blur();
    splash.inert = true;
    splash.classList.add('hidden');
    splash.setAttribute('aria-hidden', 'true');

    window.setTimeout(() => {
      splash.style.display = 'none';
    }, 420);

    // The click/keypress that got us here counts as the gesture, so the
    // browser lets the music start.
    void audio.playMusic();

    // Give focus back to the document so keyboard scrolling works.
    document.body.focus?.();
  };

  enterBtn.addEventListener('click', (event) => {
    event.preventDefault();
    enter();
  });

  // Clicking anywhere on the splash also works (the ENTER button remains the
  // obvious affordance, but nobody should get stuck behind a gradient).
  splash.addEventListener('click', (event) => {
    if (event.target === enterBtn) return;
    enter();
  });

  document.addEventListener('keydown', (event) => {
    if (dismissed) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
      event.preventDefault();
      enter();
    }
  });

  // Last-resort escape hatch if the user just stares at it.
  window.setTimeout(enter, 15000);
}
