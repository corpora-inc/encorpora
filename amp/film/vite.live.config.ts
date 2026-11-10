/**
 * Builds the live player and the review page as static files.
 *   npx vite build --config film/vite.live.config.ts --outDir <dir> --base <url path>/
 * The review page (review.html) embeds the player. It does not share the player's source.
 */
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// The figures reach problem generators that hash with node:crypto; a player never generates.
const noCrypto: Plugin = {
  name: "film-live-no-crypto",
  enforce: "pre",
  resolveId(id) {
    if (id === "node:crypto" || id === "crypto") return "\0film-no-crypto";
  },
  load(id) {
    if (id === "\0film-no-crypto") return "export function createHash() { throw new Error('node:crypto is server-only'); } export default {};";
  },
};

export default defineConfig({
  root: new URL(".", import.meta.url).pathname,
  plugins: [noCrypto, react()],
  build: {
    rollupOptions: {
      input: {
        live: new URL("live.html", import.meta.url).pathname,
        review: new URL("review.html", import.meta.url).pathname,
      },
    },
    emptyOutDir: false,
  },
});
