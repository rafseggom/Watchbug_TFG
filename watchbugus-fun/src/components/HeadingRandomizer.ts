/**
 * Heading Randomizer Component (Randomizes h2/h3 fonts)
 */

const FONTS = [
  '"Comic Sans MS", cursive',
  '"Papyrus", fantasy',
  '"Impact", sans-serif',
  '"Times New Roman", serif',
  '"Courier New", monospace',
  '"Brush Script MT", cursive',
  '"Wingdings", fantasy',
  '"Chalkboard SE", cursive',
  '"Comic Neue", cursive'
];

export function initHeadingRandomizer(): void {
  const headings = document.querySelectorAll('h2, h3');

  setInterval(() => {
    headings.forEach(heading => {
      const font = FONTS[Math.floor(Math.random() * FONTS.length)];
      (heading as HTMLElement).style.fontFamily = font;
    });
  }, 1500);
}