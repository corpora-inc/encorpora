// The harness bundle. Built by `tools/capture.mjs`, never by `npm run build`.
//
// Deliberately a second, separate build rather than a second entry in the app's
// own config: nothing a capture tool needs may change what ships. The app's
// `vite.config.ts` is untouched by this file's existence.

import { fileURLToPath, URL } from "node:url"

import react from "@vitejs/plugin-react"
import tailwind from "@tailwindcss/vite"
import { defineConfig } from "vite"

const here = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  root: here,
  // The prefix the capture server mounts this bundle at. NOT "./": the harness
  // document is served from `/__capture/pass.html` so that the seed script can
  // be injected into it, and relative asset paths would resolve against
  // `/__capture/`, where the app's own dist is mounted — a 404 for every asset
  // and a blank screenshot that looks like a component that renders nothing.
  base: "/__harness/",
  plugins: [react(), tailwind()],
  define: {
    // `platform.ts` reads this. Nothing the harness renders imports it today,
    // but a component that starts to would otherwise fail at module load with
    // a bare ReferenceError.
    __APP_VERSION__: JSON.stringify("capture"),
  },
  build: {
    outDir: fileURLToPath(new URL("../.harness-dist", import.meta.url)),
    emptyOutDir: true,
    // The app's floor, restated: a capture taken from a bundle compiled to a
    // newer baseline is not a capture of the shipped app.
    target: "es2020",
    sourcemap: false,
  },
})
