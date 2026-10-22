/**
 * Prize Wheel Component
 */

import { chaos } from '../utils/chaos.ts';

import type { AppState } from '../data/types.ts';

const WHEEL_SEGMENTS = [
  { label: '47s WITH STEVE', weight: 50, color: '#f00' },
  { label: 'FREE HOTDOG 🌭', weight: 10, color: '#f90' },
  { label: 'BUG CREDIT +1', weight: 10, color: '#0f0' },
  { label: 'NOTHING 😭', weight: 15, color: '#888' },
  { label: 'TRY AGAIN', weight: 10, color: '#0ff' },
  { label: 'MYSTERY BOX', weight: 5, color: '#f0f' }
];

export function initPrizeWheel(state: AppState, audio: any): void {
  const wheel = document.getElementById('prize-wheel')!;
  const disc = document.getElementById('wheel-disc')!;
  const msg = document.getElementById('wheel-msg')!;
  const pointer = document.getElementById('wheel-pointer')!;
  const spinBtn = document.getElementById('wheel-spin')! as HTMLButtonElement;
  const closeBtn = document.getElementById('wheel-close')!;

  // Build wheel segments
  buildWheel();

  // Listen for wheel event from pricing
  window.addEventListener('watchbug:wheel', () => {
    if (state.wheelShown) return;
    state.wheelShown = true;
    wheel.hidden = false;
  });

  window.addEventListener('watchbug:panic', () => {
    wheel.hidden = true;
    state.wheelShown = false;
  });

  let spinning = false;

  spinBtn.addEventListener('click', async () => {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    spinBtn.textContent = 'SPINNING...';

    await spin();

    spinning = false;
    spinBtn.disabled = false;
    spinBtn.textContent = 'SPIN AGAIN 🎰';
  });

  closeBtn.addEventListener('click', () => {
    wheel.hidden = true;
    state.wheelShown = false;
  });

  function buildWheel(): void {
    // Create conic gradient for segments
    let angle = 0;
    const gradientParts: string[] = [];

    WHEEL_SEGMENTS.forEach(seg => {
      const nextAngle = angle + (360 * seg.weight / 100);
      gradientParts.push(`${seg.color} ${angle}deg ${nextAngle}deg`);
      angle = nextAngle;
    });

    disc.style.background = `conic-gradient(${gradientParts.join(', ')})`;

    // Add text labels (simplified - just center message)
    msg.textContent = 'CLICK TO SPIN';
  }

  async function spin(): Promise<void> {
    // Rigged: always land on "47s WITH STEVE" (index 0)
    // But animate to look random
    const totalSpins = 5 + Math.random() * 3;
    const targetSegment = 0; // Always first segment (47s WITH STEVE)
    const segmentAngle = 360 / WHEEL_SEGMENTS.length;
    const targetAngle = totalSpins * 360 + (targetSegment * segmentAngle) + (segmentAngle / 2);

    // Animate pointer
    pointer.style.transition = 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)';
    pointer.style.transform = `translateX(-50%) rotate(${targetAngle}deg)`;

    // Play tick sounds during spin
    const tickCount = 20;
    for (let i = 0; i < tickCount; i++) {
      setTimeout(() => {
        pointer.classList.add('tick');
        audio.play('wheel-tick');
        setTimeout(() => pointer.classList.remove('tick'), 80);
      }, i * (4000 / tickCount));
    }

    await new Promise(r => setTimeout(r, 4200));

    void audio.play('wheel-win');
    chaos.triggerConfetti();

    // Show result
    msg.textContent = `🎉 ${WHEEL_SEGMENTS[targetSegment].label} 🎉`;

    import('../utils/popup.ts').then(({ popup }) => {
      popup.show({
        title: '🎰 YOU WON! 🎰',
        content: `
          <p>Congratulations! You won:</p>
          <p class="rainbow" style="font-size:1.5rem; margin:1rem 0;">${WHEEL_SEGMENTS[targetSegment].label}</p>
          <p><small>Redeemable in dreams only. No cash value.</small></p>
        `,
        confirmText: 'CLAIM PRIZE',
        onConfirm: () => {
          audio.play('generate-done');
        }
      });
    });
  }
}