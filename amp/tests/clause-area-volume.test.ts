import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { gradeStructuredWork } from "../src/math/structured-work";
import type { GeneratedProblem } from "../src/math/contracts";

const hosts = [
  "triangle-area-base-height",
  "polygon-area-decompose",
  "composite-area",
  "composite-face-prism-surface-area",
  "fraction-edge-volume",
] as const;

const classicPrompt: Record<(typeof hosts)[number], RegExp> = {
  "triangle-area-base-height": /^The figure shows a triangle /,
  "polygon-area-decompose":
    /^The figure is a (parallelogram|trapezoid)|The pentagon has /,
  "composite-area":
    /^All angles in the |^The figure is a rectangle with its top right corner /,
  "composite-face-prism-surface-area": /^A right prism has the /,
  "fraction-edge-volume":
    /^A (box|block of wood|planter box|rectangular prism) (is |has a volume )/,
};

const v1Id = (id: string, seed: string) =>
  createHash("sha256").update(JSON.stringify([id, 1, seed])).digest("hex");

test("version 1 reprints the old prompts, and each new family appears", () => {
  for (const id of hosts) {
    let clause = 0;
    for (let i = 0; i < 400; i++) {
      const seed = `clause-${id}-${i}`;
      const old = generateProblem(id, seed, 1);
      const now = generateProblem(id, seed);
      assert.equal(old.public.templateVersion, 1, seed);
      assert.equal(old.public.id, v1Id(id, seed), seed);
      assert.match(old.public.prompt, classicPrompt[id], seed);
      if (classicPrompt[id].test(now.public.prompt)) {
        assert.equal(now.public.prompt, old.public.prompt, seed);
        assert.deepEqual(now.explanation, old.explanation, seed);
        assert.equal(now.hint, old.hint, seed);
        assert.equal(now.answer, old.answer, seed);
        assert.deepEqual(now.public.figure, old.public.figure, seed);
      } else {
        clause++;
        assert.equal(now.public.templateVersion, 2, seed);
        assert.notEqual(now.public.prompt, old.public.prompt, seed);
        const escaped = now.answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        assert.doesNotMatch(now.hint, new RegExp(`(?<![\\d.])${escaped}(?!\\d)`));
      }
    }
    assert.ok(clause >= 40, `${id} showed the new family ${clause} times`);
  }
});

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const reduce = (n: number, d: number): [number, number] => {
  const g = gcd(Math.abs(n), Math.abs(d));
  return [n / g, d / g];
};
function texQ(text: string): [number, number] {
  const mixed = text.match(/^(\d+)\\tfrac\{(\d+)\}\{(\d+)\}$/);
  if (mixed)
    return [
      Number(mixed[1]) * Number(mixed[3]) + Number(mixed[2]),
      Number(mixed[3]),
    ];
  const frac = text.match(/^\\tfrac\{(\d+)\}\{(\d+)\}$/);
  if (frac) return [Number(frac[1]), Number(frac[2])];
  const whole = text.match(/^(\d+)$/);
  if (whole) return [Number(whole[1]), 1];
  throw new Error(`Unparsed ${text}`);
}
const answerQ = (answer: string): [number, number] => {
  const frac = answer.match(/^(\d+)\/(\d+)$/);
  return frac ? [Number(frac[1]), Number(frac[2])] : [Number(answer), 1];
};
const sameQ = (a: [number, number], b: [number, number]) => {
  const [an, ad] = reduce(a[0], a[1]);
  const [bn, bd] = reduce(b[0], b[1]);
  return an === bn && ad === bd;
};

