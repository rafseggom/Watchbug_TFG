/**
 * Captcha Component (Fake, and mercifully escapable)
 */

import { audio } from '../utils/audio.ts';

const CAPTCHA_IMAGES = [
  'thumb-shark.svg',
  'thumb-omg.svg',
  'thumb-lambo.svg',
  'thumb-minecraft.svg',
  'thumb-cat.svg',
  'thumb-toaster.svg',
  'thumb-baguette.svg',
  'hotdog.svg',
  'mascot.png',
];

export const captcha = {
  show(callback: () => void): void {
    const modal = document.getElementById('captcha-modal')!;
    const grid = document.getElementById('captcha-grid')!;
    const verifyBtn = document.getElementById('captcha-verify')! as HTMLButtonElement;
    const msg = document.getElementById('captcha-msg')!;
    const closeBtn = document.getElementById('captcha-close')! as HTMLButtonElement;
    const cancelBtn = document.getElementById('captcha-cancel')! as HTMLButtonElement;

    modal.hidden = false;
    grid.innerHTML = '';
    msg.innerHTML = 'Select all images with a <strong>RED ARROW</strong>';
    verifyBtn.disabled = true;

    // One of the nine images gets the arrow.
    const hasArrow = Math.floor(Math.random() * 9);

    CAPTCHA_IMAGES.forEach((img, i) => {
      const cell = document.createElement('div');
      cell.className = 'captcha-cell';
      cell.innerHTML = `
        <img src="/img/${img}" alt="Captcha image ${i + 1}" data-index="${i}" loading="eager">
        ${i === hasArrow ? '<div class="captcha-arrow" aria-hidden="true">⬆️</div>' : ''}
      `;
      const imgEl = cell.querySelector('img')! as HTMLImageElement;
      imgEl.addEventListener('click', () => toggleSelection(imgEl));
      grid.appendChild(cell);
    });

    let selectedCount = 0;

    function toggleSelection(imgEl: HTMLImageElement): void {
      imgEl.classList.toggle('selected');
      selectedCount = grid.querySelectorAll('.selected').length;
      verifyBtn.disabled = selectedCount === 0;
    }

    function close(): void {
      document.removeEventListener('keydown', onKeydown);
      modal.hidden = true;
      grid.innerHTML = '';
    }

    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') close();
    }

    document.addEventListener('keydown', onKeydown);
    closeBtn.onclick = close;
    cancelBtn.onclick = close;

    verifyBtn.onclick = () => {
      const selected = grid.querySelectorAll('.selected');
      const correct = Array.from(selected).some(
        (el) => parseInt((el as HTMLElement).dataset.index || '-1', 10) === hasArrow,
      );

      if (correct) {
        audio.play('generate-done');
        close();
        callback();
      } else {
        audio.play('coupon-expired');
        msg.innerHTML = '<strong style="color:#c00;">WRONG! Try again. The red arrow is on a different image.</strong>';
        selected.forEach((el) => el.classList.remove('selected'));
        selectedCount = 0;
        verifyBtn.disabled = true;
        setTimeout(() => {
          msg.innerHTML = 'Select all images with a <strong>RED ARROW</strong>';
        }, 2000);
      }
    };
  },
};
