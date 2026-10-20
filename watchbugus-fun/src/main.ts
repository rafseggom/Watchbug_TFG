/**
 * Watchbugus Fun - Main Entry Point
 * Parody bug reporting site with chaotic energy
 */

import './style.css';

// Import all components
import { initSplash } from './components/Splash.js';
import { initKumarBanner } from './components/KumarBanner.js';
import { initNavigation } from './components/Navigation.js';
import { initHero } from './components/Hero.js';
import { initGenerator } from './components/Generator.js';
import { initFeatures } from './components/Features.js';
import { initPricing } from './components/Pricing.js';
import { initGallery } from './components/Gallery.js';
import { initReviews } from './components/Reviews.js';
import { initNotKumar } from './components/NotKumar.js';
import { initChat } from './components/Chat.js';
import { initCookie } from './components/Cookie.js';
import { initClippy } from './components/Clippy.js';
import { initVirusScanner } from './components/VirusScanner.js';
import { initPrizeWheel } from './components/PrizeWheel.js';
import { initPhoneCall } from './components/PhoneCall.js';
import { initErrorBoxes } from './components/ErrorBoxes.js';
import { initMusic } from './components/Music.js';
import { initMouseTrail } from './components/MouseTrail.js';
import { initFallingMoney } from './components/FallingMoney.js';
import { initTitleRotation } from './components/TitleRotation.js';
import { initHeadingRandomizer } from './components/HeadingRandomizer.js';
import { initPriceCounter } from './components/PriceCounter.js';
import { toast } from './utils/toast.js';
import { popup } from './utils/popup.js';
import { audio } from './utils/audio.js';
import { chaos } from './utils/chaos.js';
import { jokes } from './data/jokes.js';

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