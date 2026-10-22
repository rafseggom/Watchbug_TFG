/**
 * Mini destructive-masking demo for the editorial section.
 */

import { audio } from '../utils/audio.ts';

const EXPOSED = '3 secrets currently exposed. This is bad.';
const MASKED = 'Masked. The original values are no longer in the pixels.';

export function initMaskDemo(): void {
  const button = document.getElementById('mask-demo-btn')! as HTMLButtonElement;
  const status = document.getElementById('mask-demo-status')!;
  const values = Array.from(document.querySelectorAll<HTMLElement>('[data-mask]'));

  let masked = false;

  button.addEventListener('click', () => {
    masked = !masked;

    values.forEach((value) => {
      value.classList.toggle('masked', masked);
      value.setAttribute('aria-label', masked ? 'Masked value' : value.textContent || '');
    });

    if (masked) {
      button.textContent = 'RESET THE DEMO';
      status.textContent = MASKED;
      void audio.play('generate-done');
    } else {
      button.textContent = 'MASK THE SECRETS';
      status.textContent = EXPOSED;
      void audio.play('generate-start');
    }
  });
}
