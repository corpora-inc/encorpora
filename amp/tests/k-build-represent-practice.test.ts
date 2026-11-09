import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import { kBuildRepresentTemplates } from "../src/math/k-build-represent-practice";

/**
 * Checks for the kindergarten building and representing types (K.G.B.5,
 * K.OA.A.1). Counts are read from the drawn scene, and drawings are judged
 * from their vertices; nothing here calls the generator's own helpers.
 */

const IDS = kBuildRepresentTemplates.map((t) => t.id);
const SEEDS = 400;
const sample = (id: string, n = SEEDS) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `kbr-${i}`));

type El = { type: string; id?: string; [k: string]: unknown };
const elementsOf = (scene: { elements: unknown[] }) =>
  (scene.elements as El[]).filter((e) => e.id !== "canvas");
function figureElements(p: GeneratedProblem): El[] {
  const f = p.public.figure;
  assert.ok(f && f.kind === "scene", p.public.templateId);
  if (!f || f.kind !== "scene") throw new Error("scene");
  return elementsOf(f.scene);
}
const choiceLabels = (p: GeneratedProblem) => {
  const r = p.public.response;
  assert.equal(r.kind, "choice");
  if (r.kind !== "choice") throw new Error("choice");
  return r.options;
};
const correctLabel = (p: GeneratedProblem) =>
  choiceLabels(p).find((o) => o.id === p.answer)!.label;

test("every template is registered, valid and deterministic", () => {
  for (const id of IDS) {
    const meta = templates.find((t) => t.id === id);
    assert.ok(meta, id);
    for (let i = 0; i < 60; i++) {
      const p = generateProblem(id, `det-${i}`);
      generatedProblemSchema.parse(p);
      assert.deepEqual(generateProblem(id, `det-${i}`), p, `${id} det-${i}`);
      assert.equal(p.public.skillId, meta!.skillId);
    }
  }
});

/* ---------------------------------------------------------------- K.G.B.5 */

test("sticks and balls: answers come from the drawn model, every variant and shape is reached", () => {
  const seen = new Map<string, number>();
  for (const p of sample("sticks-and-balls-needed")) {
    const els = figureElements(p);
    const balls = els.filter((e) => e.type === "circle").length;
    const sticks = els.filter((e) => e.type === "segment").length;
    const prompt = p.public.prompt;
    const answer = Number(p.answer);
    assert.ok(answer >= 1 && answer <= 12, prompt);
    const variant = p.variant!.id;
    seen.set(variant, (seen.get(variant) ?? 0) + 1);
    if (variant === "plan-cube") assert.deepEqual([balls, sticks], [8, 12]);
    else if (variant.startsWith("plan-")) {
      const outline = els.filter((e) => e.type === "polygon");
      assert.equal(outline.length, 1);
      assert.equal(answer, (outline[0]!.points as unknown[]).length);
    } else if (variant === "finish-cube") {
      assert.equal(balls, 8);
      assert.equal(answer, 12 - sticks);
      assert.ok(answer === 4 || answer === 8);
    } else if (variant.startsWith("finish-")) {
      assert.ok(sticks >= 1 && sticks < balls, prompt);
      assert.equal(answer, balls - sticks);
    } else if (variant === "join-cube")
      assert.deepEqual([balls, sticks, answer], [0, 12, 8]);
    else assert.deepEqual([balls, answer], [0, sticks]);
    // The figure's words never count for the learner.
    const f = p.public.figure;
    if (f?.kind === "scene")
      assert.doesNotMatch(`${f.scene.title ?? ""} ${f.scene.note ?? ""}`, /\d/);
  }
  for (const kind of ["plan", "finish", "join"])
    for (const shape of ["triangle", "square", "rectangle", "hexagon", "cube"])
      assert.ok(seen.get(`${kind}-${shape}`), `${kind}-${shape}`);
  const cube = [...seen]
    .filter(([k]) => k.endsWith("cube"))
    .reduce((s, [, n]) => s + n, 0);
  assert.ok(
    cube / SEEDS > 0.08 && cube / SEEDS < 0.22,
    `cube share ${cube / SEEDS}`,
  );
});

