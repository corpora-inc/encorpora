import test from "node:test";
import assert from "node:assert/strict";
import {
  satAlgebraStructureCase,
  satAlgebraStructureTemplates,
} from "../src/math/sat-algebra-structure-practice";
import { generateProblem, templates } from "../src/math/engine";
import { revealsAnswer } from "./fixtures/hint-rules";
import { problemLesson } from "../src/content/problem-lessons";

const SEEDS = 400;
const ids = satAlgebraStructureTemplates.map((t) => t.id);

/* Independent exact rationals (BigInt); nothing here shares code with the generator. */
type F = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint =>
  b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b);
function f(n: bigint | number, d: bigint | number = 1n): F {
  let N = BigInt(n);
  let D = BigInt(d);
  assert.notEqual(D, 0n);
  if (D < 0n) {
    N = -N;
    D = -D;
  }
  const g = gcd(N, D) || 1n;
  return { n: N / g, d: D / g };
}
const plus = (a: F, b: F) => f(a.n * b.d + b.n * a.d, a.d * b.d);
const minus = (a: F, b: F) => f(a.n * b.d - b.n * a.d, a.d * b.d);
const times = (a: F, b: F) => f(a.n * b.n, a.d * b.d);
const over = (a: F, b: F) => f(a.n * b.d, a.d * b.n);
const same = (a: F, b: F) => a.n === b.n && a.d === b.d;
const cmp = (a: F, b: F) => {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
};
const RAT = String.raw`-?(?:\\frac\{\d+\}\{\d+\}|\d+)`;
function parseRat(text: string): F {
  const frac = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(text);
  if (frac) return f(BigInt(frac[2]!) * (frac[1] ? -1n : 1n), BigInt(frac[3]!));
  assert.match(text, /^-?\d+$/);
  return f(BigInt(text));
}
/** Value of a numeric choice such as "$-\frac{3}{2}$ hours", "$30\%$" or "$12$". */
function numericLabel(label: string): F | null {
  const hit = new RegExp(String.raw`^\$(${RAT})(?:\\%)?\$(?: [a-z]+)?$`).exec(
    label,
  );
  return hit ? parseRat(hit[1]!) : null;
}
function choiceOf(prompt: ReturnType<typeof generateProblem>) {
  const response = prompt.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice expected");
  return response.options;
}
function expectOne(
  problem: ReturnType<typeof generateProblem>,
  matches: (label: string) => boolean,
) {
  const options = choiceOf(problem);
  assert.equal(new Set(options.map((o) => o.label)).size, 4);
  const hits = options.filter((o) => matches(o.label));
  assert.equal(
    hits.length,
    1,
    `${problem.public.prompt}\n${options.map((o) => o.label).join(" | ")}`,
  );
  assert.equal(problem.answer, hits[0]!.id);
}
function expectValue(problem: ReturnType<typeof generateProblem>, value: F) {
  expectOne(problem, (label) => {
    const got = numericLabel(label);
    return got !== null && same(got, value);
  });
}

/* Parsers for the visible text. */
function parseLinear(text: string, variable = "x"): [bigint, bigint] {
  const clean = text.replaceAll(" ", "");
  const hit = new RegExp(`^(-?\\d*)${variable}(?:([+-]\\d+))?$`).exec(clean);
  assert.ok(hit, text);
  const a = hit[1] === "" ? 1n : hit[1] === "-" ? -1n : BigInt(hit[1]!);
  return [a, hit[2] ? BigInt(hit[2]) : 0n];
}
function parsePoly(text: string): [bigint, bigint, bigint] {
  const hit = /^(-?\d*)x\^2(?:([+-]\d*)x)?(?:([+-]\d+))?$/.exec(
    text.replaceAll(" ", ""),
  );
  assert.ok(hit, text);
  const coef = (s: string | undefined) =>
    s === undefined
      ? 0n
      : s === "" || s === "+"
        ? 1n
        : s === "-"
          ? -1n
          : BigInt(s);
  return [coef(hit[1]), coef(hit[2]), hit[3] ? BigInt(hit[3]) : 0n];
}
const approx = (label: string, expected: number) => {
  const v = numericLabel(label);
  return v !== null && Math.abs(Number(v.n) / Number(v.d) - expected) < 1e-9;
};

