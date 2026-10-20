/**
 * Jokes Data - All the funny content for the parody site
 */

import type { JokeData } from './types.ts';

export const jokes: JokeData = {
  // Bug Generator
  bugTitles: [
    'Button click deletes production database',
    'Login works only on Tuesdays',
    'CSS loads in reverse alphabetical order',
    'API returns 418 I\'m a teapot',
    'Dark mode makes text invisible',
    'Scrolling up goes down',
    'Typing "a" deletes user account',
    'Mobile menu opens on Mars',
    'Console.log is a lie',
    'Cache invalidation works perfectly (first time in history)'
  ],

  fakeLogs: [
    '[INFO] Initializing quantum entanglement...',
    '[WARN] Hotdog supply critically low 🌭',
    '[DEBUG] Checking if user is human... 47% confidence',
    '[ERROR] Failed to fetch reality: Connection refused',
    '[INFO] Consulting the ancient bug spirits...',
    '[DEBUG] Stack trace: at Object.life.getMeaning() [native code]',
    '[WARN] Memory leak detected in developer\'s brain',
    '[INFO] Rubber duck deployed for debugging 🦆',
    '[ERROR] Segfault at 0xDEADBEEF (ate too much beef)',
    '[DEBUG] Cache invalidated. Again. And again.',
    '[INFO] Deploying to production on Friday 🎉',
    '[WARN] Tests passing? Something is wrong.',
    '[DEBUG] Variable "truth" is undefined',
    '[ERROR] 404: Motivation not found',
    '[INFO] Hotdog injected into DOM 🌭'
  ],

  fakeEnv: [
    'OS: ChaosOS 4.2.1 (unstable)',
    'Browser: Chrome 47.0.2526.106 (from 2016)',
    'Resolution: 1366x768 (on a 4K monitor)',
    'Timezone: UTC-5 (but actually UTC+hotdog)',
    'Language: en-US (with heavy sarcasm dialect)',
    'Cookies: Enabled (and delicious)',
    'LocalStorage: 4.7MB of useless tokens',
    'SessionStorage: Empty (like my promises)',
    'User Agent: Mozilla/5.0 (compatible; WatchbugusBot/1.0)',
    'Referrer: https://google.com/search?q=how+to+fix+bug'
  ],

  bugDescriptions: [
    'When the user clicks the "Submit" button 47 times rapidly while holding the spacebar and thinking about hotdogs, the application enters a quantum superposition where the database both exists and doesn\'t exist simultaneously. The Schrödinger\'s cat of bugs.',
    'The login form validates the password against a hash of the current lunar phase. Works perfectly during full moons, fails during eclipses. Werewolves cannot log in.',
    'CSS specificity wars have escalated to nuclear levels. The !important flags have formed a union and are demanding better working conditions. All styles now render in Comic Sans as protest.',
    'The API returns HTTP 418 "I\'m a teapot" for all POST requests between 2-4 AM. The backend developer was drinking tea when they wrote the middleware. It\'s a feature, not a bug.',
    'Dark mode inverts not just colors but the very fabric of reality. Text becomes anti-text. Buttons become anti-buttons. Users report seeing their own code in their dreams.',
    'Scrolling up actually scrolls down, but only on Tuesdays. On Wednesdays it scrolls left. On Thursdays it plays the Macarena. The scroll event listener has achieved sentience.',
    'Typing the letter "a" in any input field triggers a recursive function that deletes the user account, creates a new one, orders a pizza, and sends the receipt to the CEO.',
    'The mobile hamburger menu opens a portal to a dimension where CSS works perfectly. Users who enter never want to leave. The close button is a lie.',
    'console.log() outputs to a parallel universe where bugs don\'t exist. The logs appear in the terminal of a developer who fixed that exact bug 3 years ago.',
    'Cache invalidation works perfectly for the first time in computer science history. Unfortunately, it invalidates the cache AND the source code AND the developer\'s will to live.'
  ],

  bugReproductions: [
    'Open the app on a Tuesday during a full moon',
    'Click the button 47 times while holding spacebar',
    'Think about hotdogs intensely for 3 seconds',
    'Resize the browser window to exactly 666px width',
    'Type "bug" backwards in the search field',
    'Sacrifice a rubber duck to the debug gods',
    'Deploy to production on Friday at 4:59 PM',
    'Ask a senior dev "quick question"',
    'Name a variable "temp" and leave it forever',
    'Trust the cache invalidation'
  ],

  // Features
  features: [
    {
      title: '🐛 Bug Capture',
      desc: 'Screenshot the current tab with one click. Our AI (Actual Human Intern) enhances it with fake console logs and environment metadata.'
    },
    {
      title: '🎨 Annotate Like a Pro',
      desc: 'Draw arrows, circles, and passive-aggressive notes. 47 colors including "Angry Red" and "Disappointed Gray".'
    },
    {
      title: '🔒 Destructive Masking',
      desc: 'Permanently destroy sensitive data in the screenshot. Password fields? Gone. API keys? Vaporized. Your secrets? Safe.'
    },
    {
      title: '📦 Zero Dependencies',
      desc: 'The SDK is 45KB gzipped. No React, no jQuery, no nonsense. Just pure, unadulterated TypeScript chaos.'
    },
    {
      title: '🌍 Self-Hosted Everything',
      desc: 'Your bugs, your server, your rules. Docker compose up and you\'re live. No SaaS, no subscriptions, no hotdog taxes.'
    },
    {
      title: '🌭 Hotdog-Powered',
      desc: 'Every bug report generates a virtual hotdog. Collect 100 for a free virtual badge. Terms apply (they don\'t).'
    }
  ],

  // Pricing
  plans: [
    {
      name: 'FREE (BROKE)',
      price: '$0',
      period: 'forever (until we pivot)',
      features: [
        '3 bug credits/month (refill never)',
        'Basic screenshot capture',
        '1 annotation color (gray)',
        'Community support (Discord: 3 users)',
        'Watermarked exports',
        'No hotdogs included'
      ],
      cta: 'START FREE',
      ctaAction: 'popup'
    },
    {
      name: 'PRO CREATOR',
      price: '$47',
      period: '/month (price increases while you read)',
      features: [
        'Unlimited bug credits',
        'All 47 annotation colors',
        'Priority support (Steve replies)',
        'Custom branding (your logo + hotdog)',
        'Advanced masking (pixelate, blur*, solid)',
        'Weekly call with Not Kumar',
        '* Blur is a lie, we use solid fill'
      ],
      popular: true,
      cta: 'GET PRO',
      ctaAction: 'call'
    },
    {
      name: 'ENTERPRISE',
      price: '$999',
      period: '/month (call Steve)',
      features: [
        'Everything in Pro',
        'Dedicated hotdog concierge',
        'On-premise deployment',
        'SLA: 99.9% uptime (hotdog not guaranteed)',
        'Custom integrations (Jira, Linear, Notion, Trello, Excel)',
        'Steve visits your office (travel not included)',
        'Lifetime supply of virtual hotdogs'
      ],
      cta: 'CALL STEVE 📞',
      ctaAction: 'call'
    }
  ],

  // Gallery
  gallery: [
    {
      img: 'thumb-shark.webp',
      alt: 'Shark wearing a headset debugging code',
      caption: '"Found the bug! It was a shark all along."'
    },
    {
      img: 'thumb-omg.webp',
      alt: 'Person shocked finding $1',
      caption: '"I FOUND $1 IN PRODUCTION LOGS!!!"'
    },
    {
      img: 'thumb-lambo.webp',
      alt: 'Lamborghini vs toy car',
      caption: '"$1M Bug vs $1 Bug - Guess which crashed prod"'
    },
    {
      img: 'thumb-minecraft.webp',
      alt: 'Minecraft screenshot',
      caption: '"Minecraft NOT CLICKBAIT - Real diamond ore found in node_modules"'
    },
    {
      img: 'thumb-cat.webp',
      alt: 'Cat at gym',
      caption: '"Cat gym transformation - 30 days of debugging"'
    },
    {
      img: 'thumb-toaster.webp',
      alt: 'Toaster exposed',
      caption: '"TOASTER EXPOSED: It was stealing your toast this whole time"'
    },
    {
      img: 'thumb-baguette.webp',
      alt: 'Baguette gone wrong',
      caption: '"Baguette GONE WRONG - Croissant conspiracy confirmed"'
    }
  ],

  // Reviews
  reviews: [
    {
      text: '"Watchbugus changed my life. I used to have 47 bugs. Now I have 47 documented bugs AND a virtual hotdog collection. 10/10 would debug again."',
      author: 'Dave',
      role: 'Senior Bug Collector',
      avatar: 'avatar-1.webp'
    },
    {
      text: '"Finally a bug tracker that understands me. The destructive masking feature saved my API keys from my own curiosity. Steve called me once. Nice guy."',
      author: 'Karen',
      role: 'CTO (Chief Taco Officer)',
      avatar: 'avatar-2.webp'
    },
    {
      text: '"The pricing page alone is worth the $47/month. I laughed so hard I cried. Then I subscribed. Then Steve called. We talked about hotdogs for 20 minutes."',
      author: 'Mike',
      role: 'Full Stack Overflow Developer',
      avatar: 'avatar-1.webp'
    },
    {
      text: '"Not a scam! The prize wheel is totally fair. I won \"47s with Kumar\" three times in a row. Still waiting for my call. The hotdogs are delicious (imaginary)."',
      author: 'Sarah',
      role: 'QA Engineer (Question Everything)',
      avatar: 'avatar-2.webp'
    },
    {
      text: '"Best $0 I ever spent on the free tier. The community support is just Dave and Karen arguing about tabs vs spaces. Educational AND entertaining."',
      author: 'Alex',
      role: 'Junior Bug Enthusiast',
      avatar: 'avatar-1.webp'
    },
    {
      text: '"The virus scanner found 47 viruses in my browser. I paid $4.99 to remove them. Turns out they were just my open tabs. Worth it for the peace of mind."',
      author: 'Jordan',
      role: 'Tab Hoarder (247 tabs open)',
      avatar: 'avatar-2.webp'
    }
  ]
};