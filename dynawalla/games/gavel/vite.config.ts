import { defineConfig } from "vite"

// The game is a library that mounts into a host element. `npm run dev` serves
// the standalone harness in `index.html`, which wires it to the local stub Host
// so the whole thing is playable with no runtime underneath it.
export default defineConfig({
  server: { port: 4362, host: "127.0.0.1", strictPort: true },
  build: {
    target: "es2022",
    lib: {
      entry: "src/index.ts",
      name: "DynawallaGameGavel",
      formats: ["es"],
      fileName: () => "gavel.js",
    },
  },
})
