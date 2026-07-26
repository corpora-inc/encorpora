#!/usr/bin/env node
// `dw-curriculum check`. Re-execs node with type stripping so the same entry point
// works on the pinned Node 24 (where stripping is on by default) and on an older
// Node 22 that still needs the flag.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/validate/cli.ts", import.meta.url));
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--no-warnings=ExperimentalWarning", cli, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
