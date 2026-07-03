// Bare-harness dev server (capability-modules.md §7.2).
// Run from packs/shared/capabilities:  npm run harness:<name>
// On the Spark bind 0.0.0.0 and open http://spark-f62c:5199/
import { defineConfig } from "vite"
import path from "node:path"

const capabilities = path.resolve(__dirname, "../..")

export default defineConfig({
  server: { port: 5199, host: "0.0.0.0" },
  resolve: {
    alias: {
      "@shared/capabilities": capabilities,
      "@shared/core": path.resolve(capabilities, "../core"),
      "@shared/data": path.resolve(capabilities, "../data"),
      "@shared/audio": path.resolve(capabilities, "../audio"),
      react: path.resolve(capabilities, "node_modules/react"),
      "react-dom": path.resolve(capabilities, "node_modules/react-dom"),
      "@dnd-kit/core": path.resolve(capabilities, "node_modules/@dnd-kit/core"),
      zustand: path.resolve(capabilities, "node_modules/zustand"),
    },
  },
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
})
