import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@corpan-city/contracts": path.resolve(__dirname, "contracts/src/index.ts"),
      "@shared/moderation": path.resolve(__dirname, "../shared/moderation/index.ts"),
      "@shared/monetization": path.resolve(__dirname, "../shared/monetization/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: [
      "**/*.test.ts",
      "../shared/moderation/**/*.test.ts",
      "../shared/monetization/**/*.test.ts",
      "../shared/net/**/*.test.ts",
    ],
  },
})
