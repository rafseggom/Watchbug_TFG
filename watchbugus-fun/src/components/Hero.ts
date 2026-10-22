/**
 * Hero Section Component
 */

import { audio } from '../utils/audio.ts';

import type { AppState } from '../data/types.ts';

export function initHero(_state: AppState): void {
  const generateBtn = document.getElementById('hero-generate')!;
  const heroThumb = document.querySelector('.hero-mascot') as HTMLImageElement | null;

  generateBtn.addEventListener('click', () => {
    void audio.play('generate-start');

    const generator = document.getElementById('generator');
    if (generator) {
      generator.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => {
        document.getElementById('bug-title')?.focus();
      }, 600);
    }
  });

  if (heroThumb) {
    heroThumb.addEventListener('mouseenter', () => {
      heroThumb.style.filter = 'invert() saturate(3)';
    });

    heroThumb.addEventListener('mouseleave', () => {
      heroThumb.style.filter = '';
    });
  }

  // Exit intent: one popup, once, and it can be closed like everything else.
  let exitIntentShown = false;
  document.addEventListener('mouseleave', (event: MouseEvent) => {
    if (exitIntentShown || event.clientY > 0) return;
    exitIntentShown = true;
    void showExitIntent();
  });
}

async function showExitIntent(): Promise<void> {
  const { popup } = await import('../utils/popup.ts');
  popup.show({
    title: 'WAIT!!! 🛑',
    content: `
      <p>Don't go! You're <strong>this close</strong> to reading the entire FAQ.</p>
      <p class="rainbow" style="font-size:1.2rem;margin:.75rem 0;">0.5% OFF YOUR FIRST BUG REPORT</p>
      <p><small>Use code: DONTLEAVE (expires in 0.5 seconds, like all good offers)</small></p>
    `,
    confirmText: "FINE, I'LL STAY",
    cancelText: 'LEAVE ME ALONE',
  });
}
