import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

/**
 * The pack build: only `pack.html`, so the standalone entry and the stub host
 * stay out of what is installed on a tablet.
 *
 * `base: "./"` matters — a pack is served from
 * `dynawalla-pack://localhost/<id>/`, and an absolute asset path would resolve
 * to the scheme root rather than to this pack.
 */
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    assetsInlineLimit: 100000,
    outDir: "dist-pack",
    emptyOutDir: true,
    // An absolute path, resolved from this file. Vite injects the built module
    // script into an HTML entry only when it recognises the entry as its own;
    // a bare relative string produced a `pack.html` with the source script
    // stripped and nothing put back — a document that loads, paints its body
    // colour, and runs no code at all.
    rollupOptions: { input: { pack: fileURLToPath(new URL("./pack.html", import.meta.url)) } },
  },
});
