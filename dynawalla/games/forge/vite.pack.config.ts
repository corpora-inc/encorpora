import { fileURLToPath } from "node:url"

import { defineConfig } from "vite"

/**
 * The pack build.
 *
 * Separate from `vite.config.ts` because the two artefacts are different
 * things: that one is the standalone workbench with the stub host in it, this
 * one is what gets installed on a child's tablet. Only `pack.html` is an entry,
 * so `main.ts` and `stub/host.ts` are not in the bundle at all.
 *
 * `base: "./"` is not cosmetic — the pack is served from
 * `dynawalla-pack://localhost/<id>/`, and an absolute `/assets/…` would resolve
 * to the scheme root and 404 for every pack but the first.
 */
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    outDir: "dist-pack",
    emptyOutDir: true,
    // An absolute path, resolved from this file. Vite injects the built module
    // script into an HTML entry only when it recognises the entry as its own;
    // a bare relative string produced a `pack.html` with the source script
    // stripped and nothing put back — a document that loads, paints its body
    // colour, and runs no code at all.
    rollupOptions: { input: { pack: fileURLToPath(new URL("./pack.html", import.meta.url)) } },
  },
})
