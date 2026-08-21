import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

import fs from "fs";
import path from "path";
import { fileURLToPath, URL } from "url";

// Relative to this file, not to the working directory, so the config also
// resolves when something other than `npm run dev` loads it (devServer.test.ts).
const pkg = JSON.parse(
  fs.readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8")
);

// Tauri sets TAURI_DEV_HOST to the LAN address a phone or tablet has to reach;
// without it we stay on loopback. (The old comment here claimed a 0.0.0.0
// fallback — it has been 127.0.0.1 for as long as the line below has read that
// way, and the difference is the whole point of the deny list.)
//
// This is the one switch that takes the dev server off loopback. On-device
// Android/iOS testing needs it, and while it is set every file the dev server
// is willing to read is readable by any host on the LAN — which is what makes
// `server.fs.deny` below load-bearing rather than decorative.
const rawHost = process.env.TAURI_DEV_HOST;
const serverHost = rawHost || "127.0.0.1";

// Vite's own `server.fs.deny` default, restated because Vite REPLACES this
// array rather than extending it (`mergeWithDefaultsRecursively` assigns
// arrays), so anything we omit here is silently un-denied.
//
// This is the UNION of Vite 8.0's four defaults (`.env`, `.env.*`,
// `*.{crt,pem}`, `**/.git/**`) and 8.1's wider six. package.json floats on
// `^8.0.0`, so an `npm install` can move between them; a union can only ever
// be stricter than whichever version is actually installed. `devServer.test.ts`
// checks this against the installed Vite instead of trusting the comment.
const VITE_DEFAULT_DENY = [
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**",
];

// The addition, and the reason this block exists.
//
// `src-tauri/` sits INSIDE the dev server's root, `src-tauri/.gitignore`
// ignores `*.jks` because an upload keystore is expected to live there, and
// RELEASE_SETUP.md tells you to create one. Un-committed keeps it off GitHub,
// not off the network. Vite's defaults cover `.p12` (8.1 only) but none of
// these. `allow` cannot help — it is a list of roots, not a subtractive
// filter — but `deny` is checked before `allow`, so this holds regardless.
const SIGNING_MATERIAL_DENY = [
  "*.{jks,keystore,pkcs12,p8,mobileprovision,provisionprofile,certSigningRequest}",
  "*service-account*.json",
];

const DEV_SERVER_DENY = [...VITE_DEFAULT_DENY, ...SIGNING_MATERIAL_DENY];

// The `/packs` middleware below streams files off disk itself and so never
// passes through Vite's `server.fs` guard. Re-check the same material here or
// the guard has a hole shaped like `/packs`.
const DENIED_EXTENSIONS = new Set([
  ".crt", ".pem", ".key", ".p12", ".pfx", ".cer", ".der",
  ".jks", ".keystore", ".pkcs12", ".p8", ".mobileprovision",
  ".provisionprofile", ".certsigningrequest",
]);

const isDeniedFile = (filePath: string) => {
  const name = path.basename(filePath).toLowerCase();
  if (name === ".env" || name.startsWith(".env.")) return true;
  if (name.endsWith(".json") && name.includes("service-account")) return true;
  return DENIED_EXTENSIONS.has(path.extname(name));
};

const packsRoot = fileURLToPath(new URL("../packs", import.meta.url));
const outPacksRoot = fileURLToPath(
  new URL("../../web/io/out/corpan/packs", import.meta.url)
);

const contentTypes: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".zip": "application/zip",
};

