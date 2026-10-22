/**
 * Steve's Bug Consulting Component
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

export function initConsulting(_state: AppState): void {
  const bookBtn = document.getElementById('consulting-book')!;

  bookBtn.addEventListener('click', () => {
    // PhoneCall owns the listener and the modal state.
    window.dispatchEvent(new CustomEvent('watchbug:call'));
  });
}
