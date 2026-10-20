/**
 * Clippy Assistant Component
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

const CLIPPY_TIPS = [
  "It looks like you're trying to find a bug. Would you like me to generate a fake stack trace? 📋",
  "Pro tip: Press F12 to open DevTools. It's where the magic happens! ✨",
  "Did you know? 90% of bugs are caused by a missing semicolon. The other 10% are caused by cache. 🍪",
  "Hotdog fact: A hotdog is a sandwich. Fight me. 🌭",
  "Your code called. It said it misses you. 📞",
  "Remember: console.log() is your best friend. Until it's not. 😭",
  "Pro tip: Rubber duck debugging works. Even better with a rubber hotdog! 🦆🌭",
  "Error 404: Motivation not found. Have a virtual cookie! 🍪"
];

export function initClippy(state: AppState, _jokes: any): void {
  const clippy = document.getElementById('clippy')!;
  const bubble = document.getElementById('clippy-bubble')!;
  const yesBtn = document.getElementById('clippy-yes')!;
  const noBtn = document.getElementById('clippy-no')!;

  // Show after 8 seconds
  setTimeout(() => {
    showClippy();
  }, 8000);

  function showClippy(): void {
    if (state.clippyShown) return;
    state.clippyShown = true;
    clippy.hidden = false;
    requestAnimationFrame(() => {
      clippy.classList.add('show');
    });
    showRandomTip();
  }

  function showRandomTip(): void {
    const tip = CLIPPY_TIPS[Math.floor(Math.random() * CLIPPY_TIPS.length)];
    bubble.innerHTML = tip;
  }

  yesBtn.addEventListener('click', () => {
    audio.play('generate-done');
    bubble.innerHTML = "Awesome! 🎉 Here's your tip: " + CLIPPY_TIPS[Math.floor(Math.random() * CLIPPY_TIPS.length)];
    setTimeout(hideClippy, 3000);
  });

  noBtn.addEventListener('click', () => {
    audio.play('coupon-expired');
    bubble.innerHTML = "Fine, be that way. 😤 I'll be in the corner if you need me.";
    setTimeout(hideClippy, 2000);
  });

  function hideClippy(): void {
    clippy.classList.remove('show');
    setTimeout(() => {
      clippy.hidden = true;
    }, 400);
  }

  // Show new tip every 10 seconds if visible
  setInterval(() => {
    if (!clippy.hidden) {
      showRandomTip();
    }
  }, 10000);
}