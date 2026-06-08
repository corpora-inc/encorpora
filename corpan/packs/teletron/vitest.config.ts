import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@corpan-city/contracts": path.resolve(__dirname, "../corpan-city/contracts/src/index.ts"),
      "@shared/asr": path.resolve(__dirname, "../shared/asr/index.ts"),
      "@shared/moderation": path.resolve(__dirname, "../shared/moderation/index.ts"),
      "@shared/net": path.resolve(__dirname, "../shared/net"),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
  },
})
