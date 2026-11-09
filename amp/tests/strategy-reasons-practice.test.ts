import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import {
  FLAW_KINDS,
  FLAW_POSITIONS,
  STEP_VARIANTS,
  WRITTEN_VARIANTS,
  generateStrategyReasons,
  optionWords,
  strategyOptionCodes,
  strategyReasonsTemplates,
} from "../src/math/strategy-reasons-practice";

/**
 * 2.NBT.B.9: reasons, flaws and the meaning of written marks. Arithmetic is
 * re-read from the prompt text here; the generator's own models are used only
 * to read the misconception codes, never to decide a key.
 */
const IDS = [
  "strategy-step-reason",
  "strategy-flaw",
  "written-method-meaning",
  "written-method-reason",
] as const;
const many = (id: string, n: number, prefix = "t") =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `${prefix}-${i}`));

/** Integer value of "38 + 25 - 2". */
function value(expr: string): number {
  const tokens = expr.replaceAll("−", "-").match(/[-+]|\d+/g) ?? [];
  let total = Number(tokens[0]),
    sign = 1;
  for (const t of tokens.slice(1))
    if (t === "+" || t === "-") sign = t === "+" ? 1 : -1;
    else total += sign * Number(t);
  return total;
}
/** Every $left = right$ in a text. */
const equationsIn = (text: string) =>
  [...text.matchAll(/\$([^$]+)\$/g)]
    .map((m) => m[1]!)
    .filter((span) => span.includes("=") && !span.includes("\\"))
    .map(
      (span) => span.split("=").map((side) => side.trim()) as [string, string],
    );
const notebookLines = (prompt: string) =>
  prompt.split("\n").filter((line) => /^Line \d: /.test(line));
/** The prose the learner reads around the notebook or stack. */
const prose = (prompt: string) =>
  prompt
    .split("\n")
    .filter(
      (line) => !/^Line \d: /.test(line) && !line.includes("\\begin{array}"),
    )
    .join(" ");

test("the four templates are registered for explain-strategies with their capabilities", () => {
  for (const id of IDS) {
    const t = templates.find((x) => x.id === id);
    assert.ok(t, id);
    assert.equal(t.skillId, "explain-strategies");
    assert.equal(t.gradeBand, "K–2");
  }
  const capability = Object.fromEntries(
    strategyReasonsTemplates.map((t) => [t.id, t.requiredResponseCapability]),
  );
  assert.deepEqual(capability, {
    "strategy-step-reason": "single-choice-v1",
    "strategy-flaw": "multi-part-choice-v1",
    "written-method-meaning": "figure-choice-v1",
    "written-method-reason": "single-choice-v1",
  });
});

test("every problem is schema-valid, deterministic and of one response kind", () => {
  const kind = {
    "strategy-step-reason": "choice",
    "strategy-flaw": "multi-part-choice",
    "written-method-meaning": "figure-choice",
    "written-method-reason": "choice",
  } as const;
  for (const id of IDS)
    for (const p of many(id, 120)) {
      generatedProblemSchema.parse(p);
      assert.equal(p.public.response.kind, kind[id], id);
      assert.deepEqual(generateProblem(id, p.public.seed), p);
      assert.deepEqual(
        generateStrategyReasons(id, p.public.seed),
        generateStrategyReasons(id, p.public.seed),
      );
    }
});

test("every variant, flaw and line position is reached in balance", () => {
  const count = (
    problems: GeneratedProblem[],
    key: (p: GeneratedProblem) => string,
  ) => {
    const m = new Map<string, number>();
    for (const p of problems) m.set(key(p), (m.get(key(p)) ?? 0) + 1);
    return m;
  };
  const steps = count(
    many("strategy-step-reason", 1000, "r"),
    (p) => p.variant!.id,
  );
  assert.deepEqual([...steps.keys()].sort(), [...STEP_VARIANTS].sort());
  for (const [v, n] of steps) assert.ok(n >= 60, `${v}: ${n}`);
  const flaws = many("strategy-flaw", 1000, "r");
  const kinds = count(flaws, (p) => p.variant!.axes!.flaw!);
  assert.deepEqual([...kinds.keys()].sort(), [...FLAW_KINDS].sort());
  const lines = count(flaws, (p) => p.variant!.axes!.line!);
  for (const line of ["line-1", "line-2", "line-3"])
    assert.ok((lines.get(line) ?? 0) >= 250, `${line}: ${lines.get(line)}`);
  for (const [at, list] of Object.entries(FLAW_POSITIONS))
    for (const kind of list)
      assert.ok(
        flaws.some((p) => p.variant!.id === `${kind}-line-${at}`),
        `${kind} on line ${at}`,
      );
  const written = count(
    many("written-method-meaning", 400, "r"),
    (p) => p.variant!.id,
  );
  assert.deepEqual([...written.keys()].sort(), [...WRITTEN_VARIANTS].sort());
  for (const [v, n] of written) assert.ok(n >= 60, `${v}: ${n}`);
  const reason = many("written-method-reason", 200, "r");
  assert.ok(
    reason.some(
      (p) =>
        /under the \d, not/.test(p.public.prompt) &&
        /write the \d under/.test(p.public.prompt),
    ),
  );
  assert.ok(
    reason.some((p) => /write the \d of \d+ under/.test(p.public.prompt)),
  );
});

