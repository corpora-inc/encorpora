// Fast inner-loop tests: run only the tests a change can affect, plus the
// registry invariants every template change must keep. CI still runs the
// full core and content suites; this is for iterating, not for merging.
//
//   node scripts/test-related.mjs            # changes since origin/main, incl. uncommitted
//   node scripts/test-related.mjs --list     # print the selection only
//   node scripts/test-related.mjs --content  # also run the catalog-wide content sweeps
//   AMP_RELATED_BASE=<ref> node scripts/test-related.mjs
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
for (const a of args)
  if (!["--list", "--content"].includes(a))
    throw new Error(`Unexpected argument ${a}`);

const root = fileURLToPath(new URL("../", import.meta.url));
const testsDir = join(root, "tests");
const base = process.env.AMP_RELATED_BASE ?? "origin/main";

const git = (...a) =>
  execFileSync("git", ["-C", root, ...a], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
const top = git("rev-parse", "--show-toplevel")[0];
const changed = new Set(
  [
    ...git("diff", "--name-only", `${base}...HEAD`),
    ...git("diff", "--name-only", "HEAD"),
    ...git("ls-files", "--others", "--exclude-standard", "--full-name"),
  ]
    .map((p) => resolve(top, p))
    .filter((p) => p.startsWith(root) && existsSync(p)),
);

// Registry invariants: any new, moved or changed template can break these.
const always = [
  "curriculum",
  "coverage",
  "family-index",
  "gap-ledger",
  "historical-templates",
  "lesson-text",
  "offline",
  "selection-policy",
  "source-reconciliation",
  "template-glossary",
];
// Catalog-wide sweeps (slow). Opt in with --content; CI always runs them.
const content = [
  "grammar",
  "instance-hints",
  "math-typography",
  "problem-lessons",
  "glossary-baseline",
  "plain-language",
];

const stem = (p) =>
  p
    .split("/")
    .pop()
    .replace(/\.(test\.)?(tsx?|mjs|py)$/, "")
    .replace(/_math_oracle$/, "")
    .replace(/_/g, "-");
const changedStems = new Set([...changed].map(stem));
const resolveImport = (from, spec) => {
  if (!spec.startsWith(".")) return null;
  const abs = resolve(dirname(from), spec);
  for (const c of [abs, `${abs}.ts`, `${abs}.tsx`, join(abs, "index.ts")])
    if (existsSync(c)) return c;
  return null;
};

const selected = new Set(
  [...always, ...(args.has("--content") ? content : [])].map(
    (s) => `${s}.test.ts`,
  ),
);
for (const name of readdirSync(testsDir)) {
  if (!name.endsWith(".test.ts")) continue;
  const file = join(testsDir, name);
  const s = stem(name);
  if (changed.has(file)) selected.add(name);
  // tests/angle-practice.test.ts follows src/math/angle-practice.ts, and
  // tests/grade4-data.test.ts follows src/families/grade4-data.ts.
  else if (
    [...changedStems].some(
      (c) => c === s || c.startsWith(`${s}-`) || s.startsWith(`${c}-`),
    )
  )
    selected.add(name);
  else {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/from\s+["']([^"']+)["']/g)) {
      const target = resolveImport(file, m[1]);
      if (target && changed.has(target)) {
        selected.add(name);
        break;
      }
    }
  }
}
const list = [...selected].filter((n) => existsSync(join(testsDir, n))).sort();
process.stdout.write(
  `test:related (${base}): ${changed.size} changed files -> ${list.length} test files\n${list.map((n) => `  ${n}`).join("\n")}\n`,
);
if (args.has("--list")) process.exit(0);
const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    ...list.map((n) => relative(root, join(testsDir, n))),
  ],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
