import { reportEditorialLimit } from "./fixtures/editorial";
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { gradeStructuredWork } from "../src/math/structured-work";
import {
  matrixEquationSystemCase,
  matrixEquationSystemGenerate,
  matrixEquationSystemTemplates,
} from "../src/math/matrix-equation-system-practice";
import type { GeneratedProblem } from "../src/math/contracts";

/* An independent reader of the public payload: equations and matrices are
 * parsed from the prompt TeX, never taken from the generator's model. */
const V = ["x", "y", "z"];
type Eq = { coef: number[]; c: number };

function side(text: string): number[] {
  // [x, y, z, constant]
  const out = [0, 0, 0, 0];
  if (text === "0") return out;
  for (const m of text.matchAll(/([+-]?)(\d*)([xyz]?)/g)) {
    if (!m[0]) continue;
    const sign = m[1] === "-" ? -1 : 1;
    const k = m[2] === "" ? 1 : Number(m[2]);
    if (m[3]) out[V.indexOf(m[3])]! += sign * k;
    else out[3]! += sign * k;
  }
  return out;
}
/** `ax + by (+ cz) = c` with the first written unknown's coefficient kept. */
function parseEquation(tex: string, n: number): Eq {
  const [l, r] = tex.split("=") as [string, string];
  const L = side(l),
    R = side(r);
  const coef = V.slice(0, n).map((_, j) => L[j]! - R[j]!);
  let c = R[3]! - L[3]!;
  const first = /[xyz]/.exec(tex)![0];
  const j = V.indexOf(first);
  const writtenOnLeft = /[xyz]/.test(l) && l.includes(first);
  const written = writtenOnLeft ? L[j]! : R[j]!;
  if (Math.sign(written) !== Math.sign(coef[j]!)) {
    for (let k = 0; k < n; k++) coef[k] = -coef[k]!;
    c = -c;
  }
  return { coef, c };
}
const matrices = (tex: string) =>
  [...tex.matchAll(/\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}/g)].map((m) =>
    m[1]!.split("\\\\").map((row) => row.split("&")),
  );
const numbers = (m: string[][]) => m.map((row) => row.map(Number));
const caseLines = (tex: string) =>
  /\\begin\{cases\}(.*?)\\end\{cases\}/.exec(tex)![1]!.split("\\\\");
const proportional = (p: number[], q: number[]) => {
  const i = p.findIndex((v) => v !== 0);
  if (i < 0 || q[i] === 0) return false;
  return p.every((v, k) => v * q[i]! === q[k]! * p[i]!);
};
const sameSystem = (a: number[][], b: number[][]) =>
  a.length === b.length &&
  a.every((e) => b.some((f) => proportional(e, f))) &&
  b.every((f) => a.some((e) => proportional(e, f)));
const optionLabel = (p: GeneratedProblem, id: string) => {
  const r = p.public.response;
  assert.equal(r.kind, "choice");
  return r.options.find((o) => o.id === id)!.label;
};

const sweep = (id: string, n: number) =>
  Array.from({ length: n }, (_, i) =>
    matrixEquationSystemGenerate(id, `t${i}`),
  );

test("the same seed gives the same problem", () => {
  for (const t of matrixEquationSystemTemplates)
    for (let i = 0; i < 30; i++)
      assert.deepEqual(
        generateProblem(t.id, `same-${i}`),
        generateProblem(t.id, `same-${i}`),
      );
});

