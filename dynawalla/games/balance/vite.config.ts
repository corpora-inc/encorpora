import { defineConfig } from "vite";

// Standalone dev/preview shell for the Counterpoise game package.
// The shipped artefact is `src/index.ts` -> `mount(el, host)`; this config only
// exists so the game is playable on its own with `npm run dev`.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
  },
  server: {
    port: 5211,
    strictPort: true,
  },
});
