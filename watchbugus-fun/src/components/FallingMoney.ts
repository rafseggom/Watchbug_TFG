/**
 * Falling Money Component (Random money emojis falling)
 */

const MONEY_EMOJIS = ['💰', '💵', '💸', '💎', '🪙', '🤑'];

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

export function initFallingMoney(_state: AppState): void {
  // Spawn money every 2-5 seconds
  function spawnMoney(): void {
    if (Math.random() > 0.3) return; // 30% chance each interval

    const emoji = MONEY_EMOJIS[Math.floor(Math.random() * MONEY_EMOJIS.length)];
    const div = document.createElement('div');
    div.className = 'money';
    div.textContent = emoji;
    div.style.left = `${Math.random() * 100}vw`;
    div.style.fontSize = `${Math.random() * 16 + 20}px`;
    div.style.animationDuration = `${3 + Math.random() * 4}s`;
    div.style.pointerEvents = 'none';
    div.style.zIndex = '35';

    document.body.appendChild(div);

    // Remove after animation
    setTimeout(() => {
      if (div.parentNode) div.remove();
    }, 7000);
  }

  setInterval(spawnMoney, 3000);
}