import { test } from "node:test";
import assert from "node:assert/strict";
import { sweep, variantsOf } from "./fixtures/algebra-kit-checks";
import { add, eq, mul, parseQ, q, sub, type Q } from "./fixtures/kit-rational";

type Problem = ReturnType<typeof sweep>[number];
const options = (p: Problem) => {
  const r = p.public.response;
  if (r.kind !== "choice") throw new Error("choice expected");
  return r.options;
};
const label = (p: Problem) => options(p).find((o) => o.id === p.answer)!.label;
const element = (p: Problem) =>
  JSON.parse(JSON.stringify(p.public.figure)).scene.elements[0];

test("line-graph-reader: the keyed option follows from the plotted points", () => {
  const problems = sweep("line-graph-reader");
  for (const p of problems) {
    const g = element(p);
    const ask = p.variant!.id;
    const name = g.axisNames[0] as string;
    const prompt = p.public.prompt;
    const day = (i: number) => `${name} ${i}`;
    if (ask === "category-extreme") {
      const names = ["Soccer", "Art", "Chess", "Music"];
      const byColor = new Map<string, number[]>();
      for (const pt of g.points)
        byColor.set(pt.color, [...(byColor.get(pt.color) ?? []), pt.y]);
      const series = [...byColor.values()];
      assert.equal(series.length, 4);
      const week = Number(prompt.match(/In Week (\d+)/)![1]);
      const col = series.map((s) => s[week - 1]!);
      const want = /greatest percent/.test(prompt)
        ? Math.max(...col)
        : Math.min(...col);
      assert.equal(col.filter((v) => v === want).length, 1);
      assert.equal(label(p), names[col.indexOf(want)], p.public.seed);
      continue;
    }
    const ys: number[] = g.points.map((pt: { y: number }) => pt.y);
    assert.equal(g.points.length, ys.length);
    g.points.forEach((pt: { x: number }, i: number) =>
      assert.equal(pt.x, i + 1),
    );
    const d = ys.slice(1).map((v: number, i: number) => v - ys[i]!);
    const unit = /degrees/.test(prompt)
      ? "degrees"
      : /boxes/.test(prompt)
        ? "boxes"
        : "liters";
    if (ask === "greatest-point")
      assert.equal(label(p), day(ys.indexOf(Math.max(...ys)) + 1));
    else if (ask === "least-point")
      assert.equal(label(p), day(ys.indexOf(Math.min(...ys)) + 1));
    else if (ask === "value-at") {
      const i = Number(prompt.match(/on \w+ (\d+)\?/)![1]);
      assert.equal(label(p), `${ys[i - 1]} ${unit}`);
    } else if (ask === "closest-value") {
      const target = Number(prompt.match(/closest to (\d+)/)![1]);
      const dist = ys.map((v: number) => Math.abs(v - target));
      assert.equal(
        dist.filter((v: number) => v === Math.min(...dist)).length,
        1,
      );
      assert.equal(label(p), day(dist.indexOf(Math.min(...dist)) + 1));
    } else if (ask === "change-between") {
      const m = prompt.match(/from \w+ (\d+) to \w+ (\d+)\?/)!;
      const change = ys[Number(m[2]) - 1]! - ys[Number(m[1]) - 1]!;
      assert.equal(
        label(p),
        `${change > 0 ? "Increased" : "Decreased"} by ${Math.abs(change)}`,
      );
    } else if (ask === "greatest-increase" || ask === "greatest-decrease") {
      const best =
        ask === "greatest-increase" ? Math.max(...d) : Math.min(...d);
      assert.equal(d.filter((v: number) => v === best).length, 1);
      const i = d.indexOf(best) + 1;
      assert.equal(label(p), `${day(i)} to ${day(i + 1)}`);
    } else {
      // Judge every displayed statement independently; exactly one is true.
      const truth = (s: string): boolean => {
        let m: RegExpMatchArray | null;
        if ((m = s.match(/was greater on \w+ (\d+) than on \w+ (\d+)\./)))
          return ys[Number(m[1]) - 1]! > ys[Number(m[2]) - 1]!;
        if ((m = s.match(/greatest increase was from \w+ (\d+) to/)))
          return d.indexOf(Math.max(...d)) + 1 === Number(m[1]);
        if ((m = s.match(/greatest decrease was from \w+ (\d+) to/)))
          return d.indexOf(Math.min(...d)) + 1 === Number(m[1]);
        if ((m = s.match(/was (greatest|least) on \w+ (\d+)\./))) {
          const v = ys[Number(m[2]) - 1]!;
          const best = m[1] === "greatest" ? Math.max(...ys) : Math.min(...ys);
          return (
            v === best && ys.filter((x: number) => x === best).length === 1
          );
        }
        if (
          (m = s.match(
            /on \w+ (\d+) was (\d+) (more|less) than on \w+ (\d+)\./,
          ))
        ) {
          const diff = ys[Number(m[1]) - 1]! - ys[Number(m[4]) - 1]!;
          return (
            Math.abs(diff) === Number(m[2]) &&
            (m[3] === "more") === diff > 0 &&
            diff !== 0
          );
        }
        if ((m = s.match(/increased each \w+ from \w+ (\d+) to \w+ (\d+)\./))) {
          const part = ys.slice(Number(m[1]) - 1, Number(m[2]));
          return part.every((v: number, k: number) => !k || v > part[k - 1]!);
        }
        throw new Error(`Unparsed statement: ${s}`);
      };
      const trues = options(p).filter((o) => truth(o.label));
      assert.equal(trues.length, 1, p.public.seed);
      assert.equal(trues[0]!.id, p.answer);
    }
  }
});

