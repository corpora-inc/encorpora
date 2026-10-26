import test from "node:test";
import assert from "node:assert/strict";
import {
  vectorComponentsCase,
  vectorResultantCase,
  matrixDataCase,
  matrixOperationCase,
  matrixLawsCase,
  matrixInverseCase,
  matrixTransformCase,
  matrixSystemCase,
  vectorMatrixTemplates,
} from "../src/math/vectors-matrices-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

const cases: Record<
  string,
  {
    make: (seed: string) => { variant: number };
    variants: number;
    skill: string;
  }
> = {
  "vector-components": {
    make: vectorComponentsCase,
    variants: 6,
    skill: "vectors",
  },
  "vector-resultant": {
    make: vectorResultantCase,
    variants: 5,
    skill: "vector-modeling",
  },
  "matrix-data-reading": {
    make: matrixDataCase,
    variants: 6,
    skill: "matrix-data",
  },
  "matrix-operations": {
    make: matrixOperationCase,
    variants: 6,
    skill: "matrices",
  },
  "matrix-laws": {
    make: matrixLawsCase,
    variants: 6,
    skill: "matrix-properties",
  },
  "matrix-inverse-determinant": {
    make: matrixInverseCase,
    variants: 5,
    skill: "matrix-inverses",
  },
  "matrix-transformation": {
    make: matrixTransformCase,
    variants: 6,
    skill: "matrix-transformations",
  },
  "matrix-linear-system": {
    make: matrixSystemCase,
    variants: 6,
    skill: "matrix-systems",
  },
};

// Independent exact rational arithmetic on bigint pairs.
type Q = [bigint, bigint];
const g = (a: bigint, b: bigint): bigint => (b ? g(b, a % b) : a < 0n ? -a : a);
const q = (n: bigint, d = 1n): Q => {
  if (d < 0n) [n, d] = [-n, -d];
  const k = g(n, d) || 1n;
  return [n / k, d / k];
};
const qmul = (a: Q, b: Q) => q(a[0] * b[0], a[1] * b[1]);
const qadd = (a: Q, b: Q) => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
function parseQ(text: string): Q {
  const t = text.trim();
  const frac = /^(-?)\\d?frac\{(\d+)\}\{(\d+)\}$/.exec(t);
  if (frac) return q(BigInt(frac[2]!) * (frac[1] ? -1n : 1n), BigInt(frac[3]!));
  assert.match(t, /^-?\d+$/, t);
  return q(BigInt(t));
}
function matrices(latex: string): Q[][][] {
  return [...latex.matchAll(/\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}/g)].map(
    (m) => m[1]!.split("\\\\").map((row) => row.split("&").map(parseQ)),
  );
}
const qkey = (m: Q[][]) =>
  m.map((row) => row.map((x) => `${x[0]}/${x[1]}`).join(",")).join(";");
const mul = (a: Q[][], b: Q[][]) =>
  a.map((row) =>
    b[0]!.map((_, j) =>
      row.reduce((s, x, k) => qadd(s, qmul(x, b[k]![j]!)), q(0n)),
    ),
  );

function options(problem: ReturnType<typeof generateProblem>) {
  const response = problem.public.response;
  assert.equal(response.kind, "choice");
  return response.kind === "choice" ? response.options : [];
}

test("every vector and matrix template is deterministic, reaches all variants and has one correct distinct choice", () => {
  for (const [id, { make, variants, skill }] of Object.entries(cases)) {
    const template = templates.find((t) => t.id === id);
    assert.equal(template?.skillId, skill, id);
    assert.equal(template?.requiredResponseCapability, "single-choice-v1");
    const seen = new Set<number>();
    for (let seed = 0; seed < 400; seed++) {
      const key = `vm:${seed}`;
      const first = generateProblem(id, key);
      const again = generateProblem(id, key);
      assert.deepEqual(first, again, `${id} ${key} is not deterministic`);
      assert.equal(first.public.skillId, skill);
      seen.add(make(key).variant);
      const opts = options(first);
      assert.equal(opts.length, 4, `${id} ${key}`);
      assert.equal(new Set(opts.map((o) => o.label)).size, 4, `${id} ${key}`);
      const correct = opts.find((o) => o.id === first.answer);
      assert.ok(correct, `${id} ${key}: answer is not an option`);
      assert.ok(
        !first.public.prompt.includes(correct.label),
        `${id} ${key}: prompt leaks`,
      );
      assert.ok(
        !first.hint.includes(correct.label),
        `${id} ${key}: hint leaks`,
      );
      assert.ok(first.hint.length > 20 && first.explanation.length >= 1);
      for (const o of opts)
        if (o.id !== first.answer)
          assert.ok(
            first.choiceFeedback?.[o.id],
            `${id} ${key}: no feedback for ${o.id}`,
          );
    }
    assert.deepEqual(
      [...seen].sort(),
      Array.from({ length: variants }, (_, i) => i),
      id,
    );
  }
});

