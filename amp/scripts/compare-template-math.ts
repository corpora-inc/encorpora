/** Compare actual web/print MathML with a Git baseline for every template.
 * Run: tsx scripts/compare-template-math.ts origin/main /absolute/report.json
 * Baseline files are extracted to an isolated temporary directory; no checkout
 * or tracked file is changed. Differences fail the check, with no allowlist.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { templates, generateProblem } from "../src/math/engine";
import { MathText } from "../src/web/MathText";
import { PrintMathText } from "../src/content/PrintMathText";
import { learnerTexts } from "../tests/fixtures/math-typography";
import { mathmlMeaning } from "../tests/fixtures/mathml-meaning";

const root = fileURLToPath(new URL("../../", import.meta.url));
const ref = process.argv[2] ?? "origin/main";
const report = resolve(
  process.argv[3] ?? "artifacts/template-math-comparison.json",
);
const revision = execFileSync(
  "git",
  ["-C", root, "rev-parse", "--verify", `${ref}^{commit}`],
  { encoding: "utf8" },
).trim();
const snapshot = mkdtempSync(join(tmpdir(), "amp-math-baseline-"));
const archive = execFileSync(
  "git",
  [
    "-C",
    root,
    "archive",
    revision,
    "amp/src",
    "amp/tests/fixtures",
    "amp/package.json",
    "amp/tsconfig.json",
  ],
  { maxBuffer: 128 * 1024 * 1024 },
);
execFileSync("tar", ["-x", "-C", snapshot], { input: archive });
symlinkSync(
  join(root, "amp/node_modules"),
  join(snapshot, "amp/node_modules"),
  "dir",
);
const load = (path: string) =>
  import(pathToFileURL(join(snapshot, "amp", path)).href);
// tsx can compile files outside the invocation's project with classic JSX.
// Supply that runtime without editing any baseline source.
Object.assign(globalThis, { React });
const baseline = {
  ...(await load("src/math/engine.ts")),
  ...(await load("src/web/MathText.tsx")),
  ...(await load("src/content/PrintMathText.tsx")),
  ...(await load("tests/fixtures/math-typography.ts")),
};
const differences: unknown[] = [];
let surfaces = 0;
let samples = 0;
let renders = 0;
const cache = new Map<string, string>();
function render(Component: typeof MathText, text: string, key: string) {
  const id = `${key}\n${text}`;
  let value = cache.get(id);
  if (value === undefined) {
    // Bound memory during the million-surface sweep. Adjacent template seeds
    // still reuse their repeated text; retaining the entire corpus is needless.
    if (cache.size >= 50_000) cache.clear();
    value = mathmlMeaning(
      renderToStaticMarkup(React.createElement(Component, { text })),
    );
    cache.set(id, value);
    renders++;
  }
  return value;
}
function compare(owner: string, where: string, before: string, after: string) {
  for (const [surface, Old, Current] of [
    ["web", baseline.MathText, MathText],
    ["print", baseline.PrintMathText, PrintMathText],
  ] as const) {
    surfaces++;
    const oldMath = render(Old, before, `old-${surface}`);
    const newMath = render(Current, after, `new-${surface}`);
    if (oldMath !== newMath)
      differences.push({
        owner,
        where,
        surface,
        before,
        after,
        oldMath,
        newMath,
      });
  }
}
// This includes all generated learner-facing fields over 20 seeds, plus static
// methods, principles, lessons and glossary text. Plain titles are not math.
const oldTexts = baseline.learnerTexts() as ReturnType<typeof learnerTexts>;
const currentTexts = learnerTexts();
if (oldTexts.length !== currentTexts.length)
  throw new Error("Corpus surface count changed");
for (let i = 0; i < currentTexts.length; i++) {
  const a = oldTexts[i]!,
    b = currentTexts[i]!;
  if (a.owner !== b.owner || a.where !== b.where || a.plain !== b.plain)
    throw new Error(`Corpus identity changed at ${i}`);
  if (!b.plain) compare(b.owner, `${b.where}/${i}`, a.text, b.text);
  if (i && i % 50_000 === 0) console.log(`${i} learner texts compared`);
}
function problemTexts(problem: ReturnType<typeof generateProblem>): string[] {
  const response = problem.public.response;
  return [
    problem.public.prompt,
    problem.hint,
    ...problem.explanation,
    response.label ?? "",
    ...(response.kind === "choice" ? response.options.map((o) => o.label) : []),
    ...Object.values(problem.choiceFeedback ?? {}),
  ];
}
// Saved version one and each current version also exercise display inventory's
// independent seeds. Render every sample, not one representative per family.
for (const template of templates) {
  for (const version of new Set([1, template.version]))
    for (let seed = 0; seed < 20; seed++) {
      const before = baseline.generateProblem(
        template.id,
        `display-${seed}`,
        version,
      );
      const after = generateProblem(template.id, `display-${seed}`, version);
      samples++;
      const old = problemTexts(before);
      const current = problemTexts(after);
      if (old.length !== current.length)
        throw new Error(`Surface count changed: ${template.id}`);
      for (let i = 0; i < current.length; i++)
        compare(template.id, `${version}/${seed}/${i}`, old[i]!, current[i]!);
    }
  if (samples % 1000 === 0) console.log(`${samples} template samples compared`);
}
mkdirSync(resolve(report, ".."), { recursive: true });
const result = {
  baseline: revision,
  snapshot,
  templates: templates.length,
  learnerTexts: currentTexts.length,
  samples,
  surfaces,
  renders,
  differences: differences.length,
};
writeFileSync(
  report,
  JSON.stringify({ ...result, findings: differences }, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
if (differences.length) process.exitCode = 1;
