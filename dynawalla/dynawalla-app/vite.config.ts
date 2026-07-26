import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwind from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"
import fs from "node:fs"

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8")) as { version: string }

// Tauri injects TAURI_DEV_HOST for device builds (the LAN address the phone or
// tablet must reach). Fall back to loopback for desktop.
const devHost = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react(), tailwind()],

  // Read by src/app/platform.ts so the version renders in a plain browser too,
  // where there is no Tauri IPC to ask.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  clearScreen: false,

  build: {
    // The oldest WebView we ship to is the one on a stock Android 8 device
    // (minSdk 26) that has never taken a WebView update. es2020 is what that
    // engine parses; Vite's default baseline target is newer.
    target: "es2020",
    sourcemap: false,
  },

  server: {
    // 1421 is Corpán's. Both dev servers must be able to run at once.
    port: 1423,
    strictPort: true,
    host: devHost || "127.0.0.1",
    hmr: devHost ? { protocol: "ws", host: devHost, port: 1423 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
})
