import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, '..'),
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 10000,
    pool: 'forks',
  },
});
