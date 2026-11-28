import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// The shared app kit (storage, logging, toasts, the native bridge, voice input)
// lives in harvest/appkit and is compiled from source by every app that uses it.
const appkit = fileURLToPath(new URL("../../harvest/appkit/src", import.meta.url));
// The engine's API types, generated from its Rust types (harvest/api/types.ts).
const api = fileURLToPath(new URL("../../harvest/api", import.meta.url));
// Development: the engine (`harvest serve`) answers /api and /asset on 4317; the app stays same-origin.
const engineUrl = process.env.MAINT_ENGINE ?? "http://127.0.0.1:4317";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  resolve: {
    alias: { "@appkit": appkit, "@harvest/api": api },
    // appkit has no node_modules of its own: it uses this app's copies.
    dedupe: ["react", "react-dom", "zustand", "@tauri-apps/api"],
  },
  server: {
    port: 4340,
    strictPort: true,
    fs: { allow: [".", appkit, api] },
    proxy: { "/api": engineUrl, "/asset": engineUrl },
  },
  preview: { port: 4341, strictPort: true, proxy: { "/api": engineUrl, "/asset": engineUrl } },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "es2022" },
});
