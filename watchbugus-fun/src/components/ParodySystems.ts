/**
 * Parody Systems Component - Fake systems, achievements, challenges, notifications
 */

import { audio } from '../utils/audio.ts';
import { chaos } from '../utils/chaos.ts';
import { popup } from '../utils/popup.ts';
import { toast } from '../utils/toast.ts';

import type { AppState } from '../data/types.ts';

const STATUS_ITEMS = [
  { key: 'cpu', label: 'CPU USAGE', base: 47, variance: 15, unit: '%', okThreshold: 80 },
  { key: 'ram', label: 'RAM USAGE', base: 62, variance: 10, unit: '%', okThreshold: 85 },
  { key: 'disk', label: 'DISK SPACE', base: 34, variance: 5, unit: '%', okThreshold: 90 },
  { key: 'bugs', label: 'BUGS QUEUED', base: 1247, variance: 100, unit: '', okThreshold: 10000, reverse: true },
  { key: 'hotdogs', label: 'HOTDOGS EATEN', base: 47, variance: 5, unit: '', okThreshold: 0, reverse: true },
  { key: 'uptime', label: 'UPTIME', base: 99.9, variance: 0.05, unit: '%', okThreshold: 99.5 },
];

const ACHIEVEMENTS = [
  { id: 'first-bug', name: 'First Bug', desc: 'Submitted your first bug report', icon: '🐛', unlocked: true },
  { id: 'hotdog-lover', name: 'Hotdog Lover', desc: 'Clicked the hotdog button 10 times', icon: '🌭', unlocked: true },
  { id: 'night-owl', name: 'Night Owl', desc: 'Used Watchbugus at 3 AM', icon: '🦉', unlocked: false },
  { id: 'bug-squasher', name: 'Bug Squasher', desc: 'Fixed 100 bugs (in your dreams)', icon: '🔨', unlocked: false },
  { id: 'steve-friend', name: 'Steve\'s Friend', desc: 'Talked to Steve for 10 minutes', icon: '📞', unlocked: false },
  { id: 'wheel-master', name: 'Wheel Master', desc: 'Won the rigged prize wheel', icon: '🎰', unlocked: false },
  { id: 'virus-survivor', name: 'Virus Survivor', desc: 'Survived the fake virus scan', icon: '🦠', unlocked: false },
  { id: 'chaos-agent', name: 'Chaos Agent', desc: 'Triggered 50 chaotic events', icon: '🤡', unlocked: false },
];

const DAILY_CHALLENGES = [
  { title: 'Submit 3 fake bug reports', reward: '+50 XP', action: 'generate' },
  { title: 'Click the hotdog button 5 times', reward: '+25 XP', action: 'hotdog' },
  { title: 'Spin the rigged prize wheel', reward: '+100 XP', action: 'wheel' },
  { title: 'Talk to Steve for 2 minutes', reward: '+75 XP', action: 'call' },
  { title: 'Survive the virus scanner', reward: '+50 XP', action: 'virus' },
  { title: 'Earn 3 achievements today', reward: '+200 XP', action: 'achieve' },
];

const BUGS_OF_DAY = [
  { title: 'Button click deletes production database', severity: 'Critical 🔥', desc: 'User clicked "Save" and the entire database vanished. The button was labeled "Delete All Data" but in Comic Sans so nobody noticed.', reporter: 'Dave from Accounting' },
  { title: 'Dark mode makes text invisible', severity: 'High 🚨', desc: 'Background: #000. Text: #000. Contrast ratio: 1:1. Designer said "it\'s a feature, not a bug - privacy by default!"', reporter: 'Sarah the Designer' },
  { title: 'API returns 418 I\'m a teapot', severity: 'Medium ⚠️', desc: 'Backend dev was drinking tea when writing the middleware. Now all POST requests return tea status. Cannot reproduce without Earl Grey.', reporter: 'Mike the Intern' },
  { title: 'Scrolling up goes down', severity: 'High 🚨', desc: 'CSS transform: rotate(180deg) on the body element. Users now scroll with their mouse upside down. Accessibility team furious.', reporter: 'Accessibility Karen' },
  { title: 'Typing "a" deletes user account', severity: 'Critical 🔥', desc: 'Event listener for keydown "a" triggers DELETE /api/user. The "a" stands for "annihilate". Hotfix: renamed key to "b".', reporter: 'Security Steve' },
];

