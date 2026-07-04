import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      // Capability source imports (cap-squeeze) + framework resolution from
      // THIS pack's node_modules for files under packs/shared/capabilities.
      "@shared/capabilities": path.resolve(__dirname, "../shared/capabilities"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "@dnd-kit/core": path.resolve(__dirname, "node_modules/@dnd-kit/core"),
      zustand: path.resolve(__dirname, "node_modules/zustand"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
})
