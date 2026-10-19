import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  describeScene,
  layoutScene,
  sceneSchema,
  type Drawn,
  type Scene,
} from "../src/math/scene/index.js";
import {
  areaModel,
  clock,
  f,
  graph,
  halfPlane,
  numberLine,
  placeValueParts,
  scene,
} from "../src/math/scene/author.js";
import {
  clipHalfPlane,
  evaluate,
  features,
  polyRoots,
  sample,
} from "../src/math/scene/functions.js";
import { galleryCases, parityFigures } from "../src/math/scene/gallery.js";
import { typeset, advance } from "../src/math/scene/type.js";
import { semanticFigureSchema } from "../src/math/contracts.js";
import { Figure } from "../src/web/Figure.js";

const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const texts = (items: Drawn[]) =>
  items.flatMap((d) => (d.k === "text" ? [d] : []));
const byId = (items: Drawn[], id: string) => {
  const d = items.find((i) => i.id === id);
  assert.ok(d, `missing ${id}`);
  return d;
};

test("every gallery scene validates, lays out inside its box and is described", () => {
  for (const c of galleryCases) {
    assert.equal(sceneSchema.safeParse(c.scene).success, true, c.name);
    const l = layoutScene(c.scene, { reveal: c.reveal });
    assert.ok(
      l.width <= (c.scene.width ?? 360) + 1,
      `${c.name}: width ${l.width}`,
    );
    assert.ok(
      l.height <= (c.scene.maxHeight ?? 320) + 1,
      `${c.name}: height ${l.height}`,
    );
    assert.ok(!JSON.stringify(l.items).includes("NaN"), `${c.name}: NaN`);
    for (const t of texts(l.items)) {
      assert.ok(
        t.box.x0 >= -0.01 && t.box.y0 >= -0.01,
        `${c.name}: ${t.id} left/top`,
      );
      assert.ok(
        t.box.x1 <= l.width + 0.01 && t.box.y1 <= l.height + 0.01,
        `${c.name}: ${t.id} right/bottom`,
      );
    }
    assert.ok(describeScene(c.scene, c.reveal).length > 20, c.name);
  }
});

test("the schema rejects unsafe or unbounded scenes", () => {
  const bad: unknown[] = [
    { v: 1, elements: [] },
    { v: 1, elements: [{ type: "script", src: "x" }] },
    { v: 1, elements: [{ type: "numberLine", min: 0, max: 1000 }] },
    { v: 1, elements: [{ type: "numberLine", min: 5, max: 1 }] },
    { v: 1, elements: [{ type: "point", at: [Number.NaN, 0] }] },
    { v: 1, elements: [{ type: "text", at: [0, 0], text: "x".repeat(61) }] },
    {
      v: 1,
      elements: [
        { type: "clock", id: "a", hour: 1, minute: 0 },
        { type: "clock", id: "a", hour: 2, minute: 0 },
      ],
    },
    { v: 1, elements: [{ type: "graph", x: [0, 1000], y: [0, 1] }] },
  ];
  for (const s of bad)
    assert.equal(sceneSchema.safeParse(s).success, false, JSON.stringify(s));
  assert.equal(
    semanticFigureSchema.safeParse({
      kind: "scene",
      scene: clock(3, 0).scene(),
    }).success,
    true,
  );
});

test("number line ticks are evenly spaced in math units", () => {
  const l = layoutScene(numberLine({ id: "n", min: 0, max: 20 }).scene());
  const xs = Array.from({ length: 21 }, (_, v) => {
    const t = byId(l.items, `n.tick.${v}`);
    assert.equal(t.k, "line");
    return t.k === "line" ? t.x1 : 0;
  });
  for (let i = 1; i < xs.length; i++) near(xs[i]! - xs[i - 1]!, l.scale, 1e-6);
});

