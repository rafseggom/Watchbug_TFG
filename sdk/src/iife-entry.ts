import { createWatchbug } from './index';

const instance = createWatchbug();

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).Watchbug = instance;
}

export default instance;
