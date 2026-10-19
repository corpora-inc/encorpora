import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem } from "../src/math/engine.js";
import {
  completeTable,
  describeScene,
  layoutScene,
  sceneSchema,
  type Drawn,
  type Graph,
  type Table,
} from "../src/math/scene/index.js";
import { graph, table } from "../src/math/scene/author.js";
import {
  frameAt,
  missingTargets,
  visibleSteps,
} from "../src/math/scene/timeline.js";
import { sceneIllustrations } from "../src/content/scene-illustrations.js";

const texts = (items: Drawn[]) =>
  items.flatMap((d) => (d.k === "text" ? [d] : []));
const element = <T>(id: string, seed: string) => {
  const f = generateProblem(id, seed).public.figure;
  assert(f?.kind === "scene", id);
  assert.ok(sceneSchema.safeParse(f.scene).success, id);
  return { scene: f.scene, e: f.scene.elements[0] as T };
};

test("a summed table finds its derived cell from the totals and masks it", () => {
  const t = table({
    title: "Has a curfew",
    columns: ["Yes", "No", "Total"],
    rows: [
      { label: "Grade 7", cells: [18, 2, 20] },
      { label: "Grade 8", cells: [null, null, 60] },
      { label: "Total", cells: [42, 38, 80] },
    ],
    sums: true,
    derived: [[1, 0]],
  }).scene();
  const cell = (reveal: boolean) =>
    texts(layoutScene(t, { reveal }).items).find((d) => d.id === "e0.cell.1.0")!
      .plain;
  assert.equal(cell(false), "?");
  assert.equal(cell(true), "24");
  // The blank beside it is drawn empty, never filled in.
  assert.ok(
    !texts(layoutScene(t, { reveal: true }).items).some(
      (d) => d.id === "e0.cell.1.1",
    ),
  );
  assert.match(describeScene(t), /the number to find, blank, 60/);
  assert.match(describeScene(t, true), /Grade 8: 24, blank, 60/);
  // Inconsistent totals or an undetermined unknown are rejected.
  const bad = (rows: Table["rows"], derived?: [number, number][]) =>
    sceneSchema.safeParse({
      v: 1,
      elements: [
        {
          type: "table",
          columns: ["A", "B", "Total"],
          rows,
          sums: true,
          derived,
        },
      ],
    }).success;
  assert.equal(
    bad([
      { label: "x", cells: [1, 2, 3] },
      { label: "Total", cells: [1, 2, 4] },
    ]),
    false,
  );
  assert.equal(
    bad(
      [
        { label: "x", cells: [null, null, 3] },
        { label: "Total", cells: [null, null, 3] },
      ],
      [[0, 0]],
    ),
    false,
  );
  assert.deepEqual(
    completeTable({
      rows: [
        { cells: [null, 2, 5] },
        { cells: [4, null, 10] },
        { cells: [7, 8, 15] },
      ],
    }),
    [
      [3, 2, 5],
      [4, 6, 10],
      [7, 8, 15],
    ],
  );
});

test("a graph grid can step differently across and up", () => {
  const s = graph({ x: [0, 10], y: [30, 100], grid: [1, 10], tick: [1, 10] })
    .scatter([[2, 40]])
    .scene();
  const l = layoutScene(s);
  const grids = (axis: "x" | "y") =>
    l.items.filter((d) => d.id.startsWith(`e0.grid.${axis}.`)).length;
  // Eleven x values and eight y values, less each axis line itself.
  assert.equal(grids("x"), 10);
  assert.equal(grids("y"), 7);
  assert.match(describeScene(s), /every 1 across and every 10 up/);
});

