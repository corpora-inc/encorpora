import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 4310, host: "127.0.0.1" },
  build: { target: "es2022", sourcemap: false },
});
