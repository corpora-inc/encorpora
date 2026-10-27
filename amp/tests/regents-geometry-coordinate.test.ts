import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";

const seeds = Array.from({ length: 200 }, (_, i) => `reg:${i}`);
const correctLabel = (p: ReturnType<typeof generateProblem>) => {
  const r = p.public.response;
  if (r.kind !== "choice") throw new Error("choice expected");
  return r.options.find((o) => o.id === p.answer)!.label;
};
const strip = (s: string) => s.replace(/\$/g, "").replace(/\\ /g, " ");
const slopeOf = (t: string) => {
  const f = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(t);
  return f ? ((f[1] ? -1 : 1) * Number(f[2])) / Number(f[3]) : Number(t);
};

test("coordinate templates pass the shared checks", () => {
  checkTemplate("geo-segment-partition-point", {
    variants: ["ratio-1-4", "ratio-5-4", "ratio-2-3"],
    axes: { direction: ["from-first", "from-second"] },
  });
  checkTemplate("geo-circle-general-form", {
    variants: ["monic-mixed-signs", "scaled-same-signs"],
    axes: { form: ["monic", "scaled"] },
  });
  checkTemplate("geo-line-point-slope-choice", {
    variants: ["positive-slope", "negative-slope"],
    axes: { relation: ["perpendicular", "parallel"] },
  });
  checkTemplate("geo-line-pair-relationship", {
    variants: ["integer-slope", "fractional-slope"],
    axes: { kind: ["parallel", "perpendicular", "same", "neither"] },
  });
  checkTemplate("geo-dilation-line-image", {
    variants: ["misses-center"],
    axes: { factor: ["enlarge", "reduce"] },
  });
});

test("partition point splits the segment in the stated ratio", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-segment-partition-point", s);
    const pr = strip(p.public.prompt);
    const A = /A\((-?\d+), (-?\d+)\)/.exec(pr)!.slice(1).map(Number) as [
      number,
      number,
    ];
    const B = /B\((-?\d+), (-?\d+)\)/.exec(pr)!.slice(1).map(Number) as [
      number,
      number,
    ];
    const [P0, P1] = /\((-?\d+), (-?\d+)\)/
      .exec(strip(correctLabel(p)))!
      .slice(1)
      .map(Number) as [number, number];
    const [ap, pb] = /AP:PB=(\d+):(\d+)/.exec(pr)
      ? [
          Number(/AP:PB=(\d+):(\d+)/.exec(pr)![1]),
          Number(/AP:PB=(\d+):(\d+)/.exec(pr)![2]),
        ]
      : [
          Number(/BP:PA=(\d+):(\d+)/.exec(pr)![2]),
          Number(/BP:PA=(\d+):(\d+)/.exec(pr)![1]),
        ];
    // (P-A)*pb == (B-P)*ap in both coordinates
    assert.equal((P0 - A[0]) * pb, (B[0] - P0) * ap);
    assert.equal((P1 - A[1]) * pb, (B[1] - P1) * ap);
  }
});

test("circle center and radius satisfy the displayed equation", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-circle-general-form", s);
    const eq = strip(/equation (.*)\. What/.exec(p.public.prompt)![1]!).replace(
      / /g,
      "",
    );
    const lhs = eq
      .replace(/=0$/, "")
      .replace(/(\d)([xy])/g, "$1*$2")
      .replace(/\^2/g, "**2")
      .replace(/(^|[+-])([xy])/g, "$11*$2")
      .replace(/\*\*2/g, "**2");
    const f = new Function(
      "x",
      "y",
      `return ${lhs.replace(/\+/g, "+").replace(/(^|[+-])1\*/g, "$11*")};`,
    ) as (x: number, y: number) => number;
    const [h, k, rad] = /center \(\s*(-?\d+),\s*(-?\d+)\), radius (\d+)/
      .exec(strip(correctLabel(p)).replace(/\s+/g, " "))!
      .slice(1)
      .map(Number) as [number, number, number];
    for (const [x, y] of [
      [h + rad, k],
      [h - rad, k],
      [h, k + rad],
      [h, k - rad],
    ] as const)
      assert.equal(f(x, y), 0, `${eq} at ${x},${y}`);
    assert.notEqual(f(h, k), 0);
  }
});

