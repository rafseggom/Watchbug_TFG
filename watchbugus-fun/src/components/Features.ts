/**
 * Features Component
 */

interface JokeData {
  features: Array<{ title: string; desc: string }>;
}

export function initFeatures(jokes: JokeData): void {
  const grid = document.getElementById('feature-grid')!;

  jokes.features.forEach((feature, i) => {
    const card = document.createElement('article');
    card.className = 'feature';
    card.setAttribute('role', 'listitem');
    card.style.setProperty('--rotation', (i % 2 === 0 ? 2 : -2).toString());

    card.innerHTML = `
      <h3>${escapeHtml(feature.title)}</h3>
      <p>${escapeHtml(feature.desc)}</p>
    `;

    grid.appendChild(card);
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}