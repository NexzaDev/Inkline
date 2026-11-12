import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  clearScreen: false,
});
