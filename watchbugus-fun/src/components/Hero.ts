/**
 * Hero Section Component
 */

import { audio } from '../utils/audio.ts';

import type { AppState } from '../data/types.ts';

export function initHero(_state: AppState): void {
  const generateBtn = document.getElementById('hero-generate')!;
  const heroThumb = document.querySelector('.hero-thumb') as HTMLImageElement;

  generateBtn.addEventListener('click', async () => {
    await audio.play('generate-start');

    // Scroll to generator
    const generator = document.getElementById('generator');
    if (generator) {
      generator.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        document.getElementById('bug-title')!.focus();
      }, 500);
    }
  });

  // Hero thumb wild hover
  heroThumb.addEventListener('mouseenter', () => {
    heroThumb.style.filter = 'invert() saturate(3)';
  });

  heroThumb.addEventListener('mouseleave', () => {
    heroThumb.style.filter = 'saturate(2.2) contrast(1.4) hue-rotate(-8deg)';
  });

  // Random click -> body.roll (10% chance)
  document.addEventListener('click', () => {
    if (Math.random() < 0.1) {
      document.body.classList.add('roll');
      setTimeout(() => document.body.classList.remove('roll'), 1000);
    }
  });

  // Exit intent popup
  let exitIntentShown = false;
  document.addEventListener('mouseleave', (e: MouseEvent) => {
    if (!exitIntentShown && e.clientY <= 0) {
      exitIntentShown = true;
      showExitIntent();
    }
  });
}

async function showExitIntent(): Promise<void> {
  const { popup } = await import('../utils/popup.ts');
  popup.show({
    title: 'WAIT!!! 🛑',
    content: `
      <p>Don't go! You're <strong>this close</strong> to finding the bug of your dreams!</p>
      <p class="rainbow">0.5% OFF YOUR FIRST BUG REPORT</p>
      <p><small>Use code: DONTLEAVE (expires in 0.5 seconds)</small></p>
    `,
    confirmText: 'FINE, I\'LL STAY',
    cancelText: 'LEAVE ME ALONE'
  });
}