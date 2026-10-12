import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static SPA build (INV-03). In development, `/api/*` is proxied straight to the
// API so the panel keeps the same same-origin shape nginx provides in the
// container (A-10) — Phase-5 SameSite=Lax cookies depend on that shape.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
  },
});
