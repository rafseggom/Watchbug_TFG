/**
 * Virus Scanner Component (Fake)
 */

import { chaos } from '../utils/chaos';
import type { AppState } from '../data/types';

const FAKE_VIRUSES = [
  "Trojan:Win32/HotdogStealer.A",
  "Worm:JS/CookieMonster",
  "Rootkit:Linux/KeyboardLogger",
  "Ransomware:YourCodeIsMine",
  "Spyware:MouseTracker.Pro",
  "Adware:PopupInfinity",
  "Cryptominer:CPUtoaster",
  "Backdoor:AdminBypass",
  "Keylogger:PasswordHarvester",
  "Botnet:ZombieBrowser"
];

export function initVirusScanner(state: AppState, audio: any): void {
  const scanner = document.getElementById('virus-scanner')!;
  const fill = document.getElementById('virus-fill')!;
  const list = document.getElementById('virus-list')!;
  const removeBtn = document.getElementById('virus-remove')!;
  const closeBtn = document.getElementById('virus-close')!;

  // Show after 25 seconds
  setTimeout(() => {
    if (state.virusShown) return;
    state.virusShown = true;
    showScanner();
  }, 25000);

  function showScanner(): void {
    scanner.hidden = false;
    runScan();
  }

  function runScan(): void {
    let progress = 0;
    const virusesFound: string[] = [];

    const interval = setInterval(() => {
      progress += Math.random() * 8 + 2;
      if (progress > 100) progress = 100;
      fill.style.width = `${progress}%`;

      // Randomly "find" viruses
      if (Math.random() < 0.15 && virusesFound.length < 8) {
        const virus = FAKE_VIRUSES[Math.floor(Math.random() * FAKE_VIRUSES.length)];
        if (!virusesFound.includes(virus)) {
          virusesFound.push(virus);
          const li = document.createElement('li');
          li.innerHTML = `<span>🦠 ${virus}</span><span style="color:#c00;">DETECTED</span>`;
          list.appendChild(li);
        }
      }

      if (progress >= 100) {
        clearInterval(interval);
        audio.play('coupon-expired');
      }
    }, 300);
  }

  removeBtn.addEventListener('click', async () => {
    await audio.play('wheel-win');
    chaos.triggerConfetti();
    scanner.hidden = true;
    import('../utils/popup').then(({ popup }) => {
      popup.show({
        title: '🦠 VIRUSES REMOVED! 🦠',
        content: `
          <p>All ${list.children.length} threats have been <strong>QUARANTINED</strong>!</p>
          <p>Your browser is now 47% safer (margin of error: 100%).</p>
          <p><small>Charge: $4.99 (added to your phone bill)</small></p>
        `,
        confirmText: 'PAY $4.99',
        onConfirm: () => {
          audio.play('generate-done');
        }
      });
    });
  });

  closeBtn.addEventListener('click', () => {
    scanner.hidden = true;
  });
}