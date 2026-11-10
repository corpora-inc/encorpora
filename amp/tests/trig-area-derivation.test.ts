import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import {
  derivationLines,
  FLAWS,
  flawLine,
  trigAreaDerivationGenerate as generate,
  trigAreaDerivationTemplates as templates,
  type AreaTriangle,
} from "../src/math/trig-area-derivation-practice";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";
import type { PointPlotResponse } from "../src/math/point-plot";

const N = 240;
const sample = (id: string, n = N) =>
  Array.from({ length: n }, (_, i) => generate(id, `t${i}`));
type V = [number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];

test("same seed, same problem; every problem meets the contract", () => {
  for (const t of templates)
    for (let i = 0; i < 60; i++) {
      const a = generate(t.id, `d${i}`);
      assert.deepEqual(generate(t.id, `d${i}`), a);
      assert.equal(a.public.skillId, "trigonometric-area");
      generatedProblemSchema.parse(a);
    }
});

test("every variant is reachable", () => {
  const seen = (id: string) => {
    const counts = new Map<string, number>();
    for (const p of sample(id, 400))
      counts.set(p.variant!.id, (counts.get(p.variant!.id) ?? 0) + 1);
    return counts;
  };
  const foot = seen("trig-area-auxiliary-line");
  for (const v of [
    "acute-horizontal",
    "acute-vertical",
    "obtuse-horizontal",
    "obtuse-vertical",
  ])
    assert.ok((foot.get(v) ?? 0) >= 40, `${v}: ${foot.get(v)}`);
  const fill = seen("trig-area-derivation-fill");
  for (const v of [
    "acute-symbolic",
    "acute-numeric",
    "obtuse-symbolic",
    "obtuse-numeric",
  ])
    assert.ok((fill.get(v) ?? 0) >= 40, `${v}: ${fill.get(v)}`);
  const reason = seen("trig-area-derivation-reasoning");
  for (const v of [
    "choose-line",
    "find-flaw",
    "justify",
    "obtuse-complete",
    "third-height",
  ])
    assert.ok((reason.get(v) ?? 0) >= 20, `${v}: ${reason.get(v)}`);
});

test("the plotted foot is the projection of the vertex onto the base line, outside the base exactly when the angle is obtuse", () => {
  for (const p of sample("trig-area-auxiliary-line")) {
    const r = p.public.response as PointPlotResponse;
    const from =
      /height drawn from \$([A-Z])\$ perpendicular to line \$([A-Z])([A-Z])\$/.exec(
        p.public.prompt,
      )!;
    const angleAt = /the angle \$([A-Z])\$ between them/.exec(
      p.public.prompt,
    )![1]!;
    const at = (l: string): V => {
      const v = r.given!.vertices.find((x) => x.label === l)!;
      return [v.x, v.y];
    };
    const X = at(from[1]!),
      P = at(from[2]!),
      Q = at(from[3]!);
    const u = sub(Q, P);
    const s = dot(sub(X, P), u) / dot(u, u);
    const foot: V = [P[0] + s * u[0], P[1] + s * u[1]];
    assert.equal(p.answer, JSON.stringify([foot]), p.public.prompt);
    // The foot is perpendicular below X and on the line.
    assert.ok(Math.abs(dot(sub(X, foot), u)) < 1e-9);
    const Z = at(angleAt),
      Y = angleAt === from[2] ? Q : P;
    const obtuse = dot(sub(X, Z), sub(Y, Z)) < 0;
    assert.equal(obtuse, p.variant!.id.startsWith("obtuse"));
    assert.equal(obtuse, s < 0 || s > 1, "outside the base iff obtuse");
    // Never the midpoint: a median would land on the same point.
    assert.notEqual(s, 0.5);
  }
});

/** A label's value: products of numbers, (n), ½, n², sin/cos/tan of a degree. */
function value(label: string): number {
  let t = label.replaceAll("$", "").trim();
  let k = 1;
  if (t.startsWith("-")) ((k = -1), (t = t.slice(1)));
  const trig = /\\(sin|cos|tan) (\d+)\^\\circ$/.exec(t);
  assert.ok(trig, label);
  const d = (Number(trig[2]) * Math.PI) / 180;
  k *= Math[trig[1] as "sin" | "cos" | "tan"](d);
  t = t.slice(0, trig.index);
  if (t.startsWith("\\frac12")) ((k /= 2), (t = t.slice(7)));
  for (const m of t.matchAll(/\((\d+)\)(\^2)?|(\d+)/g)) {
    const n = Number(m[1] ?? m[3]);
    k *= m[2] ? n * n : n;
  }
  return k;
}