test("vector component and resultant answers match an independent calculation", () => {
  let components = 0;
  let resultants = 0;
  for (let seed = 0; seed < 400; seed++) {
    const key = `vm:${seed}`;
    const v = generateProblem("vector-components", key);
    const pts =
      /A\((-?\d+), (-?\d+)\)\$ and ends at the terminal point \$B\((-?\d+), (-?\d+)\)/.exec(
        v.public.prompt,
      );
    if (pts) {
      components++;
      const [x1, y1, x2, y2] = pts.slice(1).map(Number) as [
        number,
        number,
        number,
        number,
      ];
      const label = options(v).find((o) => o.id === v.answer)!.label;
      assert.equal(label, `$\\langle ${x2 - x1}, ${y2 - y1}\\rangle$`);
    }
    const mag =
      /^Find the magnitude of \$\\mathbf\{v\}=\\langle (-?\d+), (-?\d+)\\rangle\$/.exec(
        v.public.prompt,
      );
    if (mag) {
      const n = Number(mag[1]) ** 2 + Number(mag[2]) ** 2;
      const label = options(v).find((o) => o.id === v.answer)!.label;
      const m = /^\$(\d*)\\sqrt\{(\d+)\}\$$|^\$(\d+)\$$/.exec(label)!;
      const value = m[3]
        ? Number(m[3]) ** 2
        : (m[1] ? Number(m[1]) : 1) ** 2 * Number(m[2]);
      assert.equal(value, n);
    }
    const p = generateProblem("vector-resultant", key);
    const nums = /(\d+) (?:mph|N|newtons)[^.]*?(\d+) (?:mph|N|newtons)/.exec(
      p.public.prompt,
    );
    if (
      nums &&
      /(relative to the shore|relative to the ground|magnitude of the resultant force)\?( Round to the nearest tenth\.)?$/.test(
        p.public.prompt,
      )
    ) {
      resultants++;
      const [a, b] = [Number(nums[1]), Number(nums[2])];
      const label = options(p).find((o) => o.id === p.answer)!.label;
      const value = Number(/^\$([\d.]+)/.exec(label)![1]);
      const exact = Math.sqrt(a * a + b * b);
      assert.ok(
        Math.abs(value - exact) <= 0.05 + 1e-9,
        `${p.public.prompt} ${label}`,
      );
    }
  }
  assert.ok(components > 20 && resultants > 20);
});

test("inverse and linear-system answers satisfy their defining equations", () => {
  let inverses = 0;
  let solved = 0;
  for (let seed = 0; seed < 400; seed++) {
    const key = `vm:${seed}`;
    const inv = generateProblem("matrix-inverse-determinant", key);
    if (inv.public.prompt.startsWith("Find the inverse")) {
      inverses++;
      const [A] = matrices(inv.public.prompt);
      const labels = options(inv).map((o) => ({
        id: o.id,
        m: matrices(o.label)[0]!,
      }));
      const hits = labels.filter(({ m }) => {
        const product = mul(A!, m);
        return product.every((row, i) =>
          row.every((x, j) => x[0] === (i === j ? 1n : 0n) && x[1] === 1n),
        );
      });
      assert.equal(hits.length, 1);
      assert.equal(hits[0]!.id, inv.answer);
    }
    const sys = generateProblem("matrix-linear-system", key);
    if (sys.public.prompt.includes("Solve it using")) {
      solved++;
      const [A, B] = matrices(sys.public.prompt);
      const hits = options(sys).filter((o) => {
        const [x, y] = [
          ...o.label.matchAll(/(-?(?:\\d?frac\{\d+\}\{\d+\}|\d+))/g),
        ]
          .map((m) => parseQ(m[1]!))
          .slice(-2);
        return mul(A!, [[x!], [y!]]).every(
          (row, i) =>
            row[0]![0] === B![i]![0]![0] && row[0]![1] === B![i]![0]![1],
        );
      });
      assert.equal(hits.length, 1);
      assert.equal(hits[0]!.id, sys.answer);
    }
  }
  assert.ok(inverses > 20 && solved > 20);
});

