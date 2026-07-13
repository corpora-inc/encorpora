import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

import fs from "fs";
import path from "path";
import { fileURLToPath, URL } from "url";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

// We *can* still read TAURI_DEV_HOST for iOS / future,
// but we always fall back to 0.0.0.0 so Android can reach us.
const rawHost = process.env.TAURI_DEV_HOST;
const serverHost = rawHost || "127.0.0.1";

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
  if (!filePath.startsWith(rootDir)) {
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