test("line-graph-reader: every ask is reachable and hints vary", () => {
  const problems = sweep("line-graph-reader");
  const seen = variantsOf(problems);
  for (const ask of [
    "greatest-point",
    "least-point",
    "value-at",
    "closest-value",
    "change-between",
    "greatest-increase",
    "greatest-decrease",
    "true-statement",
    "category-extreme",
  ])
    assert.ok(seen.has(ask), ask);
  assert.ok(new Set(problems.map((p) => p.hint)).size > 20);
});

const fraction = (s: string): Q => {
  const m = s.match(/^\$?(?:(\d+))?\\frac\{(\d+)\}\{(\d+)\}\$?$/);
  if (m) return add(q(Number(m[1] ?? 0)), q(Number(m[2]), Number(m[3])));
  const mixed = s.match(/^\$(\d+)\\frac\{(\d+)\}\{(\d+)\}\$$/);
  if (mixed)
    return add(q(Number(mixed[1])), q(Number(mixed[2]), Number(mixed[3])));
  return parseQ(s);
};

test("dot-plot-arithmetic: the keyed answer follows from the plotted dots", () => {
  const problems = sweep("dot-plot-arithmetic");
  for (const p of problems) {
    const g = element(p);
    const d = g.denominator ?? 1;
    const values: Q[] = g.groups[0].values.map((v: number) =>
      q(Math.round(v * d), d),
    );
    const ask = p.variant!.id.replace(/^(whole|mixed)-/, "");
    const sum = values.reduce((s, v) => add(s, v), q(0));
    const sorted = [...values].sort((a, b) => a[0] * b[1] - b[0] * a[1]);
    const prompt = p.public.prompt;
    let expected: Q;
    if (ask === "total") expected = sum;
    else if (ask === "range") expected = sub(sorted.at(-1)!, sorted[0]!);
    else {
      const stated = prompt.match(
        /(?:\$([^$]+)\$|(\d+)) (?:miles|points|feet|pounds)/,
      )!;
      const grand = fraction(stated[1] ? `$${stated[1]}$` : stated[2]!);
      expected = sub(grand, sum);
    }
    const text = label(p).replace(/ (miles?|points?|feet|foot|pounds?)$/, "");
    assert.ok(eq(fraction(text), expected), `${p.public.seed} ${ask}`);
    // Counting multiplicity matters in every plot.
    assert.ok(new Set(values.map((v) => v.join("/"))).size < values.length);
    if (p.variant!.id.startsWith("mixed"))
      assert.ok(values.some((v) => v[1] !== 1));
    else assert.ok(values.every((v) => v[1] === 1));
  }
});

test("dot-plot-arithmetic: whole and mixed values reach every question", () => {
  const seen = variantsOf(sweep("dot-plot-arithmetic"));
  for (const v of ["whole", "mixed"])
    for (const a of ["total", "range", "missing-value"])
      assert.ok(seen.has(`${v}-${a}`), `${v}-${a}`);
  void mul;
});
