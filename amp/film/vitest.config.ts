import { configDefaults, defineConfig } from "vitest/config";

/** Pure kit tests only: no browser rendering, credentials or voice calls. */
export default defineConfig({
  test: {
    include: ["film/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "film/lab/.work/**"],
    maxWorkers: 2,
    env: { FILM_NO_VOICE: "1" },
  },
});
