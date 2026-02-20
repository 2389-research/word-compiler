import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    ...(process.env.VITEST ? { conditions: ["browser"] } : {}),
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  optimizeDeps: {
    exclude: [
      "@codemirror/commands",
      "@codemirror/lang-json",
      "@codemirror/language",
      "@codemirror/state",
      "@codemirror/theme-one-dark",
      "@codemirror/view",
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    environmentMatchGlobs: [["tests/ui/**", "jsdom"]],
  },
});
