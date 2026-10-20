/**
 * Reviews Component
 */

interface JokeData {
  reviews: Array<{
    text: string;
    author: string;
    role: string;
    avatar: string;
  }>;
}

export function initReviews(jokes: JokeData): void {
  const grid = document.getElementById('review-grid')!;

  jokes.reviews.forEach((review) => {
    const blockquote = document.createElement('blockquote');
    blockquote.setAttribute('role', 'listitem');

    blockquote.innerHTML = `
      <p>${escapeHtml(review.text)}</p>
      <footer class="review-footer">
        <img src="/img/${review.avatar}" alt="" class="review-avatar" aria-hidden="true">
        <div>
          <strong>${escapeHtml(review.author)}</strong>
          <span style="color:#888;">${escapeHtml(review.role)}</span>
        </div>
      </footer>
    `;

    grid.appendChild(blockquote);
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}