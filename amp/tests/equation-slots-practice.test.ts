import { test } from "node:test";
import assert from "node:assert/strict";
import { num, ratio, view } from "./fixtures/multi-part-view";

const SEEDS = 150;
const seeds = (p: string) =>
  Array.from({ length: SEEDS }, (_, i) => `${p}:${i}`);

test("rate-plus-fee equations hold for a whole number of items", () => {
  for (const seed of seeds("booth")) {
    const { prompt, chosen } = view("booth-equation-slots", seed);
    const m = prompt.match(
      /charges (\d+) dollars for each \w+ and (a fixed fee of|gives a discount of) (\d+) dollars\. A group pays (\d+) dollars/,
    )!;
    const [rate, fee, total] = [Number(m[1]), Number(m[3]), Number(m[4])];
    const plus = m[2] === "a fixed fee of";
    assert.equal(num(chosen.rate!), rate);
    assert.equal(num(chosen.once!), fee);
    assert.equal(num(chosen.total!), total);
    assert.equal(chosen.op, plus ? "$+$" : "$-$");
    assert.equal((plus ? total - fee : total + fee) % rate, 0);
  }
});

test("inequality symbols follow the wording", () => {
  const symbols: Record<string, string> = {
    "less than": "$<$",
    "at most": "$\\le$",
    "more than": "$>$",
    "at least": "$\\ge$",
  };
  for (const seed of seeds("budget")) {
    const { prompt, chosen } = view("budget-inequality-slots", seed);
    const word = Object.keys(symbols).find((w) => prompt.includes(` ${w} `))!;
    assert.equal(chosen.sym, symbols[word]);
    const nums = [...prompt.matchAll(/(\d+) dollars/g)].map((m) =>
      Number(m[1]),
    );
    assert.ok(
      nums.includes(num(chosen.known!)) && nums.includes(num(chosen.limit!)),
    );
    assert.ok(num(chosen.known!) < num(chosen.limit!));
  }
});

test("unit fraction divisions and array divisions are exact", () => {
  for (const seed of seeds("uf")) {
    const { prompt, chosen, problem } = view(
      "unit-fraction-division-slots",
      seed,
    );
    const mul = (
      a: [number, number],
      b: [number, number],
    ): [number, number] => [a[0] * b[0], a[1] * b[1]];
    const same = (a: [number, number], b: [number, number]) =>
      a[0] * b[1] === a[1] * b[0];
    if ("whole" in chosen && "piece" in chosen) {
      // whole ÷ (1/d) = count
      assert.ok(
        same(
          mul(ratio(chosen.count!), ratio(chosen.piece!)),
          ratio(chosen.whole!),
        ),
        prompt,
      );
    } else if ("whole" in chosen) {
      assert.ok(
        same(mul(ratio(chosen.each!), ratio(chosen.by!)), ratio(chosen.whole!)),
        prompt,
      );
    } else {
      const d = Number(prompt.match(/\\frac\{1\}\{(\d+)\}/)![1]);
      assert.equal(num(chosen.den!), d * num(chosen.by!));
      assert.match(
        problem.public.prompt,
        new RegExp(`shared equally among ${num(chosen.by!)} people`),
      );
    }
  }
  for (const seed of seeds("arr")) {
    const { prompt, chosen } = view("array-division-slots", seed);
    const [rows, cols] = [...prompt.matchAll(/(\d+) (?:rows|counters)/g)].map(
      (m) => Number(m[1]),
    );
    assert.equal(num(chosen.total!), rows! * cols!);
    assert.equal(num(chosen.total!), num(chosen.by!) * num(chosen.quot!));
    assert.ok(
      [rows, cols].includes(num(chosen.by!)) &&
        [rows, cols].includes(num(chosen.quot!)),
    );
    assert.equal(
      num(chosen.by!),
      prompt.includes("find the number of rows") ? cols : rows,
    );
  }
});

test("chosen operations give exactly the total shown", () => {
  const apply = (nums: number[], ops: string[]) => {
    const terms = [nums[0]!];
    const adds: string[] = [];
    nums.slice(1).forEach((n, i) => {
      const op = ops[i]!;
      if (op === "×") terms[terms.length - 1]! *= n;
      else if (op === "÷") terms[terms.length - 1]! /= n;
      else {
        adds.push(op);
        terms.push(n);
      }
    });
    return adds.reduce(
      (s, op, i) => (op === "+" ? s + terms[i + 1]! : s - terms[i + 1]!),
      terms[0]!,
    );
  };
  const glyph: Record<string, string> = {
    "$+$": "+",
    "$-$": "−",
    "$\\times$": "×",
    "$\\div$": "÷",
  };
  for (const id of ["story-operations-slots", "delivery-operations-slots"])
    for (const seed of seeds(id)) {
      const { sentence, chosen } = view(id, seed);
      const nums = [...sentence.matchAll(/\$(\d+)\$/g)].map((m) =>
        Number(m[1]),
      );
      const total = Number(sentence.match(/\$=(\d+)\$$/)![1]);
      const ops = Object.keys(chosen).map((k) =>
        glyph[chosen[k]!]!.replace("−", "-"),
      );
      assert.equal(apply(nums, ops), total, `${id} ${seed}`);
    }
});