test("two-way problems ask for a cell whose row has two blanks", () => {
  for (let i = 0; i < 60; i++) {
    const { e } = element<Table>("two-way-missing", `blank-${i}`);
    assert.equal(e.derived?.length, 1);
    const [[r, c]] = e.derived! as [[number, number]];
    assert.deepEqual(
      e.rows[r]!.cells.slice(0, 2).map((v) => v === null),
      [true, true],
    );
    assert.ok(e.rows[1 - r]!.cells.every((v) => typeof v === "number"));
    const full = completeTable(e)!;
    assert.equal(
      String(full[r]![c]),
      generateProblem("two-way-missing", `blank-${i}`).answer,
    );
  }
  for (const id of ["two-way-row-percent", "two-way-association-choice"])
    for (let i = 0; i < 30; i++) {
      const { e } = element<Table>(id, `full-${i}`);
      assert.equal(e.derived, undefined);
      assert.ok(completeTable(e));
    }
});

test("trend lines pass through their marked points; points stay on the grid", () => {
  for (const id of ["trend-line-predict", "trend-slope-meaning"])
    for (let i = 0; i < 40; i++) {
      const { e, scene } = element<Graph>(id, `line-${i}`);
      const fit = e.scatter!.fit!;
      assert.equal(e.points?.length, 2);
      for (const p of e.points!) assert.equal(fit.m * p.x + fit.b, p.y);
      for (const [x, y] of e.scatter!.points) {
        assert.ok(x >= e.x[0] && x <= e.x[1]);
        assert.ok(y >= e.y[0] && y <= e.y[1]);
      }
      const l = layoutScene(scene);
      assert.ok(l.width <= 720 && l.height > 0);
    }
  for (let i = 0; i < 40; i++) {
    const { e } = element<Graph>("scatter-association-choice", `cloud-${i}`);
    assert.equal(e.scatter!.fit, undefined);
    assert.ok(e.scatter!.points.length >= 12);
  }
  for (const s of Object.values(sceneIllustrations))
    assert.ok(sceneSchema.safeParse(s).success);
});

test("walkthroughs name only parts their scenes draw, and hide only what they add", () => {
  const ids = [
    "trend-line-predict",
    "trend-slope-meaning",
    "two-way-missing",
    "two-way-row-percent",
    "two-way-association-choice",
  ];
  for (const id of ids)
    for (let i = 0; i < 20; i++) {
      const f = generateProblem(id, `walk-${i}`).public.figure;
      assert(f?.kind === "scene" && f.scene.steps?.length, id);
      const layout = layoutScene(f.scene);
      assert.deepEqual(missingTargets(layout, f.scene.steps), [], id);
      // The start frame is the problem: its givens stay visible.
      const start = frameAt(layout, f.scene.steps, -1, 0);
      const hidden = (prefix: string) =>
        layout.items
          .filter((d) => d.id.startsWith(prefix))
          .every((d) => start[d.id]?.opacity === 0);
      if (id.startsWith("trend")) {
        assert.ok(hidden("g.trial") && hidden("g.residual"));
        assert.equal(start["g.fit"]?.opacity, undefined);
        for (const d of layout.items.filter((d) =>
          d.id.startsWith("g.scatter"),
        ))
          assert.equal(start[d.id]?.opacity, undefined);
      } else
        assert.ok(
          layout.items.every((d) => start[d.id]?.opacity !== 0),
          "tables only highlight",
        );
      // A hint plays only the steps that do not reveal the result.
      assert.ok(visibleSteps(f.scene.steps, "hint").length >= 1);
    }
  for (const s of Object.values(sceneIllustrations))
    if (s.steps)
      assert.deepEqual(
        missingTargets(layoutScene(s, { reveal: true }), s.steps),
        [],
      );
});

test("a prediction's value is masked in problems and revealed in lessons", () => {
  const p = generateProblem("trend-line-predict", "mask-1");
  const f = p.public.figure;
  assert(f?.kind === "scene");
  const label = (reveal: boolean) =>
    texts(layoutScene(f.scene, { reveal }).items).find(
      (d) => d.id === "g.predict.label",
    )!.plain;
  assert.equal(label(false), "?");
  assert.equal(label(true), p.answer);
  assert.ok(!JSON.stringify(f).includes(`"${p.answer}"`));
});