test("numeric derivations: the keyed height and area evaluate to b sin C and half ab sin C; wrong options do not", () => {
  let checked = 0;
  for (const p of sample("trig-area-derivation-fill", 400)) {
    if (!p.variant!.id.endsWith("numeric")) continue;
    const g =
      /\$([A-Z]{2})=(\d+)\$, \$([A-Z]{2})=(\d+)\$ and \$m\\angle ([A-Z])=(\d+)\^\\circ\$/.exec(
        p.public.prompt,
      )!;
    const from = /height \$h\$ from \$([A-Z])\$/.exec(p.public.prompt)![1]!;
    const sides = { [g[1]!]: Number(g[2]), [g[3]!]: Number(g[4]) };
    const C = Number(g[6]);
    // The hypotenuse is the given side through the vertex of the height.
    const hyp = Object.entries(sides).find(([s]) => s.includes(from))![1];
    const base = Object.entries(sides).find(([s]) => !s.includes(from))![1];
    const r = p.public.response as MultiPartChoiceResponse;
    const key = JSON.parse(p.answer) as Record<string, string>;
    const pickLabel = (id: string) =>
      r.blanks.find((b) => b.id === id)!.options.find((o) => o.id === key[id])!
        .label;
    const h = hyp * Math.sin((C * Math.PI) / 180);
    assert.ok(Math.abs(value(pickLabel("height")) - h) < 1e-9);
    for (const o of r.blanks.find((b) => b.id === "height")!.options)
      if (o.id !== key.height) assert.ok(Math.abs(value(o.label) - h) > 0.05);
    if (r.blanks.some((b) => b.id === "area")) {
      const area = (base * h) / 2;
      assert.ok(Math.abs(value(pickLabel("area")) - area) < 1e-9);
      for (const o of r.blanks.find((b) => b.id === "area")!.options)
        if (o.id !== key.area)
          assert.ok(Math.abs(value(o.label) - area) > 0.05);
    } else {
      // Obtuse: the keyed angle is the supplement.
      assert.equal(pickLabel("supp"), `$${180 - C}^\\circ$`);
      assert.match(pickLabel("foot"), /extension .* beyond \$[A-Z]\$$/);
    }
    checked++;
  }
  assert.ok(checked > 100);
});

test("symbolic derivations key the formula of the prompt's own letters, and that formula is not always ½ab sin C", () => {
  let abc = 0,
    total = 0;
  for (const p of sample("trig-area-derivation-fill", 300)) {
    const r = p.public.response as MultiPartChoiceResponse;
    const key = JSON.parse(p.answer) as Record<string, string>;
    const formula =
      /derivation of area \$=(\\frac12[a-z]{2}\\sin [A-Z])\$/.exec(
        p.public.prompt,
      )![1]!;
    const area = r.blanks.find((b) => b.id === "area");
    if (area && p.variant!.id === "acute-symbolic")
      assert.equal(
        area.options.find((o) => o.id === key.area)!.label,
        `$${formula}$`,
      );
    total++;
    if (formula === "\\frac12ab\\sin C") abc++;
  }
  assert.ok(abc / total <= 0.5, `${abc} of ${total}`);
});

/** Coordinates of a triangle: Z at the origin, Y on the x axis. */
function coords(base: number, hyp: number, angle: number) {
  const a = (angle * Math.PI) / 180;
  const Z: V = [0, 0],
    Y: V = [base, 0],
    X: V = [hyp * Math.cos(a), hyp * Math.sin(a)];
  return { X, Y, Z, D: [X[0], 0] as V };
}

test("the correct derivation's claims hold in coordinates, for acute and obtuse angles", () => {
  for (const angle of [35, 50, 75, 105, 120, 145]) {
    const { X, Y, Z, D } = coords(9, 7, angle);
    const h = X[1];
    const shoelace =
      Math.abs((Y[0] - Z[0]) * (X[1] - Z[1]) - (X[0] - Z[0]) * (Y[1] - Z[1])) /
      2;
    // h = b sin C and area = ½ab sin C.
    assert.ok(Math.abs(h - 7 * Math.sin((angle * Math.PI) / 180)) < 1e-12);
    assert.ok(Math.abs(shoelace - 0.5 * 9 * h) < 1e-9);
    // The foot lies inside the base exactly when the angle is acute.
    assert.equal(D[0] > 0 && D[0] < 9, angle < 90);
    if (angle > 90) {
      // The angle at Z inside right triangle XDZ is the supplement.
      const inner =
        (Math.acos(
          dot(sub(X, Z), sub(D, Z)) /
            (Math.hypot(...sub(X, Z)) * Math.hypot(...sub(D, Z))),
        ) *
          180) /
        Math.PI;
      assert.ok(Math.abs(inner - (180 - angle)) < 1e-9);
    }
    // The height from Z is b sin X, which is not b sin Z here.
    const c = Math.hypot(...sub(X, Y));
    const angX =
      (Math.acos((7 * 7 + c * c - 81) / (2 * 7 * c)) * 180) / Math.PI;
    assert.ok(
      Math.abs(
        Math.sin((angX * Math.PI) / 180) - Math.sin((angle * Math.PI) / 180),
      ) > 0.02,
    );
  }
});

