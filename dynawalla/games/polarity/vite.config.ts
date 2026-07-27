import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 4211, strictPort: false },
  build: { target: "es2022", assetsInlineLimit: 100000 },
});
