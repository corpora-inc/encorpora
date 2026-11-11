import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { checkTemplate } from "./fixtures/regents-check";
import {
  eventComplementSet,
  normalProbability,
  oddSineParameters,
  parabolaVertexDistance,
  specialAngleMatch,
  tangentQuadrantCosine,
} from "../src/math/regents-algebra-two-functions-practice";

type Problem = { public: { response: unknown }; answer: string };
const SEEDS = Array.from({ length: 300 }, (_, i) => `fn:${i}`);
const label = (p: Problem) => {
  const r = p.public.response as { options: { id: string; label: string }[] };
  return r.options.find((o) => o.id === p.answer)!.label;
};

/** Reference normal CDF by Simpson integration of the density (independent of the erf code). */
function phi(z: number): number {
  const lo = -10;
  const n = 20000;
  const h = (z - lo) / n;
  const f = (t: number) => Math.exp((-t * t) / 2) / Math.sqrt(2 * Math.PI);
  let sum = f(lo) + f(z);
  for (let i = 1; i < n; i++) sum += f(lo + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
}

test("normal probability: independent integration agrees", () => {
  checkTemplate("normal-probability", {
    variants: ["between-values", "count-above"],
    axes: { ask: ["between-values", "count-above"] },
    hintsMin: 15,
  });
  for (const s of SEEDS.slice(0, 120)) {
    const { model: m, problem: p } = normalProbability.generate(s);
    const lab = label(p as Problem);
    if (m.ask === "between-values") {
      const P = phi((m.b - m.mu) / m.sigma) - phi((m.a - m.mu) / m.sigma);
      assert.equal(lab, `${(Math.round(P * 1000) / 10).toFixed(1)}%`);
    } else {
      const c = Math.round(m.n * (1 - phi((m.a - m.mu) / m.sigma)));
      assert.equal(lab.replace(/[^0-9]/g, ""), String(c));
    }
  }
});

test("tangent to cosine: ratio check", () => {
  checkTemplate("tangent-quadrant-cosine", {
    variants: ["radical", "perfect-square"],
    axes: { quadrant: ["two", "three", "four"], form: ["integer", "fraction"] },
    hintsMin: 15,
  });
  for (const s of SEEDS) {
    const { model: m, axes, problem: p } = tangentQuadrantCosine.generate(s);
    const lab = label(p as Problem).replaceAll("$", "");
    const cosNeg = axes.quadrant !== "four";
    const parse =
      /^(-?)\\dfrac\{(?:(\d*)\\sqrt\{(\d+)\}|(\d+))\}\{(\d+)\}$/.exec(lab)!;
    const num = parse[4]
      ? Number(parse[4])
      : (parse[2] ? Number(parse[2]) : 1) * Math.sqrt(Number(parse[3]));
    const value = ((parse[1] === "-" ? -1 : 1) * num) / Number(parse[5]);
    // angle with tan = ±a/b in the stated quadrant: cos = sign * b / hypot
    const expected = ((cosNeg ? -1 : 1) * m.b) / Math.hypot(m.a, m.b);
    assert.ok(Math.abs(value - expected) < 1e-12, lab);
  }
});

test("special angle match: exactly one option equals the target", () => {
  checkTemplate("special-angle-match", {
    variants: [
      "sin-2pi-3",
      "sin-3pi-4",
      "sin-5pi-6",
      "cos-2pi-3",
      "cos-3pi-4",
      "cos-5pi-6",
    ],
    axes: { target: ["sine", "cosine"] },
    hintsMin: 3,
  });
  const val = (tex: string) => {
    const m =
      /^(-?)\\(sin|cos|tan)\\left\(\\frac\{(\d*)\\pi\}\{(\d+)\}\\right\)$/.exec(
        tex,
      )!;
    const angle = ((m[3] ? Number(m[3]) : 1) * Math.PI) / Number(m[4]);
    return (m[1] ? -1 : 1) * Math[m[2] as "sin" | "cos" | "tan"](angle);
  };
  for (const s of SEEDS) {
    const { model, problem } = specialAngleMatch.generate(s);
    const p = problem as unknown as Problem & {
      public: { prompt: string; response: { options: { label: string }[] } };
    };
    const target = val(/value as \$(.*)\$\?/.exec(p.public.prompt)![1]!);
    const equal = p.public.response.options.filter(
      (o) => Math.abs(val(o.label.replaceAll("$", "")) - target) < 1e-9,
    );
    assert.equal(equal.length, 1, p.public.prompt);
    assert.equal(equal[0]!.label, label(p));
    void model;
  }
});

test("odd sine: the keyed pair is the only odd one (numeric test)", () => {
  checkTemplate("odd-sine-parameters", {
    variants: ["period-2", "period-3", "period-4"],
    axes: { lead: ["positive", "negative"] },
    hintsMin: 8,
  });
  for (const s of SEEDS) {
    const { model: m, axes, problem } = oddSineParameters.generate(s);
    const p = problem as unknown as Problem & {
      public: { response: { options: { id: string; label: string }[] } };
    };
    const A = axes.lead === "negative" ? -m.A : m.A;
    const parseVal = (t: string) => {
      const q = /\\dfrac\{\\pi\}\{(\d+)\}/.exec(t);
      return q ? Math.PI / Number(q[1]) : Number(t);
    };
    const isOdd = (C: number, D: number) =>
      [0.3, 0.7, 1.9, 2.4].every(
        (x) =>
          Math.abs(
            A * Math.sin(-m.B * x - C) + D + (A * Math.sin(m.B * x - C) + D),
          ) < 1e-9,
      );
    const odds = p.public.response.options.filter((o) => {
      const mm = /C=(.*) and \$D=(.*)\$/.exec(o.label)!;
      return isOdd(parseVal(mm[1]!.replace(/\$$/, "")), parseVal(mm[2]!));
    });
    assert.equal(odds.length, 1);
    assert.equal(odds[0]!.id, p.answer);
  }
});

test("parabola vertex: equidistant from focus and directrix", () => {
  checkTemplate("parabola-vertex-distance", {
    variants: ["positive-side", "negative-side"],
    axes: { directrix: ["horizontal", "vertical"] },
    hintsMin: 15,
  });
  for (const s of SEEDS) {
    const { model: m, axes, problem } = parabolaVertexDistance.generate(s);
    const lab = label(problem as Problem);
    const pt = /\(([-\d.]+),\\ ([-\d.]+)\)/.exec(lab)!;
    const [x, y] = [Number(pt[1]), Number(pt[2])];
    const sgn = m.above ? 1 : -1;
    const focusAlong = m.d + sgn * m.f;
    // Focus F and directrix at d. The vertex V (on the axis) must satisfy |V - F| = |V - directrix|.
    const along = axes.directrix === "horizontal" ? y : x;
    const across = axes.directrix === "horizontal" ? x : y;
    assert.equal(across, m.h);
    assert.equal(Math.abs(along - focusAlong), Math.abs(along - m.d));
    assert.ok(Math.sign(along - m.d) === sgn);
  }
});

const charPreds: Record<string, (x: number) => boolean> = {
  "the number is even": (x) => x % 2 === 0,
  "the number is odd": (x) => x % 2 === 1,
  "the number is a multiple of 3": (x) => x % 3 === 0,
  "the number is a multiple of 4": (x) => x % 4 === 0,
  "the number is a multiple of 6": (x) => x % 6 === 0,
  "the number is prime": (x) =>
    x >= 2 && [...Array(x).keys()].slice(2).every((d) => x % d !== 0),
  "the number is greater than 6": (x) => x > 6,
  "the number is less than 5": (x) => x < 5,
  "the number is not a multiple of 3": (x) => x % 3 !== 0,
  "the number is a multiple of 3 or 4": (x) => x % 3 === 0 || x % 4 === 0,
};
const sentenceWords = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split(/\s+/).length);

