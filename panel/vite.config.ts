import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "../backend/api/static/panel",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