/** Parses a table such as \begin{array}{c|ccc}x&1&2&3\\\hline y&2&4&6\end{array}. */
function parseTable(prompt: string): [number, number][] {
  const hit =
    /x&(-?\d+)&(-?\d+)&(-?\d+)\\\\\\hline y&(-?\d+)&(-?\d+)&(-?\d+)/.exec(
      prompt,
    );
  assert.ok(hit, prompt);
  return [0, 1, 2].map(
    (i) => [Number(hit[1 + i]), Number(hit[4 + i])] as [number, number],
  );
}
/** Evaluates y = ... for the equation forms the generator uses (exact on a lattice). */
function evalY(label: string, x: number): F | null {
  const body = /^\$y=(.*)\$$/.exec(label)?.[1];
  if (body === undefined) return null;
  let hit = /^\\frac\{(-?\d+)\}\{x\}$/.exec(body);
  if (hit) return f(BigInt(hit[1]!), x);
  hit = /^(-?(?:\\frac\{\d+\}\{\d+\})?\d*)x$/.exec(body);
  if (hit) {
    const k =
      hit[1] === ""
        ? f(1)
        : hit[1] === "-"
          ? f(-1)
          : parseRat(hit[1]!.replace(/(\\frac\{\d+\}\{\d+\})$/, "$1"));
    return times(k, f(x));
  }
  hit = /^(-?\\frac\{\d+\}\{\d+\})x$/.exec(body);
  if (hit) return times(parseRat(hit[1]!), f(x));
  hit = /^(-?\d*)x([+-]\d+)$/.exec(body);
  if (hit) {
    const k = hit[1] === "" ? 1n : hit[1] === "-" ? -1n : BigInt(hit[1]!);
    return f(k * BigInt(x) + BigInt(hit[2]!));
  }
  return null;
}

/** Evaluates integer-coefficient quadratic text such as y=2(x+1)(x-3) or y=3x^2 - x + 4. */
function evalQuadratic(label: string, x: number): number {
  const body = /^\$y=(.*)\$$/
    .exec(label)![1]!
    .replaceAll(" ", "")
    .replace(/(\([^()]*\))\^2/g, "($1**2)")
    .replace(/x\^2/g, "(x**2)");
  const code = body.replace(/(\d|\)|x)(?=\(|x)/g, "$1*");
  return new Function("x", `return ${code};`)(x) as number;
}

/* Predicates on x for the inequality family. */
type Pred = (x: F) => boolean;
const grid: F[] = [];
for (let n = -300; n <= 300; n++) grid.push(f(n, 12));
function relation(rel: string): (a: F, b: F) => boolean {
  if (rel === "<") return (a, b) => cmp(a, b) < 0;
  if (rel === ">") return (a, b) => cmp(a, b) > 0;
  if (rel === "≤") return (a, b) => cmp(a, b) <= 0;
  return (a, b) => cmp(a, b) >= 0;
}
const norm = (s: string) => s.replace(/\\le\s*/g, "≤").replace(/\\ge\s*/g, "≥");
function labelPredicate(label: string): Pred | null {
  const text = norm(label);
  if (text === "There are no real solutions") return () => false;
  if (text === "Every real number is a solution") return () => true;
  let hit = new RegExp(`^Only \\$x=(${RAT})\\$$`).exec(text);
  if (hit) return (x) => same(x, parseRat(hit![1]!));
  hit = new RegExp(`^Every real number except \\$x=(${RAT})\\$$`).exec(text);
  if (hit) return (x) => !same(x, parseRat(hit![1]!));
  hit = new RegExp(`^\\$(${RAT})([<≤])x([<≤])(${RAT})\\$$`).exec(text);
  if (hit) {
    const [lo, hi] = [parseRat(hit[1]!), parseRat(hit[4]!)];
    return (x) => relation(hit![2]!)(lo, x) && relation(hit![3]!)(x, hi);
  }
  hit = new RegExp(
    `^\\$x([<≤])(${RAT})\\$ (or|and) \\$x([>≥])(${RAT})\\$$`,
  ).exec(text);
  if (hit) {
    const [a, b] = [parseRat(hit[2]!), parseRat(hit[5]!)];
    const left = (x: F) => relation(hit![1]!)(x, a);
    const right = (x: F) => relation(hit![4]!)(x, b);
    return hit[3] === "or"
      ? (x) => left(x) || right(x)
      : (x) => left(x) && right(x);
  }
  hit = new RegExp(`^\\$x([<≤>≥])(${RAT})\\$ or \\$x([<≤>≥])(${RAT})\\$$`).exec(
    text,
  );
  if (hit) {
    const [a, b] = [parseRat(hit[2]!), parseRat(hit[4]!)];
    return (x) => relation(hit![1]!)(x, a) || relation(hit![3]!)(x, b);
  }
  hit = new RegExp(`^\\$x([<≤])(${RAT})\\$$`).exec(text);
  if (hit) return (x) => relation(hit![1]!)(x, parseRat(hit![2]!));
  hit = /^\$\|x([+-]\d+)?\|([<≤>≥])(\d+)\$$/.exec(text);
  if (hit) {
    const center = hit[1] ? -BigInt(hit[1]) : 0n;
    const radius = f(BigInt(hit[3]!));
    return (x) => relation(hit![2]!)(abs(minus(x, f(center))), radius);
  }
  return null;
}
const abs = (a: F) => (a.n < 0n ? f(-a.n, a.d) : a);

