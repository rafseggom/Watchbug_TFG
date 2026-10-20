/**
 * Cookie Banner Component
 */

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

export function initCookie(_state: AppState): void {
  const banner = document.getElementById('cookie-banner')!;
  const acceptBtn = document.getElementById('cookie-accept')!;
  const rejectBtn = document.getElementById('cookie-reject')!;

  // Check if already accepted
  const accepted = localStorage.getItem('watchbugus_cookies');
  if (accepted) {
    return;
  }

  // Show banner after 2 seconds
  setTimeout(() => {
    banner.hidden = false;
    requestAnimationFrame(() => {
      banner.classList.add('show');
    });
  }, 2000);

  acceptBtn.addEventListener('click', () => {
    localStorage.setItem('watchbugus_cookies', 'accepted');
    hideBanner();
  });

  rejectBtn.addEventListener('click', () => {
    localStorage.setItem('watchbugus_cookies', 'rejected');
    hideBanner();
    // Chaotic transform on reject
    setTimeout(() => {
      rejectBtn.style.transform = `translate(${Math.random() * 200 - 100}px, ${Math.random() * 100 - 50}px) rotate(${Math.random() * 30 - 15}deg)`;
    }, 100);
  });

  // Chaotic hover on reject
  rejectBtn.addEventListener('mouseenter', () => {
    rejectBtn.style.transform = `translate(${Math.random() * 100 - 50}px, ${Math.random() * 50 - 25}px) rotate(${Math.random() * 20 - 10}deg)`;
  });

  rejectBtn.addEventListener('mouseleave', () => {
    rejectBtn.style.transform = '';
  });

  function hideBanner(): void {
    banner.classList.remove('show');
    setTimeout(() => {
      banner.hidden = true;
    }, 400);
  }
}