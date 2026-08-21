import { fileURLToPath } from "node:url"

import { defineConfig } from "vite"

/**
 * The pack build: only `pack.html`, so the dev harness and the stub host stay
 * out of what is installed on a tablet.
 *
 * `base: "./"` matters — a pack is served from
 * `dynawalla-pack://localhost/<id>/`, and an absolute asset path would resolve
 * to the scheme root rather than to this pack.
 *
 * The input is an absolute path resolved from this file. Vite injects the built
 * module script into an HTML entry only when it recognises the entry as its
 * own; a bare relative string produces a `pack.html` whose source script is
 * stripped and never replaced — a document that loads, paints its body colour,
 * and runs no code at all.
 */
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    outDir: "dist-pack",
    emptyOutDir: true,
    rollupOptions: { input: { pack: fileURLToPath(new URL("./pack.html", import.meta.url)) } },
  },
})
