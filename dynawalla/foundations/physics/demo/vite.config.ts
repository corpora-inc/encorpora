import { defineConfig } from "vite"

// The demo is served from this directory, which sits BELOW the package root, so
// `fs.allow` has to reach up one level to see `src/` and `node_modules/`.
// 1425 keeps out of the way of Corpán (1421) and the Dynawalla app (1423).
export default defineConfig({
  server: { port: 1425, strictPort: true, fs: { allow: [".."] } },
  build: { target: "es2020" },
})
