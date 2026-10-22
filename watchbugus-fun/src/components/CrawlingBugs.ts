/**
 * Crawling bugs mini-game
 *
 * A few bugs crawl around the viewport. Click one and it gets squashed, the
 * counter goes up, and the site says something nice to you. This is the only
 * feature on the page with a 100% success rate.
 */

import { audio } from '../utils/audio.ts';
import { chaos } from '../utils/chaos.ts';
import { toast } from '../utils/toast.ts';

const EMOJIS = ['🐛', '🐞', '🪲', '🦗'];

const PRAISE = [
  'BUG SQUASHED. The developer inside you is proud.',
  'Direct hit. QA would like to offer you a job.',
  'That bug had a family. You did the right thing.',
  'Squashed. Zero reproduction steps required.',
  'Excellent click. Steve is impressed, which means nothing.',
  'One less bug in production. Statistically meaningless, emotionally huge.',
  'You fixed it! The bug will be back tomorrow.',
  'Achievement unlocked: Pest Control (unpaid).',
];

interface Bug {
  el: HTMLButtonElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wobble: number;
  alive: boolean;
}

const SIZE = 54;
const STORAGE_KEY = 'watchbug_squashed';

export function initCrawlingBugs(_state?: unknown): void {
  const layer = document.getElementById('bug-layer');
  const counterEl = document.getElementById('bugs-squashed');
  if (!layer || !counterEl) return;

  let total = 0;
  try {
    total = Number.parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
  } catch {
    total = 0;
  }
  counterEl.textContent = String(total);

  const bugs: Bug[] = [];
  const bugCount = window.matchMedia('(max-width: 700px)').matches ? 2 : 4;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const randomBetween = (min: number, max: number): number =>
    min + Math.random() * (max - min);

  const viewport = (): { w: number; h: number } => ({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  function spawn(): Bug {
    const { w, h } = viewport();
    const fromLeft = Math.random() < 0.5;
    const speed = reduceMotion ? 0 : randomBetween(26, 58);

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'crawling-bug';
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    el.setAttribute('aria-label', 'Squash this bug');
    el.title = 'Click to squash';

    layer.appendChild(el);

    const bug: Bug = {
      el,
      x: fromLeft ? -SIZE : randomBetween(0, Math.max(0, w - SIZE)),
      y: randomBetween(40, Math.max(60, h - SIZE - 40)),
      vx: (fromLeft ? 1 : -1) * speed,
      vy: randomBetween(-0.35, 0.35) * speed,
      wobble: Math.random() * Math.PI * 2,
      alive: true,
    };

    el.addEventListener('click', (event) => {
      event.stopPropagation();
      squash(bug);
    });

    return bug;
  }

  function squash(bug: Bug): void {
    if (!bug.alive) return;
    bug.alive = false;

    total += 1;
    counterEl.textContent = String(total);
    try {
      localStorage.setItem(STORAGE_KEY, String(total));
    } catch {
      /* private mode, who cares */
    }

    void audio.play('bug-squash');
    bug.el.classList.add('squashed');
    bug.el.setAttribute('aria-hidden', 'true');
    bug.el.disabled = true;

    toast.show(PRAISE[Math.floor(Math.random() * PRAISE.length)], {
      type: 'success',
      duration: 2600,
    });

    if (total > 0 && total % 5 === 0) {
      chaos.triggerConfetti();
      toast.show(`${total} bugs squashed. HR has been notified.`, { duration: 3200 });
    }

    window.setTimeout(() => {
      bug.el.remove();
      const index = bugs.indexOf(bug);
      if (index >= 0) bugs.splice(index, 1);
      // Respawn only if the player is still around and hasn't panicked.
      if (!document.hidden) bugs.push(spawn());
    }, 520);
  }

  for (let i = 0; i < bugCount; i++) {
    bugs.push(spawn());
  }

  let last = performance.now();

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const { w, h } = viewport();
    const maxX = Math.max(0, w - SIZE);
    const maxY = Math.max(0, h - SIZE);

    for (const bug of bugs) {
      if (!bug.alive) continue;

      bug.wobble += dt * 4;
      bug.x += bug.vx * dt;
      bug.y += (bug.vy + Math.sin(bug.wobble) * 12) * dt;

      if (bug.x < 0) {
        bug.x = 0;
        bug.vx = Math.abs(bug.vx);
      } else if (bug.x > maxX) {
        bug.x = maxX;
        bug.vx = -Math.abs(bug.vx);
      }

      if (bug.y < 0) {
        bug.y = 0;
        bug.vy = Math.abs(bug.vy);
      } else if (bug.y > maxY) {
        bug.y = maxY;
        bug.vy = -Math.abs(bug.vy);
      }

      const angle = (Math.atan2(bug.vy, bug.vx) * 180) / Math.PI + 90;
      bug.el.style.transform = `translate3d(${bug.x}px, ${bug.y}px, 0) rotate(${angle}deg)`;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // Keep bugs on screen after a resize.
  window.addEventListener('resize', () => {
    const { w, h } = viewport();
    for (const bug of bugs) {
      bug.x = Math.min(bug.x, Math.max(0, w - SIZE));
      bug.y = Math.min(bug.y, Math.max(0, h - SIZE));
    }
  });
}
