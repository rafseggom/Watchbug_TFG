/**
 * Phone Call Component (Fake)
 *
 * Owns the `watchbug:call` event. Other components only need to dispatch it;
 * they must not call initPhoneCall again (that used to register duplicate
 * sequences and hang the modal).
 */

import { audio } from '../utils/audio.ts';

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

const CALL_STATES = [
  { state: 'ringing', text: 'RINGING...', duration: 3000 },
  {
    state: 'connected',
    text: 'CONNECTED — Steve: "Hello? Yeah, this is Steve. Bugs? Sure, I know bugs."',
    duration: 5000,
  },
  {
    state: 'talking',
    text: 'Steve: "Look, just add console.log everywhere. Works every time."',
    duration: 4000,
  },
  { state: 'ended', text: 'CALL ENDED — Steve hung up on you. Rude.' },
];

export function initPhoneCall(state: AppState): void {
  const callModal = document.getElementById('phone-call')!;
  const avatar = document.querySelector('.call-avatar')! as HTMLElement;
  const status = document.getElementById('call-status')!;
  const hangupBtn = document.getElementById('call-hangup')!;

  let active = false;
  let musicWasPlaying = false;
  let timer = 0;

  function clearTimer(): void {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
  }

  function startCall(): void {
    if (active) return;
    active = true;

    state.callActive = true;
    callModal.hidden = false;

    musicWasPlaying = audio.musicPlaying;
    audio.pauseMusic();

    void audio.play('steve-call');

    let index = 0;

    const step = (): void => {
      if (!active) return;

      if (index >= CALL_STATES.length) {
        endCall(true);
        return;
      }

      const current = CALL_STATES[index++];
      status.textContent = current.text;
      avatar.dataset.state = current.state;

      timer = window.setTimeout(step, current.duration);
    };

    step();
  }

  function endCall(showSummary: boolean): void {
    if (!active) {
      callModal.hidden = true;
      return;
    }

    active = false;
    state.callActive = false;
    clearTimer();

    callModal.hidden = true;
    avatar.dataset.state = 'idle';
    status.textContent = 'RINGING...';

    if (musicWasPlaying) {
      void audio.playMusic();
    }

    if (!showSummary) return;

    void import('../utils/popup.ts').then(({ popup }) => {
      popup.show({
        title: '📞 CALL ENDED',
        content: `
          <p>Steve has left the chat.</p>
          <p>He said: <em>"Your bugs are your problem. Good luck."</em></p>
          <p><small>Call duration: ${Math.floor(Math.random() * 5 + 1)} minutes. Cost: $0.00 (Steve works for hotdogs)</small></p>
        `,
        confirmText: 'OK BYE',
      });
    });
  }

  hangupBtn.addEventListener('click', () => endCall(true));

  window.addEventListener('watchbug:call', startCall);

  window.addEventListener('watchbug:panic', () => {
    if (!active) return;
    endCall(false);
  });
}