test("the correct option sits in every position", () => {
  for (const id of [
    "strategy-step-reason",
    "written-method-reason",
    "written-method-meaning",
  ]) {
    const positions = new Map<string, number>();
    for (const p of many(id, 800, "pos"))
      positions.set(p.answer, (positions.get(p.answer) ?? 0) + 1);
    assert.equal(positions.size, 4, id);
    for (const [pos, n] of positions) assert.ok(n >= 140, `${id} ${pos}: ${n}`);
  }
  const why = new Map<string, number>();
  for (const p of many("strategy-flaw", 800, "pos")) {
    const key = JSON.parse(p.answer) as { why: string };
    why.set(key.why, (why.get(key.why) ?? 0) + 1);
  }
  for (const [pos, n] of why) assert.ok(n >= 140, `flaw reason ${pos}: ${n}`);
});

test("readability: short prompts, matched option lengths, no property names", () => {
  const forbidden = /commutative|associative|regroup|algorithm/i;
  for (const id of IDS)
    for (const p of many(id, 200, "read")) {
      const text = prose(p.public.prompt);
      const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
      // The head line and the question; a borrow states its marks in one more.
      assert.ok(sentences.length <= 3, `${id}: ${text}`);
      assert.ok(
        sentences.every((s) => optionWords(s) <= 25),
        `${id}: ${text}`,
      );
      assert.doesNotMatch(p.public.prompt, forbidden);
      const r = p.public.response;
      const labels =
        r.kind === "choice"
          ? r.options.map((o) => o.label)
          : r.kind === "multi-part-choice"
            ? r.blanks[1]!.options.map((o) => o.label)
            : [];
      for (const label of labels) assert.doesNotMatch(label, forbidden);
      if (r.kind === "choice") {
        const words = labels.map(optionWords);
        assert.ok(Math.max(...words) <= 12, `${id}: ${labels.join(" | ")}`);
        assert.ok(
          Math.max(...words) - Math.min(...words) <= 3,
          `${id}: ${labels.join(" | ")}`,
        );
      }
      if (r.kind === "multi-part-choice")
        assert.ok(labels.every((l) => l.length <= 80));
    }
});

test("each option carries its own misconception code", () => {
  for (const id of IDS)
    for (let i = 0; i < 60; i++) {
      const seed = `codes-${i}`;
      const codes = strategyOptionCodes(id, seed);
      const values = Object.values(codes);
      assert.equal(new Set(values).size, values.length, `${id} ${seed}`);
      assert.equal(values.filter((c) => c === "correct").length, 1);
      const p = generateProblem(id, seed);
      if (id === "strategy-flaw")
        assert.equal(
          codes[(JSON.parse(p.answer) as { why: string }).why],
          "correct",
        );
      else assert.equal(codes[p.answer], "correct", `${id} ${seed}`);
    }
});

test("reason notebooks show only true arithmetic and reach the true result", () => {
  for (const p of many("strategy-step-reason", 400, "arith")) {
    for (const line of notebookLines(p.public.prompt))
      for (const [left, right] of equationsIn(line))
        assert.equal(value(left), value(right), `${p.public.seed}: ${line}`);
    const head = p.public.prompt.split("\n")[0]!;
    const sum = head.match(/adds \$([\d +]+)\$ like this/);
    const diff = head.match(/subtracts \$(\d+) - (\d+)\$ like this/);
    const all = notebookLines(p.public.prompt).flatMap(equationsIn);
    const last = all.at(-1)!;
    if (sum) assert.equal(value(last[1]), value(sum[1]!), p.public.prompt);
    if (diff)
      assert.equal(
        value(last[1]),
        Number(diff[1]) - Number(diff[2]),
        p.public.prompt,
      );
  }
});

