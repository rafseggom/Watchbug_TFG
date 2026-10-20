/**
 * Chat Widget Component
 */

import type { AppState } from '../data/types.ts';

const BOT_RESPONSES = [
  "Have you tried turning it off and on again? 🔄",
  "That's not a bug, that's a <strong>feature</strong>! ✨",
  "Our AI says: \"Error 418: I'm a teapot\" 🫖",
  "Have you checked the console? F12 → Console → Pray 🙏",
  "Works on my machine ¯\\_(ツ)_/¯",
  "That's a <em>quantum bug</em> - it exists and doesn't exist simultaneously ⚛️",
  "Ticket created: #BUG-${Math.floor(Math.random() * 999999)} (will be ignored)",
  "Senior dev says: \"It's a browser issue\" 🌐",
  "Have you tried sacrificing a hotdog? 🌭",
  "Our turnstile captcha says you're 47% human 🤖"
];

const NUDGES = [
  "Psst... still there? 👀",
  "Hello? The bug won't fix itself! 🐛",
  "Someone in Ohio just fixed a similar bug! 📍",
  "Your code is crying. Can you hear it? 😭",
  "Free hotdog if you reply! 🌭 (not really)"
];

export function initChat(state: AppState, audio: any): void {
  const chatWidget = document.getElementById('chat-widget')!;
  const chatClose = document.getElementById('chat-close')!;
  const chatBody = document.getElementById('chat-body')!;
  const chatForm = document.getElementById('chat-form')!;
  const chatInput = document.getElementById('chat-input')! as HTMLInputElement;
  const chatBadge = document.getElementById('chat-badge')!;
  const chatToggle = document.getElementById('chat-toggle')!;

  let unreadCount = 3;

  // Close button
  chatClose.addEventListener('click', () => {
    state.chatOpen = false;
    chatWidget.hidden = true;
    chatToggle.setAttribute('aria-expanded', 'false');
  });

  // Form submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    chatInput.value = '';
    chatBadge.textContent = '0';
    unreadCount = 0;

    // Bot responds after delay
    setTimeout(() => {
      const response = BOT_RESPONSES[Math.floor(Math.random() * BOT_RESPONSES.length)];
      addMessage(response, 'bot');
      audio.play('generate-done');
    }, 800 + Math.random() * 1200);
  });

  function addMessage(content: string, type: 'user' | 'bot'): void {
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.innerHTML = content;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Chat shake animation on new message when closed
    if (!state.chatOpen && type === 'bot') {
      chatWidget.classList.add('shake');
      setTimeout(() => chatWidget.classList.remove('shake'), 400);
    }
  }

  // Periodic nudges
  window.setInterval(() => {
    if (!state.chatOpen) {
      unreadCount++;
      chatBadge.textContent = unreadCount > 9 ? '9+' : unreadCount.toString();
      const nudge = NUDGES[Math.floor(Math.random() * NUDGES.length)];
      addMessage(nudge, 'bot');
      audio.play('generate-start');
    }
  }, 30000 + Math.random() * 30000);

  // Initial bot message
  setTimeout(() => {
    addMessage("Welcome to Watchbugus Support! I'm PikzBot 3000, your AI assistant. (I'm actually a very small shell script) 🤖", 'bot');
  }, 1000);
}