function promptPredicate(prompt: string): Pred {
  const text = norm(prompt);
  let hit =
    /^Which gives all real solutions of \$\|([^|]+)\|([<≤>≥])(-?\d+)\$\?$/.exec(
      text,
    ) ??
    /^Which describes all real solutions of \$\|([^|]+)\|([<≤>≥])\s*(-?\d+)\$\?$/.exec(
      text,
    );
  if (hit) {
    const [a, b] = parseLinear(hit[1]!);
    return (x) =>
      relation(hit![2]!)(abs(plus(times(f(a), x), f(b))), f(BigInt(hit![3]!)));
  }
  hit =
    /^Which gives all real \$x\$ satisfying \$(-?\d+)([<≤])([^<≤]+)([<≤])(-?\d+)\$\?$/.exec(
      text,
    );
  if (hit) {
    const [a, b] = parseLinear(hit[3]!);
    return (x) => {
      const e = plus(times(f(a), x), f(b));
      return (
        relation(hit![2]!)(f(BigInt(hit![1]!)), e) &&
        relation(hit![4]!)(e, f(BigInt(hit![5]!)))
      );
    };
  }
  hit =
    /^Which gives every real \$x\$ that satisfies \$([^$]+)\$ or \$([^$]+)\$\?$/.exec(
      text,
    );
  if (hit) {
    const piece = (s: string): Pred => {
      const m = /^(.+?)([<≤>≥])\s*(-?\d+)$/.exec(s)!;
      const [a, b] = parseLinear(m[1]!);
      return (x) =>
        relation(m[2]!)(plus(times(f(a), x), f(b)), f(BigInt(m[3]!)));
    };
    const [p1, p2] = [piece(hit[1]!), piece(hit[2]!)];
    return (x) => p1(x) || p2(x);
  }
  hit =
    /segment from \$(-?\d+)\$ to \$(-?\d+)\$, with (both endpoints included|neither endpoint included)/.exec(
      text,
    );
  if (hit) {
    const [lo, hi] = [f(BigInt(hit[1]!)), f(BigInt(hit[2]!))];
    const closed = hit[3]!.startsWith("both");
    return (x) =>
      closed
        ? cmp(lo, x) <= 0 && cmp(x, hi) <= 0
        : cmp(lo, x) < 0 && cmp(x, hi) < 0;
  }
  hit =
    /every point (at or to|to) the left of \$(-?\d+)\$ together with every point (?:at or to|to) the right of \$(-?\d+)\$/.exec(
      text,
    );
  if (hit) {
    const [lo, hi] = [f(BigInt(hit[2]!)), f(BigInt(hit[3]!))];
    const closed = hit[1]!.startsWith("at");
    return (x) =>
      closed
        ? cmp(x, lo) <= 0 || cmp(x, hi) >= 0
        : cmp(x, lo) < 0 || cmp(x, hi) > 0;
  }
  throw new Error(`Unparsed prompt: ${prompt}`);
}

