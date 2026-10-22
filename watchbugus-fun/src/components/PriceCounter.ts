/**
 * Price Counter Component (Slowly increases Pro Creator price)
 */

export interface AppState {
  credits: number;
  visitCount: number;
  chatOpen: boolean;
  musicPlaying: boolean;
  clippyShown: boolean;
  virusShown: boolean;
  wheelShown: boolean;
  callActive: boolean;
}

export function initPriceCounter(_state: AppState): void {
  const priceElements = document.querySelectorAll('.plan-price, .consulting-price');

  priceElements.forEach(el => {
    const originalText = el.textContent || '';
    const match = originalText.match(/[\d.]+/);
    if (!match) return;

    let price = parseFloat(match[0]);
    const prefix = originalText.slice(0, match.index);
    const suffix = originalText.slice((match.index ?? 0) + match[0].length);

    setInterval(() => {
      // Increase by $0.01 to $0.05 every 2 seconds
      price += 0.01 + Math.random() * 0.04;
      el.textContent = `${prefix}${price.toFixed(2)}${suffix}`;
    }, 2000);
  });
}