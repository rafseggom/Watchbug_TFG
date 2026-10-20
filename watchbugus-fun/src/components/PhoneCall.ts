/**
 * Phone Call Component (Fake)
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

const CALL_STATES = [
  { state: 'ringing', text: 'RINGING...', duration: 3000 },
  { state: 'connected', text: 'CONNECTED - Steve: "Hello? Yeah, this is Steve. Bugs? Sure, I know bugs."', duration: 5000 },
  { state: 'talking', text: 'Steve: "Look, just add console.log everywhere. Works every time."', duration: 4000 },
  { state: 'ended', text: 'CALL ENDED - Steve hung up on you. Rude.' }
];

export function initPhoneCall(state: AppState, audio: any): void {
  const callModal = document.getElementById('phone-call')!;
  const avatar = document.querySelector('.call-avatar')! as HTMLElement;
  const status = document.getElementById('call-status')!;
  const hangupBtn = document.getElementById('call-hangup')!;

  if (state.callActive) {
    runCallSequence();
  }

  hangupBtn.addEventListener('click', endCall);

  function runCallSequence(): void {
    let currentState = 0;

    function nextState(): void {
      if (currentState >= CALL_STATES.length) {
        endCall();
        return;
      }

      const callState = CALL_STATES[currentState];
      status.textContent = callState.text;
      avatar.dataset.state = callState.state;

      if (callState.state === 'ringing') {
        audio.play('steve-call');
      }

      currentState++;
      setTimeout(nextState, callState.duration);
    }

    nextState();
  }

  function endCall(): void {
    state.callActive = false;
    callModal.hidden = true;
    avatar.dataset.state = 'idle';

    import('../utils/popup.ts').then(({ popup }) => {
      popup.show({
        title: '📞 CALL ENDED',
        content: `
          <p>Steve has left the chat.</p>
          <p>He said: <em>"Your bugs are your problem. Good luck."</em></p>
          <p><small>Call duration: ${Math.floor(Math.random() * 5 + 1)} minutes. Cost: $0.00 (Steve works for hotdogs)</small></p>
        `,
        confirmText: 'OK BYE'
      });
    });
  }
}