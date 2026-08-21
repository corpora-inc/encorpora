import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwind from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"
import fs from "node:fs"

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8")) as { version: string }

// Tauri injects TAURI_DEV_HOST for device builds (the LAN address the phone or
// tablet must reach). Fall back to loopback for desktop.
//
// This is the ONE thing that takes the dev server off 127.0.0.1, and it is
// opt-in per command rather than a checked-in `host: true`. While it is set,
// every file `server.fs` allows is readable by any host on the network — which
// is what makes the fs guard below load-bearing rather than theoretical.
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
    // NO `fs.allow` widening, deliberately — the dev server's reach is Vite's
    // default, this app's own directory, and nothing beside it.
    //
    // The app used to import the curriculum package's TypeScript source across
    // a directory boundary, which is why this note exists at all. It does not
    // any more: the host ships no content and imports none (ADR-0022), so
    // nothing under `src/` resolves outside this directory and there is nothing
    // for an allow entry to serve.
    //
    // Kept because the finding is not obvious and would be re-derived the next
    // time something reaches across: under Vite 7 a sibling package had to be
    // allow-listed or every one of its modules 403'd in `npm run dev` while
    // `npm run build` (Rollup, no fs guard) succeeded. Vite 8 removed the need —
    // `isFileLoadingAllowed` consults `config.safeModulePaths` BEFORE
    // `fs.allow`, and import analysis adds every specifier it resolves out of an
    // already-served module. Prefer a resolvable package name over re-widening;
    // and note that Vite REPLACES this list rather than extending it, so `"."`
    // would have to be listed alongside anything added.
    fs: {
      // `deny` is replaced wholesale too (`mergeWithDefaultsRecursively` assigns
      // arrays), so Vite's six defaults are restated verbatim and the test above
      // fails the build if one goes missing.
      //
      // The last entry is the addition. `src-tauri/.gitignore` already ignores
      // `*.jks` / `*.p8` / `*.mobileprovision` and `RELEASE_SETUP.md` tells you
      // to generate an upload keystore in this tree — and Vite's default covers
      // `.p12` but none of those three. That material sits INSIDE the allowed
      // root, where narrowing `allow` cannot help, and `TAURI_DEV_HOST` (which
      // on-device Android testing requires) binds this server to the LAN. Deny
      // is checked before allow, so this holds regardless of what allow says.
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem,key,p12,pfx,cer,der}",
        ".npmrc",
        ".yarnrc.yml",
        "**/.git/**",
        "*.{jks,p8,mobileprovision}",
      ],
    },

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
