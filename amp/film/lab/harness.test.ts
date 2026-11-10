import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Pure subprocess tests are included by the kit's existing film test job.
const directory = fileURLToPath(new URL(".", import.meta.url));

function check(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: directory, encoding: "utf8", timeout: 60_000 });
  expect(result.error, result.error?.message).toBeUndefined();
  expect(result.status, result.stdout+result.stderr).toBe(0);
}

describe("model-lab offline safety and recovery checks", () => {
  it("verifies sampling, privacy, retries, calibration snapshots and accounting", () => {
    check("python3", ["-m", "unittest", "discover", "-s", ".", "-p", "test_*.py"]);
  });
  it("verifies the narration reserve without API calls", () => {
    check(process.execPath, ["--test", "quota-hook.test.mjs"]);
  });
});
