import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";
import {
  trigModelEquationsGenerate as generate,
  trigModelEquationsTemplates as templates,
} from "../src/math/trig-model-equations-practice";

type P = ReturnType<typeof generate>;
const sample = (id: string, n = 300) =>
  Array.from({ length: n }, (_, i) => generate(id, `m${i}`));

/** The model, read back from the public prompt and figure only. */
function readModel(p: P) {
  const m =
    /\$([a-zA-Z])\(t\)=(.*?)\$ for \$(?:0\\le t\\le ([\d.]+)|t\\ge0)\$/.exec(
      p.public.prompt,
    );
  assert.ok(m, p.public.prompt);
  const body = m[2]!;
  const T = m[3] ? Number(m[3]) : NaN;
  const neg = /^([\d.]+)-([\d.]*)\\cos\\left\((.+)\\right\)$/.exec(body);
  const pos = /^([\d.]*)\\(sin|cos)\\left\((.+)\\right\)(?:\+([\d.]+))?$/.exec(
    body,
  );
  assert.ok(neg || pos, body);
  const A = Number((neg ? neg[2] : pos![1]) || 1);
  const D = neg ? Number(neg[1]) : Number(pos![4] ?? 0);
  const arg = (neg ? neg[3] : pos![3])!;
  const a = /^(.+?)(?: t|\(t-([\d.]+)\))$/.exec(arg)!;
  const C = a[2] ? Number(a[2]) : 0;
  const frac = /^\\frac\{(\d*)\\pi\}\{(\d+)\}$/.exec(a[1]!);
  const whole = /^(\d*)\\pi$/.exec(a[1]!);
  const B = frac
    ? (Number(frac[1] || 1) * Math.PI) / Number(frac[2])
    : Number(whole![1] || 1) * Math.PI;
  const kind = neg ? "neg-cos" : (pos![2] as "sin" | "cos");
  const y = (t: number) =>
    kind === "neg-cos"
      ? D - A * Math.cos(B * t)
      : kind === "sin"
        ? A * Math.sin(B * (t - C)) + D
        : A * Math.cos(B * (t - C)) + D;
  const fig = p.public.figure;
  if (fig?.kind !== "scene") throw new Error("scene figure");
  const g = fig.scene.elements[0]!;
  if (g.type !== "graph") throw new Error("graph");
  const line = g.lines![0]!.line as { m: number; b: number };
  const k = line.b;
  return { A, D, C, B, P: (2 * Math.PI) / B, T, kind, y, k };
}
/** Every crossing of y = k on [0, T], by a fine scan and bisection. */
function roots(y: (t: number) => number, k: number, T: number) {
  const n = 40000;
  const out: number[] = [];
  let prev = y(0) - k;
  for (let i = 1; i <= n; i++) {
    const t = (T * i) / n;
    const v = y(t) - k;
    if (prev === 0 || prev * v < 0) {
      let lo = (T * (i - 1)) / n,
        hi = t;
      for (let j = 0; j < 60; j++) {
        const mid = (lo + hi) / 2;
        if ((y(lo) - k) * (y(mid) - k) <= 0) hi = mid;
        else lo = mid;
      }
      out.push((lo + hi) / 2);
    }
    prev = v;
  }
  return out;
}
const daily = (p: P) => /nearest day|days after/.test(p.public.prompt);
const show = (p: P, t: number) =>
  daily(p) ? String(Math.round(t)) : t.toFixed(2);
const nearHalf = (x: number) => {
  const f = x - Math.floor(x);
  return f > 0.35 && f < 0.65;
};
const choiceKey = (p: P) => {
  const r = p.public.response;
  if (r.kind !== "choice") throw new Error("choice");
  return r.options.find((o) => o.id === p.answer)!.label;
};
/** The value of an exact label such as -\frac{8}{15} or 0.35. */
function texValue(t: string): number {
  const f = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(t);
  if (f) return (f[1] ? -1 : 1) * (Number(f[2]) / Number(f[3]));
  return Number(t);
}

test("same seed, same problem; every problem meets the contract", () => {
  for (const t of templates)
    for (let i = 0; i < 40; i++) {
      const a = generate(t.id, `d${i}`);
      assert.deepEqual(generate(t.id, `d${i}`), a);
      assert.equal(a.public.skillId, "trigonometric-equations");
      generatedProblemSchema.parse(a);
    }
});

