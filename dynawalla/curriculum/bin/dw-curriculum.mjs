#!/usr/bin/env node
// `dw-curriculum check`. Re-execs node with type stripping so the same entry point
// works on the pinned Node 24 (where stripping is on by default) and on an older
// Node 22 that still needs the flag.
//
// The library it validates lives in `../packs/shared/curriculum` — packs consume
// it from there through the `@shared` alias, and this workspace exists only to
// give it devDependencies and commands.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../../packs/shared/curriculum/src/validate/cli.ts", import.meta.url));
if (!existsSync(cli)) {
  // Loudly, rather than spawning node on a path that does not exist and reading
  // whatever it makes of that. A validator that cannot find what it validates
  // must never be mistaken for a validator with nothing to report.
  process.stderr.write(`dw-curriculum: cannot find the curriculum library at ${cli}\n`);
  process.exit(2);
}
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--no-warnings=ExperimentalWarning", cli, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
