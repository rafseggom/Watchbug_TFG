/**
 * Error Boxes Component (Random Windows 98 style errors)
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

const ERROR_MESSAGES = [
  { title: 'Windows 98 Error', msg: 'A fatal exception 0E has occurred at 0028:C0034B23. The current application will be terminated.' },
  { title: 'Kernel Panic', msg: 'CPU 0: Kernel trap at 0xffffff80002c5b3e, type 14=page fault, registers:' },
  { title: 'Out of Memory', msg: 'Your browser has run out of memory. Please close some tabs or sacrifice a hotdog.' },
  { title: 'Stack Overflow', msg: 'Maximum call stack size exceeded. Recursion detected in function "fixBug()".' },
  { title: 'Syntax Error', msg: 'Unexpected token ";" at line 42. Did you mean "🌭"? ' },
  { title: 'Type Error', msg: 'Cannot read property "bug" of undefined. Your code is confused.' },
  { title: 'Network Error', msg: 'Failed to fetch. The internet is on a coffee break. ☕' },
  { title: 'Permission Denied', msg: 'You do not have permission to view this bug. Error 403: Forbidden.' },
  { title: 'Disk Full', msg: 'No space left on device. Your node_modules folder ate all the space.' },
  { title: 'Timeout', msg: 'Request timed out after 30000ms. The server fell asleep.' }
];

export function initErrorBoxes(_state: AppState): void {
  const container = document.getElementById('error-container')!;

  // First error at 18 seconds
  setTimeout(() => {
    showRandomError();
  }, 18000);

  // Then every 15-30 seconds
  setInterval(() => {
    if (Math.random() < 0.3) {
      showRandomError();
    }
  }, 20000);

  function showRandomError(): void {
    const error = ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)];
    const div = document.createElement('div');
    div.className = 'error-box';
    div.setAttribute('role', 'alert');
    div.innerHTML = `
      <div class="error-title">${escapeHtml(error.title)}</div>
      <div>${escapeHtml(error.msg)}</div>
      <button class="btn btn-small" style="margin-top:8px;">OK</button>
    `;

    const btn = div.querySelector('button')!;
    btn.addEventListener('click', () => {
      div.remove();
    });

    // Random position
    div.style.top = `${Math.random() * 60 + 10}%`;
    div.style.left = `${Math.random() * 60 + 10}%`;

    container.appendChild(div);
    audio.play('generate-start');

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (div.parentNode) div.remove();
    }, 10000);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}