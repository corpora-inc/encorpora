import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";
import {
  dilationCenter,
  dilationLine,
  motionChain,
  reflectionSide,
} from "../src/math/regents-geometry-motions-practice";

type P = ReturnType<typeof generateProblem>;
const options = (p: P) => {
  const r = p.public.response;
  return r.kind === "choice" ? r.options : [];
};
const key = (p: P) => options(p).find((o) => o.id === p.answer)!.label;
const seeds = Array.from({ length: 250 }, (_, i) => `g2:${i}`);

test("dilation center", () => {
  checkTemplate("geo-dilation-center", {
    variants: ["enlargement", "reduction"],
    axes: { ask: ["factor-and-center", "center-only"] },
  });
  for (const s of seeds) {
    const { model: m, axes, problem } = dilationCenter.generate(s);
    const imgs = m.tri.map((p) => [
      m.c[0] + ((p[0] - m.c[0]) * m.k[0]) / m.k[1],
      m.c[1] + ((p[1] - m.c[1]) * m.k[0]) / m.k[1],
    ]);
    const both = axes.ask === "factor-and-center";
    for (const o of options(problem)) {
      const center = o.label.match(/enter \$\((-?\d+), (-?\d+)\)\$/)!;
      const c = [Number(center[1]), Number(center[2])];
      const fac = both
        ? o.label.match(/factor \$(?:\\frac\{(\d+)\}\{(\d+)\}|(\d+))\$/)!
        : null;
      const k = fac
        ? fac[3]
          ? Number(fac[3])
          : Number(fac[1]) / Number(fac[2])
        : m.k[0] / m.k[1];
      const fits = m.tri.every(
        (p, i) =>
          c[0]! + k * (p[0] - c[0]!) === imgs[i]![0] &&
          c[1]! + k * (p[1] - c[1]!) === imgs[i]![1],
      );
      assert.equal(fits, o.id === problem.answer, `${o.label}`);
    }
    assert.ok(JSON.stringify(problem.public.figure).includes('"segments"'));
  }
});

test("dilation of a line", () => {
  checkTemplate("geo-dilation-line-center", {
    variants: ["factor-2-1", "factor-1-2"],
    axes: { center: ["on-the-line", "off-the-line"] },
  });
  for (const s of seeds) {
    const { model: m, problem } = dilationLine.generate(s);
    const k = m.k[0] / m.k[1];
    // Image of two points of the line must lie on the key line and not on any other.
    const pts = [0, 3].map((x) => [x, m.m * x + m.b]);
    const img = pts.map(([x, y]) => [
      m.c[0] + k * (x! - m.c[0]),
      m.c[1] + k * (y! - m.c[1]),
    ]);
    const onLine = (label: string) => {
      const [lhs, rhs] = label.replaceAll("$", "").split(" = ");
      void lhs;
      const mm = rhs!.match(
        /^(-?)(\\frac\{(\d+)\}\{(\d+)\}|\d*)x(?: ([+-]) (\\frac\{(\d+)\}\{(\d+)\}|\d+))?$/,
      )!;
      const sl =
        (mm[1] ? -1 : 1) *
        (mm[3]
          ? Number(mm[3]) / Number(mm[4])
          : mm[2] === ""
            ? 1
            : Number(mm[2]));
      const ic = mm[5]
        ? (mm[5] === "-" ? -1 : 1) *
          (mm[7] ? Number(mm[7]) / Number(mm[8]) : Number(mm[6]))
        : 0;
      return img.every(([x, y]) => Math.abs(y! - (sl * x! + ic)) < 1e-9);
    };
    for (const o of options(problem))
      assert.equal(onLine(o.label), o.id === problem.answer, o.label);
  }
});

type Pt = [number, number];
const orient = (t: Pt[]) =>
  Math.sign(
    (t[1]![0] - t[0]![0]) * (t[2]![1] - t[0]![1]) -
      (t[1]![1] - t[0]![1]) * (t[2]![0] - t[0]![0]),
  );
const classify = (a: Pt[], b: Pt[]) => {
  if (orient(a) !== orient(b)) return "reflection";
  const same = a.every(
    (p, i) =>
      b[i]![0] - p[0] === b[0]![0] - a[0]![0] &&
      b[i]![1] - p[1] === b[0]![1] - a[0]![1],
  );
  return same ? "translation" : "rotation";
};
test("motion chain", () => {
  checkTemplate("geo-motion-chain", {
    variants: [
      "translation-then-reflection",
      "reflection-then-rotation",
      "rotation-then-translation",
    ],
    axes: { first: ["translation", "reflection", "rotation"] },
  });
  for (const s of seeds) {
    const { model: m, problem } = motionChain.generate(s);
    const want = `${classify(m.tri, m.t2)}|${classify(m.t2, m.t3)}`;
    assert.equal(want, m.kinds.join("|"));
    const got = key(problem)
      .toLowerCase()
      .match(/a (\w+) followed by a (\w+)/)!;
    assert.equal(`${got[1]}|${got[2]}`, want);
  }
});

test("reflection side", () => {
  checkTemplate("geo-reflection-side", {
    variants: ["lines-0-1", "lines-2-0"],
    axes: { pair: ["axes", "diagonal-line"] },
  });
  const ref = (w: number, [x, y]: Pt): Pt =>
    w === 0 ? [x, -y] : w === 1 ? [-x, y] : w === 2 ? [y, x] : [-y, -x];
  for (const s of seeds) {
    const { model: m, problem } = reflectionSide.generate(s);
    const img = m.quad.map((p) => ref(m.lines[1], ref(m.lines[0], p)));
    const names = ["E", "F", "G", "H"];
    const lab = (i: number) => names[m.perm[i]!]!;
    // Independent: the figure's labeled points are the images and their labels.
    const fig = JSON.stringify(problem.public.figure);
    for (let i = 0; i < 4; i++)
      assert.ok(
        fig.includes(`"x":${img[i]![0]},"y":${img[i]![1]}`) &&
          fig.includes(`"label":"${lab(i)}"`),
        fig.slice(0, 80),
      );
    assert.equal(
      key(problem),
      `$\\overline{${[lab(m.side), lab((m.side + 1) % 4)].sort().join("")}}$`,
    );
  }
});

test("rigid statement", () => {
  checkTemplate("geo-rigid-statement", {
    variants: [
      "reflections-0",
      "reflections-1",
      "reflections-2",
      "reflections-3",
    ],
    axes: { parity: ["odd-reflections", "even-reflections"] },
  });
  for (const s of seeds.slice(0, 100)) {
    const p = generateProblem("geo-rigid-statement", s);
    const k = key(p);
    assert.match(k, /congruent|same length|same measure|area/);
    const reflections = (p.public.prompt.match(/a reflection/g) ?? []).length;
    assert.equal(`reflections-${reflections}`, p.variant?.id);
    // The order-of-vertices distractor must be false for this count.
    const order = options(p).find((o) => /appear/.test(o.label))!.label;
    assert.equal(/opposite order/.test(order), reflections % 2 === 0);
  }
});
