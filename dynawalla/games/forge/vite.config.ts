import { defineConfig } from "vite"

// Standalone dev/preview harness for the game. When the shared pack runtime
// lands this package is consumed as a module (`src/mount.ts`) and this config
// only serves the local playtest page.
export default defineConfig({
  clearScreen: false,
  build: {
    // Pinned rather than inherited: Vite 8's `baseline-widely-available`
    // default sits above the iOS 16.0 floor the shipping app promises.
    target: "es2020",
    sourcemap: false,
  },
  server: {
    // 1421 is Corpán's, 1423 is the Dynawalla app's. Games take 143x.
    port: 1431,
    strictPort: true,
    host: "127.0.0.1",
  },
})