const serveStaticFromRoot = (rootDir: string) => (req: any, res: any, next: any) => {
  if (!req.url) return next();
  const requestPath = decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.join(rootDir, requestPath);
  // `rootDir + sep`, not `rootDir`: a bare prefix test also accepts a sibling
  // directory whose name merely starts with the root's ("packs-private").
  if (!filePath.startsWith(rootDir + path.sep) || isDeniedFile(filePath)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return next();
    const ext = path.extname(filePath);
    res.setHeader("Content-Type", contentTypes[ext] ?? "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
};

const servePacks = () => ({
  name: "serve-corpan-packs",
  configureServer(server: any) {
    server.middlewares.use("/packs", serveStaticFromRoot(packsRoot));
    server.middlewares.use("/corpan/packs", serveStaticFromRoot(outPacksRoot));
    server.middlewares.use("/game-proxy", async (req: any, res: any) => {
      try {
        if (!req.url) {
          res.statusCode = 400;
          res.end("Missing url");
          return;
        }
        const urlParam = new URL(req.url, "http://localhost").searchParams.get("url");
        if (!urlParam) {
          res.statusCode = 400;
          res.end("Missing url");
          return;
        }
        const target = new URL(urlParam);
        const response = await fetch(target.toString());
        res.statusCode = response.status;
        const contentType = response.headers.get("content-type");
        if (contentType) {
          res.setHeader("Content-Type", contentType);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        res.end(buffer);
      } catch {
        res.statusCode = 502;
        res.end("Proxy error");
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwind(), servePacks()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    // Force a SINGLE React copy. Without this, vite's dev dep pre-bundling
    // gives @dnd-kit/core its own React instance → "Invalid hook call
    // (more than one copy of React)" → useSensor's useMemo reads a null
    // dispatcher and the whole app crashes to a blank root on the onboarding
    // language-order picker (LanguageSelectOrder). Dev-only (prod bundles
    // react into one vendor chunk), but it hard-blocks local device testing.
    dedupe: ["react", "react-dom"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("../packs/shared", import.meta.url)),
    },
  },

  // Pre-bundle the dnd-kit packages together with the app's React so they
  // share one dispatcher (pairs with resolve.dedupe above).
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/modifiers",
      "@dnd-kit/utilities",
    ],
  },

  clearScreen: false,

  // Production optimizations
  build: {
    target: "es2020", // Modern browsers only, smaller output
    minify: "esbuild", // Fast minification (default, no extra deps needed)
    rollupOptions: {
      output: {
        // Split vendor code for better caching on updates. Vite 8 / Rolldown
        // only accepts the function form of manualChunks (the object form was
        // removed); match on node_modules/<pkg>/ boundaries so "react" doesn't
        // also capture "react-i18next".
        manualChunks(id) {
          if (!id.includes("node_modules")) return
          if (/[\\/]node_modules[\\/](i18next|react-i18next|i18next-http-backend)[\\/]/.test(id)) return "i18n"
          if (/[\\/]node_modules[\\/]@radix-ui[\\/]/.test(id)) return "ui"
          if (/[\\/]node_modules[\\/](react|react-dom|zustand)[\\/]/.test(id)) return "vendor"
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Warn if chunks exceed 1MB
    reportCompressedSize: true, // Show gzip sizes in build output
    sourcemap: false, // Disable source maps in production for smaller size and faster builds
  },

  server: {
    port: 1421,
    strictPort: true,
    host: serverHost,

    fs: {
      // No `allow` entry, deliberately. Vite's default is already this app's
      // own directory (`searchForWorkspaceRoot` finds no workspace marker
      // above it and falls back to the nearest package root), and the app
      // reaches `../packs/shared` through the import graph rather than through
      // `allow` — Vite 8 consults `safeModulePaths` first. Listing anything
      // here replaces that default and would have to restate `"."` too.
      deny: DEV_SERVER_DENY,
    },

    // Extra Host-header names the dev server should answer to (e.g. a
    // tailscale MagicDNS name when testing from another device):
    //   VITE_ALLOWED_HOSTS=spark-f62c,.tail3c0d12.ts.net npx vite --host 0.0.0.0
    allowedHosts: process.env.VITE_ALLOWED_HOSTS
      ? process.env.VITE_ALLOWED_HOSTS.split(",").map((h) => h.trim())
      : undefined,

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