/* ---------- tests ---------- */

test("every new template is deterministic, public and reaches every variant", () => {
  const variants: Record<string, Set<number>> = {};
  for (const id of ids) variants[id] = new Set();
  for (const id of ids)
    for (let seed = 0; seed < SEEDS; seed++) {
      const direct = satAlgebraStructureCase(id, `s${seed}`);
      const again = satAlgebraStructureCase(id, `s${seed}`);
      assert.deepEqual(direct.problem, again.problem);
      variants[id]!.add(direct.variant);
      const generated = generateProblem(id, `s${seed}`);
      assert.deepEqual(generated.public, direct.problem.public);
      assert.equal(generated.answer, direct.problem.answer);
      const options = choiceOf(generated);
      assert.equal(options.length, 4);
      assert.equal(new Set(options.map((o) => o.label)).size, 4);
      assert.equal(options.filter((o) => o.id === generated.answer).length, 1);
      assert.ok(
        !revealsAnswer(generated, false),
        `${id}: hint states the answer`,
      );
      for (const option of options)
        if (option.id !== generated.answer)
          assert.ok(
            generated.choiceFeedback?.[option.id],
            `${id}: ${option.label} lacks feedback`,
          );
      assert.ok(generated.explanation.length >= 2);
    }
  assert.deepEqual(
    [...variants["quadratic-root-relations"]!].sort(),
    [0, 1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    [...variants["system-expression-value"]!].sort(),
    [0, 1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    [...variants["variation-constant"]!].sort(),
    [0, 1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    [...variants["rate-combination-model"]!].sort(),
    [0, 1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    [...variants["absolute-compound-inequality"]!].sort(),
    [0, 1, 2, 3, 4, 5],
  );
  assert.deepEqual([...variants["quadratic-from-data"]!].sort(), [0, 1, 2, 3]);
});

test("quadratic-root-relations agrees with numeric roots, substitution and the product of roots", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const p = generateProblem("quadratic-root-relations", `o${seed}`);
    const prompt = p.public.prompt;
    let hit = /(sum|product) of the two real solutions of \$(.+)=0\$/.exec(
      prompt,
    );
    const roots = (a: bigint, b: bigint, c: bigint) => {
      const disc = Math.sqrt(Number(b * b - 4n * a * c));
      return [
        (-Number(b) + disc) / (2 * Number(a)),
        (-Number(b) - disc) / (2 * Number(a)),
      ] as const;
    };
    if (hit) {
      const [a, b, c] = parsePoly(hit[2]!);
      assert.ok(b * b - 4n * a * c > 0n);
      const [r1, r2] = roots(a, b, c);
      expectOne(p, (l) => approx(l, hit![1] === "sum" ? r1 + r2 : r1 * r2));
      continue;
    }
    hit = /and \$q\$\. What is the value of \$(.+)\$\?$/.exec(prompt);
    if (/The real solutions of/.test(prompt)) {
      const eqn = /solutions of \$(.+)=0\$ are/.exec(prompt)![1]!;
      const [a, b, c] = parsePoly(eqn);
      assert.ok(b * b - 4n * a * c > 0n);
      const [r1, r2] = roots(a, b, c);
      const squares = prompt.includes("p^2+q^2");
      expectOne(p, (l) =>
        approx(l, squares ? r1 * r1 + r2 * r2 : 1 / r1 + 1 / r2),
      );
      continue;
    }
    hit =
      /One solution of \$(.+)=0\$ is \$x=(-?\d+)\$\. What is the value of \$k\$\?/.exec(
        prompt,
      );
    if (hit) {
      const a = /^(\d*)x\^2/.exec(hit[1]!.replaceAll(" ", ""))![1]!;
      const c = BigInt(/([+-]\d+)$/.exec(hit[1]!.replaceAll(" ", ""))![1]!);
      const root = BigInt(hit[2]!);
      const lead = BigInt(a || "1");
      const k = over(
        minus(f(0), plus(times(f(lead), f(root * root)), f(c))),
        f(root),
      );
      // Independent check: both roots satisfy the product relation and the sum gives k.
      const other = over(f(c), times(f(lead), f(root)));
      assert.ok(same(f(k.n, k.d), times(f(-lead), plus(f(root), other))));
      expectValue(p, k);
      continue;
    }
    hit =
      /One solution of \$(.+)=0\$ is \$x=(-?\d+)\$\. What is the other solution\?/.exec(
        prompt,
      );
    assert.ok(hit, prompt);
    const [a, b, c] = parsePoly(hit[1]!);
    const root = f(BigInt(hit[2]!));
    const other = over(f(c), times(f(a), root));
    for (const r of [root, other])
      assert.ok(
        same(plus(plus(times(f(a), times(r, r)), times(f(b), r)), f(c)), f(0)),
      );
    expectValue(p, other);
  }
});

test("system-expression-value is determined and matches an independent solve or two-point check", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const p = generateProblem("system-expression-value", `o${seed}`);
    const hit = /^If (.+), what is the value of \$(.+)\$\?$/.exec(
      p.public.prompt,
    )!;
    const equations = [...hit[1]!.matchAll(/\$([^$]+)\$/g)].map((m) => {
      const [left, right] = m[1]!.split("=");
      const lm = /^(-?\d*)x([+-]\d*)y$/.exec(left!.replaceAll(" ", ""))!;
      const co = (s: string) =>
        s === "" || s === "+" ? 1n : s === "-" ? -1n : BigInt(s);
      return [co(lm[1]!), co(lm[2]!), BigInt(right!)] as const;
    });
    const tm = /^(-?\d*)x([+-]\d*)y$/.exec(hit[2]!.replaceAll(" ", ""))!;
    const co = (s: string) =>
      s === "" || s === "+" ? 1n : s === "-" ? -1n : BigInt(s);
    const target = [co(tm[1]!), co(tm[2]!)] as const;
    const at = (x: F, y: F) =>
      plus(times(f(target[0]), x), times(f(target[1]), y));
    let value: F;
    if (
      equations.length === 2 &&
      equations[0]![0] * equations[1]![1] -
        equations[0]![1] * equations[1]![0] !==
        0n
    ) {
      const [[a, b, e], [c, d, g]] = equations as [
        readonly [bigint, bigint, bigint],
        readonly [bigint, bigint, bigint],
      ];
      const det = a * d - b * c;
      value = at(f(e * d - b * g, det), f(a * g - e * c, det));
    } else {
      const [a, b, e] = equations[0]!;
      for (const row of equations)
        (assert.equal(row[0] * b, row[1] * a),
          assert.equal(row[2] * a, row[0] * e));
      // Two different solutions of the same line must give the same target value.
      const one = at(f(e, a), f(0));
      const two = at(f(0), f(e, b));
      assert.ok(same(one, two), p.public.prompt);
      value = one;
    }
    expectValue(p, value);
  }
});

