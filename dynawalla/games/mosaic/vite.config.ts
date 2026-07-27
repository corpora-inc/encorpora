import { defineConfig } from "vite";

// Standard app build: `index.html` is the standalone playable demo (stub host).
// The pack runtime will import `src/index.ts` directly; no lib build needed yet.
export default defineConfig({
  base: "./",
  server: { port: 4180, strictPort: false },
  build: { target: "es2022", assetsInlineLimit: 0 },
});
