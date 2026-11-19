import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  generateProblem,
  generateProblemFor,
  gradeAnswer,
  templates,
} from "../src/math/engine";
import {
  figureCapabilities,
  generatedProblemSchema,
  responseCapabilities,
} from "../src/math/contracts";
import {
  diagramMarks,
  structuralProblem,
  type StructuredWorkResponse,
} from "../src/math/structured-work";

/* "Use aligned columns": version 3 writes the result's digits in their
   columns, with a regrouping mark only where regrouping changes a column.
   Versions 1 and 2 replay exactly as saved. */
const id = "multidigit-decimal-sum";
const columnsOf = (seed: string, version?: number) => {
  const p = generateProblem(id, seed, version);
  const r = p.public.response;
  return r.kind === "structured-work" ? { p, r } : null;
};

test("the template is version 3 and still reprints from version 1", () => {
  const meta = templates.find((t) => t.id === id)!;
  assert.equal(meta.version, 3);
  assert.equal(meta.reprintsFrom, 1);
});

test("saved version 1 and 2 problems reproduce byte for byte", () => {
  // The digest of 300 seeds at each version, generated on main before
  // version 3 (7fd3147f0).
  const out: string[] = [];
  for (const v of [1, 2])
    for (let i = 0; i < 300; i++)
      out.push(JSON.stringify(generateProblem(id, `r-${i}`, v)));
  assert.equal(
    createHash("sha256").update(out.join("\n")).digest("hex"),
    "47c67a72034dab5f92ffada5396419ea68011ab8c3cacab095c7ddf43a728f0d",
  );
  for (let i = 0; i < 40; i++) {
    const old = columnsOf(`r-${i}`, 2);
    if (!old) continue;
    assert.equal(old.r.diagram, undefined, "version 2 has no columns");
    assert.equal(old.p.public.templateVersion, 2);
    assert.ok(gradeAnswer(old.p, old.p.answer));
  }
});

test("version 3 writes every digit in its column and grades each one", () => {
  const problems = Array.from({ length: 600 }, (_, i) =>
    columnsOf(`cols-${i}`),
  ).filter((x) => x !== null);
  assert.ok(problems.length > 150, `${problems.length} column problems`);
  let marked = 0,
    plain = 0,
    tens = 0;
  for (const { p, r } of problems) {
    assert.ok(generatedProblemSchema.safeParse(p).success);
    assert.equal(p.public.templateVersion, 3);
    const d = r.diagram;
    assert.equal(d?.kind, "columns");
    if (d?.kind !== "columns") continue;
    assert.equal(structuralProblem(r), null);
    // The point sits in its own column on every line.
    const point = d.answer.findIndex((c) => "given" in c && c.given === ".");
    assert.ok(d.lines.every((l) => l[point] === "."));
    if (d.marks.some(Boolean)) marked++;
    else plain++;
    if (point === 2) tens++;
    // Right answers earn credit; one wrong digit is marked on its own.
    assert.ok(gradeAnswer(p, p.answer));
    const key = JSON.parse(p.answer) as string[][];
    const wrong = key.map((row) => [...row]);
    wrong[0]![wrong[0]!.length - 1] = String(
      (Number(wrong[0]!.at(-1)) + 1) % 10,
    );
    const response = JSON.stringify(wrong);
    assert.equal(gradeAnswer(p, response), false);
    const each = diagramMarks(r, response, p.answer)!;
    assert.equal([...each.values()].filter((ok) => !ok).length, 1);
  }
  assert.ok(
    marked > 40 && plain > 10 && tens > 0,
    JSON.stringify({ marked, plain, tens }),
  );
});

test("the founder's 2.32 − 1.31 asks for the three digits and no regrouping", () => {
  const found = Array.from({ length: 4000 }, (_, i) =>
    columnsOf(`founder-${i}`),
  ).find(
    (x) =>
      x && x.p.public.prompt === "Use aligned columns to find $2.32-1.31$.",
  );
  if (!found) return; // the draw is random; the rule is checked above
  const d = (found.r as StructuredWorkResponse).diagram!;
  assert.equal(d.kind, "columns");
  if (d.kind !== "columns") return;
  assert.deepEqual(d.marks, [null, null, null, null]);
  assert.equal(found.p.answer, JSON.stringify([["1"], ["0"], ["1"]]));
});

test("an independent oracle agrees with every version 3 problem", () => {
  const cases = Array.from({ length: 400 }, (_, i) => {
    const x = columnsOf(`oracle-${i}`);
    return x ? { public: x.p.public, answer: x.p.answer } : null;
  }).filter(Boolean);
  const result = spawnSync(
    "python3",
    [
      "-I",
      "-c",
      `
import copy, json, sys
sys.path.insert(0, 'scripts')
import clause_place_value_math_oracle as oracle
cases = json.load(sys.stdin)
rejected = 0
for case in cases:
    oracle.review_problem(case)
    altered = copy.deepcopy(case)
    key = json.loads(altered['answer'])
    key[-1][-1] = str((int(key[-1][-1]) + 1) % 10)
    altered['answer'] = json.dumps(key)
    try:
        oracle.review_problem(altered)
    except ValueError:
        rejected += 1
assert rejected == len(cases), (rejected, len(cases))
print(len(cases))
`,
    ],
    {
      cwd: new URL("..", import.meta.url).pathname,
      input: JSON.stringify(cases),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60_000,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.ok(Number(result.stdout.trim()) > 100, result.stdout);
});

test("a client that does not draw a column method is served version 2", () => {
  const seed = Array.from({ length: 50 }, (_, i) => `client-${i}`).find(
    (s) => columnsOf(s) !== null,
  )!;
  const older = responseCapabilities.filter((c) => c !== "work-columns-v1");
  const served = (caps: readonly string[]) =>
    generateProblemFor(id, seed, [...figureCapabilities], undefined, caps);
  const now = served(responseCapabilities);
  assert.equal(now.public.templateVersion, 3);
  assert.equal(
    now.public.response.kind === "structured-work" &&
      now.public.response.diagram?.kind,
    "columns",
  );
  assert.deepEqual(served(older), generateProblem(id, seed, 2));
});
