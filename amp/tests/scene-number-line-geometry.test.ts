import assert from "node:assert/strict";
import test from "node:test";
import { numberLine } from "../src/math/scene/author.js";
import { generateProblem } from "../src/math/engine.js";
import type { Scene } from "../src/math/scene/index.js";
import { CONTAINERS, faults } from "./helpers/scene-geometry.js";

/**
 * Number lines stay readable at every range, orientation and box: tick
 * numbers never collide (every n-th tick is numbered, n from 1, 2, 5, 10, …
 * by the room at hand), the values a figure refers to are always named, a
 * minus is a minus sign, hops and dots keep off the numbers, and everything
 * sits inside the figure. QA 2026-11-17: a vertical line from −6 to 15
 * numbered every tick in a 290 px card, and the numbers ran together.
 */
type Case = {
  name: string;
  min: number;
  max: number;
  step?: number;
  denominator?: number;
  start: number;
  by: number;
};
const cases: Case[] = [
  { name: "−6…15, 5 up 9 (QA)", min: -6, max: 15, start: 5, by: 9 },
  { name: "−20…20", min: -20, max: 20, start: -13, by: 21 },
  { name: "0…100", min: 0, max: 100, start: 37, by: 45 },
  { name: "0…100 by 10", min: 0, max: 100, step: 10, start: 30, by: 50 },
  { name: "−1…1 by 0.1", min: -1, max: 1, step: 0.1, start: -0.7, by: 1.2 },
  { name: "−5…5 by 0.5", min: -5, max: 5, step: 0.5, start: 2.5, by: -6 },
  {
    name: "0…3 in quarters",
    min: 0,
    max: 3,
    denominator: 4,
    start: 0.25,
    by: 2,
  },
  { name: "−11…−1", min: -11, max: -1, start: -2, by: -7 },
];
const scenes = (c: Case) =>
  (["horizontal", "vertical"] as const).flatMap((orientation) =>
    [
      [260, 290],
      [360, 320],
      [720, 400],
      [200, 160],
    ].map(([width, maxHeight]) => ({
      what: `${c.name} ${orientation} ${width}×${maxHeight}`,
      scene: numberLine({
        id: "n",
        min: c.min,
        max: c.max,
        ...(c.step !== undefined && { step: c.step }),
        ...(c.denominator !== undefined && { denominator: c.denominator }),
        ...(orientation === "vertical" && { orientation }),
        marks: [
          { at: c.start, label: true },
          { at: c.start + c.by, label: true },
        ],
        hops: [{ from: c.start, by: c.by, landing: "shown", label: false }],
      }).scene({ width: width!, maxHeight: maxHeight! }),
    })),
  );

const tickLabels = (scene: Scene, container = CONTAINERS[0]!) =>
  faults(scene, container).layout.items.flatMap((d) =>
    d.k === "text" && /\.label\.[-\d.]+$/.test(d.id) ? [d] : [],
  );

test("number lines: no label meets another label, a dot or an arrow, in any box", () => {
  const problems: string[] = [];
  for (const c of cases)
    for (const { what, scene } of scenes(c))
      for (const box of CONTAINERS)
        for (const f of faults(scene, box).faults)
          problems.push(`${what} in ${box.name}: ${f.rule}: ${f.detail}`);
  assert.deepEqual(problems, []);
});

test("number lines name 0 and the values the figure refers to, with a minus sign", () => {
  for (const c of cases)
    for (const { what, scene } of scenes(c)) {
      const labels = tickLabels(scene);
      const shown = new Set(
        faults(scene, CONTAINERS[0]!).layout.items.flatMap((d) =>
          d.k === "text" ? [d.plain] : [],
        ),
      );
      for (const t of labels)
        assert.ok(
          !t.plain.includes("-"),
          `${what}: "${t.plain}" uses a hyphen`,
        );
      const named = (v: number) =>
        c.denominator
          ? true
          : shown.has(String(Math.round(v * 1e9) / 1e9).replace("-", "−"));
      assert.ok(named(c.start), `${what}: start ${c.start} named`);
      assert.ok(named(c.start + c.by), `${what}: end named`);
      if (c.min <= 0 && c.max >= 0) assert.ok(named(0), `${what}: 0 named`);
      // Numbered ticks are evenly strided apart from the named values.
      assert.ok(labels.length >= 3, `${what}: at least three numbers`);
    }
});

test("a vertical number line fills its card's height, numbers left and hop right", () => {
  const scene = numberLine({
    id: "n",
    min: -6,
    max: 15,
    orientation: "vertical",
    marks: [
      { at: 5, label: true },
      { at: 14, label: true },
    ],
    hops: [{ from: 5, by: 9, landing: "shown", label: false }],
  }).scene({ width: 260, maxHeight: 290 });
  const { layout } = faults(scene, CONTAINERS[0]!);
  assert.ok(layout.height >= 0.95 * 290, `height ${layout.height}`);
  const axis = layout.items.find((d) => d.id === "n.axis");
  assert.ok(axis?.k === "line");
  const x = axis.x1;
  for (const t of tickLabels(scene))
    assert.ok(t.box.x1 < x - 6, `"${t.plain}" left of the axis`);
  const hop = layout.items.find((d) => d.id === "n.hop.0");
  assert.ok(hop?.k === "path");
  const xs = hop.d
    .match(/-?\d+(?:\.\d+)?/g)!
    .map(Number)
    .filter((_, i) => i % 2 === 0);
  assert.ok(Math.max(...xs) > x + 12, "the hop bows right, clear of the axis");
  // Numbers are evenly spaced: every other tick on this range, plus the
  // referenced 5, whose neighbours give way.
  const plain = tickLabels(scene).map((t) => t.plain);
  for (const v of ["−5", "0", "5", "14"]) assert.ok(plain.includes(v), v);
  assert.ok(plain.length < 22 / 1.5, `${plain.length} numbers, not every tick`);
});

test("the QA problem's four vertical number lines are readable in every card", () => {
  {
    const p = generateProblem("signed-jumps", "qa-9741").public;
    assert.match(p.prompt, /vertical number line .* 5°C rising 9°C/);
    assert.equal(p.response.kind, "figure-choice");
    if (p.response.kind !== "figure-choice") return;
    for (const o of p.response.options) {
      const line = o.scene.elements.find((e) => e.type === "numberLine");
      assert.ok(
        line && line.type === "numberLine" && line.orientation === "vertical",
      );
      for (const box of CONTAINERS)
        assert.deepEqual(
          faults(o.scene, box).faults.map(
            (f) => `${o.id} ${box.name}: ${f.detail}`,
          ),
          [],
        );
    }
  }
});
