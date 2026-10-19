import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
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
