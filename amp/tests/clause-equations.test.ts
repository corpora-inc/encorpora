import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { gradeStructuredWork } from "../src/math/structured-work";
import { classifyLinearRight } from "../src/math/structured-work";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";
import type { StructuredWorkResponse } from "../src/math/structured-work";

const seeds = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

function chosen(problem: ReturnType<typeof generateProblem>, blank: string) {
  const response = problem.public.response as MultiPartChoiceResponse;
  const key = JSON.parse(problem.answer) as Record<string, string>;
  const row = response.blanks.find((b) => b.id === blank)!;
  return row.options.find((o) => o.id === key[blank])!.label;
}

test("classic clause draws match version 1 byte for byte", () => {
  for (const id of [
    "unknown-addend-story",
    "substitution-match-table",
    "inequality-solution-set",
    "grouped-both-sides-steps",
    "linear-system-solution-count",
  ])
    for (const seed of seeds(80, `classic-${id}`)) {
      const current = generateProblem(id, seed);
      if (current.variant?.axes && "clause" in current.variant.axes) continue;
      assert.deepEqual(generateProblem(id, seed, 1), current, `${id} ${seed}`);
    }
});

test("subtraction-unknown keeps one box and a true equation", () => {
  const forms = new Map<string, number>();
  let left = 0;
  let n = 0;
  for (const seed of seeds(400, "sub")) {
    const p = generateProblem("unknown-addend-story", seed);
    if (p.variant?.id !== "subtraction-unknown") continue;
    n++;
    const eq = p.public.prompt;
    assert.equal((eq.match(/□/g) ?? []).length, 1, seed);
    assert.equal((eq.match(/−/g) ?? []).length, 1, seed);
    const nums = [...eq.matchAll(/\d+/g)].map((m) => Number(m[0]));
    assert.ok(nums.every((v) => v <= 20));
    const answer = Number(p.answer);
    const replaced = eq.replace("□", String(answer));
    const [lhs, rhs] = replaced
      .replace(/^Find the number that makes the equation true\. /, "")
      .replace(/\.$/, "")
      .split(" = ")
      .map((side) => {
        const [a, b] = side.split(" − ").map(Number);
        return b === undefined ? a! : a! - b;
      });
    assert.equal(lhs, rhs, seed);
    const shape = eq
      .replace(/\d+/g, "#")
      .replace(/^Find the number that makes the equation true\. /, "");
    forms.set(shape, (forms.get(shape) ?? 0) + 1);
    if (/true\. \d+ = □/.test(eq)) left++;
    if (/□ −/.test(eq) || /= □ −/.test(eq)) {
      const visible = [...eq.matchAll(/\d+/g)].map((m) => Number(m[0]));
      const gap = Math.abs(visible[0]! - visible[1]!);
      assert.notEqual(gap, answer, seed);
    }
    assert.equal(gradeAnswer(p, p.answer), true);
    assert.doesNotMatch(p.hint, new RegExp(`\\b${answer}\\b`));
  }
  assert.ok(n >= 120, `family count ${n}`);
  for (const count of forms.values()) assert.ok(count / n >= 0.15, `${count}/${n}`);
  assert.ok(left / n >= 0.25, `left ${left}/${n}`);
});

test("values-from-set substitutes exactly and often has no solution", () => {
  let n = 0;
  let none = 0;
  let two = 0;
  let twoWithGap = 0;
  for (const seed of seeds(400, "val")) {
    const p = generateProblem("substitution-match-table", seed);
    if (p.variant?.id !== "values-from-set") continue;
    n++;
    const response = p.public.response as MultiPartChoiceResponse;
    const sentence = /\$([^$]+)\$/.exec(p.public.prompt)![1]!;
    const parsed =
      /^((?:-?\d+)?x)(?: \+ (\d+)| − (\d+))? ([<=>≤≥]) (-?\d+)$/.exec(
        sentence,
      );
    assert.ok(parsed, sentence);
    const coef = parsed[1] === "x" ? 1 : Number(parsed[1]!.replace("x", ""));
    const add = parsed[2] ? Number(parsed[2]) : parsed[3] ? -Number(parsed[3]) : 0;
    const op = parsed[4]!;
    const right = Number(parsed[5]);
    const truths: boolean[] = [];
    for (const blank of response.blanks) {
      if (blank.id === "count") continue;
      const x = Number(blank.label);
      const left = coef * x + add;
      const holds =
        op === "="
          ? left === right
          : op === "<"
            ? left < right
            : op === ">"
              ? left > right
              : op === "≤"
                ? left <= right
                : left >= right;
      truths.push(holds);
      assert.equal(chosen(p, blank.id), holds ? "true" : "not true", seed);
    }
    const count = truths.filter(Boolean).length;
    const label =
      count === 0 ? "none" : count === 1 ? "exactly one" : "more than one";
    assert.equal(chosen(p, "count"), label, seed);
    if (label === "none") none++;
    const twoStep = op === "=" && coef > 1 && add !== 0;
    if (twoStep) {
      two++;
      const values = response.blanks
        .filter((b) => b.id !== "count")
        .map((b) => Number(b.label));
      if (values.includes(right - add)) twoWithGap++;
    }
  }
  assert.ok(n >= 120, `n ${n}`);
  assert.ok(none / n >= 0.25, `none ${none}/${n}`);
  assert.ok(two === 0 || twoWithGap / two >= 0.9, `gap ${twoWithGap}/${two}`);
});

