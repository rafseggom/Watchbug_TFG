/**
 * Watchbugus Fun - Main Entry Point
 * Parody bug reporting site with chaotic energy
 */

import './style.css';

// Import all components
import { initSplash } from './components/Splash';
import { initKumarBanner } from './components/KumarBanner';
import { initNavigation } from './components/Navigation';
import { initHero } from './components/Hero';
import { initGenerator } from './components/Generator';
import { initFeatures } from './components/Features';
import { initPricing } from './components/Pricing';
import { initGallery } from './components/Gallery';
import { initReviews } from './components/Reviews';
import { initNotKumar } from './components/NotKumar';
import { initChat } from './components/Chat';
import { initCookie } from './components/Cookie';
import { initClippy } from './components/Clippy';
import { initVirusScanner } from './components/VirusScanner';
import { initPrizeWheel } from './components/PrizeWheel';
import { initPhoneCall } from './components/PhoneCall';
import { initErrorBoxes } from './components/ErrorBoxes';
import { initMusic } from './components/Music';
import { initMouseTrail } from './components/MouseTrail';
import { initFallingMoney } from './components/FallingMoney';
import { initTitleRotation } from './components/TitleRotation';
import { initHeadingRandomizer } from './components/HeadingRandomizer';
import { initPriceCounter } from './components/PriceCounter';
import { toast } from './utils/toast';
import { popup } from './utils/popup';
import { audio } from './utils/audio';
import { chaos } from './utils/chaos';
import { jokes } from './data/jokes';

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