test("event complement: independent set algebra", () => {
  checkTemplate("event-complement-set", {
    variants: [
      "complement",
      "complement-of-union",
      "complement-of-intersection",
      "events-by-characteristic",
    ],
    axes: {
      ask: ["complement", "complement-of-union", "complement-of-intersection"],
      task: ["events-by-characteristic"],
    },
    hintsMin: 15,
  });
  for (const s of SEEDS) {
    const { model: m, problem } = eventComplementSet.generate(s);
    if (m.kind === "characteristic") continue;
    const lab = label(problem as Problem);
    const got = new Set(lab.slice(1, -1).split(", ").filter(Boolean));
    const expected = new Set(
      m.universe.filter((x) => {
        const a = m.A.has(x);
        const b = m.B.has(x);
        return m.ask === "complement"
          ? !a
          : m.ask === "complement-of-union"
            ? !(a || b)
            : !(a && b);
      }),
    );
    assert.deepEqual([...got].sort(), [...expected].sort());
  }
});

test("events by characteristic: descriptions differ and old versions stay named sets", () => {
  let described = 0;
  let selected = 0;
  for (let i = 0; i < 200; i++) {
    const old = generateProblem("event-complement-set", `char:${i}`, 1);
    assert.equal(old.public.prompt.includes("characteristic"), false);
    assert.equal(old.variant?.axes?.task, undefined);
    const problem = generateProblem("event-complement-set", `char:${i}`);
    if (!problem.public.prompt.includes("characteristic")) continue;
    assert.equal(problem.variant?.id, "events-by-characteristic");
    for (const text of [problem.public.prompt, problem.hint, ...problem.explanation])
      for (const n of sentenceWords(text))
        assert.ok(n <= 35, text);
    const response = problem.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") continue;
    const correct = response.options.find((o) => o.id === problem.answer)!.label;
    assert.equal(problem.hint.includes(correct), false);
    const describedPrompt = /event \{(.+?)\} by a characteristic/.exec(
      problem.public.prompt,
    );
    if (describedPrompt) {
      described++;
      const n = Number(/from 1 to (\d+)/.exec(problem.public.prompt)![1]);
      const target = describedPrompt[1]!.split(", ").map(Number);
      const sets = response.options.map((o) =>
        [...Array(n).keys()]
          .map((k) => k + 1)
          .filter(charPreds[o.label]!),
      );
      assert.equal(new Set(sets.map((s) => s.join(","))).size, 4);
      const key = [...Array(n).keys()]
        .map((k) => k + 1)
        .filter(charPreds[correct]!);
      assert.deepEqual(key, target);
    } else {
      selected++;
      const n = Number(/from 1 to (\d+)/.exec(problem.public.prompt)![1]);
      const space = [...Array(n).keys()].map((k) => k + 1);
      const A = new Set(space.filter((x) => x % 2 === 0));
      const B = new Set(space.filter((x) => x % 3 === 0));
      const words = /lists the numbers (.+)\?$/.exec(problem.public.prompt)![1]!;
      const ops: Record<string, number[]> = {
        "in $A$ and not in $B$": space.filter((x) => A.has(x) && !B.has(x)),
        "not in $A$": space.filter((x) => !A.has(x)),
        "in $A$ or in $B$": space.filter((x) => A.has(x) || B.has(x)),
        "not in $A$ or $B$": space.filter((x) => !A.has(x) && !B.has(x)),
        "not in both $A$ and $B$": space.filter((x) => !(A.has(x) && B.has(x))),
      };
      assert.deepEqual(
        correct,
        `{${ops[words]!.join(", ")}}`,
      );
      const sets = response.options.map((o) => o.label);
      assert.equal(new Set(sets).size, 4);
    }
  }
  assert.ok(described > 0 && selected > 0);
});
