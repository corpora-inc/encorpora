import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { earlyOperationsTemplates } from "../src/math/early-operations-practice";
import {
  generatedProblemSchema,
  semanticFigureSchema,
} from "../src/math/contracts";
import { templateRole } from "../src/learning/placement";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { lessons } from "../src/content/lessons";

const ids = earlyOperationsTemplates.map((t) => t.id);
// Figure checks belong to the reprint. The current catalog also draws
// clause tasks whose answer is a choice or structured work.
const sample = (id: string, n = 300) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `early-${i}`, 1));
const unknowns = (value: unknown): number =>
  value === null
    ? 1
    : Array.isArray(value)
      ? value.reduce((s: number, v) => s + unknowns(v), 0)
      : value && typeof value === "object"
        ? Object.values(value).reduce((s: number, v) => s + unknowns(v), 0)
        : 0;

test("early-operation families are deterministic, figured, valid and gradeable", () => {
  for (const id of ids)
    for (const [i, problem] of sample(id).entries()) {
      assert.deepEqual(problem, generateProblem(id, `early-${i}`, 1));
      generatedProblemSchema.parse(problem);
      assert.ok(problem.public.figure, id);
      assert.equal(templateRole(id), "assessment");
      assert.equal(gradeAnswer(problem, problem.answer), true);
      assert.equal(
        gradeAnswer(problem, String(Number(problem.answer) + 1)),
        false,
      );
      // Every figure except three plain groups hides exactly one number.
      if (problem.public.figure!.kind !== "addend-groups")
        assert.equal(unknowns(problem.public.figure), 1, id);
    }
});

test("each figure agrees with its answer", () => {
  const sum = (v: (number | null)[]) =>
    v.reduce<number>((s, x) => s + (x ?? 0), 0);
  for (const p of sample("number-bond-missing")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "number-bond");
    if (f.kind !== "number-bond") continue;
    assert.equal(sum(f.parts) + Number(p.answer), f.whole);
  }
  for (const p of sample("unknown-addend-story")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "bar-model");
    if (f.kind !== "bar-model") continue;
    if (f.whole == null) assert.equal(sum(f.parts), Number(p.answer));
    else assert.equal(sum(f.parts) + Number(p.answer), f.whole);
  }
  for (const p of sample("balanced-addition")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "equal-balance");
    if (f.kind !== "equal-balance") continue;
    const box = f.left.includes(null) ? f.left : f.right,
      other = f.left.includes(null) ? f.right : f.left;
    assert.equal(sum(box) + Number(p.answer), sum(other));
  }
  for (const p of sample("three-addend-story")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "addend-groups");
    if (f.kind !== "addend-groups") continue;
    assert.equal(sum(f.addends), Number(p.answer));
    assert.doesNotMatch(
      p.public.prompt,
      /\b1 (red |blue |green )?(blocks|pages|points)\b/,
    );
  }
  for (const p of sample("two-step-change")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "change-chain");
    if (f.kind !== "change-chain") continue;
    const a = Number(p.answer),
      start = f.start ?? a,
      values = f.steps.map((s) => s.value ?? a),
      end = f.end ?? a;
    let n = start;
    f.steps.forEach((s, i) => (n += s.op === "+" ? values[i]! : -values[i]!));
    assert.equal(n, end);
  }
  assert.throws(() =>
    semanticFigureSchema.parse({
      kind: "equal-balance",
      left: [5, 7],
      right: [4, 8],
    }),
  );
});

test("early-operation items reach every frame", () => {
  const frames = (id: string) =>
    new Set(sample(id, 400).map((p) => p.public.prompt.replace(/\d+/g, "#")));
  assert.ok(frames("number-bond-missing").size >= 4);
  assert.ok(frames("unknown-addend-story").size >= 4);
  assert.ok(frames("balanced-addition").size >= 4);
  assert.ok(frames("three-addend-story").size >= 4);
  assert.ok(frames("two-step-change").size >= 4);
  const tens = sample("three-addend-story", 400).filter((p) => {
    const f = p.public.figure!;
    if (f.kind !== "addend-groups") return false;
    const [a, b, c] = f.addends;
    return a + b === 10 || b + c === 10 || a + c === 10;
  }).length;
  assert.ok(tens > 150, `${tens}`);
});