test("strict inequalities never include the boundary", () => {
  let n = 0;
  for (const seed of seeds(400, "strict")) {
    const p = generateProblem("inequality-solution-set", seed);
    if (p.variant?.id !== "strict-form") continue;
    n++;
    const m = /x ([<>]) (−?\d+(?:\.\d+)?)/.exec(p.public.prompt);
    assert.ok(m, p.public.prompt);
    const sign = m[1] as "<" | ">";
    const c = Number(m[2]!.replace("−", "-"));
    const options = p.public.response.kind === "choice" ? p.public.response.options : [];
    const key = options.find((o) => o.id === p.answer)!.label;
    assert.match(key, /is not/);
    assert.match(key, /infinitely many/);
    assert.doesNotMatch(key, new RegExp(`and ${m[2]} are solutions`));
    const finite = options.map((o) => o.label).find((l) => /whole number/.test(l))!;
    if (sign === "<" && c > 0) {
      const greatest = Number.isInteger(c) ? c - 1 : Math.floor(c);
      const count = greatest + 1;
      assert.match(
        finite,
        count === 1
          ? /there (?:is 1 solution|are 1 solutions)/
          : new RegExp(`there are ${count} solutions`),
      );
    } else assert.match(finite, /no whole number/);
    const probe = sign === "<" ? (c > 0 ? 0 : c - 1) : c + 1;
    const reversed = options
      .map((o) => o.label)
      .find((l) => l.startsWith("Every number") && !l.includes("is not"))!;
    const holds =
      sign === "<" ? probe < c : probe > c;
    assert.equal(holds, true);
    assert.equal(
      sign === "<" ? probe > c : probe < c,
      false,
      reversed,
    );
  }
  assert.ok(n >= 120, `n ${n}`);
});

test("arithmetic and algebra use the same operation order", () => {
  let n = 0;
  for (const seed of seeds(200, "cmp")) {
    const p = generateProblem("arithmetic-algebra-compare", seed);
    n++;
    const arith = chosen(p, "arith");
    const alg = chosen(p, "alg");
    const same = chosen(p, "same");
    const steps = arith.toLowerCase();
    if (steps.startsWith("subtract")) {
      assert.match(alg, /subtract/i);
      assert.match(same, /subtract/i);
      assert.match(same, /divide/i);
    } else {
      assert.match(alg, /divide/i);
      assert.match(same, /divide/i);
      assert.match(same, /subtract/i);
    }
    assert.equal(gradeAnswer(p, p.answer), true);
  }
  assert.equal(n, 200);
});

test("fee graphs follow the truth at zero and name whole bounds", () => {
  let graphs = 0;
  let words = 0;
  for (const seed of seeds(200, "fee")) {
    const graph = generateProblem("fee-budget-number-line", seed);
    graphs++;
    const m = /\$(\d+) \+ (\d+)x ([≤≥<>]) (\d+(?:\.\d+)?)\$/.exec(
      graph.public.prompt,
    )!;
    const fee = Number(m[1]);
    const rate = Number(m[2]);
    const op = m[3]!;
    const budget = Number(m[4]);
    const b = (budget - fee) / rate;
    const at0 =
      op === "≤"
        ? fee <= budget
        : op === "<"
          ? fee < budget
          : op === "≥"
            ? fee >= budget
            : fee > budget;
    const options =
      graph.public.response.kind === "figure-choice"
        ? graph.public.response.options
        : [];
    const key = options.find((o) => o.id === graph.answer)!.label;
    assert.match(key, at0 ? /shaded left/ : /shaded right/);
    assert.match(key, op === "<" || op === ">" ? /open/i : /filled/i);
    assert.match(key, new RegExp(String(b)));

    const wordsP = generateProblem("fee-budget-meaning", `meaning-${seed}`);
    words++;
    const wm = /\$(\d+) \+ (\d+)x ([≤≥<>]) (\d+(?:\.\d+)?)\$/.exec(
      wordsP.public.prompt,
    )!;
    const wb = (Number(wm[4]) - Number(wm[1])) / Number(wm[2]);
    const wop = wm[3]!;
    const text =
      wordsP.public.response.kind === "choice"
        ? wordsP.public.response.options.find((o) => o.id === wordsP.answer)!
            .label
        : "";
    if (!Number.isInteger(wb)) {
      const named = wop === "≥" || wop === ">" ? Math.ceil(wb) : Math.floor(wb);
      assert.match(text, new RegExp(`\\b${named}\\b`));
    }
  }
  assert.equal(graphs, 200);
  assert.equal(words, 200);
});

