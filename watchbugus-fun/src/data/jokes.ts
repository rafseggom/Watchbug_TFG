/**
 * Jokes Data - All the funny content for the parody site
 *
 * Rule of thumb: every claim about Watchbug itself is true. The jokes live in
 * the delivery. If a card says the SDK does something, the repository does it.
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
    'console.log is a lie',
    'Cache invalidation works perfectly (first time in history)',
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
    '[INFO] Hotdog injected into DOM 🌭',
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
    'User Agent: Mozilla/5.0 (compatible; WatchbugBot/1.0)',
    'Referrer: https://google.com/search?q=how+to+fix+bug',
  ],

  bugDescriptions: [
    'When the user clicks the "Submit" button 47 times rapidly while holding the spacebar and thinking about hotdogs, the application enters a quantum superposition where the database both exists and doesn\'t exist simultaneously. Schrödinger\'s cat of bugs.',
    'The login form validates the password against a hash of the current lunar phase. Works perfectly during full moons, fails during eclipses. Werewolves cannot log in.',
    'CSS specificity wars have escalated to nuclear levels. The !important flags have formed a union and are demanding better working conditions. All styles now render in Comic Sans as protest.',
    'The API returns HTTP 418 "I\'m a teapot" for all POST requests between 2-4 AM. The backend developer was drinking tea when they wrote the middleware. It is a feature, not a bug.',
    'Dark mode inverts not just colours but the very fabric of reality. Text becomes anti-text. Buttons become anti-buttons. Users report seeing their own code in their dreams.',
    'Scrolling up actually scrolls down, but only on Tuesdays. On Wednesdays it scrolls left. On Thursdays it plays the Macarena. The scroll event listener has achieved sentience.',
    'Typing the letter "a" in any input field triggers a recursive function that deletes the user account, creates a new one, orders a pizza, and sends the receipt to the CEO.',
    'The mobile hamburger menu opens a portal to a dimension where CSS works perfectly. Users who enter never want to leave. The close button is a lie.',
    'console.log() outputs to a parallel universe where bugs do not exist. The logs appear in the terminal of a developer who fixed that exact bug three years ago.',
    'Cache invalidation works perfectly for the first time in computer science history. Unfortunately, it invalidates the cache AND the source code AND the developer\'s will to live.',
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
    'Trust the cache invalidation',
  ],

  // Features - real capabilities, comedy delivery
  features: [
    {
      title: '🐛 One-tap capture',
      desc: 'The floating widget grabs the current tab through the browser\'s own screen picker, draws it to a canvas, and hands it to the annotator. No browser extension, no "install our desktop app".',
    },
    {
      title: '🖤 Destructive masking',
      desc: 'Password fields, credential-looking values, card numbers and [data-watchbug-sensitive] nodes get a flat opaque fill written into the pixels before encoding. Not a CSS overlay. Not a blur you can de-convolve.',
    },
    {
      title: '🧾 Console + environment, included',
      desc: 'Every report can carry the console buffer, the URL, viewport size, user agent and locale. The stuff you always end up asking for in the replies, captured at the moment it happened.',
    },
    {
      title: '🏠 Actually self-hosted',
      desc: 'API, admin panel and PostgreSQL in one docker-compose file. Reports and attachments live on your disk. "Our cloud" is not a dependency you have to opt out of.',
    },
    {
      title: '🧩 Framework agnostic',
      desc: 'A plain script tag and a global init call. It does not care whether your app is React 19, Vue, Svelte, or a 2009 jQuery page held together by hope.',
    },
    {
      title: '🪶 Small on purpose',
      desc: 'The injected core is a gzipped file measured by a hard size gate. No framework is shipped to draw a rectangle; the annotation editor is a lazy chunk loaded only when used.',
    },
    {
      title: '🔐 No host credentials',
      desc: 'The SDK never reads cookies, localStorage, sessionStorage, auth headers or bearer tokens. Only the public, write-only project key leaves the page.',
    },
    {
      title: '🗄️ Attachments behind auth',
      desc: 'Screenshots are files on a volume and are served only through the authenticated API. There is no public bucket with guessable URLs and a "please do not index" note.',
    },
    {
      title: '🌍 English + Spanish',
      desc: 'Two hand-rolled dictionaries, because shipping an i18n framework to translate eleven strings is how bundles get fat. RNF-03, if you enjoy requirement IDs.',
    },
    {
      title: '🎯 Triage that fits on one screen',
      desc: 'Login, list, filter, open a report, change its status. That is the whole admin panel. Calm and boring is a feature in operational tooling.',
    },
    {
      title: '🧪 Verified end to end',
      desc: 'One Playwright suite maps to the acceptance criteria and runs on Chromium, Firefox and WebKit. WebKit is there because canvas WebP encoding silently falls back to PNG.',
    },
    {
      title: '🌭 Hotdog-powered',
      desc: 'This card is the only thing on the page with no technical value. It is here for balance. The product does not ship with hotdogs. Steve is not included either.',
    },
  ],

  // Pricing (parody)
  plans: [
    {
      name: 'FREE (BROKE)',
      price: '$0',
      period: 'forever, because it is open source',
      features: [
        'The entire product, unironically',
        'Self-hosted on your own hardware',
        'Unlimited reports (limited by your disk)',
        'All masking primitives',
        'Community support (three people and a duck)',
        'No hotdogs included',
      ],
      cta: 'CLONE THE REPO',
      ctaAction: 'popup',
    },
    {
      name: 'PRO CREATOR',
      price: '$47',
      period: '/month (price increases while you read)',
      features: [
        'Everything in FREE, but you feel seen',
        'A badge that says PRO',
        'Priority support (Steve replies)',
        'Custom branding (your logo + a hotdog)',
        'Advanced masking (solid fill, or solid fill)',
        'Weekly call with Steve',
        '* Blur is a lie, we do not ship it',
      ],
      popular: true,
      cta: 'GET PRO',
      ctaAction: 'call',
    },
    {
      name: 'ENTERPRISE',
      price: '$999',
      period: '/month (call Steve)',
      features: [
        'Everything in Pro, plus a PDF',
        'Dedicated hotdog concierge',
        'On-premise deployment (the only kind we have)',
        'SLA: 99.9% uptime (hotdog not guaranteed)',
        'Integrations that do not exist (Jira, Linear, Excel)',
        'Steve visits your office (travel not included)',
        'Lifetime supply of virtual hotdogs',
      ],
      cta: 'CALL STEVE 📞',
      ctaAction: 'call',
    },
  ],

  // Gallery
  gallery: [
    {
      img: 'thumb-shark.svg',
      alt: 'A shark wearing a headset in front of a fake bug dashboard',
      caption: '"Found the bug. It was a shark. It had a headset."',
    },
    {
      img: 'thumb-omg.svg',
      alt: 'A shocked developer who found a dollar in the production logs',
      caption: '"I FOUND $1 IN THE PRODUCTION LOGS!!!"',
    },
    {
      img: 'thumb-lambo.svg',
      alt: 'A fancy car next to a tiny toy car',
      caption: '"The $1,000,000 bug vs the $1 bug. Guess which one crashed prod."',
    },
    {
      img: 'thumb-minecraft.svg',
      alt: 'A blocky game landscape with a diamond ore',
      caption: '"Diamond ore found in node_modules. Not clickbait."',
    },
    {
      img: 'thumb-cat.svg',
      alt: 'A cat flexing at the gym',
      caption: '"Day 30 of debugging: the cat is now stronger than the codebase."',
    },
    {
      img: 'thumb-toaster.svg',
      alt: 'An evil toaster with glowing eyes',
      caption: '"TOASTER EXPOSED: it was stealing your toast this whole time."',
    },
    {
      img: 'thumb-baguette.svg',
      alt: 'A baguette wearing sunglasses',
      caption: '"Baguette GONE WRONG. The croissant conspiracy is real."',
    },
  ],

  // Reviews
  reviews: [
    {
      text: '"Watchbug changed my life. I used to have 47 bugs. Now I have 47 documented bugs AND a screenshot where the password is a black rectangle. 10/10."',
      author: 'Dave',
      role: 'Senior Bug Collector',
      avatar: 'avatar-1.svg',
    },
    {
      text: '"Finally a bug tracker that understands consent. The destructive masking saved my API keys from my own curiosity. Steve called me once. Nice guy, useless consultant."',
      author: 'Karen',
      role: 'CTO (Chief Taco Officer)',
      avatar: 'avatar-2.svg',
    },
    {
      text: '"The pricing page alone is worth the $47/month. I laughed, then I realised the product is free and self-hosted, then I laughed again. Steve is still calling."',
      author: 'Mike',
      role: 'Full Stack Overflow Developer',
      avatar: 'avatar-1.svg',
    },
    {
      text: '"Not a scam! The prize wheel is totally fair. I won \'47s with Steve\' three times in a row. Still waiting for the call. The hotdogs are imaginary but the masking is real."',
      author: 'Sarah',
      role: 'QA Engineer (Questions Everything)',
      avatar: 'avatar-2.svg',
    },
    {
      text: '"Best $0 I ever spent. The community support is Dave and Karen arguing about tabs versus spaces. Educational AND entertaining. Would self-host again."',
      author: 'Alex',
      role: 'Junior Bug Enthusiast',
      avatar: 'avatar-1.svg',
    },
    {
      text: '"The virus scanner found 47 viruses in my browser. I paid $4.99 to remove them. Turns out they were my open tabs. Worth it for the peace of mind."',
      author: 'Jordan',
      role: 'Tab Hoarder (247 tabs open)',
      avatar: 'avatar-2.svg',
    },
  ],
};
