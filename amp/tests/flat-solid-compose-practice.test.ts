import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import { flatSolidComposeTemplates } from "../src/math/flat-solid-compose-practice";

/**
 * Flat or solid (K.G.A.3) and composite shapes (1.G.A.2). Answers are
 * recomputed from the drawn primitives by the independent oracle
 * (scripts/flat_solid_compose_math_oracle.py); the shape statistics below
 * are read from the figures by that oracle's reader, never from the
 * generator's own model.
 */

const IDS = flatSolidComposeTemplates.map((t) => t.id);
const SKILLS: Record<string, string> = {
  "flat-or-solid-name": "name-shapes",
  "pick-flat-or-solid": "name-shapes",
  "count-flat-or-solid": "name-shapes",
  "composite-shape-name": "composite-shapes",
  "composite-which-pieces": "composite-shapes",
  "composite-which-solids": "composite-shapes",
};
const sample = (id: string, n: number, prefix = "t") =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `${prefix}-${i}`));
const frequency = (problems: GeneratedProblem[]) => {
  const counts: Record<string, number> = {};
  for (const p of problems)
    counts[p.variant!.id] = (counts[p.variant!.id] ?? 0) + 1;
  return counts;
};
function python(script: string, input: unknown) {
  const result = spawnSync("python3", ["-c", script], {
    cwd: new URL("..", import.meta.url).pathname,
    input: JSON.stringify(input),
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return JSON.parse(result.stdout.trim().split("\n").at(-1)!);
}

test("every template is valid, deterministic and on its skill", () => {
  assert.deepEqual(IDS, Object.keys(SKILLS));
  for (const id of IDS)
    for (const [i, p] of sample(id, 60).entries()) {
      assert.equal(generatedProblemSchema.safeParse(p).success, true, id);
      assert.equal(p.public.skillId, SKILLS[id], id);
      assert.deepEqual(generateProblem(id, `t-${i}`), p, `${id} repeats`);
      assert.equal(p.public.figure?.kind, "scene", id);
    }
});

test("variant families are reached at their spec weights", () => {
  const within = (
    id: string,
    n: number,
    weights: Record<string, number>,
    slack = 0.08,
  ) => {
    const counts = frequency(sample(id, n, "w"));
    assert.deepEqual(
      Object.keys(counts).sort(),
      Object.keys(weights).sort(),
      id,
    );
    for (const [variant, weight] of Object.entries(weights))
      assert.ok(
        Math.abs(counts[variant]! / n - weight) <= slack,
        `${id} ${variant}: ${counts[variant]}/${n}`,
      );
  };
  within("flat-or-solid-name", 400, {
    "solid-with-lookalike": 0.45,
    "flat-with-lookalike": 0.45,
    "flat-circle-vs-round-solids": 0.1,
  });
  within("pick-flat-or-solid", 500, {
    "even-split": 0.3,
    "lookalike-pair": 0.45,
    "all-but-one": 0.15,
    "turned-flats": 0.1,
  });
  within("count-flat-or-solid", 400, { mixed: 0.6, "lookalike-heavy": 0.4 });
  within("composite-shape-name", 400, {
    "name-new-flat": 0.75,
    "name-new-solid": 0.25,
  });
  const solids = frequency(sample("composite-which-solids", 300, "w"));
  assert.equal(Object.keys(solids).length, 5);
});

test("choices are distinct, the shown count matches, and no true name is a distractor", () => {
  for (const p of sample("composite-shape-name", 300)) {
    const r = p.public.response;
    assert.equal(r.kind, "choice");
    if (r.kind !== "choice") continue;
    const labels = r.options.map((o) => o.label);
    assert.equal(new Set(labels).size, 4);
    const answer = r.options.find((o) => o.id === p.answer)!.label;
    if (answer === "square")
      assert.ok(!labels.includes("rectangle") && !labels.includes("trapezoid"));
    if (answer === "rectangle") assert.ok(!labels.includes("trapezoid"));
    assert.ok(!labels.includes("sphere"), "sphere is never offered");
    for (const o of r.options)
      if (o.id !== p.answer) assert.ok(p.choiceFeedback?.[o.id], "feedback");
  }
  for (const p of sample("flat-or-solid-name", 300)) {
    const r = p.public.response;
    if (r.kind !== "multi-part-choice") throw new Error("multi-part");
    const names = r.blanks[1]!.options.map((o) => o.label);
    assert.equal(new Set(names).size, 4);
    const solidNames = names.filter((n) =>
      ["cube", "cylinder", "cone", "sphere", "rectangular prism"].includes(n),
    );
    if (p.variant!.id === "flat-circle-vs-round-solids")
      assert.deepEqual([...names].sort(), [
        "circle",
        "cone",
        "cylinder",
        "sphere",
      ]);
    else assert.equal(solidNames.length, 2, names.join());
  }
  for (const id of ["pick-flat-or-solid", "composite-which-solids"])
    for (const p of sample(id, 200)) {
      const r = p.public.response;
      if (r.kind !== "multi-select") throw new Error("multi-select");
      assert.equal(JSON.parse(p.answer).length, r.selectionCount);
      assert.ok(r.selectionCount >= 2 && r.selectionCount < r.options.length);
    }
});

test("no figure description, hint or option names the hidden answer", () => {
  for (const p of sample("count-flat-or-solid", 200)) {
    assert.ok(!new RegExp(`\\b${p.answer}\\b`).test(p.hint), p.hint);
    const scene =
      p.public.figure?.kind === "scene" ? p.public.figure.scene : null;
    assert.ok(
      scene &&
        !/\b(flat|solid|cube|sphere|cone|cylinder)\b/i.test(
          `${scene.title} ${scene.note}`,
        ),
    );
  }
  for (const id of ["flat-or-solid-name", "pick-flat-or-solid"])
    for (const p of sample(id, 200)) {
      const scene =
        p.public.figure?.kind === "scene" ? p.public.figure.scene : null;
      const text = `${scene?.title} ${scene?.note} ${JSON.stringify(scene?.elements.map((e) => e.id))}`;
      assert.ok(
        !/\b(flat|solid|cube|sphere|cone|cylinder|square|circle|triangle|rectangle|hexagon|prism)\b/i.test(
          text,
        ),
        text,
      );
    }
  for (const p of sample("composite-which-solids", 200)) {
    const scene =
      p.public.figure?.kind === "scene" ? p.public.figure.scene : null;
    assert.ok(
      !/\b(cube|cone|cylinder|prism)\b/i.test(`${scene?.title} ${scene?.note}`),
    );
  }
});

test("the independent oracle reproduces every answer on 256 seeds per template and reads the spec's anti-cue rules", () => {
  const cases = IDS.flatMap((id) =>
    Array.from({ length: 256 }, (_, i) =>
      generateProblem(id, `independent-${i}`),
    ),
  );
  const stats = python(
    String.raw`
import json, math, sys
sys.path.insert(0, 'scripts')
import flat_solid_compose_math_oracle as oracle
oracle.self_test()
cases = json.load(sys.stdin)
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer'], problem['public']['seed']
    assert oracle.solve(problem['public']) == problem['answer']
PAIRS = [('square', 'cube'), ('rectangle', 'box'), ('circle', 'sphere'), ('circle', 'cylinder'), ('triangle', 'cone')]
def pairs(kinds):
    return [p for p in PAIRS if p[0] in kinds and p[1] in kinds]
def shapes_of(problem):
    return oracle.cell_shapes(problem['public']['figure']['scene'])
def cell_elements(problem, i):
    return [e for e in problem['public']['figure']['scene']['elements'] if e.get('id', '').startswith(f'c{i}') and not e['id'].endswith(('box', 'tag'))]
def box_area(elements):
    pts = []
    for e in elements:
        if e['type'] in ('polygon', 'polyline'):
            pts += e['points']
        elif e['type'] == 'circle':
            c, r = e['center'], e['r']
            pts += [[c[0] - r, c[1] - r], [c[0] + r, c[1] + r]]
        elif e['type'] == 'segment':
            pts += [e['from'], e['to']]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return (max(xs) - min(xs)) * (max(ys) - min(ys))
out = {'rows': 0, 'filled': 0, 'flatLargest': 0, 'mixed': 0, 'flatAsked': 0, 'pickRows': 0,
       'squares': 0, 'turnedSquares': 0, 'rects': 0, 'tallRects': 0, 'spheres': 0, 'shadedSpheres': 0}
for problem in cases:
    public = problem['public']
    template = public['templateId']
    variant = problem['variant']['id']
    if template in ('pick-flat-or-solid', 'count-flat-or-solid', 'flat-or-solid-name'):
        shapes = shapes_of(problem)
        kinds = [k for _, _, k in shapes]
        for i, (_, solid, kind) in enumerate(shapes):
            els = cell_elements(problem, i)
            if kind == 'square':
                p = els[0]['points']
                angle = abs(math.degrees(math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]))) % 90
                out['squares'] += 1
                out['turnedSquares'] += min(angle, 90 - angle) >= 14.9
            if kind == 'rectangle':
                p = els[0]['points']
                xs, ys = [q[0] for q in p], [q[1] for q in p]
                out['rects'] += 1
                out['tallRects'] += (max(ys) - min(ys)) > (max(xs) - min(xs))
            if kind == 'sphere':
                out['spheres'] += 1
                out['shadedSpheres'] += any(e['type'] == 'circle' and e.get('fill') == 'accent-fill' for e in els) and any(e['type'] == 'circle' and e.get('fill') == 'paper' for e in els)
        if template != 'flat-or-solid-name':
            out['rows'] += 1
            flats = [i for i, (_, solid, _) in enumerate(shapes) if not solid]
            out['filled'] += bool(flats) and cell_elements(problem, flats[0])[0].get('fill') == 'accent-fill'
            if flats and len(flats) < len(shapes):
                out['mixed'] += 1
                areas = [box_area(cell_elements(problem, i)) for i in range(len(shapes))]
                out['flatLargest'] += areas.index(max(areas)) in flats
            assert len(set(kinds)) == len(kinds)
        if template == 'pick-flat-or-solid':
            out['pickRows'] += 1
            out['flatAsked'] += 'flat' in public['prompt']
            want = 'flat' in public['prompt']
            chosen = [k for _, solid, k in shapes if solid != want]
            if variant == 'lookalike-pair':
                assert pairs(kinds), kinds
            if variant == 'all-but-one':
                lone = [k for _, solid, k in shapes if solid == want]
                assert len(lone) == 1 and any(lone[0] in p and (set(p) - {lone[0]}) <= set(chosen) for p in PAIRS), kinds
            if variant == 'turned-flats':
                assert want and 'circle' not in kinds
            if variant == 'even-split':
                assert len(chosen) * 2 == len(shapes)
        if template == 'count-flat-or-solid':
            assert 1 <= int(problem['answer']) <= 5
            if variant == 'lookalike-heavy':
                assert len(pairs(kinds)) >= 2 and len(kinds) in (4, 6), kinds
    if template == 'composite-which-solids':
        kinds = [oracle.solid_kind(g) for g in oracle.groups(public['figure']['scene']['elements'], r'p(\d+)').values()]
        assert kinds.count('cube') <= 1 and not (set(kinds) == {'cube'})
print(json.dumps(out))
`,
    cases,
  );
  const share = (a: number, b: number) => a / b;
  assert.ok(
    share(stats.filled, stats.rows) >= 0.4 &&
      share(stats.filled, stats.rows) <= 0.6,
    `filled ${stats.filled}/${stats.rows}`,
  );
  assert.ok(
    share(stats.flatAsked, stats.pickRows) >= 0.4 &&
      share(stats.flatAsked, stats.pickRows) <= 0.6,
    `flat asked ${stats.flatAsked}/${stats.pickRows}`,
  );
  assert.ok(
    share(stats.flatLargest, stats.mixed) >= 0.35 &&
      share(stats.flatLargest, stats.mixed) <= 0.65,
    `largest is flat ${stats.flatLargest}/${stats.mixed}`,
  );
  assert.ok(share(stats.turnedSquares, stats.squares) >= 0.5, "turned squares");
  assert.ok(share(stats.tallRects, stats.rects) >= 0.4, "tall rectangles");
  assert.equal(stats.shadedSpheres, stats.spheres, "every sphere is shaded");
});

test("every composite recipe target is reached and solids show their seams", () => {
  const flats = new Set<string>();
  for (const p of sample("composite-shape-name", 500, "r")) {
    const r = p.public.response;
    if (r.kind === "choice")
      flats.add(r.options.find((o) => o.id === p.answer)!.label);
  }
  assert.deepEqual([...flats].sort(), [
    "circle",
    "cylinder",
    "half-circle",
    "hexagon",
    "rectangle",
    "rectangular prism",
    "square",
    "trapezoid",
    "triangle",
  ]);
  // Each item's three wrong sets are the three misconceptions: the wrong
  // size, the wrong kinds, and one piece too few.
  const sizes = new Set<string>();
  for (const p of sample("composite-which-pieces", 200, "r")) {
    const texts = Object.values(p.choiceFeedback ?? {}).join("\n");
    assert.match(texts, /too (big|small)/);
    assert.match(texts, /wrong kinds/);
    assert.match(texts, /one is missing/);
    sizes.add(/too (big|small)/.exec(texts)![1]!);
  }
  assert.deepEqual([...sizes].sort(), ["big", "small"]);
});
