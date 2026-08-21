import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 4178, strictPort: false },
  build: { target: "es2022", assetsInlineLimit: 0 },
});
