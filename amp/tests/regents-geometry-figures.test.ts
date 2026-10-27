import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";

const seeds = Array.from({ length: 200 }, (_, i) => `reg:${i}`);
const labels = (p: ReturnType<typeof generateProblem>) => {
  const r = p.public.response;
  if (r.kind !== "choice") throw new Error("choice");
  return r.options;
};
const correct = (p: ReturnType<typeof generateProblem>) =>
  labels(p).find((o) => o.id === p.answer)!.label;
const strip = (s: string) => s.replace(/\$/g, "").replace(/\\ /g, " ");
const deg = Math.PI / 180;

test("figure templates pass the shared checks", () => {
  checkTemplate("geo-altitude-hypotenuse", {
    variants: ["integer-altitude", "radical-altitude"],
    axes: { ask: ["leg", "altitude", "other-leg"] },
  });
  checkTemplate("geo-centroid-median", {
    variants: ["A-median", "B-median", "C-median"],
    axes: { ask: ["true-statement", "segment-length"] },
  });
  checkTemplate("geo-polygon-rotation", {
    variants: [],
    axes: { count: ["one-rotation", "two-rotations"] },
  });
  checkTemplate("geo-isosceles-exterior-angle", {
    variants: ["large-base-angle", "small-base-angle"],
    axes: { exterior: ["apex", "base-vertex"] },
  });
  checkTemplate("geo-complementary-trig-choice", {
    variants: ["first-smaller", "second-smaller"],
    axes: { ask: ["equation", "smallest-angle"] },
  });
  checkTemplate("geo-parallel-segment-length", {
    variants: ["short-top", "long-top"],
    axes: { ask: ["whole-side", "parallel-length"] },
  });
  checkTemplate("geo-area-changing-transformation", {
    variants: ["shear", "reciprocal-stretch"],
    axes: { ask: ["changes-area", "keeps-area-not-congruent"] },
  });
  checkTemplate("geo-section-impossible", {
    variants: ["draw-0", "draw-1", "draw-2"],
    minHints: 8,
    axes: { solid: ["rectangular-prism", "cylinder", "cone"] },
  });
  checkTemplate("geo-parallelogram-sufficient", {
    variants: ["draw-0", "draw-1"],
    minHints: 8,
    axes: { target: ["rhombus", "rectangle"] },
  });
});

const radicalValue = (t: string) => {
  const m = /^(\d*)\\sqrt\{(\d+)\}$/.exec(t);
  return m ? (m[1] ? Number(m[1]) : 1) * Math.sqrt(Number(m[2])) : Number(t);
};
test("altitude-to-hypotenuse lengths agree with coordinates", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-altitude-hypotenuse", s);
    const pr = strip(p.public.prompt);
    const [ad, db] = [
      Number(/AD=(\d+)/.exec(pr)![1]),
      Number(/DB=(\d+)/.exec(pr)![1]),
    ];
    const name = /length of (\w+)\?/.exec(
      pr.replace(/\\overline\{(\w+)\}/g, "$1"),
    )![1]!;
    // Coordinates: D at origin, hypotenuse on the x-axis, C above D with CD^2 = AD*DB (right angle at C).
    const A = [-ad, 0],
      B = [db, 0],
      C = [0, Math.sqrt(ad * db)];
    const dist = (u: number[], v: number[]) =>
      Math.hypot(u[0]! - v[0]!, u[1]! - v[1]!);
    assert.ok(
      Math.abs(dist(A, C) ** 2 + dist(B, C) ** 2 - dist(A, B) ** 2) < 1e-9,
    );
    const want = { CD: dist([0, 0], C), AC: dist(A, C), BC: dist(B, C) }[name]!;
    assert.ok(
      Math.abs(radicalValue(strip(correct(p))) - want) < 1e-9,
      `${name} ${pr}`,
    );
  }
});

test("centroid lengths come from median coordinates", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-centroid-median", s);
    const pr = strip(p.public.prompt);
    if (!/has length/.test(pr)) continue;
    const L = Number(/has length (\d+)/.exec(pr)![1]);
    const asked = /length of (\w+)\?/.exec(
      pr.replace(/\\overline\{(\w+)\}/g, "$1"),
    )![1]!;
    // Place the vertex at 0, midpoint at L; centroid is the average of the vertex, and the other two (mirror about the midpoint).
    const V = 0,
      M = L;
    const other = [M + 5, M - 5]; // B and C symmetric about M => midpoint of BC is M
    const G = (V + other[0]! + other[1]!) / 3;
    const want = asked.startsWith("G") ? M - G : G - V;
    assert.equal(Number(strip(correct(p))), want);
  }
});

test("exactly one listed polygon has all rotation angles", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-polygon-rotation", s);
    const angles = [...p.public.prompt.matchAll(/\$(\d+)\^\\circ\$/g)].map(
      (m) => Number(m[1]),
    );
    const n: Record<string, number> = {
      "Equilateral triangle": 3,
      Square: 4,
      "Regular pentagon": 5,
      "Regular hexagon": 6,
      "Regular octagon": 8,
      "Regular nonagon": 9,
      "Regular decagon": 10,
      "Regular dodecagon": 12,
    };
    const ok = labels(p).filter((o) =>
      angles.every(
        (a) =>
          Math.abs(
            Math.round((a * n[o.label]!) / 360) - (a * n[o.label]!) / 360,
          ) < 1e-9,
      ),
    );
    assert.deepEqual(
      ok.map((o) => o.id),
      [p.answer],
    );
  }
});