test("point-slope answer has the right slope and passes through the point", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-line-point-slope-choice", s);
    const pr = strip(p.public.prompt);
    const pts = [...pr.matchAll(/\((-?\d+), (-?\d+)\)/g)].map(
      (m) => [Number(m[1]), Number(m[2])] as const,
    );
    const [[x1, y1], [x2, y2], [qx, qy]] = pts as [
      [number, number],
      [number, number],
      [number, number],
    ];
    const given = (y2 - y1) / (x2 - x1);
    const m = /^y( [-+] \d+)? = (.+)\(x( [-+] \d+)?\)$/.exec(
      strip(correctLabel(p)),
    )!;
    const sl = slopeOf(m[2]!);
    const yy = m[1] ? -Number(m[1].replace(/ /g, "")) : 0;
    const xx = m[3] ? -Number(m[3].replace(/ /g, "")) : 0;
    assert.equal(yy, qy);
    assert.equal(xx, qx);
    if (/perpendicular to it/.test(pr))
      assert.ok(Math.abs(sl * given + 1) < 1e-9);
    else assert.ok(Math.abs(sl - given) < 1e-9);
  }
});

test("line pair classification agrees with a determinant test", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-line-pair-relationship", s);
    const pr = strip(p.public.prompt);
    const e1 = /equation y = (.*?)x ([+-]) (\d+) and line/.exec(pr)!;
    const m1 = slopeOf(e1[1]!);
    const b1 = (e1[2] === "-" ? -1 : 1) * Number(e1[3]);
    const e2 =
      /line m has the equation (-?\d*)x ([+-]) (\d*)y = (-?\d+)\. Which/.exec(
        pr,
      )!;
    const A = e2[1] === "" ? 1 : e2[1] === "-" ? -1 : Number(e2[1]);
    const B = (e2[2] === "-" ? -1 : 1) * (e2[3] === "" ? 1 : Number(e2[3]));
    const C = Number(e2[4]);
    // line1 as (-m1) x + y = b1 ; line2 A x + B y = C
    const a1 = -m1,
      bb1 = 1;
    const det = a1 * B - bb1 * A;
    const dot = a1 * A + bb1 * B;
    const kind =
      Math.abs(dot) < 1e-9
        ? "perpendicular"
        : Math.abs(det) > 1e-9
          ? "neither"
          : Math.abs(b1 * A - C * a1) < 1e-9 &&
              Math.abs(b1 * B - C * bb1) < 1e-9
            ? "same"
            : "parallel";
    const label = strip(correctLabel(p));
    const expected = {
      parallel: "parallel",
      perpendicular: "perpendicular",
      same: "the same line",
      neither: "neither parallel nor perpendicular",
    }[kind];
    assert.equal(label, expected, pr);
  }
});

test("dilation image contains the images of two points of the line", () => {
  for (const s of seeds) {
    const p = generateProblem("geo-dilation-line-image", s);
    const pr = strip(p.public.prompt);
    const eq = /equation y = (.*?)\. It/.exec(pr)![1]!;
    const parse = (t: string) => {
      const mm = /^(-?\d*)x?(?: ([+-]) (\d+))?$/.exec(t);
      if (/x/.test(t)) {
        const sl = /^(-?\d*)x/.exec(t)![1]!;
        const slope = sl === "" ? 1 : sl === "-" ? -1 : Number(sl);
        const rest = /x (?:([+-]) (\d+))$/.exec(t);
        return [
          slope,
          rest ? (rest[1] === "-" ? -1 : 1) * Number(rest[2]) : 0,
        ] as const;
      }
      void mm;
      return [0, Number(t)] as const;
    };
    const [m, b] = parse(eq);
    const k = /factor of (\d+) centered/.exec(pr)
      ? Number(/factor of (\d+) centered/.exec(pr)![1])
      : 1 / Number(/frac\{1\}\{(\d+)\}/.exec(pr)![1]);
    const [m2, b2] = parse(/^y = (.*)$/.exec(strip(correctLabel(p)))![1]!);
    for (const x of [-3, 2]) {
      const y = m * x + b;
      const X = k * x,
        Y = k * y;
      assert.ok(Math.abs(m2 * X + b2 - Y) < 1e-9, `${eq} k=${k}`);
    }
  }
});