test("variation-constant matches an independent model for every representation", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const p = generateProblem("variation-constant", `o${seed}`);
    const prompt = p.public.prompt;
    const directText = prompt.includes("varies directly");
    let hit =
      /When \$\w\$=?|When \$(\w)=(\d+)\$, \$(\w)=(\d+)\$\. What is \$\w\$ when \$\w=(\d+)\$\?/.exec(
        prompt,
      );
    if (hit && hit[2]) {
      const [x1, y1, x2] = [
        f(BigInt(hit[2]!)),
        f(BigInt(hit[4]!)),
        f(BigInt(hit[5]!)),
      ];
      expectValue(
        p,
        directText ? times(over(y1, x1), x2) : over(times(x1, y1), x2),
      );
      continue;
    }
    hit =
      /The value of \$(\w)\$ is (\d+) when \$(\w)\$ is (\d+)\. Which equation/.exec(
        prompt,
      );
    if (hit) {
      const [y1, x1] = [f(BigInt(hit[2]!)), f(BigInt(hit[4]!))];
      expectOne(p, (label) => {
        const direct = new RegExp(
          String.raw`^\$${hit![1]}=(${RAT})?${hit![3]}\$$`,
        ).exec(label);
        const inverse = new RegExp(
          String.raw`^\$${hit![1]}=\\frac\{(\d+)\}\{${hit![3]}\}\$$`,
        ).exec(label);
        if (directText && direct) {
          const k = direct[1] === undefined ? f(1) : parseRat(direct[1]);
          return same(times(k, x1), y1);
        }
        if (!directText && inverse)
          return same(over(f(BigInt(inverse[1]!)), x1), y1);
        return false;
      });
      continue;
    }
    if (prompt.includes("fits every row")) {
      const rows = parseTable(prompt);
      expectOne(p, (label) =>
        rows.every(([x, y]) => {
          const got = evalY(label, x);
          return got !== null && same(got, f(y));
        }),
      );
      continue;
    }
    hit =
      /varies (directly|inversely) with \$x\$\. By what factor does \$y\$ change when \$x\$ changes from (\d+) to (\d+)\?/.exec(
        prompt,
      );
    if (hit) {
      const [a, b] = [f(BigInt(hit[2]!)), f(BigInt(hit[3]!))];
      const factor = hit[1] === "directly" ? over(b, a) : over(a, b);
      expectOne(p, (label) => {
        const m = new RegExp(
          String.raw`^\$y\$ is multiplied by \$(${RAT})\$$`,
        ).exec(label);
        return !!m && same(parseRat(m[1]!), factor);
      });
      continue;
    }
    hit =
      /relationship is \$\w=(?:k\w|\\frac\{k\}\{\w\})\$, and \$\w=(\d+)\$ when \$\w=(\d+)\$/.exec(
        prompt,
      );
    assert.ok(hit, prompt);
    const [y1, x1] = [f(BigInt(hit[1]!)), f(BigInt(hit[2]!))];
    expectValue(p, prompt.includes("\\frac{k}") ? times(x1, y1) : over(y1, x1));
  }
});

