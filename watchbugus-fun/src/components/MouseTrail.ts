/**
 * Mouse Trail Component (Emojis following cursor)
 */

const TRAIL_EMOJIS = ['🌭', '🐛', '🔥', '💯', '✨', '🎉', '💩', '🤡', '👻', '🦄'];

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

export function initMouseTrail(_state: AppState): void {
  let lastTrailTime = 0;
  const trailThrottle = 40; // ms

  document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastTrailTime < trailThrottle) return;
    lastTrailTime = now;

    createTrailEmoji(e.clientX, e.clientY);
  });

  function createTrailEmoji(x: number, y: number): void {
    const emoji = TRAIL_EMOJIS[Math.floor(Math.random() * TRAIL_EMOJIS.length)];
    const div = document.createElement('div');
    div.className = 'trail';
    div.textContent = emoji;
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.style.fontSize = `${Math.random() * 16 + 16}px`;
    div.style.pointerEvents = 'none';
    div.style.zIndex = '300';

    document.body.appendChild(div);

    // Remove after animation
    setTimeout(() => {
      if (div.parentNode) div.remove();
    }, 900);
  }
}