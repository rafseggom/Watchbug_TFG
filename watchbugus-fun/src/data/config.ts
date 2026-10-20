/**
 * Configuration Data
 */

export const config = {
  site: {
    name: 'Watchbugus',
    tagline: 'Bug reporting that\'s actually fun',
    version: '0.0.1-pre-alpha-beta-gamma-delta',
    domain: 'fun.watchbugus.com'
  },

  credits: {
    initial: 3,
    refillInterval: null, // never
    proUnlimited: true
  },

  timing: {
    splashDuration: 2500,
    kumarBannerDelay: 0,
    clippyDelay: 8000,
    virusDelay: 25000,
    errorFirstDelay: 18000,
    errorInterval: 20000,
    nudgeInterval: 30000,
    titleRotationInterval: 1200,
    headingRandomizeInterval: 1500,
    priceCounterInterval: 2000,
    moneyFallInterval: 3000,
    mouseTrailThrottle: 40
  },

  probabilities: {
    exitIntent: 1,
    randomRoll: 0.1,
    chaoticTransform: 0.3,
    typoInjection: 0.02,
    quakeOnGenerate: 0.2,
    errorBox: 0.3
  },

  captcha: {
    gridSize: 9,
    images: [
      'thumb-shark.webp',
      'thumb-omg.webp',
      'thumb-lambo.webp',
      'thumb-minecraft.webp',
      'thumb-cat.webp',
      'thumb-toaster.webp',
      'thumb-baguette.webp',
      'hotdog.webp',
      'mascot.webp'
    ]
  },

  wheel: {
    segments: [
      { label: '47s WITH KUMAR', weight: 50 },
      { label: 'FREE HOTDOG 🌭', weight: 10 },
      { label: 'BUG CREDIT +1', weight: 10 },
      { label: 'NOTHING 😭', weight: 15 },
      { label: 'TRY AGAIN', weight: 10 },
      { label: 'MYSTERY BOX', weight: 5 }
    ],
    riggedWinner: 0 // Index of "47s WITH KUMAR"
  },

  audio: {
    volumes: {
      sfx: 0.5,
      music: 0.3
    },
    files: {
      'generate-start': 'generate-start.mp3',
      'generate-done': 'generate-done.mp3',
      'steve-call': 'steve-call.mp3',
      'wheel-tick': 'wheel-tick.mp3',
      'wheel-win': 'wheel-win.mp3',
      'coupon-expired': 'coupon-expired.mp3',
      'shop-bossa-loop': 'shop-bossa-loop.mp3'
    }
  },

  assets: {
    images: {
      hotdog: 'hotdog.webp',
      mascot: 'mascot.webp',
      thumbnails: [
        'thumb-shark.webp',
        'thumb-omg.webp',
        'thumb-lambo.webp',
        'thumb-minecraft.webp',
        'thumb-cat.webp',
        'thumb-toaster.webp',
        'thumb-baguette.webp'
      ],
      avatars: [
        'avatar-1.webp',
        'avatar-2.webp'
      ],
      notkumar: 'notkumar.jpg',
      chatbot: 'chatbot.webp',
      clippy: 'clippy.webp'
    },
    audio: [
      'generate-start.mp3',
      'generate-done.mp3',
      'steve-call.mp3',
      'wheel-tick.mp3',
      'wheel-win.mp3',
      'coupon-expired.mp3',
      'shop-bossa-loop.mp3'
    ]
  },

  easterEggs: {
    konamiCode: true,
    clickCounter: 50,
    secretPages: ['/credits', '/hotdog-manifesto', '/steve-diary']
  },

  legal: {
    disclaimer: 'This is a parody site. No actual bug tracking occurs. Hotdogs are virtual. Steve is fictional. Kumar is not affiliated.',
    privacy: 'We collect your bugs, your soul, and your hotdog preferences. GDPR? Never heard of her.',
    terms: 'By using this site you agree to sacrifice one (1) virtual hotdog per bug report. No refunds.'
  }
};