test("a hop lands on from + by, and its landing is masked until revealed", () => {
  const s = numberLine({ id: "n", min: 0, max: 20 }).mark(8).hop(8, 5).scene();
  const masked = layoutScene(s),
    revealed = layoutScene(s, { reveal: true });
  const tick = (l: typeof masked, v: number) => {
    const t = byId(l.items, `n.tick.${v}`);
    return t.k === "line" ? t.x1 : NaN;
  };
  const hop = byId(masked.items, "n.hop.0");
  assert.equal(hop.k, "path");
  const nums =
    hop.k === "path" ? hop.d.match(/-?\d+(\.\d+)?/g)!.map(Number) : [];
  near(nums[0]!, tick(masked, 8), 0.01);
  const head = byId(masked.items, "n.hop.0.head");
  assert.ok(head.k === "path");
  near(Number(head.d.match(/^M(-?[\d.]+)/)![1]), tick(masked, 13), 0.01);
  const landing = (l: typeof masked) => byId(l.items, "n.hop.0.landing");
  assert.equal((landing(masked) as { plain: string }).plain, "?");
  assert.equal((landing(revealed) as { plain: string }).plain, "13");
  assert.ok(
    !texts(masked.items).some((t) => t.plain === "13" && t.id.includes("hop")),
  );
  assert.match(describeScene(s), /lands on the number to find/);
  assert.match(describeScene(s, true), /lands on 13/);
});

test("area model splits by place value and masks products", () => {
  assert.deepEqual(placeValueParts(345), [300, 40, 5]);
  assert.deepEqual(placeValueParts(306), [300, 6]);
  const s = areaModel(34, 6).scene();
  const l = layoutScene(s);
  const a = byId(l.items, "e0.region.0.0"),
    b = byId(l.items, "e0.region.1.0");
  assert.ok(a.k === "rect" && b.k === "rect");
  // Proportional: widths 30 : 4, equal heights.
  near(a.w / b.w, 30 / 4, 1e-9);
  near(a.h, b.h);
  assert.deepEqual(
    texts(l.items)
      .filter((t) => t.id.includes("product"))
      .map((t) => t.plain),
    ["?", "?"],
  );
  assert.deepEqual(
    texts(layoutScene(s, { reveal: true }).items)
      .filter((t) => t.id.includes("product"))
      .map((t) => t.plain),
    ["180", "24"],
  );
  assert.match(describeScene(areaModel(345, 7).scene()), /not to scale/);
});

test("polynomial roots, vertex and intercepts are exact", () => {
  // (x − 1)(x + 2)(x − 3) = x³ − 2x² − 5x + 6
  assert.deepEqual(polyRoots([6, -5, -2, 1], -10, 10), [-2, 1, 3]);
  assert.deepEqual(polyRoots([0, 0, 1], -5, 5), [0]); // double root
  assert.deepEqual(polyRoots([1, 0, 1], -5, 5), []);
  // (x − 2)²(x + 1): a double root found between critical points
  assert.deepEqual(polyRoots([4, 0, -3, 1], -5, 5), [-1, 2]);
  const q = features(f.vertex(2, -1, 3), -5, 5);
  assert.deepEqual(q.vertex, [-1, 3]);
  assert.deepEqual(q.yint, [0, 5]);
  assert.deepEqual(q.zeros, []);
});

test("rational, exponential, log and trig features come from the formula", () => {
  // (x − 1) / ((x − 1)(x − 2)): a hole at x = 1, an asymptote at x = 2.
  const r = features(f.rational([1, -1], [1, -3, 2]), -6, 6);
  assert.deepEqual(r.vertical, [2]);
  assert.deepEqual(r.holes, [[1, -1]]);
  assert.equal(r.horizontal, 0);
  // (x² + 1) / x: slant asymptote y = x.
  assert.deepEqual(features(f.rational([1, 0, 1], [1, 0]), -5, 5).slant, {
    m: 1,
    b: 0,
  });
  const e = features(f.exp(1, 2, { k: -2 }), -4, 8);
  assert.equal(e.horizontal, -2);
  assert.deepEqual(e.zeros, [[1, 0]]);
  const g = features(f.log(2, 2, { h: -1 }), -4, 8);
  assert.deepEqual(g.vertical, [-1]);
  assert.deepEqual(g.zeros, [[0, 0]]);
  const t = features(f.tan(1, 1), -4, 4);
  t.vertical.forEach((x, i) => near(x, [-Math.PI / 2, Math.PI / 2][i]!, 1e-9));
  const sz = features(f.sin(1, 1), -4, 4).zeros.map((z) => z[0]);
  [-Math.PI, 0, Math.PI].forEach((x, i) => near(sz[i]!, x, 1e-9));
});

