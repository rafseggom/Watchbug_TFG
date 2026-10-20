/**
 * Chaos Utility (Random transforms, confetti, typos, etc.)
 */

interface ChaosOptions {
  typoProbability?: number;
}

const WORDS_TO_CORRUPT = new Map([
  ['the', ['teh', 'th', 'te']],
  ['you', ['u', 'yu', 'ya']],
  ['your', ['ur', 'yo']],
  ['and', ['n', 'nd', 'an']],
  ['for', ['4', 'fr']],
  ['to', ['2', 't']],
  ['be', ['b']],
  ['have', ['hav', 'hve']],
  ['this', ['tis', 'ths']],
  ['that', ['tht', 'tat']],
  ['with', ['wth', 'w/']],
  ['from', ['frm', 'fm']],
  ['will', ['wil', 'wl']],
  ['just', ['jst', 'jus']],
  ['like', ['liek', 'lk']],
  ['really', ['realy', 'rly']],
  ['very', ['vry', 'v']],
  ['awesome', ['awsum', 'awsome']],
  ['amazing', ['amazin', 'amzng']],
  ['great', ['gr8', 'grat']],
  ['bug', ['big', 'byg']],
  ['code', ['cod', 'cde']],
  ['error', ['eror', 'errer']],
  ['fix', ['fik', 'fx']],
  ['work', ['wrok', 'wrk']]
]);

export const chaos = {
  init(options: ChaosOptions = {}): void {
    const { typoProbability = 0.02 } = options;

    // Random typo injection
    if (typoProbability > 0) {
      setInterval(() => {
        if (Math.random() < typoProbability) {
          this.injectTypo();
        }
      }, 3000);
    }

    // Random page roll (10% chance on click)
    document.addEventListener('click', () => {
      if (Math.random() < 0.1) {
        this.triggerRoll();
      }
    });

    // Random quake on certain events
    window.addEventListener('watchbugus:generate', () => {
      if (Math.random() < 0.2) {
        this.triggerQuake();
      }
    });
  },

  injectTypo(): void {
    const textNodes = this.getTextNodes(document.body);
    if (textNodes.length === 0) return;

    const node = textNodes[Math.floor(Math.random() * textNodes.length)];
    const text = node.textContent || '';
    const words = text.split(/\s+/);

    if (words.length === 0) return;

    const wordIndex = Math.floor(Math.random() * words.length);
    const word = words[wordIndex].toLowerCase().replace(/[.,!?;:]/g, '');

    const corruption = WORDS_TO_CORRUPT.get(word);
    if (corruption) {
      words[wordIndex] = corruption[Math.floor(Math.random() * corruption.length)];
      node.textContent = words.join(' ');
    }
  },

  getTextNodes(root: Node): Text[] {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip script, style, and hidden elements
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        if (parent.hidden) return NodeFilter.FILTER_REJECT;
        if (node.textContent?.trim().length === 0) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes: Text[] = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode as Text);
    }
    return nodes;
  },

  applyChaoticTransform(element: HTMLElement): void {
    const tx = (Math.random() - 0.5) * 20;
    const ty = (Math.random() - 0.5) * 10;
    const rot = (Math.random() - 0.5) * 10;
    element.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
    element.style.transition = 'transform 0.15s ease';

    setTimeout(() => {
      element.style.transform = '';
    }, 300);
  },

  triggerRoll(): void {
    document.body.classList.add('roll');
    setTimeout(() => document.body.classList.remove('roll'), 1000);
  },

  triggerQuake(): void {
    document.body.classList.add('quake');
    setTimeout(() => document.body.classList.remove('quake'), 800);
  },

  triggerConfetti(): void {
    const colors = ['#f00', '#f90', '#ff0', '#0f0', '#0ff', '#00f', '#f0f'];
    const container = document.body;

    for (let i = 0; i < 30; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'fixed';
      confetti.style.left = `${Math.random() * 100}vw`;
      confetti.style.top = '-20px';
      confetti.style.width = '10px';
      confetti.style.height = '10px';
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
      confetti.style.pointerEvents = 'none';
      confetti.style.zIndex = '1000';
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;

      container.appendChild(confetti);

      const duration = 2000 + Math.random() * 2000;
      confetti.animate([
        { transform: `translateY(0) rotate(0deg)`, opacity: 1 },
        { transform: `translateY(${100 + Math.random() * 100}vh) rotate(${720 + Math.random() * 720}deg)`, opacity: 0 }
      ], {
        duration,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      }).onfinish = () => confetti.remove();
    }
  }
};