test("entry: the key is the system read independently, and only it is credited", () => {
  const forms = new Set<string>();
  for (const p of sweep("system-to-matrix-equation", 400)) {
    const r = p.public.response;
    assert.equal(r.kind, "structured-work");
    if (r.kind !== "structured-work") continue;
    assert.equal(p.public.response.kind, "structured-work");
    forms.add(p.variant!.id);
    const key = JSON.parse(p.answer) as string[][];
    if (p.variant!.id.startsWith("shape")) {
      const lines = caseLines(p.public.prompt);
      const n = new Set(lines.join("").match(/[xyz]/g)).size;
      assert.deepEqual(key, [
        [String(lines.length), String(n)],
        [String(n), "1"],
        [String(lines.length), "1"],
      ]);
      continue;
    }
    const eqs = [
      ...p.public.prompt.matchAll(/[Ee]quation \d is \$([^$]+)\$/g),
    ].map((m) => parseEquation(m[1]!, 2));
    assert.equal(eqs.length, 2);
    const want = [
      eqs[0]!.coef.map(String),
      eqs[1]!.coef.map(String),
      [String(eqs[0]!.c), String(eqs[1]!.c)],
    ];
    assert.deepEqual(key, want, p.public.prompt);
    const [a, b, c, d] = [...eqs[0]!.coef, ...eqs[1]!.coef];
    assert.notEqual(a! * d! - b! * c!, 0, "det A is not 0");
    assert.ok([a, b, c, d].every((v) => Math.abs(v!) <= 9));
    assert.ok(eqs.every((e) => e.c !== 0 && Math.abs(e.c) <= 20));
    assert.ok(gradeStructuredWork(r, p.workGrading!, p.answer));
    const send = (rows: (number | string)[][]) =>
      gradeStructuredWork(
        r,
        p.workGrading!,
        JSON.stringify(rows.map((x) => x.map(String))),
      );
    // Transposed A, a negated row (scaled), swapped constants.
    if (b !== c)
      assert.ok(
        !send([
          [a!, c!],
          [b!, d!],
          [eqs[0]!.c, eqs[1]!.c],
        ]),
      );
    assert.ok(
      !send([
        [-a!, -b!],
        [c!, d!],
        [-eqs[0]!.c, eqs[1]!.c],
      ]),
    );
    if (eqs[0]!.c !== eqs[1]!.c)
      assert.ok(
        !send([
          [a!, b!],
          [c!, d!],
          [eqs[1]!.c, eqs[0]!.c],
        ]),
      );
  }
  for (const f of [
    "aligned",
    "rearranged-x-equals",
    "rearranged-zero",
    "rearranged-flipped",
    "rearranged-split",
    "rearranged-reversed",
    "rearranged-x-only",
    "rearranged-y-only",
    "shape-2x2",
    "shape-3x3",
    "shape-3x2",
    "shape-2x3",
  ])
    assert.ok(forms.has(f), `unreached ${f}`);
});

