import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const lane = process.argv[2];
if (
  process.argv.length !== 3 ||
  !["core", "database", "browser"].includes(lane)
)
  throw new Error("Expected core, database or browser");
const plan = JSON.parse(process.env.AMP_CI_PLAN ?? "null");
const selected = plan?.[lane === "browser" ? "browser_scripts" : lane];
if (!Array.isArray(selected) || !selected.length)
  throw new Error("Missing or empty CI test selection");
const suffix = lane === "database" ? ".integration.ts" : ".test.ts";
const allowed = new Set(
  lane === "browser"
    ? Object.entries(
        JSON.parse(readFileSync(new URL("../package.json", import.meta.url)))
          .scripts,
      )
        .filter(([name]) => name.startsWith("test:"))
        .flatMap(([, command]) =>
          [...command.matchAll(/\btsx (scripts\/verify-[\w-]+\.ts)\b/g)].map(
            (match) => match[1],
          ),
        )
    : readdirSync(new URL("../tests/", import.meta.url))
        .filter((name) => name.endsWith(suffix))
        .map((name) => `tests/${name}`),
);
if (selected.some((file) => typeof file !== "string" || !allowed.has(file)))
  throw new Error("Unknown CI test entrypoint");
console.log(`Selected ${lane} checks:\n${selected.join("\n")}`);
const commands =
  lane === "browser"
    ? selected.map((file) => ["--import", "tsx", file])
    : [["--import", "tsx", "--test", ...selected]];
for (const args of commands) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
