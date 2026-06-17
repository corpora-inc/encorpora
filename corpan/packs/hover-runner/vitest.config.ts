import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@shared/ui": path.resolve(__dirname, "../shared/ui"),
      "@shared/state": path.resolve(__dirname, "../shared/state"),
      "@shared/monetization": path.resolve(__dirname, "../shared/monetization/index.ts"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/", "dist/", "scripts/"],
    },
  },
})
