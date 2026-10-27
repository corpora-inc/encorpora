import { test } from "node:test";
import assert from "node:assert/strict";
import { num, ratio, view } from "./fixtures/multi-part-view";

const SEEDS = 150;
const seeds = (p: string) =>
  Array.from({ length: SEEDS }, (_, i) => `${p}:${i}`);

test("fraction, mixed number and conversion keys are exact", () => {
  for (const seed of seeds("ff")) {
    const { prompt, chosen } = view("fraction-forms-blanks", seed);
    const [n, d] = ratio(prompt.match(/\$\\frac\{\d+\}\{\d+\}\$/)![0]);
    assert.ok(Math.abs(num(chosen.decimal!) - n / d) < 1e-9);
    assert.ok(
      Math.abs(num(chosen.percent!.replace("%", "")) - (100 * n) / d) < 1e-9,
    );
  }
  for (const seed of seeds("mx")) {
    const { prompt, chosen } = view("decimal-mixed-number-blanks", seed);
    const text = prompt.match(/Write (\d+\.\d+) as/)![1]!;
    const [w, f] = text.split(".");
    assert.equal(num(chosen.whole!), Number(w));
    assert.equal(num(chosen.num!), Number(f));
    assert.equal(num(chosen.den!), 10 ** f!.length);
  }
  for (const seed of seeds("cv")) {
    const { prompt, chosen } = view("conversion-proportion-blanks", seed);
    const factor = prompt.match(/is about ([\d.]+) meter/)![1]!;
    const amount = prompt.match(/meters in (\d+) yards/)![1]!;
    assert.deepEqual(
      [chosen.a, chosen.b, chosen.c, chosen.d],
      ["1", factor, amount, "$x$"],
    );
  }
});

test("inequality solutions, model parts and circle estimates follow the givens", () => {
  for (const seed of seeds("ineq")) {
    const { prompt, response, chosen } = view(
      "inequality-solution-blanks",
      seed,
    );
    const stated = [
      ...prompt.matchAll(/\$(-\d+)x([+-]\d+)?(<|>|\\le|\\ge)(-?\d+)\$/g),
    ];
    assert.equal(stated.length, 2);
    stated.forEach((m, i) => {
      const [a, b, op, c] = [
        Number(m[1]),
        Number(m[2] ?? 0),
        m[3]!,
        Number(m[4]),
      ];
      const pick = chosen[`q${i + 1}`]!.match(/^\$x(<|>|\\le|\\ge)(-?\d+)\$$/)!;
      const v = Number(pick[2]);
      const holds = (x: number, o: string) =>
        o === "<"
          ? a * x + b < c
          : o === ">"
            ? a * x + b > c
            : o === "\\le"
              ? a * x + b <= c
              : a * x + b >= c;
      // The chosen boundary satisfies equality, and the chosen side satisfies the inequality.
      assert.equal(a * v + b, c);
      const side = pick[1] === "<" || pick[1] === "\\le" ? v - 1 : v + 1;
      assert.ok(holds(side, op), `${prompt}`);
      assert.equal(["<", ">"].includes(pick[1]!), ["<", ">"].includes(op));
      void response;
    });
  }
  for (const seed of seeds("exp")) {
    const { prompt, chosen } = view("exponential-parameters-blanks", seed);
    const m = prompt.match(/=([\d{},]+)\(([\d.]+)\)\^\{t\}/)!;
    const [a, b] = [num(m[1]!), Number(m[2])];
    assert.equal(num(chosen.start!), a);
    assert.equal(chosen.dir, b > 1 ? "increases" : "decreases");
    assert.ok(Math.abs(num(chosen.pct!) - Math.abs(b - 1) * 100) < 1e-9);
  }
  for (const seed of seeds("circ")) {
    const { prompt, chosen } = view("circle-estimate-blanks", seed);
    if ("radius" in chosen) {
      const d = Number(prompt.match(/is (\d+) feet across/)![1]);
      assert.equal(num(chosen.radius!), d / 2);
      assert.ok(Math.abs(num(chosen.area!) - 3.14 * (d / 2) ** 2) < 1e-9);
    } else {
      const [c, d] = [
        prompt.match(/circumference of ([\d.]+) cent/)![1]!,
        prompt.match(/diameter of (\d+) cent/)![1]!,
      ].map(Number);
      assert.equal(chosen.top, "circumference");
      assert.equal(chosen.bottom, "diameter");
      assert.ok(Math.abs(num(chosen.pi!) - c! / d!) < 0.005);
    }
  }
});
