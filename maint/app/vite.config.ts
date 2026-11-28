import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// The shared app kit (storage, logging, toasts, the native bridge, voice input)
// lives in harvest/appkit and is compiled from source by every app that uses it.
const appkit = fileURLToPath(new URL("../../harvest/appkit/src", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  resolve: {
    alias: { "@appkit": appkit },
    // appkit has no node_modules of its own: it uses this app's copies.
    dedupe: ["react", "react-dom", "zustand", "@tauri-apps/api"],
  },
  server: { port: 4340, strictPort: true, fs: { allow: [".", appkit] } },
  preview: { port: 4341, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "es2022" },
});
