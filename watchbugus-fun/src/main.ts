/**
 * Watchbugus Fun - Main Entry Point
 * Parody bug reporting site with chaotic energy
 */

import './style.css';

// Import all components
import { initSplash } from './components/Splash.ts';
import { initKumarBanner } from './components/KumarBanner.ts';
import { initNavigation } from './components/Navigation.ts';
import { initHero } from './components/Hero.ts';
import { initGenerator } from './components/Generator.ts';
import { initFeatures } from './components/Features.ts';
import { initPricing } from './components/Pricing.ts';
import { initGallery } from './components/Gallery.ts';
import { initReviews } from './components/Reviews.ts';
import { initNotKumar } from './components/NotKumar.ts';
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
import { initHeadingRandomizer } from './components/HeadingRandomizer.ts';
import { initPriceCounter } from './components/PriceCounter.ts';
import { initParodySystems } from './components/ParodySystems.ts';
import { toast } from './utils/toast.ts';
import { popup } from './utils/popup.ts';
import { audio } from './utils/audio.ts';
import { chaos } from './utils/chaos.ts';
import { jokes } from './data/jokes.ts';

// Global state
const state = {
  credits: 3,
  visitCount: 125847,
  chatOpen: false,
  musicPlaying: false,
  clippyShown: false,
  virusShown: false,
  wheelShown: false,
  callActive: false,
};

// Initialize all components
async function init() {
  // Initialize utilities first
  toast.init();
  popup.init();
  audio.init();
  chaos.init();

  // Initialize components
  await initSplash(state);
  initKumarBanner(state);
  initNavigation(state);
  initHero(state);
  initGenerator(state, jokes, audio);
  initFeatures(jokes);
  initPricing(jokes);
  initGallery(jokes);
  initReviews(jokes);
  initNotKumar(state, audio);
  initChat(state, audio);
  initCookie(state);
  initClippy(state, jokes);
  initVirusScanner(state, audio);
  initPrizeWheel(state, audio);
  initPhoneCall(state, audio);
  // captcha is used by Generator, no init needed
  initErrorBoxes(state);
  initMusic(state, audio);
  initMouseTrail(state);
  initFallingMoney(state);
  initTitleRotation();
  initHeadingRandomizer();
  initPriceCounter(state);
  initParodySystems(state);

  // Load visit count from "API"
  loadVisitCount();

  console.log('%c🐛 Watchbugus Loaded!', 'font-size: 24px; color: #f0f; text-shadow: 2px 2px #000;');
  console.log('%cMade with 🌭 and questionable decisions', 'color: #0f0; font-family: Comic Sans MS;');
}

init();

// Mock API calls
async function loadVisitCount() {
  try {
    // In production, this would be a real API call
    // const response = await fetch('/api/visit', { method: 'POST' });
    // const data = await response.json();
    // state.visitCount = data.visits;
    document.getElementById('hits-counter')!.textContent = state.visitCount.toLocaleString();
  } catch {
    // Fallback to localStorage
    const stored = localStorage.getItem('watchbugus_visits');
    if (stored) {
      state.visitCount = parseInt(stored, 10);
    }
    state.visitCount++;
    localStorage.setItem('watchbugus_visits', state.visitCount.toString());
    document.getElementById('hits-counter')!.textContent = state.visitCount.toLocaleString();
  }
}

// Export for debugging
(window as any).__WATCHBUGUS__ = { state, audio, chaos };