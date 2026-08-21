import { defineConfig } from "vite"

export default defineConfig({
  server: { port: 5179, strictPort: true },
  build: {
    target: "es2022",
    // The game is one self-contained bundle; the pack host loads it as a module.
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "horde" },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
