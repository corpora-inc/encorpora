import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import {
  gradeMultiPart,
  type MultiPartChoiceResponse,
} from "../src/math/multi-part-choice";
import {
  chooseDecoys,
  clozeFamily,
  decoysOf,
  reasonFamily,
  sameFamily,
  terminalFamily,
} from "../src/math/unit-circle-extension-practice";
import { ALL_REALS, PI_FORMS } from "../src/math/unit-circle-extension-kit";

/** HSF.TF.A.2 types: every fact checked here is recomputed from t. */
const TAU = 2 * Math.PI;
const N = 1200;
const seeds = Array.from({ length: N }, (_, i) => `uce-${i}`);
const gap = (a: number, b: number) => {
  const d = (((a - b) % TAU) + TAU) % TAU;
  return Math.min(d, TAU - d);
};
const axisDistance = (t: number) =>
  Math.min(...[0, 1, 2, 3].map((k) => gap(t, (k * Math.PI) / 2)));
/** Value of a TeX sum such as "0.4 - 4\\pi", "\\pi - 0.4" or "0.4 + 360". */
function sumValue(label: string): number {
  const s = label.replace(/\$/g, "").replace(/\\pi/g, "π").replace(/\s+/g, "");
  let total = 0;
  for (const m of s.matchAll(/([+-]?)(\d*\.?\d*)(π?)/g)) {
    if (!m[0] || (!m[2] && !m[3])) continue;
    const sign = m[1] === "-" ? -1 : 1;
    total += sign * (m[2] ? Number(m[2]) : 1) * (m[3] ? Math.PI : 1);
  }
  return total;
}
const share = (counts: Map<string, number>, key: string) =>
  (counts.get(key) ?? 0) / N;
const tally = (counts: Map<string, number>, key: string) =>
  counts.set(key, (counts.get(key) ?? 0) + 1);

test("the real numbers sit at least 0.3 from every axis, are never special angles, and have at most one decimal place", () => {
  assert.ok(ALL_REALS.length > 60);
  for (const t of ALL_REALS) {
    assert.ok(axisDistance(t.value) >= 0.3 - 1e-12, t.tex);
    if (t.pi) {
      // Not a multiple of π/6 or π/4.
      assert.notEqual((6 * t.pi.p) % t.pi.q, 0, t.tex);
      assert.notEqual((4 * t.pi.p) % t.pi.q, 0, t.tex);
      assert.ok(Math.abs(t.pi.p) <= 2 * t.pi.q);
    } else assert.ok(Math.abs(t.value * 10 - Math.round(t.value * 10)) < 1e-9);
  }
  // Twelfths in lowest terms all sit within 0.27 of an axis.
  assert.ok(PI_FORMS.every((f) => f.q !== 12));
});

test("the same seed gives the same problem", () => {
  for (const id of [
    "unit-circle-extension-reason",
    "unit-circle-extension-cloze",
    "real-number-terminal-point",
    "real-number-same-terminal-point",
  ])
    for (const seed of ["a", "b", "17"])
      assert.deepEqual(generateProblem(id, seed), generateProblem(id, seed));
});

test("justify, explain and find-the-flaw problems keep each step's conditions and never key a computed value", () => {
  const variants = new Map<string, number>();
  let flawProblems = 0,
    noFlawShown = 0;
  for (const seed of seeds) {
    const g = reasonFamily.generate(seed);
    const { model: m, problem: p } = g;
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    tally(variants, p.variant!.id);
    const t = m.t.value;
    const r = p.public.response;
    assert.equal(r.kind, "choice");
    if (r.kind !== "choice") continue;
    const key = r.options.find((o) => o.id === p.answer)!.label;
    // Conditions under which each step or claim is true.
    if (m.part === "s0" || m.part === "f1") assert.ok(t < 0 || t >= 1.9);
    if (m.part === "s3") assert.ok(t > 0 && t < Math.PI / 2);
    if (m.part === "f2") assert.ok(t < 0);
    if (m.part === "f3") assert.ok(Math.abs(t) > TAU);
    if (m.part === "f4") assert.ok(t > 0 && t < Math.PI);
    // Only the calculator distractor states a numeric value.
    for (const o of r.options)
      if (/\\approx/.test(o.label))
        assert.match(o.label, /^A calculator/, o.label);
    if (m.part === "s0")
      assert.ok(key.includes(`${Math.round((t * 180) / Math.PI)}^\\circ`));
    if (m.part === "explain") {
      const turns = Math.floor(Math.abs(t) / TAU);
      const rest = (Math.abs(t) - turns * TAU).toFixed(2);
      assert.equal(/counterclockwise/.test(key), t > 0, key);
      if (turns)
        assert.ok(
          key.includes(turns === 1 ? "one full turn" : "two full turns") &&
            key.includes(rest),
          key,
        );
      // The "acute angle" distractor appears only when it is false outright.
      for (const o of r.options)
        if (/that angle is acute/.test(o.label)) {
          const other = /\\cos/.test(o.label) ? TAU - t : Math.PI - t;
          assert.ok(!(other > 0 && other < Math.PI / 2), o.label);
        }
    }
    if (m.part === "f3") {
      const turns = Math.floor(Math.abs(t) / TAU);
      assert.ok(key.includes((Math.abs(t) - turns * TAU).toFixed(2)), key);
    }
    if (m.family === "r3") {
      flawProblems++;
      assert.doesNotMatch(key, /no flaw/i);
      if (r.options.some((o) => /no flaw/i.test(o.label))) noFlawShown++;
    }
    if (m.part === "s0" || m.part === "explain" || m.part === "f1")
      for (const o of r.options)
        if (/^Draw a right triangle/.test(o.label))
          assert.ok(t < 0 || t >= 1.9);
  }
  for (const v of [
    "r1-s0",
    "r1-s1",
    "r1-s2",
    "r1-s3",
    "r1-s4",
    "r2-explain",
    "r3-f1",
    "r3-f2",
    "r3-f3",
    "r3-f4",
  ])
    assert.ok(share(variants, v) >= 0.03, `${v}: ${share(variants, v)}`);
  assert.ok(noFlawShown > 0 && noFlawShown <= flawProblems / 2);
});