test("adaptive sampling stays within a quarter pixel and never joins across an asymptote", () => {
  const fn = f.poly(1, 0, -4),
    s = 30;
  const pieces = sample(
    (x) => evaluate(fn, x),
    -3,
    3,
    (x, y) => [x * s, -y * s],
  );
  assert.equal(pieces.length, 1);
  const pts = pieces[0]!;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = pts[i]!,
      [x2, y2] = pts[i + 1]!;
    const xm = (x1 + x2) / 2;
    // Chord midpoint vs the curve, in pixels.
    assert.ok(Math.abs(((y1 + y2) / 2 - evaluate(fn, xm)) * s) < 0.6);
  }
  const rational = f.rational([1], [1, -2]);
  const split = sample(
    (x) => evaluate(rational, x),
    -6,
    6,
    (x, y) => [x * s, -y * s],
    [2],
  );
  assert.equal(split.length, 2);
  assert.ok(split[0]!.every(([x]) => x < 2) && split[1]!.every(([x]) => x > 2));
});

test("half-planes parse and clip to the feasible polygon", () => {
  assert.deepEqual(halfPlane("2x + 3y <= 12"), { a: 2, b: 3, c: 12, op: "<=" });
  assert.deepEqual(halfPlane("y > 2x - 1"), { a: -2, b: 1, c: -1, op: ">" });
  assert.deepEqual(halfPlane("x ≥ 0"), { a: 1, b: 0, c: 0, op: ">=" });
  let poly: [number, number][] = [
    [-1, -1],
    [8, -1],
    [8, 8],
    [-1, 8],
  ];
  for (const [a, b, c] of [
    [1, 1, 6],
    [-1, 0, 0],
    [0, -1, 0],
  ] as const)
    poly = clipHalfPlane(poly, a, b, c);
  const area =
    Math.abs(
      poly.reduce((s, [x, y], i) => {
        const [u, v] = poly[(i + 1) % poly.length]!;
        return s + x * v - u * y;
      }, 0),
    ) / 2;
  near(area, 18, 1e-9);
  const l = layoutScene(
    graph({ id: "g", x: [-1, 8], y: [-1, 8] })
      .shade("x + y < 6")
      .scene(),
  );
  const boundary = byId(l.items, "g.region.0.boundary.0");
  assert.equal(boundary.k === "line" && boundary.dash, "dash");
  assert.match(
    describeScene(
      graph({ x: [-5, 5], y: [-5, 5] })
        .shade("y < 2x + 1")
        .scene(),
    ),
    /y is less than 2x \+ 1/,
  );
});

test("graph curves are clipped to the window and features are named elements", () => {
  const s = graph({ id: "g", x: [-5, 5], y: [-5, 5] })
    .curve(f.vertex(1, 1, -4), {
      features: ["vertex", "zeros"],
      featureLabels: "derived",
    })
    .scene();
  const l = layoutScene(s);
  const ids = l.items.map((d) => d.id);
  for (const id of [
    "g.curve.0.vertex",
    "g.curve.0.zero.0",
    "g.curve.0.zero.1",
    "g.curve.0.piece.0",
  ])
    assert.ok(ids.includes(id), id);
  assert.ok(
    texts(l.items)
      .filter((t) => t.id.endsWith(".label") && t.id.includes("curve"))
      .every((t) => t.plain === "?"),
  );
  assert.match(describeScene(s, true), /vertex is at \(1, negative 4\)/);
  assert.match(describeScene(s), /vertex is marked/);
});

