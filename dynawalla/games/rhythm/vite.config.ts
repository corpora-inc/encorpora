import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    // The game is one self-contained chunk; a pack loader fetches it whole.
    rollupOptions: { output: { manualChunks: undefined } },
  },
  server: { host: "127.0.0.1", port: 5183, strictPort: false },
});
