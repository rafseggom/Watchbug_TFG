import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 10000,
    pool: 'forks',
  },
});
