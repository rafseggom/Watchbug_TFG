/**
 * Navigation Component
 */

import { chaos } from '../utils/chaos';

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

export function initNavigation(state: AppState): void {
  const chatToggle = document.getElementById('chat-toggle')!;
  const navButtons = document.querySelectorAll('.nav .btn-small');

  // Chat toggle
  chatToggle.addEventListener('click', () => {
    state.chatOpen = !state.chatOpen;
    const chatWidget = document.getElementById('chat-widget')!;
    chatToggle.setAttribute('aria-expanded', state.chatOpen.toString());
    chatWidget.hidden = !state.chatOpen;
    if (state.chatOpen) {
      document.getElementById('chat-input')!.focus();
    }
  });

  // Chaotic hover on nav buttons
  navButtons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      if (Math.random() < 0.3) {
        chaos.applyChaoticTransform(btn as HTMLElement);
      }
    });
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href')!);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}