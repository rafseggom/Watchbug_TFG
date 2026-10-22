/**
 * Not Kumar Ad Component
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

export function initNotKumar(_state: AppState): void {
  const bookBtn = document.getElementById('notkumar-book')!;

  bookBtn.addEventListener('click', () => {
    // PhoneCall owns the listener and the modal state.
    window.dispatchEvent(new CustomEvent('watchbug:call'));
  });
}
