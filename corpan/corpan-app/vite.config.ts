import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

import fs from "fs";
import path from "path";
import { fileURLToPath, URL } from "url";

// We *can* still read TAURI_DEV_HOST for iOS / future,
// but we always fall back to 0.0.0.0 so Android can reach us.
const rawHost = process.env.TAURI_DEV_HOST;
const serverHost = rawHost || "127.0.0.1";

const gamesRoot = fileURLToPath(new URL("../games", import.meta.url));

const contentTypes: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const serveGames = () => ({
  name: "serve-corpan-games",
  configureServer(server: any) {
    server.middlewares.use("/games", (req: any, res: any, next: any) => {
      if (!req.url) return next();
      const requestPath = decodeURIComponent(req.url.split("?")[0]);
      const filePath = path.join(gamesRoot, requestPath);
      if (!filePath.startsWith(gamesRoot)) {
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
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwind(), serveGames()],
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
