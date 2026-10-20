/**
 * Title Rotation Component (Changes document title periodically)
 */

const TITLES = [
  'Watchbugus — Make Bug Reports for $0.000001!!!',
  'Watchbugus — Now with 47% more hotdogs 🌭',
  'Watchbugus — Bug tracking that doesn\'t suck (much)',
  'Watchbugus — Steve is watching you 👀',
  'Watchbugus — Your bugs called, they want their money back',
  'Watchbugus — 125,847 developers can\'t be wrong (they can)',
  'Watchbugus — Powered by hope and rubber ducks 🦆',
  'Watchbugus — Free hotdog with every bug report! (lies)',
  'Watchbugus — The only bug tracker with a mascot that\'s a hotdog',
  'Watchbugus — Debugging is just removing bugs. We add them. 🐛'
];

export function initTitleRotation(): void {
  let index = 0;

  setInterval(() => {
    index = (index + 1) % TITLES.length;
    document.title = TITLES[index];
  }, 1200);
}