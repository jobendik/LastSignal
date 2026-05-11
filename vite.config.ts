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
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (normalized.includes("vite/preload-helper")) return "chunk-preload";
          if (normalized.includes("/node_modules/")) return "chunk-vendor";
          if (
            normalized.endsWith("/src/systems/ConsentSystem.ts") ||
            normalized.endsWith("/src/ui/ConsentModal.ts")
          ) {
            return "chunk-consent";
          }
          if (normalized.endsWith("/src/ui/dom.ts")) return "chunk-dom";
          if (normalized.endsWith("/src/core/Config.ts")) return "chunk-config";
          if (
            normalized.endsWith("/src/data/codex.ts") ||
            normalized.endsWith("/src/data/help.ts")
          ) {
            return "chunk-text";
          }
          if (
            normalized.endsWith("/src/data/sectors.ts") ||
            normalized.endsWith("/src/data/waves.ts")
          ) {
            return "chunk-sector";
          }
          if (normalized.endsWith("/src/data/training.ts")) return "chunk-training";
          if (
            normalized.includes("/src/ui/") &&
            !normalized.endsWith("/src/ui/LoadingScreen.ts") &&
            !normalized.endsWith("/src/ui/ConsentModal.ts") &&
            !normalized.endsWith("/src/ui/CodexPanel.ts") &&
            !normalized.endsWith("/src/ui/dom.ts")
          ) {
            return "chunk-ui";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
