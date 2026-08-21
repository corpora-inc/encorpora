import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@shared/capabilities": path.resolve(__dirname, "."),
      "@shared/core": path.resolve(__dirname, "../core"),
      "@shared/data": path.resolve(__dirname, "../data"),
      "@shared/audio": path.resolve(__dirname, "../audio"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "@dnd-kit/core": path.resolve(__dirname, "node_modules/@dnd-kit/core"),
      zustand: path.resolve(__dirname, "node_modules/zustand"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
})
