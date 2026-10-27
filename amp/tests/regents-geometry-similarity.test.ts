import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";

type P = ReturnType<typeof generateProblem>;
const options = (p: P) => {
  const r = p.public.response;
  return r.kind === "choice" ? r.options : [];
};
const key = (p: P) => options(p).find((o) => o.id === p.answer)!.label;
const seeds = Array.from({ length: 250 }, (_, i) => `g2:${i}`);
const deg = Math.PI / 180;

test("altitude ratio from coordinates", () => {
  checkTemplate("geo-altitude-ratio", {
    variants: ["sin-A", "cos-B", "tan-A"],
    axes: { fn: ["sin", "cos", "tan"], angle: ["a", "b"] },
    hintsMin: 20,
  });
  for (const s of seeds) {
    const p = generateProblem("geo-altitude-ratio", s);
    const [ac, bc] = p.public.prompt
      .match(/AC=(\d+)\$ and \$BC=(\d+)/)!
      .slice(1)
      .map(Number) as [number, number];
    // Coordinates: C at the origin, A on the x-axis, B on the y-axis, D the foot of the altitude.
    const C = [0, 0],
      A = [ac, 0],
      B = [0, bc];
    const t = (ac * ac) / (ac * ac + bc * bc);
    const D = [A[0]! + t * (B[0]! - A[0]!), A[1]! + t * (B[1]! - A[1]!)];
    const pts: Record<string, number[]> = { A, B, C: C, D };
    const dist = (n: string) =>
      Math.hypot(
        pts[n[0]!]![0]! - pts[n[1]!]![0]!,
        pts[n[0]!]![1]! - pts[n[1]!]![1]!,
      );
    // The angle at a vertex measured from its two neighbours: independent of the formula used by the generator.
    const angle = (v: string) => {
      const o = v === "A" ? B : A;
      const a1 = Math.atan2(o[1]! - pts[v]![1]!, o[0]! - pts[v]![0]!);
      const a2 = Math.atan2(C[1]! - pts[v]![1]!, C[0]! - pts[v]![0]!);
      return Math.abs(a1 - a2);
    };
    for (const o of options(p)) {
      const m = o.label.match(
        /\\(sin|cos|tan) ([AB]) = \\frac\{(\w\w)\}\{(\w\w)\}/,
      )!;
      const f =
        m[1] === "sin" ? Math.sin : m[1] === "cos" ? Math.cos : Math.tan;
      const holds =
        Math.abs(f(angle(m[2]!)) - dist(m[3]!) / dist(m[4]!)) < 1e-9;
      assert.equal(holds, o.id === p.answer, `${p.public.prompt} ${o.label}`);
    }
    assert.ok(/CD|AD|BD/.test(key(p)));
  }
});

test("parallel perimeter", () => {
  checkTemplate("geo-parallel-perimeter", {
    variants: ["ratio-2-5", "ratio-3-4"],
    axes: { given: ["cut-part", "whole-side"] },
    hintsMin: 10,
  });
  for (const s of seeds) {
    const p = generateProblem("geo-parallel-perimeter", s);
    const len = (n: string) =>
      Number(new RegExp(`${n}=(\\d+)\\\\ \\\\text`).exec(p.public.prompt)?.[1]);
    const AD = len("AD");
    const AB = Number.isNaN(len("AB")) ? AD + len("DB") : len("AB");
    const k = AB / AD;
    const perimeter = AB + len("DE") * k + len("AE") * k;
    assert.equal(Number(p.answer), perimeter);
    assert.ok(Number.isInteger(perimeter));
  }
});

test("parallel statement", () => {
  checkTemplate("geo-parallel-statement", {
    variants: ["AB"],
    hintsMin: 20,
    axes: { figure: ["crossing", "nested"] },
  });
  for (const s of seeds) {
    const p = generateProblem("geo-parallel-statement", s);
    const k = key(p);
    assert.ok(/\\cong\\triangle|^\$[A-Z]{2}=[A-Z]{2}\$$/.test(k), k);
    const trues = options(p).filter((o) => o.id !== p.answer);
    assert.equal(trues.length, 3);
    for (const o of trues)
      assert.ok(/\\sim|\\angle|\\frac/.test(o.label), o.label);
  }
});

test("equal legs radical", () => {
  checkTemplate("geo-equal-legs-radical", {
    variants: ["enlargement", "reduction"],
    axes: { ask: ["find-hypotenuse", "find-leg"] },
  });
  for (const s of seeds) {
    const p = generateProblem("geo-equal-legs-radical", s);
    const given = Number(
      /D[EF]=(\d+)\$\. What/.exec(p.public.prompt)?.[1] ??
        /D[EF]=(\d+)\$\./.exec(p.public.prompt)![1],
    );
    const asksLeg = p.public.prompt.includes("DE=");
    const expected = asksLeg ? given / Math.SQRT2 : given * Math.SQRT2;
    const parse = (label: string) => {
      const m = label.match(/^\$(\d*)(?:\\sqrt\{(\d)\})?\$$/)!;
      return (
        (m[1] === "" ? 1 : Number(m[1])) * (m[2] ? Math.sqrt(Number(m[2])) : 1)
      );
    };
    for (const o of options(p))
      assert.equal(
        Math.abs(parse(o.label) - expected) < 1e-9,
        o.id === p.answer,
        o.label,
      );
  }
});

test("elevation and depression", () => {
  checkTemplate("geo-elevation-depression", {
    variants: ["higher-top", "deeper-base"],
    axes: { place: ["whole", "tenth"] },
  });
  for (const s of seeds) {
    const p = generateProblem("geo-elevation-depression", s);
    const [d, up, down] = [
      ...p.public.prompt.matchAll(/\$(\d+)(?:\^\\circ)?\$/g),
    ].map((m) => Number(m[1]));
    // Independent: sine and cosine form of the same two legs.
    const leg = (a: number) => (d! * Math.sin(a * deg)) / Math.cos(a * deg);
    const h = leg(up!) + leg(down!);
    const places = p.public.prompt.includes("tenth of a foot") ? 1 : 0;
    assert.equal(Number(p.answer), Math.round(h * 10 ** places) / 10 ** places);
  }
});

test("density rank", () => {
  checkTemplate("geo-density-rank", {
    variants: ["Alder"],
    hintsMin: 20,
    axes: { order: ["greatest-first", "least-first"] },
  });
  for (const s of seeds) {
    const p = generateProblem("geo-density-rank", s);
    const rows = [
      ...JSON.stringify(p.public.figure).matchAll(
        /"label":"(\w+)","cells":\["([\d,]+)","([\d,]+)"\]/g,
      ),
    ].map((m) => ({
      name: m[1]!,
      d: Number(m[2]!.replaceAll(",", "")) / Number(m[3]!.replaceAll(",", "")),
    }));
    assert.equal(rows.length, 4);
    const greatest = p.public.prompt.includes("greatest to least");
    const want = [...rows]
      .sort((a, b) => (greatest ? b.d - a.d : a.d - b.d))
      .map((r) => r.name)
      .join(", ");
    assert.equal(key(p), want);
    for (const o of options(p))
      if (o.id !== p.answer) assert.notEqual(o.label, want);
  }
});