test("rate-combination-model matches an independent exact derivation", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const p = generateProblem("rate-combination-model", `o${seed}`);
    const t = p.public.prompt;
    let hit =
      /can \w[^.]* in (\d+) hours and [^.]* in (\d+) hours\. Working together/.exec(
        t,
      );
    if (hit) {
      const [a, b] = [f(BigInt(hit[1]!)), f(BigInt(hit[2]!))];
      expectValue(p, over(f(1), plus(over(f(1), a), over(f(1), b))));
      continue;
    }
    hit =
      /fill an empty tank in (\d+) hours\. A drain alone can empty a full tank in (\d+) hours/.exec(
        t,
      );
    if (hit) {
      const [a, b] = [f(BigInt(hit[1]!)), f(BigInt(hit[2]!))];
      expectValue(p, over(f(1), minus(over(f(1), a), over(f(1), b))));
      continue;
    }
    hit =
      /mixes (\d+) liters? of a (\d+)% salt solution with (\d+) liters? of a (\d+)% salt solution/.exec(
        t,
      );
    if (hit) {
      const [x, pp, y, qq] = hit.slice(1).map((s) => f(BigInt(s)));
      expectValue(p, over(plus(times(pp!, x!), times(qq!, y!)), plus(x!, y!)));
      continue;
    }
    hit =
      /How many liters of a (\d+)% salt solution must be added to (\d+) liters? of a (\d+)% salt solution to make a mixture that is (\d+)% salt/.exec(
        t,
      );
    if (hit) {
      const [qq, x, pp, mm] = hit.slice(1).map((s) => f(BigInt(s)));
      // x liters of p% plus y liters of q% satisfy p x + q y = m (x + y).
      expectValue(p, over(times(x!, minus(mm!, pp!)), minus(qq!, mm!)));
      continue;
    }
    hit =
      /goes (\d+) miles to a lake at an average speed of (\d+) miles per hour and returns the same \d+ miles at (\d+) miles per hour/.exec(
        t,
      );
    if (hit) {
      const [d, u, v] = hit.slice(1).map((s) => f(BigInt(s)));
      const time = plus(over(d!, u!), over(d!, v!));
      expectValue(p, over(times(f(2), d!), time));
      continue;
    }
    hit =
      /(?:A tank holds (\d+) liters|An empty tank is being filled)\. For the first (\d+) minutes a pump adds (\d+) liters per minute\. Then a second pump takes over and adds (\d+) liters per minute\. How many minutes after the start does the tank hold (\d+) liters/.exec(
        t,
      );
    assert.ok(hit, t);
    const [v0, t1, r1, r2, target] = [
      hit[1] ?? "0",
      hit[2]!,
      hit[3]!,
      hit[4]!,
      hit[5]!,
    ].map((s) => f(BigInt(s)));
    const left = minus(minus(target!, v0!), times(r1!, t1!));
    assert.ok(left.n > 0n);
    expectValue(p, plus(t1!, over(left, r2!)));
  }
});

