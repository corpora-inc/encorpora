import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const suite = process.argv[2];
const listOnly = process.argv[3] === "--list";
if (process.argv.length > (listOnly ? 4 : 3))
  throw new Error("Unexpected arguments");
if (!["core", "inventory", "all"].includes(suite)) {
  throw new Error("Expected test suite: core, inventory, or all");
}
const root = fileURLToPath(new URL("../", import.meta.url));
const inventory = "independent-review.test.ts";
const tests = readdirSync(new URL("../tests/", import.meta.url))
  .filter((name) => name.endsWith(".test.ts"))
  .filter(
    (name) =>
      suite === "all" || (name === inventory) === (suite === "inventory"),
  )
  .sort();
if (tests.length === 0) throw new Error(`Empty ${suite} test suite`);
if (listOnly) {
  process.stdout.write(JSON.stringify(tests) + "\n");
  process.exit(0);
}
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...tests.map((name) => `tests/${name}`)],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
