import test from "node:test";
import assert from "node:assert/strict";
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

test("event complement: independent set algebra", () => {
  checkTemplate("event-complement-set", {
    variants: [
      "complement",
      "complement-of-union",
      "complement-of-intersection",
    ],
    axes: {
      ask: ["complement", "complement-of-union", "complement-of-intersection"],
    },
    hintsMin: 15,
  });
  for (const s of SEEDS) {
    const { model: m, problem } = eventComplementSet.generate(s);
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