test("balance, tape and make-ten animations follow the example's figure", () => {
  for (let i = 0; i < 40; i++) {
    const lesson = problemLesson("balanced-addition", `animation-${i}`);
    const m = animationModel(lesson);
    assert.equal(m?.kind, "balance-level");
    if (m?.kind !== "balance-level") continue;
    const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
    assert.equal(sum(m.partial) + Number(lesson.example.answer), sum(m.full));
    assert.equal(animationFrames(m).length, 3);
  }
  let tapes = 0;
  for (let i = 0; i < 40; i++) {
    const lesson = problemLesson("unknown-addend-story", `animation-${i}`);
    const m = animationModel(lesson);
    if (m?.kind !== "tape-join") continue;
    tapes++;
    assert.equal(m.part + Number(lesson.example.answer), m.whole);
  }
  assert.ok(tapes >= 10, `addition tapes ${tapes}`);
  for (let i = 0; i < 40; i++) {
    const lesson = problemLesson("three-addend-story", `animation-${i}`);
    const m = animationModel(lesson);
    assert.equal(m?.kind, "make-ten-three");
    if (m?.kind !== "make-ten-three") continue;
    const frames = animationFrames(m);
    assert.match(frames[2]!.math, new RegExp(`= ${lesson.example.answer}\\$$`));
  }
});

test("current draws grade, and clause tasks use their own answer format", () => {
  const seen = new Set<string>();
  for (const id of [
    "number-bond-missing",
    "three-addend-story",
    "unknown-addend-story",
  ])
    for (let i = 0; i < 80; i++) {
      const problem = generateProblem(id, `live-${i}`);
      assert.equal(gradeAnswer(problem, problem.answer), true, id);
      const task = problem.variant?.axes?.clause;
      if (typeof task === "string" && task !== "legacy")
        seen.add(`${id}:${task}`);
      else {
        assert.ok(problem.public.figure, id);
        assert.equal(
          gradeAnswer(problem, String(Number(problem.answer) + 1)),
          false,
        );
      }
    }
  assert.ok(seen.has("number-bond-missing:two-ways"));
  assert.ok(seen.has("three-addend-story:which-equation"));
  assert.ok(seen.has("unknown-addend-story:subtraction-unknown"));
});

test("every early-operation family has one illustrated lesson", () => {
  for (const id of ids) {
    const bound = lessons.filter((lesson) => lesson.templateIds.includes(id));
    assert.equal(bound.length, 1, id);
    assert.ok(
      bound[0]!.sections.some((s) => s.illustration),
      id,
    );
  }
});

test("independent bus-story oracle accepts counted people and rejects contradictory figures", async () => {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const cases = sample("two-step-change", 256).filter((p) =>
    p.public.prompt.startsWith("A bus"),
  );
  // Include the exact full-inventory failure as well as broad generated cases.
  cases.push(generateProblem("two-step-change", "independent-2", 1));
  const result = spawnSync(
    "python3",
    [
      "-c",
      `
import copy, json, sys
sys.path.insert(0, 'scripts')
from early_operations_math_oracle import solve_early_operations
for case in json.load(sys.stdin):
    public = case['public']
    solved = solve_early_operations(public)
    assert str(solved) == case['answer']
    wrong = copy.deepcopy(public)
    wrong['figure']['steps'][0]['value'] += 1
    try:
        solve_early_operations(wrong)
    except ValueError:
        pass
    else:
        raise AssertionError('Accepted a contradictory figure')
for off, on in [(1, 1), (1, 3), (4, 1), (4, 3)]:
    for named in [True, False]:
        def people(n):
            return (' person' if n == 1 else ' people') if named else ''
        def verb(n):
            return 'gets' if n == 1 else 'get'
        public = {
            'templateId': 'two-step-change',
            'prompt': f'A bus has 20 people. At a stop, {off}{people(off)} {verb(off)} off and then {on}{people(on)} {verb(on)} on. How many people are on the bus now?',
            'figure': {'kind': 'change-chain', 'start': 20, 'steps': [{'op': '−', 'value': off}, {'op': '+', 'value': on}], 'end': None},
        }
        assert solve_early_operations(public) == 20 - off + on
print('bus-story cases:', ${cases.length}, '+ 8 singular/plural/legacy fixtures')
`,
    ],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      input: JSON.stringify(cases),
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
});
