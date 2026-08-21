import { defineConfig } from "vite";

// The bazaar is a library that also runs standalone. `npm run dev` serves the
// demo street with ten stub stalls; `npm run build` emits the library.
export default defineConfig({
  server: { port: 5183, strictPort: false },
  build: {
    lib: {
      entry: "src/index.ts",
      name: "DynawallaBazaar",
      formats: ["es"],
      fileName: () => "bazaar.js",
    },
    sourcemap: true,
  },
});