test("line pairs classify by exact slope and intercept", () => {
  const counts = { parallel: 0, intersect: 0, same: 0 };
  let n = 0;
  for (const seed of seeds(300, "lines")) {
    const p = generateProblem("linear-system-solution-count", seed);
    if (p.variant?.id !== "lines-through-points") continue;
    n++;
    const pts = [...p.public.prompt.matchAll(/\((-?\d+), (-?\d+)\)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    assert.equal(pts.length, 4, p.public.prompt);
    const slope = (a: number[], b: number[]) => (b[1]! - a[1]!) / (b[0]! - a[0]!);
    const s1 = slope(pts[0]!, pts[1]!);
    const s2 = slope(pts[2]!, pts[3]!);
    const i1 = pts[0]![1]! - s1 * pts[0]![0]!;
    const i2 = pts[2]![1]! - s2 * pts[2]![0]!;
    const label =
      p.public.response.kind === "choice"
        ? p.public.response.options.find((o) => o.id === p.answer)!.label
        : "";
    if (s1 === s2 && i1 === i2) {
      counts.same++;
      assert.match(label, /same line/);
    } else if (s1 === s2) {
      counts.parallel++;
      assert.match(label, /parallel/);
      assert.doesNotMatch(label, /Yes, at \(/);
    } else {
      counts.intersect++;
      const x = (i2 - i1) / (s1 - s2);
      const y = s1 * x + i1;
      assert.match(label, /Yes, at/);
      const hit = /Yes, at \(([^)]+)\)/.exec(label)!;
      const num = (t: string) => {
        const [a, b] = t.split("/").map(Number);
        return b ? a! / b : a!;
      };
      const [xs, ys] = hit[1]!.split(", ").map((t) => num(t.trim()));
      assert.ok(Math.abs(xs! - x) < 1e-9 && Math.abs(ys! - y) < 1e-9, label);
    }
  }
  assert.ok(n >= 80, `n ${n}`);
  for (const [name, count] of Object.entries(counts))
    assert.ok(count / n >= (name === "same" ? 0.12 : 0.25), `${name} ${count}/${n}`);
});

test("the combine stage accepts a commuted equation", () => {
  let checked = 0;
  const cases = { one: 0, infinite: 0, none: 0 };
  for (const seed of seeds(400, "work")) {
    const p = generateProblem("grouped-both-sides-steps", seed);
    if (p.variant?.id !== "solution-count-steps") continue;
    const response = p.public.response as StructuredWorkResponse;
    const rows = JSON.parse(p.answer) as string[][];
    const combined = rows[1]![0]!;
    const [left, right] = combined.split("=");
    const commute = (side: string) => {
      const m = /^(-?)(\d*)x([+-]\d+)$/.exec(side);
      if (!m) return side;
      const coef = (m[1] === "-" ? -1 : 1) * (m[2] === "" ? 1 : Number(m[2]));
      const con = Number(m[3]);
      const x = coef === 1 ? "x" : coef === -1 ? "-x" : `${coef}x`;
      return `${con}${coef < 0 ? x : `+${x}`}`;
    };
    const next = rows.map((row) => [...row]);
    const swapped = `${left}=${commute(right!)}`;
    next[1]![0] = swapped;
    assert.equal(
      gradeStructuredWork(response, p.workGrading!, JSON.stringify(next)),
      true,
      `${seed} ${combined} -> ${swapped}`,
    );
    const conclusion = response.banks[0]!.options.find(
      (o) => o.id === rows[3]![0],
    )!.label;
    if (conclusion.startsWith("Infinitely")) cases.infinite++;
    else if (conclusion.startsWith("No solution")) cases.none++;
    else cases.one++;
    if (conclusion.startsWith("No solution")) {
      const closed = rows[2]![0]!;
      const [a, b] = closed.split("=").map(Number);
      assert.notEqual(a, b, closed);
    }
    checked++;
  }
  assert.ok(checked >= 60, `checked ${checked}`);
  for (const count of Object.values(cases))
    assert.ok(count / checked >= 0.28, `${count}/${checked} ${JSON.stringify(cases)}`);
});

test("linear right-side classes match brute force", () => {
  const axb = (a: number, b: number) => {
    if (a === 0) return `${b}`;
    const x = a === 1 ? "x" : a === -1 ? "-x" : `${a}x`;
    if (b === 0) return x;
    return b > 0 ? `${x}+${b}` : `${x}${b}`;
  };
  let n = 0;
  for (let p = -9; p <= 9; p++) {
    if (p === 0) continue;
    for (let q = -12; q <= 12; q += 3)
      for (let a = -12; a <= 12; a += 2)
        for (let b = -18; b <= 18; b += 3) {
          const cls = a === p && b === q ? "infinite" : a === p ? "none" : "one";
          assert.equal(classifyLinearRight(p, q, axb(a, b)), cls);
          n++;
        }
  }
  assert.equal(classifyLinearRight(4, 3, "2(2x+1)+1"), "infinite");
  assert.equal(classifyLinearRight(4, 3, "4x+5"), "none");
  assert.equal(classifyLinearRight(4, 3, "5x+3"), "one");
  assert.ok(n >= 1000, `n ${n}`);
  let numeric = 0;
  let made = 0;
  for (const seed of seeds(80, "ex")) {
    const p = generateProblem("equation-make-example", seed);
    made++;
    if (p.public.prompt.startsWith("Fill the box")) numeric++;
    assert.equal(gradeAnswer(p, p.answer), true);
  }
  assert.ok(numeric / made >= 0.15 && numeric / made <= 0.5, `${numeric}/${made}`);
});

test("assumption checks and scaled elimination are exact", () => {
  let none = 0;
  let solved = 0;
  for (const seed of seeds(120, "asm")) {
    const p = generateProblem("assume-solution-check", seed);
    const check = chosen(p, "chk");
    if (p.public.prompt.includes("leaves")) {
      none++;
      assert.match(chosen(p, "shown"), /no number is a solution/);
      assert.match(check, /false/);
    } else {
      solved++;
      const x = Number(/x = (-?\d+)/.exec(p.public.prompt)![1]);
      const eq = /with (.+)\. The chain/.exec(p.public.prompt)![1]!;
      const [left, right] = eq.split(" = ");
      const value = (side: string) => {
        const m = /(-?\d+)\(x([+-]\d+)\)/.exec(side);
        if (m) return Number(m[1]) * (x + Number(m[2]));
        return Number(/(-?\d+)x/.exec(side)?.[1] ?? 0) * x + Number(/(?:x)([+-]\d+)/.exec(side)?.[1] ?? 0);
      };
      assert.equal(value(left!), value(right!));
      assert.match(check, new RegExp(String(value(left!))));
    }
  }
  assert.ok(none / (none + solved) >= 0.2, `${none}/${none + solved}`);

  for (const seed of seeds(80, "elim")) {
    const p = generateProblem("scaled-elimination", seed);
    const sum = chosen(p, "sum");
    const m = /E2 \+ (-?\d+)·E1/.exec(p.public.prompt)!;
    const k = Number(m[1]);
    const eqs = [...p.public.prompt.matchAll(/(-?\d+)x([+-]\d+)y = (-?\d+)/g)];
    assert.equal(eqs.length, 2, p.public.prompt);
    const [a, b, c] = eqs[0]!.slice(1).map(Number);
    const [d, e, f] = eqs[1]!.slice(1).map(Number);
    const nx = d! + k * a!;
    const ny = e! + k * b!;
    const nr = f! + k * c!;
    assert.equal(ny, 0, p.public.prompt);
    const xTerm = nx === 1 ? /(?:^| )x =/ : nx === -1 ? /-x =/ : new RegExp(`${nx}x`);
    assert.match(sum, xTerm);
    assert.match(sum, new RegExp(`= ${nr}`));
    const unscaled = p.public.response.kind === "multi-part-choice"
      ? p.public.response.blanks[0]!.options.map((o) => o.label)
      : [];
    assert.ok(unscaled.some((label) => label.includes(`= ${f! + c!}`) && label !== sum));
  }
});
