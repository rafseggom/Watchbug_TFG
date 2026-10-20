/**
 * Type definitions for the parody site
 */

export interface JokeData {
  // Bug Generator
  bugTitles: string[];
  fakeLogs: string[];
  fakeEnv: string[];
  bugDescriptions: string[];
  bugReproductions: string[];

  // Features
  features: Array<{ title: string; desc: string }>;

  // Pricing
  plans: Array<{
    name: string;
    price: string;
    period: string;
    features: string[];
    popular?: boolean;
    cta: string;
    ctaAction: 'wheel' | 'popup' | 'call';
  }>;

  // Gallery
  gallery: Array<{
    img: string;
    alt: string;
    caption: string;
  }>;

  // Reviews
  reviews: Array<{
    text: string;
    author: string;
    role: string;
    avatar: string;
  }>;
}

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