test("a flawed notebook has one wrong line, a wrong result, and an unsingled correct reason", () => {
  for (const p of many("strategy-flaw", 400, "flaw")) {
    const head = p.public.prompt.split("\n")[0]!;
    const lines = notebookLines(p.public.prompt);
    assert.equal(lines.length, 3);
    const claimed = lines[2]!.match(/(\d+)\$?\.?$/)!;
    const work = head.match(
      /^One line of \w+'s work for \$([^$]+)\$ is wrong\.$/,
    );
    assert.ok(work, head);
    const truth = value(work[1]!);
    assert.notEqual(Number(claimed[1]), truth, p.public.prompt);
    // Every line before the flawed one is true; a false line is never earlier.
    const falseAt = lines.findIndex((line) =>
      equationsIn(line).some(([l, r]) => value(l) !== value(r)),
    );
    const key = JSON.parse(p.answer) as { line: string; why: string };
    const keyed = "abc".indexOf(key.line);
    assert.ok(keyed >= 0, p.answer);
    if (falseAt >= 0) assert.ok(falseAt >= keyed, p.public.prompt);
    const response = p.public.response;
    assert.equal(response.kind, "multi-part-choice");
    if (response.kind !== "multi-part-choice") continue;
    const reasons = response.blanks[1]!.options;
    const correct = reasons.find((o) => o.id === key.why)!.label;
    const numbersOf = (s: string) => new Set(s.match(/\d+/g) ?? []);
    for (const n of numbersOf(correct))
      assert.ok(
        reasons.some((o) => o.id !== key.why && numbersOf(o.label).has(n)),
        `${p.public.seed}: only the correct reason names ${n}: ${reasons.map((o) => o.label).join(" | ")}`,
      );
  }
});

test("written marks: the keyed blocks keep the amount and match the marks", () => {
  for (const p of many("written-method-meaning", 400, "marks")) {
    const r = p.public.response;
    assert.equal(r.kind, "figure-choice");
    if (r.kind !== "figure-choice") continue;
    assert.equal(r.noun, "Picture");
    const blocks = (id: string) => {
      const e = r.options.find((o) => o.id === id)!.scene
        .elements[0] as unknown as {
        type: string;
        hundreds: number;
        tens: number;
        ones: number;
      };
      assert.equal(e.type, "baseTen");
      return e;
    };
    for (const o of r.options) {
      const e = blocks(o.id);
      assert.ok(e.tens <= 19 && e.ones <= 19 && e.hundreds <= 9);
      assert.match(o.label, /^Base-ten blocks: /);
    }
    const key = blocks(p.answer);
    const carry = p.public.prompt.match(
      /wrote a small 1 above the (tens|hundreds)/,
    );
    if (carry) {
      assert.deepEqual(
        [key.hundreds, key.tens, key.ones],
        carry[1] === "tens" ? [0, 1, 0] : [1, 0, 0],
      );
      continue;
    }
    const top = Number(p.public.prompt.match(/subtracted \$(\d+) - /)![1]);
    assert.equal(100 * key.hundreds + 10 * key.tens + key.ones, top);
    assert.ok(key.ones >= 10, "the traded ten is now ones");
    // The marks above the stack are exactly the keyed counts.
    const marks = [
      ...p.public.prompt.matchAll(
        /\\scriptstyle (?:\\cancel\{10\}\\,)?(\d+)\}/g,
      ),
    ].map((m) => Number(m[1]));
    assert.deepEqual(
      marks,
      [key.hundreds, key.tens, key.ones].slice(3 - marks.length),
    );
    if (marks.length === 3) {
      // The stopped-early picture shows the same amount but not the marks.
      const same = r.options.filter((o) => {
        const e = blocks(o.id);
        return 100 * e.hundreds + 10 * e.tens + e.ones === top;
      });
      assert.equal(same.length, 2, p.public.prompt);
    }
  }
});

test("the independent oracle agrees on 256 seeds of every template and rejects corruptions", () => {
  const cases = IDS.flatMap((id) =>
    Array.from({ length: 256 }, (_, i) =>
      generateProblem(id, `independent-${i}`),
    ),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import copy, json, sys
sys.path.insert(0, 'scripts')
import strategy_reasons_math_oracle as oracle
print(oracle.self_test())
cases = json.load(sys.stdin)
seen = set()
rejected = 0
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer'], problem['public']['seed']
    assert oracle.solve(problem['public']) == problem['answer']
    template = problem['public']['templateId']
    if template in seen:
        continue
    seen.add(template)
    bad = copy.deepcopy(problem)
    response = bad['public']['response']
    if response['kind'] == 'multi-part-choice':
        key = json.loads(bad['answer'])
        key['why'] = next(o['id'] for o in response['blanks'][1]['options'] if o['id'] != key['why'])
        bad['answer'] = json.dumps(key, separators=(',', ':'))
    else:
        bad['answer'] = next(o['id'] for o in response['options'] if o['id'] != bad['answer'])
    try:
        oracle.review_problem(bad)
    except ValueError:
        rejected += 1
print({'cases': len(cases), 'templates': len(seen), 'rejected': rejected})
`,
    ],
    {
      cwd: new URL("..", import.meta.url).pathname,
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'mutations': 8/);
  assert.match(result.stdout, /'cases': 1024, 'templates': 4, 'rejected': 4/);
});