test("reading: every variant's key agrees with the matrix equation in the prompt", () => {
  const seen = new Set<string>();
  for (const p of sweep("matrix-equation-reading", 1200)) {
    const id = p.variant!.id;
    seen.add(id);
    const r = p.public.response;
    assert.equal(r.kind, "choice");
    if (r.kind !== "choice") continue;
    assert.equal(r.options.length, 4);
    assert.equal(new Set(r.options.map((o) => o.label)).size, 4);
    for (const o of r.options)
      reportEditorialLimit(
        o.label.length <= 120,
        `${p.public.templateId}: option exceeds 120 characters`,
      );
    const correct = optionLabel(p, p.answer);
    const wrong = r.options.filter((o) => o.id !== p.answer);
    assert.deepEqual(
      Object.keys(p.choiceFeedback!).sort(),
      wrong.map((o) => o.id).sort(),
    );
    if (
      id.startsWith("which-system") ||
      id.startsWith("one-row") ||
      id.startsWith("coefficient")
    ) {
      const [Araw, , Braw] = matrices(p.public.prompt);
      const A = numbers(Araw!),
        B = numbers(Braw!).map((x) => x[0]!);
      const n = A.length;
      const system = A.map((row, i) => [...row, B[i]!]);
      const asEqs = (label: string) =>
        (label.includes("cases")
          ? caseLines(label)
          : [label.replaceAll("$", "")]
        ).map((e) => {
          const q = parseEquation(e, n);
          return [...q.coef, q.c];
        });
      if (id.startsWith("which-system")) {
        assert.ok(sameSystem(asEqs(correct), system));
        for (const o of wrong)
          assert.ok(!sameSystem(asEqs(o.label), system), o.label);
        if (n === 3) assert.equal(A.flat().filter((v) => v === 0).length, 1);
      } else if (id.startsWith("one-row")) {
        const k = Number(/row (\d) of/.exec(p.public.prompt)![1]) - 1;
        const [want] = asEqs(correct);
        assert.ok(proportional(want!, system[k]!));
        for (const o of wrong)
          assert.ok(!proportional(asEqs(o.label)[0]!, system[k]!), o.label);
      } else {
        const m = /coefficient of \$([xyz])\$ in equation (\d)/.exec(
          p.public.prompt,
        )!;
        const value = A[Number(m[2]) - 1]![V.indexOf(m[1]!)]!;
        assert.equal(correct, `$${value}$`);
        for (const o of wrong) assert.notEqual(o.label, `$${value}$`);
      }
    } else if (id.startsWith("substitute")) {
      const [A, B, , X] = matrices(p.public.prompt).map(numbers);
      const AX = A!.map((row) => row[0]! * X![0]![0]! + row[1]! * X![1]![0]!);
      const solves = AX.every((v, i) => v === B![i]![0]);
      assert.equal(solves, id === "substitute-solution");
      assert.equal(
        correct,
        `$AX=\\begin{bmatrix}${AX.join("\\\\")}\\end{bmatrix}$, so this $X$ ${solves ? "is" : "is not"} a solution.`,
      );
      assert.ok(
        Math.abs(A![0]![0]! * A![1]![1]! - A![0]![1]! * A![1]![0]!) > 0,
      );
      assert.ok(X!.every(([v]) => Math.abs(v!) <= 7));
    } else {
      // Find the flaw: rebuild the correct matrices from the shown system
      // and check the keyed slip turns them into the student's.
      const lines = caseLines(p.public.prompt);
      const n = lines.length;
      const eqs = lines.map((e) => parseEquation(e, n));
      const A = eqs.map((e) => e.coef),
        B = eqs.map((e) => e.c);
      const [SA, SB] = matrices(p.public.prompt.split("using")[1]!).map(
        numbers,
      );
      const sb = SB!.map((x) => x[0]!);
      const kind = id.replace("find-flaw-", "");
      const differs = SA!.flatMap((row, i) =>
        row.flatMap((v, j) => (A[i]?.[j] === v ? [] : [[i, j]])),
      );
      if (kind === "transposed")
        assert.deepEqual(
          SA,
          A[0]!.map((_, j) => A.map((row) => row[j]!)),
        );
      else if (kind === "augmented")
        assert.deepEqual(
          SA,
          A.map((row, i) => [...row, B[i]!]),
        );
      else if (kind === "constant-sign") {
        assert.deepEqual(SA, A);
        assert.equal(sb.filter((v, i) => v !== B[i]).length, 1);
        assert.ok(sb.every((v, i) => v === B[i] || v === -B[i]!));
      } else if (kind === "moved-sign") {
        assert.equal(differs.length, 1);
        const [i, j] = differs[0]!;
        assert.equal(SA![i!]![j!], -A[i!]![j!]!);
        assert.deepEqual(sb, B);
      } else {
        // order or zero: one row holds the same coefficients rearranged.
        const rows = SA!.flatMap((row, i) =>
          row.join() === A[i]!.join() ? [] : [i],
        );
        assert.equal(rows.length, 1);
        const i = rows[0]!;
        assert.deepEqual([...SA![i]!].sort(), [...A[i]!].sort());
        if (kind === "zero")
          assert.ok(A[i]!.includes(0) && SA![i]!.at(-1) === 0);
        assert.deepEqual(sb, B);
      }
      assert.ok(
        SA!.flat().join() !== A.flat().join() || sb.join() !== B.join(),
      );
    }
  }
  for (const v of [
    "which-system-2",
    "which-system-3",
    "one-row-2",
    "one-row-3",
    "coefficient",
    "coefficient-zero",
    "find-flaw-transposed",
    "find-flaw-augmented",
    "find-flaw-moved-sign",
    "find-flaw-constant-sign",
    "find-flaw-order",
    "find-flaw-zero",
    "substitute-solution",
    "substitute-near-miss",
  ])
    assert.ok(seen.has(v), `unreached ${v}`);
});

test("forced variants generate on every seed", () => {
  for (const variant of ["aligned", "rearranged", "shape"] as const)
    for (let i = 0; i < 40; i++)
      matrixEquationSystemCase.entry(`force-${i}`, { variant });
  for (const variant of [
    "which-system",
    "one-row",
    "find-flaw",
    "substitute",
  ] as const)
    for (let i = 0; i < 40; i++)
      matrixEquationSystemCase.reading(`force-${i}`, { variant });
});
