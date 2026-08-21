import { defineConfig } from "vite"

export default defineConfig({
  server: {
    // 1421 is Corpán's, 1423 is dynawalla-app's. Every dev server in this
    // repo must be able to run at the same time, so each game claims its own.
    port: 1437,
    strictPort: true,
    host: "127.0.0.1",
  },
  build: {
    target: "es2020",
    sourcemap: false,
  },
})
