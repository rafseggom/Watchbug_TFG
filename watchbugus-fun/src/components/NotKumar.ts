/**
 * Not Kumar Ad Component
 */

import { initPhoneCall } from './PhoneCall.js';

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

export function initNotKumar(state: AppState, audio: any): void {
  const bookBtn = document.getElementById('notkumar-book')!;

  bookBtn.addEventListener('click', () => {
    // Dispatch event to trigger phone call
    window.dispatchEvent(new CustomEvent('watchbugus:call'));
  });

  // Listen for call event from pricing
  window.addEventListener('watchbugus:call', () => {
    const callModal = document.getElementById('phone-call')!;
    callModal.hidden = false;
    state.callActive = true;
    initPhoneCall(state, audio);
  });
}