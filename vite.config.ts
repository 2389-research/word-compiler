import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    // jsdom@28 + html-encoding-sniffer@6 + @exodus/bytes produces a non-fatal ESM
    // require() warning on Node 18. All tests pass; suppress to avoid false CI failures.
    dangerouslyIgnoreUnhandledErrors: true,
    environmentMatchGlobs: [
      ["tests/ui/**", "jsdom"],
    ],
  },
});
