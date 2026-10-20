/**
 * Captcha Component (Fake)
 */

import { audio } from '../utils/audio.ts';

// Export for use by Generator
export const captcha = {
  show(callback: () => void): void {
    const modal = document.getElementById('captcha-modal')!;
    const grid = document.getElementById('captcha-grid')!;
    const verifyBtn = document.getElementById('captcha-verify')! as HTMLButtonElement;
    const msg = document.getElementById('captcha-msg')!;

    modal.hidden = false;
    grid.innerHTML = '';

    // Create 9 images (3x3), one has red arrow
    const hasArrow = Math.floor(Math.random() * 9);
    const images = [
      'thumb-shark.webp',
      'thumb-omg.webp',
      'thumb-lambo.webp',
      'thumb-minecraft.webp',
      'thumb-cat.webp',
      'thumb-toaster.webp',
      'thumb-baguette.webp',
      'hotdog.webp',
      'mascot.webp'
    ];

    images.forEach((img, i) => {
      const div = document.createElement('div');
      div.style.position = 'relative';
      div.innerHTML = `
        <img src="/img/${img}" alt="Captcha image ${i + 1}" data-index="${i}" loading="eager">
        ${i === hasArrow ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:2rem;color:red;text-shadow:2px 2px #000;">⬆️</div>' : ''}
      `;
      const imgEl = div.querySelector('img')! as HTMLImageElement;
      imgEl.addEventListener('click', () => toggleSelection(imgEl));
      grid.appendChild(div);
    });

    let selectedCount = 0;
    function toggleSelection(imgEl: HTMLImageElement): void {
      imgEl.classList.toggle('selected');
      selectedCount = grid.querySelectorAll('.selected').length;
      verifyBtn.disabled = selectedCount === 0;
    }

    verifyBtn.onclick = () => {
      const selected = grid.querySelectorAll('.selected');
      const correct = Array.from(selected).some(el => parseInt((el as HTMLElement).dataset.index || '-1') === hasArrow);

      if (correct) {
        audio.play('generate-done');
        modal.hidden = true;
        callback();
      } else {
        audio.play('coupon-expired');
        msg.innerHTML = '<strong style="color:#c00;">WRONG! Try again. The red arrow was on a different image.</strong>';
        // Reset
        selected.forEach(el => el.classList.remove('selected'));
        selectedCount = 0;
        verifyBtn.disabled = true;
        // New random position
        setTimeout(() => {
          msg.textContent = 'Select all images with a RED ARROW';
        }, 2000);
      }
    };
  }
};