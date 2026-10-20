/**
 * Gallery Component
 */

interface JokeData {
  gallery: Array<{
    img: string;
    alt: string;
    caption: string;
  }>;
}

export function initGallery(jokes: JokeData): void {
  const grid = document.getElementById('gallery-grid')!;

  jokes.gallery.forEach((item, i) => {
    const figure = document.createElement('figure');
    figure.setAttribute('role', 'listitem');
    figure.style.setProperty('--rotation', (i % 2 === 0 ? 2 : -2).toString());

    figure.innerHTML = `
      <img src="/img/${item.img}" alt="${escapeHtml(item.alt)}" loading="lazy" width="400" height="225">
      <figcaption>${escapeHtml(item.caption)}</figcaption>
    `;

    // Wild hover effect
    figure.addEventListener('mouseenter', () => {
      const img = figure.querySelector('img')!;
      img.style.filter = 'invert() saturate(3)';
    });

    figure.addEventListener('mouseleave', () => {
      const img = figure.querySelector('img')!;
      img.style.filter = 'saturate(2.2) contrast(1.4) hue-rotate(-8deg)';
    });

    grid.appendChild(figure);
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}