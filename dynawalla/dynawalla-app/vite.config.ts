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
    // Pinned, not inherited. Vite 8's default is `baseline-widely-available`
    // — chrome111 / safari16.4 / ios16.4 — which sits *above* the iOS 16.0
    // floor this app's bundle config promises, and a Vite upgrade moves it
    // again without a word.
    //
    // The real floor is iOS 16.0 and, on Android, a WebView kept current
    // through Play. minSdk 26 does not mean the 2017 engine in an Android 8
    // system image: React 19 does not run there at all, and neither does the
    // emitted bundle, which contains `??` (Chrome 80). A device that installs
    // from Play has an updated WebView; one that cannot is not a device this
    // app ships to.
    target: "es2020",
    sourcemap: false,
  },

  server: {
    // 1421 is Corpán's. Both dev servers must be able to run at once.
    port: 1423,
    strictPort: true,
    host: devHost || "127.0.0.1",
    // Spread rather than `hmr: undefined`: the option is optional, not
    // nullable, and this project is checked with `exactOptionalPropertyTypes`.
    ...(devHost ? { hmr: { protocol: "ws" as const, host: devHost, port: 1423 } } : {}),
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
})
