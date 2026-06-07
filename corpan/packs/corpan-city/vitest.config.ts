import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@corpan-city/contracts": path.resolve(__dirname, "contracts/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
})