type Pt = [number, number];
function drawingOf(els: El[]): {
  kind: "closed" | "open" | "curved";
  pts: Pt[];
} {
  const d = els.filter((e) => ["polygon", "polyline", "path"].includes(e.type));
  assert.equal(d.length, 1);
  const e = d[0]!;
  if (e.type === "polygon") return { kind: "closed", pts: e.points as Pt[] };
  if (e.type === "polyline") return { kind: "open", pts: e.points as Pt[] };
  const ops = e.d as (string | number)[][];
  assert.ok(ops.some((op) => op[0] === "Q"));
  return {
    kind: "curved",
    pts: ops
      .filter((op) => op[0] === "M" || op[0] === "L")
      .map((op) => [op[1], op[2]] as Pt),
  };
}
const SIDES: Record<string, number> = {
  triangle: 3,
  square: 4,
  rectangle: 4,
  hexagon: 6,
};
function cosines(pts: Pt[]) {
  return pts.map((b, i) => {
    const a = pts[(i + pts.length - 1) % pts.length]!,
      c = pts[(i + 1) % pts.length]!;
    const u = [a[0] - b[0], a[1] - b[1]],
      v = [c[0] - b[0], c[1] - b[1]];
    return (
      (u[0]! * v[0]! + u[1]! * v[1]!) /
      (Math.hypot(u[0]!, u[1]!) * Math.hypot(v[0]!, v[1]!))
    );
  });
}
function isShape(d: ReturnType<typeof drawingOf>, shape: string) {
  if (d.kind !== "closed" || d.pts.length !== SIDES[shape]) return false;
  if (shape === "square" || shape === "rectangle")
    if (!cosines(d.pts).every((c) => Math.abs(c) < 0.01)) return false;
  if (shape === "square") {
    const s = d.pts.map((p, i) =>
      Math.hypot(d.pts[(i + 1) % 4]![0] - p[0], d.pts[(i + 1) % 4]![1] - p[1]),
    );
    if (Math.max(...s) - Math.min(...s) > 0.01 * Math.max(...s)) return false;
  }
  return true;
}
function flawOf(d: ReturnType<typeof drawingOf>, shape: string) {
  if (d.kind !== "closed") return d.kind;
  if (d.pts.length !== SIDES[shape]) return "count";
  if (!isShape({ ...d }, shape))
    return cosines(d.pts).every((c) => Math.abs(c) < 0.01)
      ? "unequal"
      : "corners";
  return "none";
}

test("check the drawing: exactly one drawing is the shape, the others show three different flaws", () => {
  const positions = new Map<string, number>();
  let turned = 0;
  const shapes = new Set<string>();
  for (const p of sample("check-the-drawing")) {
    const shape = /a (\w+)\?$/.exec(p.public.prompt)![1]!;
    shapes.add(shape);
    const r = p.public.response;
    assert.equal(r.kind, "figure-choice");
    if (r.kind !== "figure-choice") continue;
    assert.equal(r.noun, "Picture");
    const drawings = r.options.map((o) => drawingOf(elementsOf(o.scene)));
    const passing = r.options.filter((_, i) => isShape(drawings[i]!, shape));
    assert.deepEqual(
      passing.map((o) => o.id),
      [p.answer],
      p.public.seed,
    );
    const flaws = drawings
      .filter((d) => !isShape(d, shape))
      .map((d) => flawOf(d, shape));
    assert.equal(new Set(flaws).size, 3, flaws.join());
    // Every card shares one canvas, so size never tells the answer.
    const canvases = r.options.map((o) =>
      JSON.stringify((o.scene.elements as unknown as El[])[0]),
    );
    assert.equal(new Set(canvases).size, 1);
    positions.set(p.answer, (positions.get(p.answer) ?? 0) + 1);
    if (p.variant!.id.endsWith("-turned")) turned++;
    for (const o of r.options)
      assert.doesNotMatch(o.label, /correct|right one|wrong/i);
  }
  assert.equal(shapes.size, 4);
  assert.ok(
    turned / SEEDS > 0.5 && turned / SEEDS < 0.7,
    `turned ${turned / SEEDS}`,
  );
  for (const n of positions.values())
    assert.ok(n > SEEDS * 0.15, `positions ${[...positions]}`);
});