test("absolute-compound-inequality choices match the prompt as sets on a rational grid", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const p = generateProblem("absolute-compound-inequality", `o${seed}`);
    const want = promptPredicate(p.public.prompt);
    expectOne(p, (label) => {
      const got = labelPredicate(label);
      assert.ok(got, `Unparsed choice: ${label}`);
      return grid.every((x) => got(x) === want(x));
    });
  }
});

test("quadratic-from-data keeps exactly the equation that fits every stated condition", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const p = generateProblem("quadratic-from-data", `o${seed}`);
    const t = p.public.prompt;
    let hit =
      /crosses the \$x\$-axis at \$x=(-?\d+)\$ and \$x=(-?\d+)\$ and passes through the point \$\((-?\d+),(-?\d+)\)\$/.exec(
        t,
      );
    let conditions: [number, number][];
    let axis: number | null = null;
    if (hit)
      conditions = [
        [Number(hit[1]), 0],
        [Number(hit[2]), 0],
        [Number(hit[3]), Number(hit[4])],
      ];
    else if (
      (hit =
        /vertex at \$\((-?\d+),(-?\d+)\)\$ and passes through the point \$\((-?\d+),(-?\d+)\)\$/.exec(
          t,
        ))
    ) {
      axis = Number(hit[1]);
      conditions = [
        [axis, Number(hit[2])],
        [Number(hit[3]), Number(hit[4])],
      ];
    } else if (t.includes("\\begin{array}")) conditions = parseTable(t);
    else {
      hit =
        /passes through \$\((-?\d+),(-?\d+)\)\$, \$\((-?\d+),(-?\d+)\)\$ and \$\((-?\d+),(-?\d+)\)\$/.exec(
          t,
        );
      assert.ok(hit, t);
      conditions = [0, 1, 2].map(
        (i) =>
          [Number(hit![1 + 2 * i]), Number(hit![2 + 2 * i])] as [
            number,
            number,
          ],
      );
    }
    expectOne(p, (label) => {
      const fits = conditions.every(([x, y]) => evalQuadratic(label, x) === y);
      const symmetric =
        axis === null ||
        [1, 2, 3].every(
          (d) =>
            evalQuadratic(label, axis! + d) === evalQuadratic(label, axis! - d),
        );
      const quadratic =
        evalQuadratic(label, 2) -
          2 * evalQuadratic(label, 1) +
          evalQuadratic(label, 0) !==
        0;
      return fits && symmetric && quadratic;
    });
  }
});

test("new families bind to existing skills, lessons, methods and principles", () => {
  const expected: Record<string, string> = {
    "quadratic-root-relations": "quadratic-equations",
    "system-expression-value": "linear-systems",
    "variation-constant": "proportional-relationships",
    "rate-combination-model": "linear-equation-modeling",
    "absolute-compound-inequality": "linear-inequalities",
    "quadratic-from-data": "quadratic-graphs",
  };
  for (const [id, skill] of Object.entries(expected)) {
    assert.equal(templates.find((t) => t.id === id)?.skillId, skill);
    const lesson = problemLesson(id, "library");
    assert.ok((lesson.intuition ?? "").length > 60);
    assert.ok(lesson.method.length >= 3);
    assert.ok(lesson.watch);
    assert.ok(lesson.principle);
    assert.ok(lesson.example.steps.length >= 2);
  }
});
