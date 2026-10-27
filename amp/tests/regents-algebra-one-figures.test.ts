import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";

type P = ReturnType<typeof generateProblem>;
const options = (p: P) => {
  const r = p.public.response;
  return r.kind === "figure-choice" || r.kind === "choice" ? r.options : [];
};

test("parabola axis and vertex from a graph", () => {
  checkTemplate("parabola-axis-vertex-graph", {
    variants: ["up-left", "up-right", "down-left", "down-right"],
    axes: { opens: ["up", "down"] },
    hintsMin: 1,
  });
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("parabola-axis-vertex-graph", `p:${i}`);
    const fig = JSON.stringify(p.public.figure);
    // The drawn curve is y = a(x-h)^2 + k; its polynomial coefficients are c0 + c1 x + c2 x^2.
    const c = JSON.parse(fig).scene.elements?.[0]?.curves?.[0]?.fn?.c as
      number[] | undefined;
    assert.ok(c, fig.slice(0, 200));
    const a = c[2]!;
    const h = -c[1]! / (2 * a);
    const k = c[0]! - a * h * h;
    const key = options(p).find((o) => o.id === p.answer)!.label;
    assert.equal(
      key,
      `$x = ${h}$ and vertex $(${h < 0 ? `-${-h}` : h}, ${k < 0 ? `-${-k}` : k})$`,
    );
    for (const o of options(p))
      if (o.id !== p.answer) assert.notEqual(o.label, key);
  }
});

test("graph is a function", () => {
  checkTemplate("graph-is-function", { variants: [""], hintsMin: 1 });
  const functionLike =
    /^(A parabola opening (up|down)|A line through|A graph of two straight rays meeting at \([^)]*\) and opening up|An S-shaped curve)/;
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("graph-is-function", `f:${i}`);
    let count = 0;
    for (const o of options(p)) {
      const isFunction = functionLike.test(o.label);
      assert.equal(isFunction, o.id === p.answer, o.label);
      if (isFunction) count++;
    }
    assert.equal(count, 1);
  }
});

test("inequality both sides", () => {
  checkTemplate("inequality-both-sides-number-line", {
    variants: [""],
    hintsMin: 20,
  });
  const num = (t: string) => Number(t.replace("−", "-"));
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("inequality-both-sides-number-line", `n:${i}`);
    const stmt = p.public.prompt.match(/solutions of \$(.+)\$\?/)![1]!;
    const sides = stmt.split(/ (<|>|\\le|\\ge) /);
    assert.equal(sides.length, 3, stmt);
    const parse = (side: string) => {
      const mm = side.match(/^(?:(-?\d*)x)?(?: ?([+-]) ?(\d+))?$|^(-?\d+)$/)!;
      if (mm[4]) return { a: 0, b: Number(mm[4]) };
      const a =
        mm[1] === undefined
          ? 0
          : mm[1] === ""
            ? 1
            : mm[1] === "-"
              ? -1
              : Number(mm[1]);
      const b = mm[3] ? (mm[2] === "-" ? -1 : 1) * Number(mm[3]) : 0;
      return { a, b };
    };
    const L = parse(sides[0]!);
    const R = parse(sides[2]!);
    const op = sides[1]!;
    const holds = (x: number) => {
      const l = L.a * x + L.b;
      const r = R.a * x + R.b;
      return op === "<"
        ? l < r
        : op === ">"
          ? l > r
          : op === "\\le"
            ? l <= r
            : l >= r;
    };
    for (const o of options(p)) {
      const d = o.label.match(
        /^(An open|A closed) circle at (−?[\d.]+) with the ray shaded to the (right|left)\.$/,
      )!;
      const c = num(d[2]!);
      const open = d[1] === "An open";
      const right = d[3] === "right";
      let same = true;
      for (let t = -12; t <= 12; t += 0.25) {
        const x = t + 0.0;
        const inRay = right ? (open ? x > c : x >= c) : open ? x < c : x <= c;
        if (inRay !== holds(x)) same = false;
      }
      assert.equal(same, o.id === p.answer, `${stmt} ${o.label}`);
    }
  }
});
