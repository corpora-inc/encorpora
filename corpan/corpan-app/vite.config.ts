import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

import { fileURLToPath, URL } from "url";

// We *can* still read TAURI_DEV_HOST for iOS / future,
// but we always fall back to 0.0.0.0 so Android can reach us.
const rawHost = process.env.TAURI_DEV_HOST;
const serverHost = rawHost || "127.0.0.1";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwind()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: serverHost,

    // Let Vite decide HMR host unless TAURI_DEV_HOST is set.
    // This avoids weirdness like ws://0.0.0.0.
    hmr: rawHost
      ? {
        protocol: "ws",
        host: rawHost,
        port: 1421,
      }
      : undefined,

    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
