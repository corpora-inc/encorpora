/**
 * `dw-curriculum check` — the curriculum validator.
 *
 * Modes follow GATES.md: **incremental** on PR, **full** nightly. The incremental
 * mode here is seed-scoped rather than diff-scoped, because the graph is four nodes
 * and a diff scoper would be untested machinery guarding nothing. PR-4.6 owns
 * diff scoping, at the point where it starts to matter.
 *
 *   npm run check                    # incremental: 200 seeds per level
 *   npm run check:full               # full sweep: 1000 seeds per level
 *   npm run check -- --report json   # machine-readable
 *   npm run snapshots:update         # rewrite the CG-16 output hashes
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultContext } from "./context.ts";
import type { ShippedIds } from "./context.ts";
import { EMPTY_SNAPSHOT } from "./gates/generatorGates.ts";
import type { Snapshot } from "./gates/generatorGates.ts";
import { runGates } from "./runGates.ts";
import type { GateResult, Report } from "./types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CURRICULUM_SRC = join(HERE, "..");
/**
 * `dynawalla/`, four directories above `src/`:
 * `packs/shared/curriculum/src` → `packs/shared/curriculum` → `packs/shared` →
 * `packs` → `dynawalla`. Named rather than counted inline, because a run of
 * `".."` segments is the thing that silently points at nothing after a move —
 * and a source-scanning gate handed a directory that does not exist scans zero
 * files and passes.
 */
const DYNAWALLA_ROOT = join(CURRICULUM_SRC, "..", "..", "..", "..");
const ENGINE_SRC = join(DYNAWALLA_ROOT, "engine", "src");
const SNAPSHOT_PATH = join(CURRICULUM_SRC, "snapshots", "generators.json");
const SHIPPED_IDS_PATH = join(CURRICULUM_SRC, "graph", "shipped-ids.json");

export const INCREMENTAL_SEEDS = 200;
export const FULL_SEEDS = 1000;

/**
 * The two directories the source-scanning gates read. Exported so the gate tests
 * can assert they exist and hold source — a root that resolves to nothing is a
 * green lint over an empty set.
 */
export const LINT_ROOTS: readonly string[] = [CURRICULUM_SRC, ENGINE_SRC];

export { SHIPPED_IDS_PATH, SNAPSHOT_PATH };

type Options = {
  readonly full: boolean;
  readonly json: boolean;
  readonly update: boolean;
  readonly strictRenderers: boolean;
};

function parseArgs(argv: readonly string[]): Options {
  const args = argv.filter((arg) => arg !== "check");
  const has = (flag: string): boolean => args.includes(flag);
  const reportIndex = args.indexOf("--report");
  const json = has("--json") || (reportIndex >= 0 && args[reportIndex + 1] === "json");
  for (const arg of args) {
    if (
      arg.startsWith("-") &&
      !["--full", "--json", "--report", "--update-snapshots", "--strict-renderers"].includes(arg)
    ) {
      throw new Error(`unknown flag ${arg}`);
    }
  }
  return {
    full: has("--full"),
    json,
    update: has("--update-snapshots"),
    strictRenderers: has("--strict-renderers"),
  };
}

function isNotFound(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && (cause as { code?: unknown }).code === "ENOENT";
}

/**
 * Read a committed JSON input.
 *
 * A gate whose input file cannot be read must never go green. CG-1's immutability
 * check is the one failure in this program that cannot be repaired after ship — a
 * mastery key that moved is a child's history pointing at nothing — and swallowing
 * the read error would quietly turn it into a no-op that still prints `OK`.
 *
 * So a malformed file always throws, and a missing file throws too unless the
 * caller says absence is a legitimate state by passing `whenMissing`. It is for the
 * snapshot file (an empty snapshot makes CG-16 fail loudly with "no committed
 * hash") and it is not for `shipped-ids.json`, which is committed and whose absence
 * is a broken checkout.
 */
export function readJson<T>(path: string, whenMissing?: T): T {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (cause) {
    if (isNotFound(cause) && whenMissing !== undefined) return whenMissing;
    throw new Error(`cannot read ${path}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new Error(`${path} is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

const STATUS_LABEL: Readonly<Record<GateResult["status"], string>> = {
  pass: "pass   ",
  warn: "warn   ",
  fail: "FAIL   ",
  pending: "pending",
};

function printText(report: Report): void {
  const lines: string[] = [];
  lines.push(`dw-curriculum check — ${report.mode}, ${String(report.seedsPerLevel)} seeds per level`);
  lines.push(
    Object.entries(report.stats)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join("  "),
  );
  lines.push("");
  for (const result of report.results) {
    lines.push(`  ${STATUS_LABEL[result.status]} ${result.gate.padEnd(6)} ${result.title}`);
    for (const finding of result.findings) {
      const subject = finding.subject === undefined ? "" : `${finding.subject}: `;
      lines.push(`         ${finding.severity === "error" ? "×" : "!"} ${subject}${finding.message}`);
    }
  }
  lines.push("");
  lines.push(report.ok ? "OK" : "FAILED");
  process.stdout.write(`${lines.join("\n")}\n`);
}

export function main(argv: readonly string[]): number {
  const options = parseArgs(argv);
  const shipped = readJson<ShippedIds>(SHIPPED_IDS_PATH);
  const snapshot = readJson<Snapshot>(SNAPSHOT_PATH, EMPTY_SNAPSHOT);

  const { report, snapshot: next } = runGates({
    context: defaultContext({
      shipped,
      seedsPerLevel: options.full ? FULL_SEEDS : INCREMENTAL_SEEDS,
      strictRenderers: options.strictRenderers,
    }),
    roots: LINT_ROOTS,
    snapshot,
    updateSnapshots: options.update,
    mode: options.full ? "full" : "incremental",
  });

  if (options.update) {
    writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    process.stdout.write(`wrote ${SNAPSHOT_PATH}\n`);
  }

  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else printText(report);

  return report.ok ? 0 : 1;
}

if (process.argv[1] !== undefined && process.argv[1].endsWith("cli.ts")) {
  process.exitCode = main(process.argv.slice(2));
}
