import { createRoot } from 'react-dom/client';

// Phase-1 Step 0 tooling shell (Q-08): proves `vite build` runs under the pinned
// Vite 8 + React 19 + TypeScript toolchain before any real panel code exists.
// Step 5 replaces this with the two-column list/detail entry point (P1-D-04).
const container = document.getElementById('root');
if (!container) {
  throw new Error('Watchbug panel: #root container missing from index.html');
}

createRoot(container).render(<h1>Watchbug</h1>);
