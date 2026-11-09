import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import { layoutScene } from "../src/math/scene";
import type { Scene } from "../src/math/scene/spec";

/**
 * Independent checks for the area-by-counting family (3.MD.C.6). Areas are
 * recounted from the drawn paths: the unit cells of a shaded figure, and the
 * tiles of a covering compared cell by cell with its surface. Nothing here
 * calls the generator's own shape helpers.
 */

const IDS = [
  "count-unit-squares",
  "unit-square-area-statement",
  "improvised-unit-count",
  "improvised-unit-covering",
  "improvised-unit-change",
] as const;
const many = (id: string, n: number, tag = "t") =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `${tag}-${i}`));

type Pt = [number, number];
type Op = (string | number)[];
const elementsOf = (scene: Scene) =>
  new Map(
    scene.elements.flatMap((e) => ("id" in e && e.id ? [[e.id, e]] : [])),
  ) as Map<string, Record<string, unknown>>;
function subpaths(d: Op[]): Pt[][] {
  const out: Pt[][] = [];
  let current: Pt[] = [];
  for (const op of d) {
    if (op[0] === "M") current = [[op[1] as number, op[2] as number]];
    else if (op[0] === "L") current.push([op[1] as number, op[2] as number]);
    else if (op[0] === "Z") out.push(current);
  }
  return out;
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
/** [x, y, side] of a square subpath. */
function squareOf(points: Pt[]): [number, number, number] {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  const side = Math.max(...xs) - x;
  assert.ok(near(side, Math.max(...ys) - y), "square");
  return [x, y, side];
}
function sceneOf(p: GeneratedProblem): Scene {
  const f = p.public.figure;
  assert.equal(f?.kind, "scene");
  if (!f || f.kind !== "scene") throw new Error("scene");
  return f.scene;
}
/** Shaded cells as [column, row from top], and the grid box. */
function shaded(scene: Scene) {
  const by = elementsOf(scene);
  const grid = (by.get("grid")!.d as Op[]).filter((op) => op[0] !== "Z");
  const cols = Math.max(...grid.map((op) => op[1] as number));
  const rows = Math.max(...grid.map((op) => op[2] as number));
  const cells = subpaths(by.get("cells")!.d as Op[]).map((sub) => {
    const [x, y, side] = squareOf(sub);
    assert.equal(side, 1);
    return [x, rows - 1 - y] as Pt;
  });
  return { cells, cols, rows };
}
const key = ([c, r]: Pt) => `${c},${r}`;
function connected(cells: Pt[]) {
  const all = new Set(cells.map(key));
  const seen = new Set([key(cells[0]!)]);
  const stack = [cells[0]!];
  while (stack.length) {
    const [c, r] = stack.pop()!;
    for (const n of [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ] as Pt[])
      if (all.has(key(n)) && !seen.has(key(n))) {
        seen.add(key(n));
        stack.push(n);
      }
  }
  return seen.size === all.size;
}
/** Unshaded cells of the box that cannot reach the outside. */
function enclosed(cells: Pt[], cols: number, rows: number) {
  const all = new Set(cells.map(key));
  const out = new Set(["-1,-1"]);
  const stack: Pt[] = [[-1, -1]];
  while (stack.length) {
    const [c, r] = stack.pop()!;
    for (const [nc, nr] of [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ] as Pt[]) {
      if (nc < -1 || nr < -1 || nc > cols || nr > rows) continue;
      const k = key([nc, nr]);
      if (all.has(k) || out.has(k)) continue;
      out.add(k);
      stack.push([nc, nr]);
    }
  }
  const holes: Pt[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!all.has(key([c, r])) && !out.has(key([c, r]))) holes.push([c, r]);
  return holes;
}
const canon = (cells: Pt[]) => {
  const c0 = Math.min(...cells.map((c) => c[0])),
    r0 = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([c, r]) => [c - c0, r - r0] as Pt)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .map(key)
    .join(";");
};
/** Surface cells (math coordinates) from the outline, by cell centers. */
function surfaceCells(scene: Scene) {
  const loops = subpaths(elementsOf(scene).get("surface")!.d as Op[]);
  const inside = (x: number, y: number) => {
    let hit = false;
    for (const loop of loops)
      for (let i = 0; i < loop.length; i++) {
        const [x1, y1] = loop[i]!,
          [x2, y2] = loop[(i + 1) % loop.length]!;
        if (y1 > y !== y2 > y && x1 + ((y - y1) * (x2 - x1)) / (y2 - y1) > x)
          hit = !hit;
      }
    return hit;
  };
  const out = new Set<string>();
  for (let x = 0; x < 8; x++)
    for (let y = 0; y < 7; y++)
      if (inside(x + 0.5, y + 0.5)) out.add(`${x},${y}`);
  return out;
}
function tilesOf(scene: Scene, id: string): Pt[] {
  const element = elementsOf(scene).get(id);
  if (!element) return [];
  return subpaths(element.d as Op[]).map((sub) => {
    const [x, y, side] = squareOf(sub);
    assert.ok(near(side, 0.88), "tile side");
    return [x - 0.06, y - 0.06];
  });
}
function coveringOf(scene: Scene) {
  const surface = surfaceCells(scene);
  const tiles = [...tilesOf(scene, "tiles"), ...tilesOf(scene, "extra")];
  const onCells = tiles.filter(
    ([x, y]) => near(x, Math.round(x)) && near(y, Math.round(y)),
  );
  const keys = onCells.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`);
  const exact =
    onCells.length === tiles.length &&
    new Set(keys).size === keys.length &&
    keys.length === surface.size &&
    keys.every((k) => surface.has(k));
  return { surface, tiles, exact };
}

test("templates are registered with their skill, band and capabilities", () => {
  for (const id of IDS) {
    const t = templates.find((x) => x.id === id);
    assert.ok(t, id);
    assert.equal(t.skillId, "area-by-counting-squares");
    assert.equal(t.gradeBand, "3–5");
    assert.equal(t.requiredFigureCapability, "scenes-v1");
  }
  assert.equal(
    templates.find((t) => t.id === "improvised-unit-covering")!
      .requiredResponseCapability,
    "figure-choice-v1",
  );
  for (const id of ["unit-square-area-statement", "improvised-unit-change"])
    assert.equal(
      templates.find((t) => t.id === id)!.requiredResponseCapability,
      "single-choice-v1",
    );
});

test("every problem is schema-valid, deterministic and keeps one response kind", () => {
  for (const id of IDS) {
    const kinds = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const p = generateProblem(id, `det-${i}`);
      assert.deepEqual(p, generateProblem(id, `det-${i}`), `${id} det-${i}`);
      assert.ok(generatedProblemSchema.safeParse(p).success, `${id} det-${i}`);
      kinds.add(p.public.response.kind);
    }
    assert.equal(kinds.size, 1, id);
  }
});

test("count-unit-squares: area is the shaded-cell count, shapes are valid, every variant appears", () => {
  const problems = many("count-unit-squares", 400, "count");
  const variants = new Map<string, number>();
  for (const p of problems) {
    const { cells, cols, rows } = shaded(sceneOf(p));
    const v = p.variant!.id;
    variants.set(v, (variants.get(v) ?? 0) + 1);
    assert.equal(p.answer, String(cells.length));
    assert.ok(connected(cells), `${p.public.seed} connected`);
    assert.ok(cols <= 7 && rows <= 6, "bounding box at most 7 by 6");
    const holes = enclosed(cells, cols, rows);
    if (v === "rectangle") {
      assert.equal(cells.length, cols * rows);
      assert.ok(cells.length >= 6 && cells.length <= 30);
      assert.ok(cols !== rows || (cols >= 3 && cols <= 5));
    } else if (v === "polyomino") {
      assert.ok(cells.length < cols * rows, "not a rectangle");
      assert.ok(cells.length >= 6 && cells.length <= 20);
      assert.ok(cols <= 6 && rows <= 5);
      assert.equal(holes.length, 0);
    } else if (v.startsWith("hole-")) {
      assert.ok(holes.length === 1 || holes.length === 2, "one or two holes");
      assert.ok(cols >= 4 && rows >= 4);
      assert.ok(cells.length >= 10 && cells.length <= 30);
      assert.match(p.explanation.join(" "), /hole/);
    } else {
      assert.match(v, /^composite-(l|t|u|plus|stairs)$/);
      assert.ok(cells.length < cols * rows, "not a rectangle");
      assert.ok(cells.length >= 8 && cells.length <= 30);
      assert.equal(holes.length, 0);
    }
    assert.equal(
      p.public.response.kind === "number" && p.public.response.label,
      {
        cm: "square centimeters",
        in: "square inches",
        ft: "square feet",
        m: "square meters",
      }[p.variant!.axes!.unit!],
    );
  }
  for (const v of [
    "rectangle",
    "polyomino",
    "composite-l",
    "composite-t",
    "composite-u",
    "composite-plus",
    "composite-stairs",
  ])
    assert.ok((variants.get(v) ?? 0) > 0, v);
  const holes = [...variants].filter(([k]) => k.startsWith("hole-"));
  assert.ok(holes.reduce((s, [, n]) => s + n, 0) > 15, "holes appear");
  // Weights 15 / 35 / 30 / 10, with tolerance.
  const share = (prefix: string) =>
    [...variants]
      .filter(([k]) => k.startsWith(prefix))
      .reduce((s, [, n]) => s + n, 0) / problems.length;
  assert.ok(Math.abs(share("rectangle") - 15 / 90) < 0.07);
  assert.ok(Math.abs(share("composite") - 35 / 90) < 0.08);
  assert.ok(Math.abs(share("polyomino") - 30 / 90) < 0.08);
  // A–D all appear within the first 60 seeds.
  const early = new Set(
    problems.slice(0, 60).map((p) => p.variant!.id.split("-")[0]),
  );
  for (const v of ["rectangle", "composite", "polyomino", "hole"])
    assert.ok(early.has(v), v);
});

test("irregular shapes vary: 200 polyominoes give at least 120 distinct shapes", () => {
  const shapes: string[] = [];
  for (let i = 0; shapes.length < 200 && i < 2000; i++) {
    const p = generateProblem("count-unit-squares", `poly-${i}`);
    if (p.variant!.id === "polyomino")
      shapes.push(canon(shaded(sceneOf(p)).cells));
  }
  assert.equal(shapes.length, 200);
  assert.ok(new Set(shapes).size >= 120, `${new Set(shapes).size}`);
});

test("units spread evenly and contexts match their unit", () => {
  const contexts: Record<string, string[]> = {
    cm: ["sticker", "paper cut-out", "game piece", "stamp design"],
    in: [
      "mosaic tile design",
      "bookmark",
      "phone case pattern",
      "cookie cut-out",
    ],
    ft: ["patio", "rug", "garden bed", "sandbox", "dance floor"],
    m: ["stage", "school garden", "reading corner", "garden shed floor"],
  };
  for (const id of ["count-unit-squares", "unit-square-area-statement"]) {
    const counts = new Map<string, number>();
    for (const p of many(id, 100, "unit")) {
      const unit = p.variant!.axes!.unit!;
      counts.set(unit, (counts.get(unit) ?? 0) + 1);
      const noun = p.public.prompt.match(
        /area of the ([a-z -]+?)( is true)?\?/,
      )![1]!;
      assert.ok(contexts[unit]!.includes(noun), `${unit}: ${noun}`);
      assert.doesNotMatch(p.public.prompt, /formula|perimeter|ft²|cm²|\$/);
    }
    for (const unit of Object.keys(contexts))
      assert.ok(
        (counts.get(unit) ?? 0) >= 15,
        `${id} ${unit}: ${counts.get(unit)}`,
      );
  }
});

test("the area statement: four distinct statements, one true, the plain unit carries the count", () => {
  const positions = new Map<string, number>();
  let notLargest = 0;
  for (const p of many("unit-square-area-statement", 400, "stmt")) {
    const r = p.public.response;
    assert.equal(r.kind, "choice");
    if (r.kind !== "choice") continue;
    const n = shaded(sceneOf(p)).cells.length;
    const parsed = r.options.map((o) => {
      const m = o.label.match(/^The area is (\d+) (.+)\.$/)!;
      return { id: o.id, value: Number(m[1]), unit: m[2]! };
    });
    const squareUnit = parsed.filter((o) => o.unit.startsWith("square "));
    assert.equal(squareUnit.length, 3);
    const truth = parsed.filter(
      (o) => o.value === n && o.unit.startsWith("square "),
    );
    assert.equal(truth.length, 1);
    assert.equal(p.answer, truth[0]!.id);
    assert.ok(
      parsed.some((o) => o.value === n && !o.unit.startsWith("square ")),
    );
    assert.equal(new Set(parsed.map((o) => `${o.value} ${o.unit}`)).size, 4);
    for (const o of parsed)
      if (o.id !== p.answer) assert.ok(p.choiceFeedback![o.id]!.length > 20);
    positions.set(p.answer, (positions.get(p.answer) ?? 0) + 1);
    if (Math.max(...squareUnit.map((o) => o.value)) !== n) notLargest++;
  }
  for (const id of ["option-a", "option-b", "option-c", "option-d"])
    assert.ok((positions.get(id) ?? 0) >= 60, `${id}: ${positions.get(id)}`);
  assert.ok(notLargest > 100 && notLargest < 400);
});

test("explanations count row by row and the description lists the same rows", () => {
  for (const id of ["count-unit-squares", "unit-square-area-statement"])
    for (const p of many(id, 80, "rows")) {
      const scene = sceneOf(p);
      const { cells, rows } = shaded(scene);
      const counts = Array.from(
        { length: rows },
        (_, r) => cells.filter((c) => c[1] === r).length,
      );
      const lines = p.explanation.filter((l) => l.startsWith("Row "));
      assert.equal(lines.length, rows);
      let total = 0;
      lines.forEach((line, i) => {
        const m = line.match(
          /has (\d+) shaded squares?: (?:\$\d+ \+ \d+ = (\d+)\$|(\d+)) so far\.$/,
        )!;
        assert.equal(Number(m[1]), counts[i]);
        total += counts[i]!;
        assert.equal(Number(m[2] ?? m[3]), total);
      });
      assert.equal(total, cells.length);
      assert.ok(
        scene.note!.startsWith(
          `Shaded squares in each row, from the top: ${counts.join(", ")}.`,
        ),
      );
      assert.match(p.explanation.at(-1)!, /box|rows of/);
    }
});

test("improvised-unit-count: the drawn covering is exact and the answer is its count", () => {
  const shapes = new Set<string>();
  for (const p of many("improvised-unit-count", 200, "imp")) {
    const { surface, tiles, exact } = coveringOf(sceneOf(p));
    assert.ok(exact, p.public.seed);
    assert.equal(p.answer, String(tiles.length));
    assert.ok(tiles.length >= 6 && tiles.length <= 30);
    const xs = [...surface].map((k) => Number(k.split(",")[0]));
    const ys = [...surface].map((k) => Number(k.split(",")[1]));
    assert.ok(Math.max(...xs) < 7 && Math.max(...ys) < 5, "box at most 7 by 5");
    shapes.add(p.variant!.id);
    const unit =
      p.public.response.kind === "number" ? p.public.response.label : "";
    assert.ok(p.public.prompt.endsWith(`in ${unit}?`));
    assert.ok(
      !p.hint.includes(` ${p.answer} `) && !p.hint.endsWith(` ${p.answer}.`),
    );
  }
  assert.deepEqual([...shapes].sort(), ["l-shape", "rectangle", "t-shape"]);
});

test("improvised-unit-covering: one exact covering, one with gaps, one with overlaps", () => {
  const places = new Set<string>();
  const positions = new Map<string, number>();
  for (const p of many("improvised-unit-covering", 200, "cover")) {
    const r = p.public.response;
    assert.equal(r.kind, "figure-choice");
    if (r.kind !== "figure-choice") continue;
    assert.equal(r.noun, "Picture");
    assert.equal(r.options.length, 3);
    const kinds = r.options.map((o) => {
      const { surface, tiles, exact } = coveringOf(o.scene);
      assert.equal(Number(o.label.match(/^(\d+) /)![1]), tiles.length);
      return { id: o.id, area: surface.size, tiles: tiles.length, exact };
    });
    assert.equal(new Set(kinds.map((k) => k.area)).size, 1, "same surface");
    const area = kinds[0]!.area;
    assert.ok(area >= 8 && area <= 20);
    const exact = kinds.filter((k) => k.exact);
    assert.equal(exact.length, 1);
    assert.equal(p.answer, exact[0]!.id);
    assert.ok(
      kinds.some((k) => !k.exact && k.tiles < area),
      "gap covers fewer",
    );
    assert.ok(
      kinds.some((k) => !k.exact && k.tiles > area),
      "overlap uses more",
    );
    assert.match(p.explanation.join(" "), /bare/);
    assert.match(p.explanation.join(" "), /on top of/);
    places.add(p.variant!.id);
    positions.set(p.answer, (positions.get(p.answer) ?? 0) + 1);
  }
  assert.deepEqual([...places].sort(), ["gap-edge", "gap-inside"]);
  for (const id of ["option-a", "option-b", "option-c"])
    assert.ok((positions.get(id) ?? 0) >= 40, id);
});

test("improvised-unit-change: smaller units take more, larger take fewer; both directions appear", () => {
  const directions = new Map<string, number>();
  for (const p of many("improvised-unit-change", 200, "change")) {
    const m = p.public.prompt.match(
      /counted (\d+)\..*Each side of a (small|large) .* is (half|twice) as long/,
    )!;
    const n = Number(m[1]);
    const smaller = m[2] === "small";
    assert.equal(m[3] === "half", smaller);
    assert.ok(n >= 6 && n <= 24);
    const scene = sceneOf(p);
    assert.equal(coveringOf(scene).tiles.length, n);
    const by = elementsOf(scene);
    const side = (id: string) =>
      squareOf(subpaths(by.get(id)!.d as Op[])[0]!)[2];
    assert.ok(near(side("second") / side("first"), smaller ? 0.5 : 2));
    const r = p.public.response;
    if (r.kind !== "choice") throw new Error("choice");
    const want = smaller ? `More than ${n}` : `Fewer than ${n}`;
    assert.equal(r.options.find((o) => o.id === p.answer)!.label, want);
    assert.equal(r.options.length, 3);
    directions.set(p.variant!.id, (directions.get(p.variant!.id) ?? 0) + 1);
    assert.ok(p.hint.includes(String(n)));
  }
  assert.ok((directions.get("smaller-unit") ?? 0) > 60);
  assert.ok((directions.get("larger-unit") ?? 0) > 60);
});

test("figures stay legible on a 320 px phone and never label the answer", () => {
  for (const id of IDS)
    for (const p of many(id, 40, "lay")) {
      const scenes: Scene[] = [];
      if (p.public.figure?.kind === "scene") scenes.push(p.public.figure.scene);
      if (p.public.response.kind === "figure-choice")
        scenes.push(...p.public.response.options.map((o) => o.scene));
      for (const scene of scenes) {
        const layout = layoutScene(scene);
        assert.deepEqual(layout.dropped, [], `${id} ${p.public.seed}`);
        // A 320 px phone gives the figure a 288 px stage.
        const perUnit = layout.scale * Math.min(1, 288 / layout.width);
        assert.ok(perUnit >= 36, `${id} ${p.public.seed}: ${perUnit}`);
        const texts = scene.elements.flatMap((e) =>
          e.type === "text" ? [e.text] : [],
        );
        if (p.public.response.kind === "number")
          for (const text of texts)
            assert.ok(!text.includes(p.answer), `${id}: ${text}`);
      }
    }
});

test("the independent oracle agrees on 256 seeds of every template", () => {
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
import json, sys
sys.path.insert(0, 'scripts')
import area_by_counting_math_oracle as oracle
print(oracle.self_test())
seen = 0
for problem in json.load(sys.stdin):
    assert oracle.review_problem(problem) == problem['answer']
    assert oracle.solve(problem['public']) == problem['answer']
    seen += 1
print({'cases': seen})
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
  assert.match(result.stdout, /'mutations': 11/);
  assert.match(result.stdout, /'cases': 1280/);
});