const NOTIFICATION_TEMPLATES = [
  { type: 'success', title: 'Bug report generated!', msg: 'Your fake bug report has been queued for processing (never).' },
  { type: 'warning', title: 'System load high', msg: 'CPU at 94%. Consider sacrificing a hotdog to the server gods.' },
  { type: 'error', title: 'Hotdog shortage', msg: 'Virtual hotdog inventory depleted. Restocking in 47 minutes.' },
  { type: 'success', title: 'Achievement unlocked!', msg: 'You earned "Chaos Agent" - triggered 50 chaotic events!' },
  { type: 'warning', title: 'Steve is calling', msg: 'Steve from Accounting wants to talk about your bugs. Answer or face the consequences.' },
  { type: 'success', title: 'Daily challenge complete!', msg: 'You earned +50 XP! Tomorrow: "Survive the virus scanner".' },
  { type: 'error', title: 'Virus detected', msg: 'Trojan:Win32/HotdogStealer.A found in your cookies. Pay $4.99 to remove.' },
  { type: 'success', title: 'Prize wheel spun', msg: 'You won "47s WITH KUMAR"! (It\'s rigged, everyone wins this)' },
];

export function initParodySystems(state: AppState): void {
  initSystemStatus();
  initAchievements();
  initDailyChallenge();
  initBugOfDay();
  initNotifications();
  initLoadBarAnimation();
  startRandomNotifications();
  startSystemStatusUpdates();
}

function initSystemStatus(): void {
  const grid = document.getElementById('status-grid')!;
  
  STATUS_ITEMS.forEach(item => {
    const div = document.createElement('div');
    div.className = 'status-item';
    div.id = `status-${item.key}`;
    div.innerHTML = `
      <div class="label">${item.label}</div>
      <div class="value" data-key="${item.key}">${item.base}${item.unit}</div>
    `;
    grid.appendChild(div);
  });
}

function initLoadBarAnimation(): void {
  const loadBar = document.getElementById('load-bar')!;
  const loadPercent = document.getElementById('load-percent')!;
  
  let currentLoad = 0;
  let targetLoad = Math.random() * 30 + 20; // 20-50%
  
  function animateLoad(): void {
    if (currentLoad < targetLoad) {
      currentLoad += Math.random() * 2 + 0.5;
      if (currentLoad > targetLoad) currentLoad = targetLoad;
    } else if (currentLoad > targetLoad) {
      currentLoad -= Math.random() * 1.5 + 0.2;
      if (currentLoad < targetLoad) currentLoad = targetLoad;
    }
    
    // Randomly change target
    if (Math.random() < 0.02) {
      targetLoad = Math.random() * 60 + 10; // 10-70%
    }
    
    loadBar.style.width = `${Math.min(100, Math.max(0, currentLoad))}%`;
    loadPercent.textContent = `${Math.round(currentLoad)}%`;
    
    // Color based on load
    if (currentLoad > 80) {
      loadBar.style.background = 'linear-gradient(90deg,#f00,#f90)';
    } else if (currentLoad > 50) {
      loadBar.style.background = 'linear-gradient(90deg,#ff0,#f90)';
    } else {
      loadBar.style.background = 'linear-gradient(90deg,#0f0,#ff0)';
    }
    
    requestAnimationFrame(animateLoad);
  }
  
  animateLoad();
}

function initAchievements(): void {
  const grid = document.getElementById('achievement-grid')!;
  
  ACHIEVEMENTS.forEach(achievement => {
    const div = document.createElement('div');
    div.className = `achievement ${achievement.unlocked ? 'unlocked' : 'locked'}`;
    div.id = `achievement-${achievement.id}`;
    div.innerHTML = `
      <span class="achievement-icon">${achievement.icon}</span>
      <div>
        <div class="achievement-text">${achievement.name}</div>
        <div style="font-size:0.7rem;color:#888;">${achievement.desc}</div>
      </div>
    `;
    grid.appendChild(div);
  });
}

function initDailyChallenge(): void {
  const content = document.getElementById('challenge-content')!;
  const challenge = DAILY_CHALLENGES[Math.floor(Math.random() * DAILY_CHALLENGES.length)];
  
  content.innerHTML = `
    <p style="text-align:center;margin-bottom:1rem;font-size:1.1rem;">${challenge.title}</p>
    <p style="text-align:center;color:#c00;font-weight:700;font-family:'Courier New',monospace;margin-bottom:1rem;">Reward: ${challenge.reward}</p>
    <button id="challenge-btn" class="btn btn-big challenge-btn" data-action="${challenge.action}">START CHALLENGE</button>
  `;
  
  const btn = document.getElementById('challenge-btn')!;
  btn.addEventListener('click', () => handleChallengeAction(challenge.action));
}