test("every variant, context and form is reachable; about a quarter of setups have a negative ratio", () => {
  const counts = new Map<string, number>();
  const models = new Map<string, number>();
  let negative = 0,
    total = 0;
  for (const t of templates)
    for (const p of sample(t.id, 400)) {
      counts.set(
        `${t.id}:${p.variant!.id}`,
        (counts.get(`${t.id}:${p.variant!.id}`) ?? 0) + 1,
      );
      const m =
        /^(The water depth|A rider|The air temperature|The number of hours of daylight|A weight)/.exec(
          p.public.prompt,
        )![1]!;
      const form = readModel(p).kind;
      models.set(`${m}:${form}`, (models.get(`${m}:${form}`) ?? 0) + 1);
      if (t.id === "trig-model-inverse-setup") {
        total++;
        if (p.variant!.id.endsWith("negative")) negative++;
      }
    }
  for (const v of [
    "trig-model-inverse-setup:sin-shift-positive",
    "trig-model-inverse-setup:sin-shift-negative",
    "trig-model-inverse-setup:cos-shift-positive",
    "trig-model-inverse-setup:cos-shift-negative",
    "trig-model-inverse-setup:negcos-positive",
    "trig-model-inverse-setup:negcos-negative",
    "trig-model-solve-interval:all",
    "trig-model-solve-interval:next",
    "trig-model-solve-interval:count",
    "trig-model-interpret-solutions:instants",
    "trig-model-interpret-solutions:recurrence",
    "trig-model-interpret-solutions:no-solution",
    "trig-model-interpret-solutions:negative-time",
    "trig-model-interpret-solutions:above-below",
  ])
    assert.ok((counts.get(v) ?? 0) >= 20, `${v}: ${counts.get(v)}`);
  for (const c of [
    "The water depth:sin",
    "The water depth:cos",
    "A rider:neg-cos",
    "The air temperature:cos",
    "The number of hours of daylight:sin",
    "A weight:sin",
  ])
    assert.ok((models.get(c) ?? 0) >= 20, `${c}: ${models.get(c)}`);
  assert.ok(Math.abs(negative / total - 0.25) <= 0.07, `${negative}/${total}`);
});

test("setup: the isolated ratio, the first time and every wrong time recompute from the shown model", () => {
  for (const p of sample("trig-model-inverse-setup")) {
    const m = readModel(p);
    const r = p.public.response as MultiPartChoiceResponse;
    const key = JSON.parse(p.answer) as Record<string, string>;
    const label = (id: string) =>
      r.blanks.find((b) => b.id === id)!.options.find((o) => o.id === key[id])!
        .label;
    const ratio = texValue(/=([^=$]+)\$$/.exec(label("isolate"))![1]!);
    const expected =
      m.kind === "neg-cos" ? (m.D - m.k) / m.A : (m.k - m.D) / m.A;
    assert.ok(Math.abs(ratio - expected) < 1e-9, label("isolate"));
    assert.ok(Math.abs(expected) <= 0.9);
    for (const s of [0, 0.5, Math.SQRT1_2, Math.sqrt(3) / 2])
      assert.ok(Math.abs(Math.abs(expected) - s) >= 0.02);
    const all = roots(m.y, m.k, m.T);
    assert.ok(all.length >= 2);
    for (const t of all) assert.ok(Math.abs(m.y(t) - m.k) < 1e-6);
    assert.equal(label("first"), `$${show(p, all[0]!)}$`);
    const shownKey = Number(show(p, all[0]!));
    for (const o of r.blanks.find((b) => b.id === "first")!.options)
      if (o.id !== key.first)
        assert.ok(
          Math.abs(Number(o.label.replaceAll("$", "")) - shownKey) > 0.05,
          o.label,
        );
    // The radian/degree slip is far from the key.
    const theta = m.kind === "sin" ? Math.asin(expected) : Math.acos(expected);
    const degreeTime =
      (m.kind === "neg-cos" ? 0 : m.C) + (theta * 180) / Math.PI / m.B;
    assert.ok(Math.abs(degreeTime - all[0]!) > 0.1);
  }
});

