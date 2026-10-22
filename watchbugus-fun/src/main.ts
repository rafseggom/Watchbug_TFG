/**
 * Watchbug Fun - Main Entry Point
 *
 * A parody marketing page for the real Watchbug SDK. The rule of this page:
 * jokes on top, real content underneath, and an obvious way out of every popup.
 */

import './style.css';
import './content.css';

import { initSplash } from './components/Splash.ts';
import { initPromoBanner } from './components/PromoBanner.ts';
import { initNavigation } from './components/Navigation.ts';
import { initHero } from './components/Hero.ts';
import { initGenerator } from './components/Generator.ts';
import { initFeatures } from './components/Features.ts';
import { initPricing } from './components/Pricing.ts';
import { initGallery } from './components/Gallery.ts';
import { initReviews } from './components/Reviews.ts';
import { initConsulting } from './components/Consulting.ts';
import { initChat } from './components/Chat.ts';
import { initCookie } from './components/Cookie.ts';
import { initClippy } from './components/Clippy.ts';
import { initVirusScanner } from './components/VirusScanner.ts';
import { initPrizeWheel } from './components/PrizeWheel.ts';
import { initPhoneCall } from './components/PhoneCall.ts';
import { initErrorBoxes } from './components/ErrorBoxes.ts';
import { initMusic } from './components/Music.ts';
import { initMouseTrail } from './components/MouseTrail.ts';
import { initFallingMoney } from './components/FallingMoney.ts';
import { initTitleRotation } from './components/TitleRotation.ts';
import { initPriceCounter } from './components/PriceCounter.ts';
import { initParodySystems } from './components/ParodySystems.ts';
import { initCrawlingBugs } from './components/CrawlingBugs.ts';
import { initMaskDemo } from './components/MaskDemo.ts';
import { initPanicButton } from './components/Panic.ts';

import { toast } from './utils/toast.ts';
import { popup } from './utils/popup.ts';
import { audio } from './utils/audio.ts';
import { chaos } from './utils/chaos.ts';
import { jokes } from './data/jokes.ts';

const state = {
  credits: 3,
  visitCount: 2847,
  chatOpen: false,
  musicPlaying: false,
  clippyShown: false,
  virusShown: false,
  wheelShown: false,
  callActive: false,
};

function init(): void {
  // Utilities first: everything below may fire a toast or a popup.
  toast.init();
  popup.init();
  audio.init();
  chaos.init({ typoProbability: 0, rollProbability: 0 });

  // Music before the splash so the toggle reflects the state the ENTER click
  // is about to create.
  initMusic(state);
  initSplash(state);
  initPanicButton();

  initPromoBanner(state);
  initNavigation(state);
  initHero(state);
  initMaskDemo();
  initGenerator(state, jokes, audio);
  initFeatures(jokes);
  initPricing(jokes);
  initGallery(jokes);
  initReviews(jokes);
  initConsulting(state);
  initChat(state, audio);
  initCookie(state);
  initClippy(state);
  initVirusScanner(state, audio);
  initPrizeWheel(state, audio);
  initPhoneCall(state);
  initErrorBoxes(state);
  initMouseTrail(state);
  initFallingMoney(state);
  initTitleRotation();
  initPriceCounter(state);
  initParodySystems(state);
  initCrawlingBugs(state);

  loadVisitCount();

  console.log('%c🐛 Watchbug loaded (parody edition)', 'font-size: 22px; color: #6b2cff; text-shadow: 2px 2px #000;');
  console.log('%cReal product. Fake hotdogs. Click the crawling bugs.', 'color: #0a7a2f; font-family: Comic Sans MS;');
}

init();

function loadVisitCount(): void {
  const key = 'watchbug_visits';
  try {
    const stored = Number.parseInt(localStorage.getItem(key) || '', 10);
    state.visitCount = Number.isFinite(stored) && stored > 0 ? stored + 1 : state.visitCount + 1;
    localStorage.setItem(key, String(state.visitCount));
  } catch {
    state.visitCount += 1;
  }

  const counter = document.getElementById('hits-counter');
  if (counter) {
    counter.textContent = state.visitCount.toLocaleString('en-US');
  }
}

// Export for debugging / for the curious who open DevTools.
(window as unknown as { __WATCHBUG__: unknown }).__WATCHBUG__ = { state, audio, chaos, jokes };
