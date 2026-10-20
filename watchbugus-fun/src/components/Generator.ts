/**
 * Bug Generator Component
 */

import { popup } from '../utils/popup.ts';
import { toast } from '../utils/toast.ts';
import { captcha } from './Captcha.ts';

import type { AppState, JokeData } from '../data/types.ts';

export function initGenerator(state: AppState, jokes: JokeData, audio: any): void {
  const form = document.getElementById('gen-form')!;
  const submitBtn = document.getElementById('gen-submit')! as HTMLButtonElement;
  const bugTitle = document.getElementById('bug-title')! as HTMLInputElement;
  const output = document.getElementById('gen-output')!;
  const creditsEl = document.getElementById('credits-count')!;
  const optScreenshot = document.getElementById('opt-screenshot')! as HTMLInputElement;
  const optLogs = document.getElementById('opt-logs')! as HTMLInputElement;
  const optEnv = document.getElementById('opt-env')! as HTMLInputElement;

  let generationCount = 0;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (state.credits <= 0) {
      await audio.play('coupon-expired');
      popup.show({
        title: '🚫 NO CREDITS LEFT 🚫',
        content: `
          <p>You've used all your free credits!</p>
          <p>Options:</p>
          <ul style="text-align:left; margin: 1rem 0;">
            <li>Wait for credits to refill (never)</li>
            <li>Buy Pro Creator for $47/mo</li>
            <li>Book a call with Steve</li>
            <li>Sacrifice a hotdog to the bug gods 🌭</li>
          </ul>
        `,
        confirmText: 'BUY PRO CREATOR',
        onConfirm: () => {
          document.getElementById('notkumar-book')!.click();
        }
      });
      return;
    }

    // Show captcha on first generation
    if (generationCount === 0) {
      captcha.show(() => doGenerate());
      generationCount++;
      return;
    }

    await doGenerate();
  });

  async function doGenerate(): Promise<void> {
    const title = bugTitle.value.trim() || 'Mysterious bug appeared';
    state.credits--;
    creditsEl.textContent = state.credits.toString();

    // Disable button during generation
    submitBtn.disabled = true;
    submitBtn.textContent = 'GENERATING...';
    output.hidden = true;

    // Show loading bar
    const loadingHtml = `
      <div style="text-align:center; padding: 1rem;">
        <div style="height: 20px; background:#eee; border:2px solid #000; border-radius:999px; overflow:hidden; margin-bottom:1rem;">
          <div id="gen-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg,#f00,#ff0,#0f0); transition:width 0.3s;"></div>
        </div>
        <p id="gen-status">Initializing quantum bug detector...</p>
      </div>
    `;
    output.innerHTML = loadingHtml;
    output.hidden = false;

    const statusEl = document.getElementById('gen-status')!;
    const barFill = document.getElementById('gen-bar-fill')!;

    const steps = [
      { progress: 10, text: 'Scanning your codebase for bugs...' },
      { progress: 25, text: 'Consulting the bug oracle...' },
      { progress: 40, text: 'Summoning the debug spirits...' },
      { progress: 55, text: 'Analyzing stack traces in 4D...' },
      { progress: 70, text: 'Generating reproduction steps...' },
      { progress: 85, text: 'Adding fake console logs...' },
      { progress: 95, text: 'Applying hotdog-based masking...' },
      { progress: 100, text: 'BUG REPORT READY!' }
    ];

    for (const step of steps) {
      barFill.style.width = `${step.progress}%`;
      statusEl.textContent = step.text;
      await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    }

    await audio.play('generate-done');

    // Generate the bug report
    const report = generateBugReport(title, optScreenshot.checked, optLogs.checked, optEnv.checked, jokes);
    output.innerHTML = report;
    output.hidden = false;

    // Re-enable button
    submitBtn.disabled = false;
    submitBtn.textContent = 'GENERATE BUG REPORT';

    // Show "Again" button
    const againBtn = document.createElement('button');
    againBtn.className = 'btn btn-big';
    againBtn.textContent = 'AGAIN 🔄';
    againBtn.style.marginTop = '1rem';
    againBtn.addEventListener('click', () => {
      bugTitle.value = '';
      doGenerate();
    });
    output.appendChild(againBtn);

    toast.show(`Bug report generated! ${state.credits} credits left.`);
  }
}

function generateBugReport(
  title: string,
  includeScreenshot: boolean,
  includeLogs: boolean,
  includeEnv: boolean,
  jokes: JokeData
): string {
  const bugId = `WB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];

  let html = `
    <div style="font-family:'Courier New',monospace; font-size:12px; line-height:1.6;">
      <div style="background:#000; color:#0f0; padding:8px; margin:-12px -12px 12px; border-bottom:3px solid #000;">
        <strong>WATCHBUGUS BUG REPORT</strong> <span style="float:right;">${bugId}</span>
      </div>
      <p><strong>Title:</strong> ${escapeHtml(title)}</p>
      <p><strong>Severity:</strong> ${['Critical 🔥', 'High 🚨', 'Medium ⚠️', 'Low 😴', 'Cosmic 🌌'][Math.floor(Math.random() * 5)]}</p>
      <p><strong>Status:</strong> ${['Open', 'In Progress', 'Won\'t Fix', 'Cannot Reproduce', 'Works on My Machine'][Math.floor(Math.random() * 5)]}</p>
      <p><strong>Reported:</strong> ${timestamp}</p>
      <p><strong>Reporter:</strong> Anonymous Hotdog Enthusiast #${Math.floor(Math.random() * 9999)}</p>
  `;

  if (includeScreenshot) {
    html += `
      <p><strong>Screenshot:</strong> <em>[Attached: ${['shark-with-headset.webp', 'cat-gym.webp', 'toaster-exposed.webp', 'baguette-gone-wrong.webp'][Math.floor(Math.random() * 4)]}]</em></p>
      <p><em>Masked regions: 3 password fields, 2 API keys, 1 credit card</em></p>
    `;
  }

  html += `
      <hr style="border-top:2px dashed #000; margin:8px 0;">
      <p><strong>Description:</strong></p>
      <p style="margin-left:1rem;">${jokes.bugDescriptions[Math.floor(Math.random() * jokes.bugDescriptions.length)]}</p>
      <p><strong>Steps to Reproduce:</strong></p>
      <ol style="margin-left:1.5rem;">
        ${jokes.bugReproductions.slice(0, 3).map(step => `<li>${step}</li>`).join('')}
      </ol>
  `;

  if (includeLogs) {
    html += `
      <hr style="border-top:2px dashed #000; margin:8px 0;">
      <p><strong>Console Logs:</strong></p>
      <pre style="background:#111; color:#0f0; padding:8px; border:2px solid #000; overflow:auto; font-size:11px;">
${jokes.fakeLogs.slice(0, 8).join('\n')}
      </pre>
    `;
  }

  if (includeEnv) {
    html += `
      <hr style="border-top:2px dashed #000; margin:8px 0;">
      <p><strong>Environment:</strong></p>
      <pre style="background:#fafafa; padding:8px; border:2px solid #000; font-size:11px;">
${jokes.fakeEnv.map((line, i) => `${i + 1}. ${line}`).join('\n')}
      </pre>
    `;
  }

  html += `
      <hr style="border-top:2px dashed #000; margin:8px 0;">
      <p style="text-align:center; color:#888; font-size:11px;">
        Generated by Watchbugus AI™ (Actually a Human Intern named Dave)<br>
        This report will self-destruct in 24 hours (not really)
      </p>
    </div>
  `;

  return html;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}