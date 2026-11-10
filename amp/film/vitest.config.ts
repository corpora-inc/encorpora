import { configDefaults, defineConfig } from "vitest/config";

/** Kit tests. The frame check renders in Chrome; the rest do not call a voice or a credential. */
export default defineConfig({
  test: {
    include: ["film/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "film/lab/.work/**"],
    maxWorkers: 2,
    env: { FILM_NO_VOICE: "1" },
  },
});
