import { defineConfig } from "vite";

// LAST SIGNAL — Vite config.
// base is "./" so the built game can be hosted anywhere (e.g. GitHub Pages).
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    open: false,
  },
});
