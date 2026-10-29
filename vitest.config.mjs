import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'forks',
    singleFork: true,
    reporters: ['verbose'],
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      '@watchbug/contracts': resolve(__dirname, 'packages/contracts/src'),
      '@watchbug/sdk': resolve(__dirname, 'packages/sdk/src'),
    },
  },
});