test("isosceles exterior angle matches a search over x", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-isosceles-exterior-angle", s);
    const pr = strip(p.public.prompt);
    const parse = (t: string) => {
      const m = /^(\d*)x ([+-]) (\d+)$/.exec(t)!;
      return [
        m[1] ? Number(m[1]) : 1,
        (m[2] === "-" ? -1 : 1) * Number(m[3]),
      ] as const;
    };
    const [e1, e2] = [...pr.matchAll(/\(([^()]*x [^()]*)\)\^\\circ/g)].map(
      (m) => parse(m[1]!),
    );
    let sol = NaN;
    for (let x = 1; x <= 200; x++)
      if (e1![0] * x + e1![1] === e2![0] * x + e2![1]) sol = x;
    const base = e1![0] * sol + e1![1];
    const want = /exterior angle at A/.test(pr) ? base * 2 : 180 - base;
    assert.equal(Number(p.answer), want);
  }
});

test("complementary templates agree with a numeric search", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-complementary-trig-choice", s);
    const pr = strip(p.public.prompt);
    const parse = (t: string) => {
      const m = /^(\d*)x ([+-]) (\d+)$/.exec(t)!;
      return [
        m[1] ? Number(m[1]) : 1,
        (m[2] === "-" ? -1 : 1) * Number(m[3]),
      ] as const;
    };
    const [e1, e2] = [...pr.matchAll(/\(([^()]*x [^()]*)\)\^\\circ/g)].map(
      (m) => parse(m[1]!),
    );
    const xs: number[] = [];
    for (let x = 1; x <= 90; x += 1) {
      const A = e1![0] * x + e1![1],
        B = e2![0] * x + e2![1];
      if (
        A > 0 &&
        A < 90 &&
        B > 0 &&
        B < 90 &&
        Math.abs(Math.sin(A * deg) - Math.cos(B * deg)) < 1e-9
      )
        xs.push(x);
    }
    assert.equal(xs.length, 1);
    const x = xs[0]!;
    if (/smallest angle/.test(pr)) {
      const want = Math.min(e1![0] * x + e1![1], e2![0] * x + e2![1]);
      assert.equal(strip(correct(p)), `${want}^\\circ`);
    }
  }
});

test("parallel segment lengths satisfy similar triangles", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-parallel-segment-length", s);
    const pr = strip(p.public.prompt);
    const [ad, db, ae] = [/AD=(\d+)/, /DB=(\d+)/, /AE=(\d+)/].map((r) =>
      Number(r.exec(pr)![1]),
    );
    const ec = (db! * ae!) / ad!;
    assert.equal(
      Number(p.answer),
      /Find the length of/.test(pr) ? ae! + ec : ec,
    );
    // DE parallel to BC <=> AB/AD = AC/AE
    assert.equal((ad! + db!) * ae!, ad! * (ae! + ec));
  }
});

// Evaluate a coordinate rule such as (x, y) -> (2x, y/2) on the unit square.
function mapRule(label: string) {
  const body = /\\to\((.*)\)$/.exec(strip(label).replace(/\s+/g, ""))!;
  const parts = body[1]!
    .split(",")
    .map((t) =>
      t
        .replace(/\\frac\{(\w)\}\{(\d+)\}/g, "($1/$2)")
        .replace(/(\d)([xy])/g, "$1*$2"),
    );
  const f = parts.map(
    (t) =>
      new Function("x", "y", `return ${t};`) as (
        x: number,
        y: number,
      ) => number,
  );
  const sq: [number, number][] = [
    [0, 0],
    [3, 0],
    [3, 2],
    [0, 2],
  ];
  const img = sq.map(([x, y]) => [f[0]!(x, y), f[1]!(x, y)] as const);
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const [a, b] = [img[i]!, img[(i + 1) % 4]!];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const side = (i: number) =>
    Math.hypot(
      img[i]![0] - img[(i + 1) % 4]![0],
      img[i]![1] - img[(i + 1) % 4]![1],
    );
  return {
    area: Math.abs(area) / 2,
    congruent: Math.abs(side(0) - 3) < 1e-9 && Math.abs(side(1) - 2) < 1e-9,
  };
}
test("area-changing rules check against the unit square", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-area-changing-transformation", s);
    const pr = p.public.prompt;
    const rules = labels(p).map((o) => ({
      id: o.id,
      ...mapRule(o.label.replace(/\$/g, "")),
    }));
    const matching = rules.filter((r) =>
      /changes the area/.test(pr)
        ? r.area !== 6
        : Math.abs(r.area - 6) < 1e-9 && !r.congruent,
    );
    assert.deepEqual(
      matching.map((r) => r.id),
      [p.answer],
    );
  }
});