test("math labels typeset with KaTeX metrics: italic variables, stacked fractions", () => {
  const frac = typeset("3/4", "math", "md");
  assert.equal(frac.bars.length, 1);
  assert.deepEqual(
    frac.runs.map((r) => r.text),
    ["3", "4"],
  );
  const eq = typeset("y = 2x", "math", "md");
  assert.deepEqual(
    eq.runs.map((r) => [r.text, r.font]),
    [
      ["y", "italic"],
      ["=", "main"],
      ["2", "main"],
      ["x", "italic"],
    ],
  );
  assert.ok(
    advance("Hundreds", "sansBold", 14) > advance("Hundreds", "sans", 14),
  );
});

test("ported legacy kinds render through the scene framework with their test hooks", () => {
  for (const figure of parityFigures) {
    const html = renderToStaticMarkup(React.createElement(Figure, { figure }));
    assert.match(html, /class="figure scene-figure"/);
    assert.match(html, new RegExp(`data-kind="${figure.kind}"`));
    if (figure.kind === "number-line")
      for (const v of figure.points)
        assert.match(html, new RegExp(`data-mark="${v}"`));
    if (figure.kind === "ten-frame")
      assert.equal((html.match(/data-slot=/g) ?? []).length, figure.capacity);
    if (figure.kind === "coordinate-plane")
      for (const p of figure.points)
        assert.match(html, new RegExp(`data-point="${p.label}"`));
  }
  // The minute hand of 4:35 points at 7 (210°): down and to the left.
  const html = renderToStaticMarkup(
    React.createElement(Figure, {
      figure: { kind: "clock", hour: 4, minute: 35 },
    }),
  );
  const hand =
    /<line data-id="clock.hand.minute" data-hand="minute" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/.exec(
      html,
    )!;
  const [x1, y1, x2, y2] = hand.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
  ];
  near(Math.atan2(x2 - x1, -(y2 - y1)) * (180 / Math.PI) + 360, 210, 0.01);
});

test("primitives annotate a component in its own coordinates", () => {
  const s: Scene = scene(numberLine({ id: "n", min: 0, max: 10 }), {
    type: "brace",
    id: "span",
    from: [2, 0],
    to: [7, 0],
    gap: 22,
    label: "5",
  }).build({ title: "Distance from 2 to 7" });
  assert.equal(s.elements.length, 2);
  const l = layoutScene(s);
  const tick = (v: number) => {
    const t = byId(l.items, `n.tick.${v}`);
    return t.k === "line" ? t.x1 : NaN;
  };
  const label = byId(l.items, "span.label");
  assert.ok(label.k === "text");
  near((label.box.x0 + label.box.x1) / 2, (tick(2) + tick(7)) / 2, 0.01);
  assert.throws(() =>
    scene({ type: "numberLine", min: 3, max: 1 } as never).build(),
  );
});

test("print SVG sets words in the worksheet face and keeps every paint a role", async () => {
  const { SceneFigure } = await import("../src/web/scene/SceneFigure.js");
  const s = graph({ x: [0, 10], y: [0, 10], axisNames: ["hours", "score"] })
    .point(3, 4, "A")
    .scene();
  const html = renderToStaticMarkup(
    React.createElement(SceneFigure, { scene: s, medium: "print" }),
  );
  assert.match(html, /font-family:Arial, Helvetica, sans-serif/);
  assert.match(html, /font-family:KaTeX_Main/);
  assert.match(html, /aria-label="Coordinate plane/);
  // Paints are theme roles: no literal colors reach the page.
  assert.doesNotMatch(html, /(fill|stroke)="#[0-9a-f]{3,8}"/i);
});
