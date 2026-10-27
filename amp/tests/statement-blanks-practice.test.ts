import { test } from "node:test";
import assert from "node:assert/strict";
import { num, ratio, view } from "./fixtures/multi-part-view";

const SEEDS = 150;
const seeds = (p: string) =>
  Array.from({ length: SEEDS }, (_, i) => `${p}:${i}`);

test("expense rows are decided by their amounts or kind", () => {
  const fixedKinds = [
    "Rent",
    "Car payment",
    "Insurance",
    "Internet service",
    "Phone plan",
  ];
  for (const seed of seeds("exp")) {
    const { response, chosen } = view("fixed-variable-expense-table", seed);
    for (const b of response.blanks) {
      const amounts = [...b.label.matchAll(/(?:Jan|Feb|Mar) (\d+)/g)].map((m) =>
        Number(m[1]),
      );
      const varies = amounts.length
        ? new Set(amounts).size > 1
        : !fixedKinds.includes(b.label);
      assert.equal(chosen[b.id], varies ? "Varies" : "Stays the same", b.label);
    }
  }
});

test("right triangles satisfy the converse and congruence rules keep distance", () => {
  for (const seed of seeds("py")) {
    const { response, chosen } = view("pythagorean-sort-table", seed);
    const verdicts = new Set<string>();
    for (const b of response.blanks) {
      const [x, y, z] = b.label.split(", ").map(Number);
      const [a, c] = [Math.min(x!, y!), Math.max(x!, y!, z!)];
      const others = [x!, y!, z!].filter((v) => v !== c);
      const right = others[0]! ** 2 + others[1]! ** 2 === c ** 2;
      assert.equal(
        chosen[b.id],
        right ? "Right triangle" : "Not a right triangle",
      );
      verdicts.add(chosen[b.id]!);
      void a;
    }
    assert.equal(verdicts.size, 2);
  }
  for (const seed of seeds("cong")) {
    const { response, chosen } = view("congruence-claims-table", seed);
    for (const b of response.blanks) {
      const m = b.label.match(/\\to \((.+), (.+)\)\$$/)!;
      const image = (x: number, y: number) => {
        const f = (e: string) =>
          Function(
            "x",
            "y",
            `return ${e.replace(/(\d)([xy])/g, "$1*$2").replace(/\s+/g, "")}`,
          )(x, y) as number;
        return [f(m[1]!), f(m[2]!)] as const;
      };
      const [p, q] = [image(0, 0), image(1, 0)];
      const [r2, s2] = [image(0, 1), image(1, 1)];
      const d = (u: readonly number[], v: readonly number[]) =>
        Math.hypot(u[0]! - v[0]!, u[1]! - v[1]!);
      const rigid =
        Math.abs(d(p, q) - 1) < 1e-9 &&
        Math.abs(d(p, r2) - 1) < 1e-9 &&
        Math.abs(d(p, s2) - Math.SQRT2) < 1e-9;
      assert.equal(
        chosen[b.id],
        rigid ? "Preserves congruence" : "Does not preserve",
        b.label,
      );
    }
  }
});

test("equivalent rows have the same value as the given expression", () => {
  const value = (tex: string, v: number) => {
    const js = tex
      .replace(/\\cdot/g, "*")
      .replace(/\\div/g, "/")
      .replace(/\^/g, "**")
      .replace(/\s+/g, "")
      .replace(/(\d|x|\))(?=[x(\d])(?!\*)/g, (m, c, offset, str) =>
        /\d/.test(c) && /\d/.test(str[offset + 1] ?? "") ? c : `${c}*`,
      );
    try { return Function("x", `return ${js}`)(v) as number; } catch (e) { throw new Error(`${tex} -> ${js}`); }
  };
  for (const seed of seeds("eq")) {
    const { prompt, response, chosen } = view(
      "equivalent-expressions-table",
      seed,
    );
    const letter = prompt.replace(/\\[a-z]+/g, "").match(/to \$.*?([a-z])/)![1]!;
    const norm = (t: string) => t.replaceAll("$", "").replaceAll(letter, "x");
    const base = norm(prompt.match(/to (\$.+\$)\./)![1]!);
    let yes = 0;
    for (const b of response.blanks) {
      const same = [2, 3, 5, -1].every(
        (t) => Math.abs(value(norm(b.label), t) - value(base, t)) < 1e-9,
      );
      assert.equal(
        chosen[b.id],
        same ? "Equivalent" : "Not equivalent",
        b.label,
      );
      yes += same ? 1 : 0;
    }
    assert.equal(yes, 2);
  }
});