test("drawing mistake: the one true choice names the drawing's only flaw; turning is never the mistake", () => {
  let nothing = 0;
  const seen = new Set<string>();
  for (const p of sample("drawing-mistake")) {
    const shape = /drew a (\w+)\./.exec(p.public.prompt)![1]!;
    const d = drawingOf(figureElements(p));
    const flaw = flawOf(d, shape);
    assert.notEqual(flaw, "unequal");
    const label = correctLabel(p);
    seen.add(`${shape}-${flaw}`);
    const expected =
      flaw === "none"
        ? `Nothing is wrong. It is a ${shape}.`
        : flaw === "open"
          ? "It is not closed."
          : flaw === "curved"
            ? "One side is curved."
            : flaw === "count"
              ? `It has ${d.pts.length} sides, not ${SIDES[shape]}.`
              : "The corners are not square corners.";
    assert.equal(label, expected, p.public.seed);
    if (flaw === "none") {
      nothing++;
      assert.ok(
        choiceLabels(p).some((o) => o.label === "It is turned the wrong way."),
      );
    }
    assert.notEqual(label, "It is turned the wrong way.");
    // A false count choice names a count the drawing does not have.
    for (const o of choiceLabels(p)) {
      const m = /^It has (\d+) sides, not (\d+)\.$/.exec(o.label);
      if (m && o.id !== p.answer)
        assert.ok(d.kind !== "closed" || Number(m[1]) !== d.pts.length);
    }
  }
  assert.ok(
    nothing / SEEDS > 0.17 && nothing / SEEDS < 0.33,
    `nothing ${nothing / SEEDS}`,
  );
  for (const key of [
    "triangle-open",
    "square-corners",
    "rectangle-corners",
    "hexagon-count",
    "square-curved",
    "triangle-none",
  ])
    assert.ok(seen.has(key), key);
});

/* --------------------------------------------------------------- K.OA.A.1 */

function counters(els: El[]) {
  const circles = els.filter((e) => e.type === "circle");
  const arrow = els.find((e) => e.type === "arrow") as unknown as
    { from: Pt; to: Pt } | undefined;
  return {
    teal: circles.filter((e) => e.fill === "accent").length,
    rust: circles.filter((e) => e.fill === "warm").length,
    faded: circles.filter((e) => e.fill === "empty").length,
    arrow: arrow ? (arrow.from[0] > arrow.to[0] ? "in" : "out") : null,
    frame: els.some(
      (e) => e.type === "rect" && String(e.id).startsWith("slot"),
    ),
  };
}
const numbersIn = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

