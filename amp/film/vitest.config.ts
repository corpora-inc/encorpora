import { defineConfig } from "vitest/config";

/** Pure kit tests only: no browser rendering, credentials or voice calls. */
export default defineConfig({
  test: { include: ["film/**/*.test.ts"], maxWorkers: 2, env: { FILM_NO_VOICE: "1" } },
});
