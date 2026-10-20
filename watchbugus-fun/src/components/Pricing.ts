/**
 * Pricing Component
 */

interface JokeData {
  plans: Array<{
    name: string;
    price: string;
    period: string;
    features: string[];
    popular?: boolean;
    cta: string;
    ctaAction: 'call' | 'popup' | 'wheel';
  }>;
}

export function initPricing(jokes: JokeData): void {
  const grid = document.getElementById('plans')!;

  jokes.plans.forEach((plan) => {
    const card = document.createElement('article');
    card.className = 'plan' + (plan.popular ? ' popular' : '');
    card.setAttribute('role', 'listitem');

    if (plan.popular) {
      const ribbon = document.createElement('div');
      ribbon.className = 'ribbon';
      ribbon.textContent = 'MOST POPULAR (allegedly)';
      card.appendChild(ribbon);
    }

    card.innerHTML = `
      <h3>${escapeHtml(plan.name)}</h3>
      <div class="plan-price">${escapeHtml(plan.price)}</div>
      <div class="plan-period">${escapeHtml(plan.period)}</div>
      <ul>
        ${plan.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
      </ul>
    `;

    const btn = document.createElement('button');
    btn.className = 'btn btn-big';
    btn.textContent = plan.cta;
    btn.addEventListener('click', () => handlePlanAction(plan.ctaAction));
    card.appendChild(btn);

    grid.appendChild(card);
  });
}

function handlePlanAction(action: string): void {
  switch (action) {
    case 'call':
      // Trigger phone call modal
      const event = new CustomEvent('watchbugus:call');
      window.dispatchEvent(event);
      break;
    case 'wheel':
      const wheelEvent = new CustomEvent('watchbugus:wheel');
      window.dispatchEvent(wheelEvent);
      break;
    case 'popup':
    default:
      import('../utils/popup.ts').then(({ popup }) => {
        popup.show({
          title: '🎉 COMING SOON 🎉',
          content: '<p>This feature is still baking in our chaos oven!</p><p>Check back never.</p>'
        });
      });
      break;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}