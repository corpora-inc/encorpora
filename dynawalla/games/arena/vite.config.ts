import { defineConfig } from "vite"

export default defineConfig({
  server: { port: 5188, strictPort: true, host: "127.0.0.1" },
  preview: { port: 4188, strictPort: true, host: "127.0.0.1" },
  build: { target: "es2022", outDir: "dist" },
})