test("pay, coordinates and counts follow the givens", () => {
  for (const seed of seeds("net")) {
    const { prompt, chosen, sentence } = view("gross-net-sentence", seed);
    if (!("out" in chosen)) {
      assert.equal(chosen.when, "before");
      assert.equal(chosen.op, "minus");
      continue;
    }
    const [gross, tax, other] = [...prompt.matchAll(/(\d+) dollars/g)].map(
      (m) => Number(m[1]),
    );
    assert.equal(num(chosen.out!), tax! + other!);
    assert.equal(num(chosen.net!), gross! - tax! - other!);
    assert.ok(sentence.includes("take-home pay"));
  }
  const says: Record<string, string> = {
    "the horizontal number line of the plane": "$x$-axis",
    "the vertical number line of the plane": "$y$-axis",
    "the point $(0, 0)$ where the two axes cross": "origin",
    "the first number of an ordered pair": "$x$-coordinate",
    "the second number of an ordered pair": "$y$-coordinate",
    "two numbers in order that name a point": "ordered pair",
  };
  for (const seed of seeds("terms")) {
    const { response, chosen } = view("coordinate-terms-slots", seed);
    for (const b of response.blanks)
      assert.equal(chosen[b.id], says[b.label.replace("The term for ", "")]);
  }
  for (const seed of seeds("axis")) {
    const { prompt, chosen } = view("point-on-axis-sentence", seed);
    const m = prompt.match(/\$\((\d+), (\d+)\)\$/)!;
    const [a, b] = [Number(m[1]), Number(m[2])];
    assert.ok(a === 0 || b === 0);
    assert.equal(chosen.axis, b === 0 ? "$x$-axis" : "$y$-axis");
    assert.equal(chosen.which, b === 0 ? "second" : "first");
    assert.equal(num(chosen.units!), Math.max(a, b));
    assert.equal(chosen.dir, b === 0 ? "right" : "up");
  }
  for (const seed of seeds("times")) {
    const { prompt, rows, chosen } = view("times-as-many-blanks", seed);
    const names = rows![0]!.slice(1);
    const counts = rows![1]!.slice(1).map(Number);
    const count = (n: string) => counts[names.indexOf(n)]!;
    if ("k" in chosen) {
      assert.equal(count(chosen.big!), num(chosen.k!) * count(chosen.small!));
      assert.ok(num(chosen.k!) >= 2);
    } else {
      assert.ok(count(chosen.more!) > 2 * count(chosen.less!));
    }
    void prompt;
  }
});

test("fraction reasons and inequality numbers are decided by the values", () => {
  for (const seed of seeds("frac")) {
    const { prompt, chosen } = view("compare-fractions-reason-blanks", seed);
    const [f1, f2] = [...prompt.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)].map(
      (m) => [Number(m[1]), Number(m[2])] as const,
    );
    const greater = f1![0] * f2![1] > f2![0] * f1![1] ? f1! : f2!;
    assert.deepEqual(ratio(chosen.bigger!), [greater[0], greater[1]]);
    const sameNumerator = f1![0] === f2![0];
    assert.equal(
      chosen.why,
      sameNumerator
        ? "the pieces are larger when the denominator is smaller"
        : "it has more pieces of the same size",
    );
  }
  for (const seed of seeds("ineq")) {
    const { response, sentence, chosen } = view(
      "inequality-number-blanks",
      seed,
    );
    const value = (t: string) => {
      const [n, d] = ratio(t);
      return n / d;
    };
    const bank = response.blanks[0]!.options.map((o) => value(o.label));
    const [lt, gt] = [...sentence.matchAll(/\$([<>])(.+?)\$/g)].map(
      (m) => [m[1], value(m[2]!)] as const,
    );
    const fitsLess = bank.filter((v) => v < lt![1]);
    const fitsMore = bank.filter((v) => v > gt![1]);
    assert.equal(fitsLess.length, 1);
    assert.equal(fitsMore.length, 1);
    assert.equal(value(chosen.less!), fitsLess[0]);
    assert.equal(value(chosen.more!), fitsMore[0]);
  }
});
