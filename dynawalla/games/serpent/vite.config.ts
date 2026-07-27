import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5291, strictPort: true },
  build: {
    target: "es2022",
    lib: {
      entry: "src/index.ts",
      name: "DynawallaSerpent",
      formats: ["es"],
      fileName: () => "serpent.js",
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
