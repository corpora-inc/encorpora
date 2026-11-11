import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("guards narration quota and transcription with fake responses", () => {
  const result = spawnSync(process.execPath, ["--test", "quota-hook.test.mjs"], {
    cwd: fileURLToPath(new URL(".", import.meta.url)), encoding: "utf8", timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 35_000);