test("in-context, triangles, stacked cubes, and base area match the clause", () => {
  assert.equal(((14 + 8) / 2) * 4 * 2, 88);
  assert.equal(10 * 6 + (10 * 4) / 2, 80);
  assert.equal(6 * 6 * 6 + 4 * 2 * 2, 232);
  let gardens = 0;
  let houses = 0;
  let bases = 0;
  let missing = 0;
  for (let i = 0; i < 400; i++) {
    const polygon = generateProblem("polygon-area-decompose", `ctx-poly-${i}`);
    if (polygon.public.prompt.startsWith("A garden")) {
      gardens++;
      const price = Number(polygon.public.prompt.match(/costs \$(\d+)/)![1]);
      const f = polygon.public.figure as {
        vertices: [number, number][];
      };
      const v = f.vertices;
      let shoelace = 0;
      for (let k = 0; k < v.length; k++) {
        const n = v[(k + 1) % v.length]!;
        shoelace += v[k]![0] * n[1] - n[0] * v[k]![1];
      }
      assert.equal(Number(polygon.answer), (shoelace / 2) * price);
      assert.doesNotMatch(polygon.public.prompt, /88|44/);
    }
    const area = generateProblem("composite-area", `ctx-area-${i}`);
    const house = area.public.prompt.match(
      /^The figure is a rectangle (\d+) \w+ wide and (\d+) \w+ tall with a triangle on top\. The triangle is (\d+) \w+ wide and (\d+) \w+ tall/,
    );
    if (house) {
      houses++;
      const [w, wall, tw, roof] = house.slice(1).map(Number);
      assert.equal(w, tw);
      assert.equal(Number(area.answer), w! * wall! + (w! * roof!) / 2);
      if (w === 10 && wall === 6 && roof === 4) assert.equal(area.answer, "80");
      assert.ok(!area.hint.includes(area.answer));
    }
    const stacked = generateProblem(
      "composite-face-prism-surface-area",
      `ctx-stack-${i}`,
    );
    const cubes = stacked.public.prompt.match(
      /bottom cube has edges of (\d+).*top cube has edges of (\d+)/,
    );
    if (cubes) {
      const e = Number(cubes[1]),
        f = Number(cubes[2]);
      assert.equal(Number(stacked.answer), 6 * e * e + 4 * f * f);
      if (e === 6 && f === 2) assert.equal(stacked.answer, "232");
      assert.doesNotMatch(stacked.hint, /232|6e|4f/);
      assert.match(stacked.public.prompt, /both edges are stated here/);
      const face = (stacked.public.figure as { face: number[][] }).face;
      assert.equal(face.length, 8);
    }
    const edge = generateProblem("fraction-edge-volume", `ctx-edge-${i}`);
    if (edge.public.prompt.includes("rectangular base") || edge.public.prompt.includes("has a base of")) {
      bases++;
      assert.doesNotMatch(edge.public.prompt, /\b(long|wide|length|width)\b/);
      const sides = (edge.public.figure as { sides: (number | null)[] }).sides;
      assert.ok(sides.every((s) => s === null));
      const [an, ad] = answerQ(edge.answer);
      assert.ok(ad <= 12, edge.answer);
      const money = [...edge.public.prompt.matchAll(/\$([^$]+)\$/g)].map((m) =>
        texQ(m[1]!),
      );
      if (edge.public.prompt.includes("How deep")) {
        missing++;
        assert.ok(sameQ(answerQ(edge.answer), reduce(money[1]![0] * money[0]![1], money[1]![1] * money[0]![0])));
      } else {
        const [pn, pd] = reduce(money[0]![0] * money[1]![0], money[0]![1] * money[1]![1]);
        assert.equal(an, pn);
        assert.equal(ad, pd);
      }
      assert.doesNotMatch(edge.hint, new RegExp(`(?<![\\d./])${edge.answer}(?!\\d)`));
    }
  }
  assert.ok(gardens >= 40, `gardens ${gardens}`);
  assert.ok(houses >= 40, `houses ${houses}`);
  assert.ok(bases >= 40, `base-area ${bases}`);
  assert.ok(missing >= 40, `missing height ${missing}`);
});