test("the cloze keys the direction, radians, (cos t, sin t) and the endless circle, and grades all or nothing", () => {
  const kinds = new Map<string, number>();
  for (const seed of seeds) {
    const { model: m, problem: p } = clozeFamily.generate(seed);
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    tally(kinds, m.t.kind);
    const r = p.public.response as MultiPartChoiceResponse;
    const key = JSON.parse(p.answer) as Record<string, string>;
    const keyed = (blank: string) =>
      r.blanks
        .find((b) => b.id === blank)!
        .options.find((o) => o.id === key[blank])!.label;
    const t = m.t.value;
    const move = keyed("move");
    assert.equal(/counterclockwise/.test(move), t > 0, move);
    assert.ok(move.includes(m.t.absTex), move);
    assert.doesNotMatch(move, /\\circ/);
    if (!m.t.pi) assert.doesNotMatch(move, /\\pi/);
    const turns = Math.floor(Math.abs(t) / TAU);
    if (turns)
      assert.ok(move.includes((Math.abs(t) - turns * TAU).toFixed(2)), move);
    assert.ok(
      keyed("angle").includes(m.t.tex) && /radians$/.test(keyed("angle")),
    );
    assert.doesNotMatch(keyed("angle"), /\\circ|\}\{2\\pi\}/);
    assert.equal(keyed("point"), "$(\\cos t, \\sin t)$");
    assert.match(keyed("reason"), /no end/);
    assert.ok(gradeMultiPart(r, p.answer, p.answer));
    // Changing any one blank loses the credit.
    for (const b of r.blanks) {
      const other = b.options.find((o) => o.id !== key[b.id])!.id;
      assert.equal(
        gradeMultiPart(r, p.answer, JSON.stringify({ ...key, [b.id]: other })),
        false,
      );
    }
  }
  for (const k of ["positive", "negative", "winding", "pi-form"])
    assert.ok(share(kinds, k) >= 0.03, k);
});

test("the locate family keys (cos t, sin t) among four points at least 0.3 apart", () => {
  const kinds = new Map<string, number>();
  for (const seed of seeds.slice(0, 600)) {
    const { model: m, problem: p } = terminalFamily.generate(seed);
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    tally(kinds, m.t.kind);
    const r = p.public.response;
    assert.equal(r.kind, "figure-choice");
    if (r.kind !== "figure-choice") continue;
    const at = (o: (typeof r.options)[number]) => {
      const pt = o.scene.elements.find(
        (e) => e.type === "point" && e.id === "Q",
      ) as { at: [number, number] };
      return pt.at;
    };
    const key = r.options.find((o) => o.id === p.answer)!;
    const [x, y] = at(key);
    assert.ok(Math.abs(x - Math.cos(m.t.value)) < 1e-5);
    assert.ok(Math.abs(y - Math.sin(m.t.value)) < 1e-5);
    // Within half a degree of the true terminal point.
    assert.ok(gap(Math.atan2(y, x), m.t.value) < Math.PI / 360);
    const angles = r.options.map((o) => Math.atan2(at(o)[1], at(o)[0]));
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++)
        assert.ok(gap(angles[i]!, angles[j]!) >= 0.3 - 1e-6, seed);
    assert.equal(Object.keys(p.choiceFeedback ?? {}).length, 3);
  }
  for (const k of ["positive", "negative", "winding", "pi-form"])
    assert.ok((kinds.get(k) ?? 0) / 600 >= 0.03, k);
  // Exhaustively: every real and every order of the decoy pool yields a
  // valid set of three.
  for (const t of ALL_REALS) {
    const pool = decoysOf(t.value);
    for (let s = 0; s < pool.length; s++) {
      const order = [...pool.slice(s), ...pool.slice(0, s)];
      const picked = chooseDecoys(t.value, order);
      const all = [t.value, ...picked.map((d) => d.angle)];
      for (let i = 0; i < 4; i++)
        for (let j = i + 1; j < 4; j++)
          assert.ok(gap(all[i]!, all[j]!) >= 0.3, `${t.tex} ${s}`);
    }
  }
});

test("the same-point family keys exactly the whole-turn shifts of t", () => {
  const counts = new Map<string, number>();
  for (const seed of seeds.slice(0, 600)) {
    const { problem: p } = sameFamily.generate(seed);
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    const r = p.public.response;
    assert.equal(r.kind, "multi-select");
    if (r.kind !== "multi-select") continue;
    tally(counts, String(r.selectionCount));
    const t = Number(/\$t = ([\d.]+)\$/.exec(p.public.prompt)![1]);
    const keyed = new Set(JSON.parse(p.answer) as string[]);
    assert.equal(keyed.size, r.selectionCount);
    assert.ok(keyed.size > 0 && keyed.size < r.options.length);
    for (const o of r.options) {
      const v = sumValue(o.label);
      const turns = (v - t) / TAU;
      const whole = Math.abs(turns - Math.round(turns)) < 1e-9 && v !== t;
      assert.equal(keyed.has(o.id), whole, o.label);
      if (!whole) assert.ok(gap(v, t) >= 0.3, o.label);
    }
  }
  assert.ok((counts.get("2") ?? 0) > 60 && (counts.get("3") ?? 0) > 60);
});