test("solution sets, next times and counts match a brute-force scan; values avoid rounding boundaries", () => {
  for (const p of sample("trig-model-solve-interval", 400)) {
    const m = readModel(p);
    const all = roots(m.y, m.k, m.T);
    for (const t of all) {
      assert.ok(
        !nearHalf(daily(p) ? t : t * 100),
        `${t} near a rounding boundary`,
      );
      assert.ok(t > 0.04 && t < m.T - 0.04);
    }
    for (let i = 1; i < all.length; i++)
      assert.ok(
        Number(show(p, all[i]!)) - Number(show(p, all[i - 1]!)) >
          (daily(p) ? 2 : 0.05),
      );
    const key = choiceKey(p);
    const r = p.public.response;
    if (r.kind !== "choice") throw new Error("choice");
    if (p.variant!.id === "all") {
      assert.equal(key, `$\\{${all.map((t) => show(p, t)).join(",\\ ")}\\}$`);
      const sizes = r.options
        .filter((o) => o.id !== p.answer)
        .map((o) => o.label.split(",").length);
      assert.ok(sizes.includes(all.length), "a wrong set has the key's size");
    } else if (p.variant!.id === "next") {
      const t1 = Number(/about \$t=([\d.]+)\$/.exec(p.public.prompt)![1]);
      const i = all.findIndex((t) => show(p, t) === show(p, t1));
      assert.ok(i >= 0 && i + 1 < all.length);
      assert.equal(key, `$t\\approx${show(p, all[i + 1]!)}$`);
    } else {
      assert.equal(key, String(all.length));
    }
  }
});

test("interpretations agree with the shown model", () => {
  for (const p of sample("trig-model-interpret-solutions", 400)) {
    const m = readModel(p);
    const key = choiceKey(p);
    const v = p.variant!.id;
    if (v === "no-solution") {
      const T = Number.isFinite(m.T) ? m.T : 2 * m.P;
      assert.deepEqual(roots(m.y, m.k, T), []);
      assert.ok(m.k > m.D + m.A || m.k < m.D - m.A);
      const r = Math.abs(m.k - m.D) / m.A;
      assert.ok(r > 1.1 && r <= 1.8);
      assert.match(key, /never reached/);
      continue;
    }
    const T = Number.isFinite(m.T) ? m.T : 3 * m.P;
    const all = roots(m.y, m.k, T);
    if (v === "negative-time") {
      const t0 = Number(/\\approx-([\d.]+)\$/.exec(p.public.prompt)![1]);
      // −t0 solves the equation; |−t0| does not; −t0 + P is in the domain.
      assert.ok(Math.abs(m.y(-t0) - m.k) < 0.01 * m.A);
      assert.ok(Math.abs(m.y(t0) - m.k) > 0.01 * m.A);
      const later = Number(/about ([\d.]+) hours\.$/.exec(key)![1]);
      assert.ok(
        all.some((t) => Math.abs(t - later) < 0.006),
        key,
      );
      assert.ok(!/first/.test(key), "the key never claims the first time");
    } else if (v === "instants" || v === "recurrence") {
      assert.ok(
        key.includes(show(p, all[0]!)) && key.includes(show(p, all[1]!)),
        key,
      );
      if (v === "recurrence")
        assert.ok(key.includes(`every ${Number(m.P.toFixed(4))} `), key);
    } else {
      const [t1, t2, t3] = all as [number, number, number];
      const asksAbove = /greater than/.test(key);
      const inner = m.y((t1 + t2) / 2) > m.k === asksAbove;
      const span = inner ? [t1, t2] : [t2, t3];
      assert.ok(
        key.includes(
          `between about ${show(p, span[0]!)} and ${show(p, span[1]!)}`,
        ),
        key,
      );
    }
  }
});

test("choices: four distinct options, feedback on each wrong one, keys spread over positions", () => {
  for (const id of [
    "trig-model-solve-interval",
    "trig-model-interpret-solutions",
  ]) {
    const positions = new Map<string, number>();
    for (const p of sample(id, 300)) {
      const r = p.public.response;
      if (r.kind !== "choice") throw new Error("choice");
      assert.equal(new Set(r.options.map((o) => o.label)).size, 4);
      assert.deepEqual(
        Object.keys(p.choiceFeedback!).sort(),
        r.options.map((o) => o.id).filter((x) => x !== p.answer),
      );
      if (p.variant!.id !== "count")
        positions.set(p.answer, (positions.get(p.answer) ?? 0) + 1);
    }
    for (const o of ["option-a", "option-b", "option-c", "option-d"])
      assert.ok(
        (positions.get(o) ?? 0) >= 30,
        `${id} ${o}: ${positions.get(o)}`,
      );
  }
});

test("explanations name the inverse's range and the symmetry rule of the form", () => {
  for (const p of sample("trig-model-solve-interval", 120)) {
    if (p.variant!.id === "next") continue;
    const text = p.explanation.join(" ");
    const kind = readModel(p).kind;
    assert.match(text, kind === "sin" ? /\\pi-\\theta/ : /\$-\\theta\$/);
  }
  for (const p of sample("trig-model-inverse-setup", 120))
    assert.match(
      p.explanation.join(" "),
      /\[-\\frac\{\\pi\}\{2\},\\frac\{\\pi\}\{2\}\]|\[0,\\pi\]/,
    );
});