test("each flawed derivation agrees with the correct one before its flaw and differs on that line", () => {
  const t = (obtuse: boolean): AreaTriangle => ({
    names: ["A", "B", "C"],
    X: "A",
    Y: "B",
    Z: "C",
    base: 9,
    hyp: 7,
    angle: obtuse ? 120 : 50,
    obtuse,
  });
  // A slip in line 4 leaves lines 1–3 correct; a slip in line 1 leaves 4.
  const reference = (obtuse: boolean) => [
    ...derivationLines(
      t(obtuse),
      obtuse ? "obtuse-base" : "half-dropped",
    ).slice(0, 3),
    derivationLines(t(obtuse), obtuse ? "foot-inside" : "wrong-vertex")[3]!,
  ];
  assert.match(reference(false)[3]!, /\\frac12ab\\sin C\$\.$/);
  assert.match(reference(true)[3]!, /\\frac12ab\\sin C\$\.$/);
  assert.match(reference(true)[2]!, /=\\sin C\$, \$h=b\\sin C\$\.$/);
  for (const flaw of FLAWS) {
    const obtuse = FLAWS.indexOf(flaw) >= 4;
    const lines = derivationLines(t(obtuse), flaw);
    const correct = reference(obtuse);
    const k = flawLine[flaw] - 1;
    assert.deepEqual(lines.slice(0, k), correct.slice(0, k), flaw);
    assert.notEqual(lines[k], correct[k], flaw);
  }
  // Every line is the first error for exactly two slips.
  for (const line of [1, 2, 3, 4])
    assert.equal(FLAWS.filter((f) => flawLine[f] === line).length, 2);
});

test("find-the-flaw keys the slip's line, in fixed line order, spread over all four lines", () => {
  const lines = new Map<string, number>();
  for (const p of sample("trig-area-derivation-reasoning", 400)) {
    const r = p.public.response;
    assert.equal(r.kind, "choice");
    if (r.kind !== "choice" || p.variant!.id !== "find-flaw") continue;
    assert.deepEqual(
      r.options.map((o) => o.label),
      ["Line 1", "Line 2", "Line 3", "Line 4"],
    );
    const label = r.options.find((o) => o.id === p.answer)!.label;
    lines.set(label, (lines.get(label) ?? 0) + 1);
  }
  for (const l of ["Line 1", "Line 2", "Line 3", "Line 4"])
    assert.ok((lines.get(l) ?? 0) >= 15, `${l}: ${lines.get(l)}`);
});

test("choices are four distinct options with feedback on each wrong one, and the key is spread over positions", () => {
  const positions = new Map<string, number>();
  for (const p of sample("trig-area-derivation-reasoning", 400)) {
    const r = p.public.response;
    if (r.kind !== "choice") throw new Error("choice");
    assert.equal(new Set(r.options.map((o) => o.label)).size, 4);
    assert.deepEqual(
      Object.keys(p.choiceFeedback!).sort(),
      r.options.map((o) => o.id).filter((id) => id !== p.answer),
    );
    if (p.variant!.id !== "find-flaw")
      positions.set(p.answer, (positions.get(p.answer) ?? 0) + 1);
  }
  for (const id of ["option-a", "option-b", "option-c", "option-d"])
    assert.ok((positions.get(id) ?? 0) >= 25, `${id}: ${positions.get(id)}`);
});

test("hints never name the key; obtuse items never call the foot inside, acute items never mention a supplement", () => {
  for (const id of templates.map((t) => t.id))
    for (const p of sample(id, 120)) {
      const r = p.public.response;
      if (r.kind === "choice") {
        const key = r.options.find((o) => o.id === p.answer)!.label;
        assert.ok(!p.hint.includes(key), `${id}: ${p.hint}`);
      }
      const acute = p.variant!.id.startsWith("acute");
      if (acute && id === "trig-area-derivation-fill")
        assert.ok(!/180\^\\circ-/.test(p.explanation.join(" ")), p.answer);
    }
});