test("piece cards, expressions, packing, and naming the solid", () => {
  let traps = 0;
  let expressions = 0;
  for (let i = 0; i < 300; i++) {
    const pieces = generateProblem("polygon-show-the-pieces", `pieces-${i}`);
    const response = pieces.public.response;
    assert.equal(response.kind, "multi-part-choice");
    if (response.kind !== "multi-part-choice") continue;
    assert.equal(response.layout, "cards");
    assert.ok(response.blanks.length >= 3 && response.blanks.length <= 4);
    const key = JSON.parse(pieces.answer) as Record<string, string>;
    const chosen = response.blanks.map((blank) => {
      const id = key[blank.id];
      return blank.options.find((o) => o.id === id)!.label;
    });
    assert.equal(new Set(chosen).size, chosen.length);
    const trap = pieces.public.prompt.match(
      /parallel sides are (\d+) and (\d+), and the height is (\d+)/,
    );
    if (trap) {
      traps++;
      const B = Number(trap[1]),
        b = Number(trap[2]),
        h = Number(trap[3]),
        o = (B - b) / 2;
      assert.equal(o, Math.floor(o));
      const tri = (o * h) / 2;
      assert.equal(tri, Math.floor(tri));
      assert.deepEqual(chosen, [String(b * h), String(tri), String(b * h + 2 * tri)]);
      if (B === 14 && b === 8 && h === 4)
        assert.deepEqual(chosen, ["32", "6", "44"]);
    }
    const expr = generateProblem("polygon-which-expression", `expr-${i}`);
    expressions++;
    const choice = expr.public.response;
    assert.equal(choice.kind, "choice");
    if (choice.kind !== "choice") continue;
    const dims = expr.public.prompt.match(/parallel sides (\d+) and (\d+) and height (\d+)/)!;
    const B = Number(dims[1]),
      b = Number(dims[2]),
      h = Number(dims[3]),
      o = (B - b) / 2;
    const correct = `${b} × ${h} + 2 × (1/2 × ${o} × ${h})`;
    const labels = choice.options.map((o) => o.label);
    assert.equal(new Set(labels).size, 4);
    assert.deepEqual(
      [...labels].sort(),
      [correct, `${B} × ${h}`, `${b} × ${h}`, `${B} × ${b}`].sort(),
    );
    assert.equal(choice.options.find((o) => o.id === expr.answer)!.label, correct);
    const area = ((B + b) / 2) * h;
    for (const label of labels)
      if (label !== correct) assert.notEqual(evalExpr(label), area);
    assert.equal(evalExpr(correct), area);
    assert.ok(!expr.hint.includes(String(area)));
  }
  assert.ok(traps >= 40, `trapezoid cards ${traps}`);
  assert.equal(expressions, 300);

  let halfInch = 0;
  for (let i = 0; i < 300; i++) {
    const packed = generateProblem("count-then-size-then-check", `pack-${i}`);
    const work = packed.public.response;
    assert.equal(work.kind, "structured-work");
    if (work.kind !== "structured-work") continue;
    assert.equal(work.rows.length, 5);
    const rows = JSON.parse(packed.answer) as string[][];
    const [alongL, alongW] = rows[0]!.map(Number);
    const [alongH, total] = rows[1]!.map(Number);
    assert.equal(total, alongL! * alongW! * alongH!);
    const cube = rows[2]![0]!;
    const fromCount = rows[3]![0]!;
    const fromEdges = rows[4]![0]!;
    assert.equal(fromCount, fromEdges);
    const text = packed.explanation.join(" ");
    assert.match(text, /The count is not the volume/);
    const cubeEdge = (packed.public.figure as { cubeEdge: { n: number; d: number } })
      .cubeEdge;
    assert.equal(cubeEdge.n, 1);
    const den = cubeEdge.d;
    assert.equal(cube, `1/${den ** 3}`);
    assert.ok(sameQ(answerQ(fromCount), reduce(total!, den ** 3)));
    if (den === 2) {
      halfInch++;
      assert.match(text, /tfrac\{1\}\{2\}/);
      assert.match(text, /tfrac\{1\}\{8\}/);
      assert.match(text, /not \$\\tfrac\{1\}\{2\}/);
    }
    if (fromCount === "21/4") {
      const decimal = packed.answer.replaceAll("21/4", "5.25");
      assert.equal(
        gradeStructuredWork(work, packed.workGrading!, decimal),
        true,
      );
      const mixed = packed.answer.replaceAll("21/4", "5 1/4");
      assert.equal(gradeAnswer(packed, mixed), false);
      assert.equal(gradeAnswer(packed, packed.answer), true);
    }
    // The hint names this box's edges and the small cube's edge (its
    // givens), so a one-digit answer can match a given. Past the givens it
    // never states the answer.
    const givens = packed.hint.indexOf("to count the cubes along it.");
    assert.ok(givens >= 0, packed.hint);
    assert.ok(!packed.hint.slice(givens).includes(fromCount), packed.hint);
  }
  assert.ok(halfInch >= 40, `half-inch cubes ${halfInch}`);

  const names = ["rectangular prism", "cube", "triangular prism", "square pyramid"];
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const named = generateProblem("net-name-the-solid", `net-${i}`);
    const choice = named.public.response;
    assert.equal(choice.kind, "choice");
    if (choice.kind !== "choice") continue;
    assert.deepEqual(choice.options.map((o) => o.label).sort(), [...names].sort());
    const correct = choice.options.find((o) => o.id === named.answer)!.label;
    seen.add(correct);
    const others = choice.options.filter((o) => o.id !== named.answer).map((o) => o.label);
    assert.equal(new Set(others).size, 3);
    assert.ok(!others.includes(correct));
    const text = named.explanation.join(" ");
    if (correct === "triangular prism" || correct === "square pyramid") {
      assert.match(text, /two triangles and three rectangles/i);
      assert.match(text, /one square and four triangles/i);
    }
    assert.ok(!named.hint.includes(correct) || named.hint.length > 0);
    const figure = named.public.figure as { kind: string };
    assert.ok(
      figure.kind === "rectangular-prism-net" ||
        figure.kind === "triangular-prism-net" ||
        figure.kind === "square-pyramid-net",
    );
  }
  assert.deepEqual([...seen].sort(), [...names].sort());
});

function evalExpr(label: string): number {
  const sum = label.match(/^(\d+) × (\d+) \+ 2 × \(1\/2 × (\d+) × (\d+)\)$/);
  if (sum) return Number(sum[1]) * Number(sum[2]) + Number(sum[3]) * Number(sum[4]);
  const prod = label.match(/^(\d+) × (\d+)$/);
  if (prod) return Number(prod[1]) * Number(prod[2]);
  throw new Error(label);
}

test("a half-inch packing grades 21/4 and 5.25 but not a mixed number", () => {
  let found: GeneratedProblem | undefined;
  for (let i = 0; i < 400 && !found; i++) {
    const packed = generateProblem("count-then-size-then-check", `form-${i}`);
    if (packed.answer.includes("21/4")) found = packed;
  }
  assert.ok(found, "expected a 21/4 volume");
  assert.equal(gradeAnswer(found!, found!.answer), true);
  assert.equal(
    gradeAnswer(found!, found!.answer.replaceAll("21/4", "5.25")),
    true,
  );
  assert.equal(
    gradeAnswer(found!, found!.answer.replaceAll("21/4", "5 1/4")),
    false,
  );
});