test("picture to number sentence: the key represents the action, every variant is reached", () => {
  const seen = new Map<string, number>();
  const positions = new Map<string, number>();
  for (const p of sample("picture-to-number-sentence", 600)) {
    const v = p.variant!.id;
    seen.set(v, (seen.get(v) ?? 0) + 1);
    positions.set(p.answer, (positions.get(p.answer) ?? 0) + 1);
    let action: "join" | "take", x: number, y: number;
    if (v.startsWith("story")) {
      assert.equal(p.public.figure, undefined);
      const story = p.public.prompt.replace(
        / Which number sentence tells the story\?$/,
        "",
      );
      [x, y] = numbersIn(story) as [number, number];
      action = /\bmore\b/.test(story) ? "join" : "take";
      assert.equal(action, v === "story-join" ? "join" : "take");
    } else {
      const c = counters(figureElements(p));
      assert.equal(c.frame, false);
      if (c.rust) {
        action = "join";
        [x, y] = [c.teal, c.rust];
        assert.equal(c.arrow, "in");
      } else {
        action = "take";
        [x, y] = [c.teal + c.faded, c.faded];
        assert.equal(c.arrow, "out");
      }
    }
    const result = action === "join" ? x + y : x - y;
    assert.ok(
      x >= 1 && y >= 1 && result >= 1 && result <= 10,
      `${v} ${x} ${y}`,
    );
    if (action === "join") assert.ok(x <= 9 && y <= 9);
    const labels = choiceLabels(p).map((o) => o.label);
    assert.equal(new Set(labels).size, 4);
    const key = correctLabel(p);
    if (v.startsWith("words")) assert.deepEqual(numbersIn(key), [x, y, result]);
    else {
      const sign = action === "join" ? "+" : "-";
      const eq = v.endsWith("-eq") || v.startsWith("story");
      assert.equal(
        key,
        eq ? `$${x} ${sign} ${y} = ${result}$` : `$${x} ${sign} ${y}$`,
      );
      // Never offered as a wrong choice: the turnaround or a result-first form.
      for (const l of labels.filter((l) => l !== key)) {
        assert.notEqual(l, `$${y} + ${x}$`);
        assert.doesNotMatch(l, /^\$\d+ = /);
        assert.ok(
          numbersIn(l).every((n) => n <= 19),
          l,
        );
      }
      // The key is never the only choice that uses both numbers of the picture.
      if (!eq)
        assert.ok(
          labels.filter(
            (l) => numbersIn(l).includes(x) && numbersIn(l).includes(y),
          ).length >= 2,
          labels.join(" | "),
        );
    }
    assert.equal(Object.keys(p.choiceFeedback ?? {}).length, 3);
  }
  for (const v of [
    "join-expr",
    "take-expr",
    "join-eq",
    "take-eq",
    "story-join",
    "story-take",
    "words-join",
    "words-take",
  ])
    assert.ok((seen.get(v) ?? 0) >= 10, `${v}: ${seen.get(v)}`);
  for (const n of positions.values())
    assert.ok(n > 600 * 0.17, `positions ${[...positions]}`);
});

test("number sentence to picture: exactly one picture matches both numbers and the action", () => {
  const seen = new Set<string>();
  for (const p of sample("number-sentence-to-picture")) {
    seen.add(p.variant!.id);
    const m =
      /^Which (picture|ten frame) shows \$(\d+) ([+-]) (\d+)(?: = (\d+))?\$\?$/.exec(
        p.public.prompt,
      );
    assert.ok(m, p.public.prompt);
    const [x, sign, y] = [Number(m![2]), m![3], Number(m![4])];
    const result = sign === "+" ? x + y : x - y;
    if (m![5]) assert.equal(Number(m![5]), result);
    assert.ok(result >= 1 && result <= 10);
    const r = p.public.response;
    if (r.kind !== "figure-choice") throw new Error("figure-choice");
    assert.equal(r.noun, "Picture");
    const matching = r.options.filter((o) => {
      const c = counters(elementsOf(o.scene));
      if (m![1] === "ten frame")
        return c.frame && c.teal === x && c.rust === y && c.faded === 0;
      return sign === "+"
        ? c.teal === x && c.rust === y && c.faded === 0 && c.arrow === "in"
        : c.teal === result &&
            c.rust === 0 &&
            c.faded === y &&
            c.arrow === "out";
    });
    assert.deepEqual(
      matching.map((o) => o.id),
      [p.answer],
    );
    assert.equal(new Set(r.options.map((o) => o.label)).size, 4);
  }
  assert.deepEqual([...seen].sort(), ["frame-pic", "join-pic", "take-pic"]);
});

/* ------------------------------------------------------------- oracle */

test("the independent oracle agrees on 256 seeds of every template and rejects corruption", () => {
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
import k_build_represent_math_oracle as oracle
print(oracle.self_test())
cases = json.load(sys.stdin)
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer'], problem['public']['seed']
    assert oracle.solve(problem['public']) == problem['answer']
rejected = 0
seen = set()
for problem in cases:
    template = problem['public']['templateId']
    if template in seen:
        continue
    seen.add(template)
    bad = copy.deepcopy(problem)
    if problem['public']['response']['kind'] == 'number':
        bad['answer'] = str(int(problem['answer']) + 1)
    else:
        ids = [o['id'] for o in problem['public']['response']['options']]
        bad['answer'] = next(i for i in ids if i != problem['answer'])
    try:
        oracle.review_problem(bad)
    except ValueError:
        rejected += 1
print({'cases': len(cases), 'rejected': rejected})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'mutations': 8/);
  assert.match(result.stdout, /'cases': 1280, 'rejected': 5/);
});
