/**
 * Title Rotation Component (Changes document title periodically)
 */

const TITLES = [
  'Watchbug — Bug reports your users actually finish',
  'Watchbug — Now with 47% more hotdogs 🌭',
  'Watchbug — Bug tracking that doesn\'t suck (much)',
  'Watchbug — Steve is watching you 👀',
  'Watchbug — Your bugs called, they want their money back',
  'Watchbug — 125,847 developers can\'t be wrong (they can)',
  'Watchbug — Powered by hope and rubber ducks 🦆',
  'Watchbug — Free hotdog with every bug report! (lies)',
  'Watchbug — The only bug tracker whose mascot has a headset',
  'Watchbug — Debugging is just removing bugs. We add them. 🐛',
];

export function initTitleRotation(): void {
  let index = 0;

  setInterval(() => {
    index = (index + 1) % TITLES.length;
    document.title = TITLES[index];
  }, 4200);
}