test("table equations fit every pair, and rule tables follow the stated rule", () => {
  for (const seed of seeds("tab")) {
    const { rows, chosen } = view("table-equation-slots", seed);
    const xs = rows![0]!.slice(1).map(Number);
    const ys = rows![1]!.slice(1).map(Number);
    const sign = chosen.op === "$+$" ? 1 : -1;
    xs.forEach((x, i) =>
      assert.equal(ys[i], num(chosen.mult!) * x + sign * num(chosen.const!)),
    );
  }
  for (const seed of seeds("fill")) {
    const { prompt, rows, chosen } = view("rule-table-fill-slots", seed);
    const rule = prompt.match(/\$y=(.+?)\$/)![1]!;
    const f = (x: number) =>
      rule.startsWith("x+")
        ? x + Number(rule.slice(2))
        : rule.startsWith("x-")
          ? x - Number(rule.slice(2))
          : Number(rule.replace("x", "")) * x;
    const [xr, yr] = [rows![0]!.slice(1), rows![1]!.slice(1)];
    xr.forEach((x, i) => {
      if (x !== "?") assert.equal(num(chosen[`y${i + 1}`]!), f(Number(x)));
      else assert.equal(f(num(chosen[`x${i - 1}`]!)), Number(yr[i]));
    });
  }
});

test("unit price, cylinder, dilation and transformation keys follow the givens", () => {
  for (const seed of seeds("price")) {
    const { prompt, chosen } = view("unit-price-sentence-slots", seed);
    const m = prompt.match(/^(\d+) pairs of [a-z ]+ cost ([\d.]+) dollars/)!;
    assert.equal(num(chosen.count!), Number(m[1]));
    assert.equal(num(chosen.total!), Number(m[2]));
    assert.ok(Math.abs(num(chosen.unit!) * Number(m[1]) - Number(m[2])) < 1e-9);
  }
  for (const seed of seeds("cyl")) {
    const { prompt, chosen } = view("cylinder-volume-slots", seed);
    const m = prompt.match(
      /is (\d+) feet (across|from its center to its edge) and (\d+) feet deep/,
    )!;
    const r = m[2] === "across" ? Number(m[1]) / 2 : Number(m[1]);
    assert.equal(num(chosen.r1!), r);
    assert.equal(num(chosen.r2!), r);
    assert.equal(num(chosen.h!), Number(m[3]));
  }
  for (const seed of seeds("dil")) {
    const { prompt, chosen } = view("dilation-rule-slots", seed);
    const m = prompt
      .match(/A\((\d+), (\d+)\)\$ to its image \$A'\((\d+), (\d+)\)/)!
      .slice(1)
      .map(Number);
    const k = ratio(chosen.kx!);
    assert.deepEqual(chosen.kx, chosen.ky);
    assert.equal(m[0]! * k[0], m[2]! * k[1]);
    assert.equal(m[1]! * k[0], m[3]! * k[1]);
  }
  const image: Record<string, (x: number, y: number) => string> = {
    "a reflection across the $x$-axis": (x, y) => `(${x}, ${-y})`,
    "a reflection across the $y$-axis": (x, y) => `(${-x}, ${y})`,
    "a reflection across the line $y = x$": (x, y) => `(${y}, ${x})`,
    "a rotation of 180° about the origin": (x, y) => `(${-x}, ${-y})`,
    "a rotation of 90° counterclockwise about the origin": (x, y) =>
      `(${-y}, ${x})`,
    "a rotation of 90° clockwise about the origin": (x, y) => `(${y}, ${-x})`,
  };
  for (const seed of seeds("tr")) {
    const { response, chosen } = view("transformation-rule-slots", seed);
    for (const b of response.blanks) {
      const name = b.label.replace("The rule for ", "");
      const rule = chosen[b.id]!.replaceAll("$", "");
      const at = (x: number, y: number) =>
        rule.replace(/-?[xy]/g, (t) =>
          String(
            (t.startsWith("-") ? -1 : 1) * (t.endsWith("x") ? x : y),
          ).replace("--", ""),
        );
      assert.equal(
        at(3, 5).replace(/ /g, ""),
        image[name]!(3, 5).replace(/ /g, ""),
        name,
      );
    }
    assert.equal(new Set(Object.values(chosen)).size, response.blanks.length);
  }
});

test("exponent quotients, squared binomials and shifts match their formulas", () => {
  for (const seed of seeds("exp")) {
    const { prompt, chosen } = view("exponent-quotient-slots", seed);
    const m = prompt.match(
      /\\dfrac\{(\d+)([a-z])\^\{(\d+)\}\}\{(\d+)[a-z]\^\{(\d+)\}\}/,
    )!;
    assert.equal(num(chosen.coef!), Number(m[1]) / Number(m[4]));
    assert.equal(num(chosen.exp!), Number(m[3]) - Number(m[5]));
  }
  for (const seed of seeds("sq")) {
    const { prompt, chosen } = view("square-root-solutions-slots", seed);
    const m = prompt.match(/\(x ([+-]) (\d+)\)\^2 = (\d+)/)!;
    const h = Number(m[2]) * (m[1] === "+" ? 1 : -1);
    const [lo, hi] = [num(chosen.low!), num(chosen.high!)];
    assert.ok(lo < hi);
    for (const x of [lo, hi]) assert.equal((x + h) ** 2, Number(m[3]));
  }
  for (const seed of seeds("sh")) {
    const { prompt, chosen } = view("function-shift-sentence", seed);
    const m = prompt.match(/f\(x([+-])(\d+)\)([+-])(\d+)/)!;
    assert.equal(chosen.hdir, m[1] === "-" ? "right" : "left");
    assert.equal(num(chosen.hamt!), Number(m[2]));
    assert.equal(chosen.vdir, m[3] === "+" ? "up" : "down");
    assert.equal(num(chosen.vamt!), Number(m[4]));
  }
});