function handleChallengeAction(action: string): void {
  switch (action) {
    case 'generate':
      document.getElementById('bug-title')!.focus();
      document.getElementById('generator')!.scrollIntoView({ behavior: 'smooth' });
      break;
    case 'hotdog':
      document.getElementById('kumar-link')!.click();
      break;
    case 'wheel':
      window.dispatchEvent(new CustomEvent('watchbugus:wheel'));
      break;
    case 'call':
      window.dispatchEvent(new CustomEvent('watchbugus:call'));
      break;
    case 'virus':
      const virusScanner = document.getElementById('virus-scanner')!;
      virusScanner.hidden = false;
      break;
    case 'achieve':
      toast.show('Earn more achievements by exploring the site!');
      break;
  }
  audio.play('generate-start');
  toast.show(`Challenge started: ${action}!`);
}

function initBugOfDay(): void {
  const content = document.getElementById('bug-of-day-content')!;
  const bug = BUGS_OF_DAY[Math.floor(Math.random() * BUGS_OF_DAY.length)];
  
  content.innerHTML = `
    <div class="bug-of-day-info">
      <h4>${bug.title}</h4>
      <p style="margin-bottom:0.5rem;"><strong>Severity:</strong> ${bug.severity}</p>
      <p style="margin-bottom:0.5rem;">${bug.desc}</p>
      <div class="bug-of-day-meta">Reported by: ${bug.reporter}</div>
    </div>
    <button id="bug-day-view" class="btn btn-big bug-of-day-btn">VIEW DETAILS (FAKE)</button>
  `;
  
  const btn = document.getElementById('bug-day-view')!;
  btn.addEventListener('click', () => {
    document.getElementById('bug-title')!.value = bug.title;
    document.getElementById('generator')!.scrollIntoView({ behavior: 'smooth' });
    audio.play('generate-start');
  });
}

function initNotifications(): void {
  const panel = document.getElementById('notifications-panel')!;
  const list = document.getElementById('notifications-list')!;
  const closeBtn = document.getElementById('notifications-close')!;
  
  // Show panel after 5 seconds
  setTimeout(() => {
    panel.classList.remove('hidden');
    showRandomNotification();
  }, 5000);
  
  closeBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
  });
  
  // Periodic notifications
  setInterval(() => {
    if (Math.random() < 0.3) {
      showRandomNotification();
      if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        setTimeout(() => panel.classList.add('hidden'), 10000);
      }
    }
  }, 30000);
}

function showRandomNotification(): void {
  const list = document.getElementById('notifications-list')!;
  const template = NOTIFICATION_TEMPLATES[Math.floor(Math.random() * NOTIFICATION_TEMPLATES.length)];
  
  const div = document.createElement('div');
  div.className = `notification ${template.type}`;
  div.innerHTML = `
    <div class="notification-title">${template.title}</div>
    <div>${template.msg}</div>
    <div class="notification-time">${new Date().toLocaleTimeString()}</div>
  `;
  
  list.insertBefore(div, list.firstChild);
  
  // Limit to 10 notifications
  while (list.children.length > 10) {
    list.lastChild!.remove();
  }
  
  // Play sound based on type
  if (template.type === 'error') {
    audio.play('coupon-expired');
  } else if (template.type === 'success') {
    audio.play('generate-done');
  } else {
    audio.play('wheel-tick');
  }
}

function startRandomNotifications(): void {
  // Already handled in initNotifications
}

function startSystemStatusUpdates(): void {
  const statusElements = document.querySelectorAll('.status-item .value');
  
  setInterval(() => {
    statusElements.forEach(el => {
      const key = (el as HTMLElement).dataset.key;
      const item = STATUS_ITEMS.find(i => i.key === key);
      if (!item) return;
      
      const current = parseFloat(el.textContent?.replace('%', '') || '0');
      let change = (Math.random() - 0.5) * item.variance * 0.2;
      let newValue = current + change;
      
      // Clamp
      if (item.unit === '%') {
        newValue = Math.max(0, Math.min(100, newValue));
      } else if (item.reverse) {
        newValue = Math.max(0, newValue);
      }
      
      el.textContent = item.unit ? `${newValue.toFixed(item.unit === '%' ? 1 : 0)}${item.unit}` : Math.round(newValue).toLocaleString();
      
      // Update status class
      const parent = el.closest('.status-item')!;
      parent.classList.remove('ok', 'warn');
      if (item.reverse) {
        if (newValue > item.okThreshold) parent.classList.add('ok');
      } else {
        if (newValue < item.okThreshold) parent.classList.add('ok');
        else if (newValue > item.okThreshold * 0.9) parent.classList.add('warn');
      }
    });
  }, 3000);
}