import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

const serverCrypto = "\0server-only:node-crypto";
/** The browser bundle reaches server-only problem generators (which hash with
 * node:crypto) through the family registry. The dev server cannot externalize
 * a named import, so it would fail to load every page and verification
 * harness; the production build already stubs it. Generation always runs on
 * the server, so a browser call is a bug and fails loudly. */
const serverOnlyCrypto: Plugin = {
  name: "amp-server-only-crypto",
  apply: "serve",
  enforce: "pre",
  resolveId(id, _importer, options) {
    if (!options?.ssr && (id === "node:crypto" || id === "crypto"))
      return serverCrypto;
  },
  load(id) {
    if (id === serverCrypto)
      return `export function createHash() {
  throw new Error("node:crypto is server-only: generate problems on the server.");
}`;
  },
};

/** Local media fixtures (synthetic test patterns) for development and browser
 * verification only. The production build never contains them. */
const fixtureTypes: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".vtt": "text/vtt",
};
const devFixtures: Plugin = {
  name: "amp-dev-fixtures",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/__amp-fixtures/pitch/", (request, response) => {
      const name = (request.url ?? "").split("?")[0].replace(/^\//, "");
      const type = fixtureTypes[extname(name)];
      if (!/^pitch-fixture[a-z-]*\.[a-z0-9]+$/.test(name) || !type) {
        response.statusCode = 404;
        response.end();
        return;
      }
      const bytes = readFileSync(
        fileURLToPath(
          new URL(`scripts/fixtures/pitch/${name}`, import.meta.url),
        ),
      );
      // Byte ranges, so every engine can seek and report duration.
      const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? "");
      response.setHeader("Content-Type", type);
      response.setHeader("Accept-Ranges", "bytes");
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Number(range[2]) : bytes.length - 1;
        response.statusCode = 206;
        response.setHeader(
          "Content-Range",
          `bytes ${start}-${end}/${bytes.length}`,
        );
        response.end(bytes.subarray(start, end + 1));
        return;
      }
      response.end(bytes);
    });
  },
};

export default defineConfig({
  plugins: [serverOnlyCrypto, devFixtures, react()],
  optimizeDeps: {
    entries: ["index.html"],
    include: [
      "react",
      "react-dom/client",
      "@tanstack/react-router",
      "@tanstack/react-query",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-toast",
      "zod",
      "zustand",
      "zustand/middleware",
      "better-auth/client",
      "better-auth/client/plugins",
      "@better-auth/passkey/client",
      "oidc-client-ts",
      "@tauri-apps/api/core",
      "@tauri-apps/api/event",
      "katex",
    ],
  },
  // A preview on other ports (scripts/design-preview.sh) sets both.
  server: {
    port: Number(process.env.AMP_WEB_PORT ?? 4310),
    proxy: {
      "/api": `http://127.0.0.1:${process.env.AMP_API_PORT ?? 4311}`,
    },
  },
  build: { outDir: "dist" },
});
