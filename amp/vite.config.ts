import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

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

export default defineConfig({
  plugins: [serverOnlyCrypto, react()],
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
  server: { port: 4310, proxy: { "/api": "http://127.0.0.1:4311" } },
  build: { outDir: "dist" },
});