test("matrix operation answers match independent row-by-column products", () => {
  let products = 0;
  for (let seed = 0; seed < 400; seed++) {
    const key = `vm:${seed}`;
    const p = generateProblem("matrix-operations", key);
    if (/Find \$AB\$\.$/.test(p.public.prompt)) {
      products++;
      const [A, B] = matrices(p.public.prompt);
      const expected = mul(A!, B!);
      const hits = options(p).filter(
        (o) => qkey(matrices(o.label)[0]!) === qkey(expected),
      );
      assert.equal(hits.length, 1);
      assert.equal(hits[0]!.id, p.answer);
    }
  }
  assert.ok(products > 20);
});

test("vectors and matrices are bound to lessons, methods and principles", () => {
  for (const template of vectorMatrixTemplates) {
    const lesson = problemLesson(template.id, "library");
    assert.ok(lesson.intuition && lesson.method.length >= 2, template.id);
    assert.ok(lesson.watch && lesson.principle, template.id);
    assert.ok(lesson.example.steps.length >= 2, template.id);
  }
});

test("determinant, transformation and operation answers match independent arithmetic", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 400; seed++) {
    const key = `vm:${seed}`;
    const label = (p: ReturnType<typeof generateProblem>) =>
      options(p).find((o) => o.id === p.answer)!.label;
    const det = generateProblem("matrix-inverse-determinant", key);
    if (det.public.prompt.startsWith("Find the determinant")) {
      seen.add("det");
      const [[[a, b], [c, d]]] = matrices(det.public.prompt) as [Q[][]];
      assert.equal(label(det), `$${a![0] * d![0] - b![0] * c![0]}$`);
    }
    const t = generateProblem("matrix-transformation", key);
    const apply =
      /^The matrix \$(.*?)\$ transforms each point.*send \$\((-?\d+), (-?\d+)\)\$/.exec(
        t.public.prompt,
      );
    if (apply) {
      seen.add("apply");
      const [M] = matrices(apply[1]!);
      const [x, y] = [BigInt(apply[2]!), BigInt(apply[3]!)];
      const nx = M![0]![0]![0] * x + M![0]![1]![0] * y;
      const ny = M![1]![0]![0] * x + M![1]![1]![0] * y;
      assert.equal(label(t), `$(${nx}, ${ny})$`);
    }
    const area =
      /^A triangle with area (\d+) square units is transformed by \$(.*?)\$/.exec(
        t.public.prompt,
      );
    if (area) {
      seen.add("area");
      const [M] = matrices(area[2]!);
      let d = M![0]![0]![0] * M![1]![1]![0] - M![0]![1]![0] * M![1]![0]![0];
      if (d < 0n) d = -d;
      assert.equal(label(t), `$${d * BigInt(area[1]!)}$`);
    }
    const sum = generateProblem("matrix-operations", key);
    const add = /^Let \$A=(.*?)\$ and \$B=(.*?)\$\. Find \$A\+B\$\.$/.exec(
      sum.public.prompt,
    );
    if (add) {
      seen.add("sum");
      const [A] = matrices(add[1]!);
      const [B] = matrices(add[2]!);
      const S = A!.map((row, i) => row.map((x, j) => qadd(x, B![i]![j]!)));
      assert.equal(qkey(matrices(label(sum))[0]!), qkey(S));
    }
  }
  assert.deepEqual([...seen].sort(), ["apply", "area", "det", "sum"]);
});
