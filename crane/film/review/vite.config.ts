/**
 * Builds the crane film review pages as static files. Run from amp/, whose
 * node_modules hold the stage's dependencies:
 *   npx vite build --config ../crane/film/review/vite.config.ts --outDir <dir> --base /lesson-films/crane/
 * No imports here: this file sits outside amp/ and its packages.
 */
const here = new URL(".", import.meta.url).pathname;

export default {
  root: here,
  esbuild: { jsx: "automatic" },
  plugins: [
    {
      // The AMP figures the shared player can draw reach code that hashes with node:crypto; a player never generates.
      name: "film-live-no-crypto",
      enforce: "pre",
      resolveId(id: string) {
        if (id === "node:crypto" || id === "crypto") return "\0film-no-crypto";
      },
      load(id: string) {
        if (id === "\0film-no-crypto") return "export function createHash() { throw new Error('node:crypto is server-only'); } export default {};";
      },
    },
  ],
  build: { emptyOutDir: false },
};
