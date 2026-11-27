import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const harvest = fileURLToPath(new URL("../../harvest", import.meta.url));
const content = fileURLToPath(new URL("../content", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  // The app compiles the shared practice engine and the crane content tools from source.
  server: { port: 1440, strictPort: true, fs: { allow: [".", harvest, content] } },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "es2022", chunkSizeWarningLimit: 2500 },
});
