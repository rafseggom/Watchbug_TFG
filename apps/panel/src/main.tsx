import { createRoot } from 'react-dom/client';
import './tokens.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Watchbug panel: #root container missing from index.html');
}

createRoot(container).render(<App />);
