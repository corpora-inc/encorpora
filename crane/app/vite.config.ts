import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const harvest = fileURLToPath(new URL("../../harvest", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  // The app compiles the shared practice engine from source.
  server: { port: 1440, strictPort: true, fs: { allow: [".", harvest] } },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "es2022", chunkSizeWarningLimit: 2500 },
});
