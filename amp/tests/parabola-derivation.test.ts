import test from "node:test";
import assert from "node:assert/strict";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
} from "../src/math/engine";
import {
  multiPartMarks,
  type MultiPartChoiceResponse,
} from "../src/math/multi-part-choice";
import {
  describeScene,
  layoutScene,
  sceneSchema,
} from "../src/math/scene/index.js";

/**
 * Independent checks for the HSG.GPE.A.2 parabola-derivation types. Every
 * line is read back from the public TeX and evaluated as a function of
 * (x, y); the focus and directrix are read from the prompt. Truth is the
 * definition: distance to the focus minus distance to the directrix. Nothing
 * here calls the generator's own line or answer builders.
 */

const DERIVE = "parabola-derive-equation";
const CHECK = "parabola-derivation-check";
const POINT = "parabola-point-equidistance";
const SEEDS = 600;
const gen = (id: string, i: number) => generateProblem(id, `pd-${i}`);

/* ----------------------------------------------- reading the givens */

interface Givens {
  a: number;
  b: number;
  /** The directrix variable and value: y = c or x = c. */
  v: "x" | "y";
  c: number;
}
function givensOf(prompt: string): Givens {
  const m =
    /focus \$F\((-?[\d.]+), (-?[\d.]+)\)\$ and directrix \$([xy])=(-?[\d.]+)\$/.exec(
      prompt,
    );
  assert.ok(m, `no focus and directrix in: ${prompt}`);
  return {
    a: Number(m[1]),
    b: Number(m[2]),
    v: m[3] as "x" | "y",
    c: Number(m[4]),
  };
}
/** Distance to the focus minus distance to the directrix. */
const truth = (g: Givens) => (x: number, y: number) =>
  Math.hypot(x - g.a, y - g.b) - Math.abs((g.v === "y" ? y : x) - g.c);
/** The squared condition as one polynomial: PF² − drop². */
const truthSquared = (g: Givens) => (x: number, y: number) =>
  (x - g.a) ** 2 + (y - g.b) ** 2 - ((g.v === "y" ? y : x) - g.c) ** 2;
/** Points on the parabola, from the definition: across offset t, the level
 * where t² + (u − F)² = (u − c)². */
function curve(g: Givens): [number, number][] {
  const F = g.v === "y" ? g.b : g.a;
  const across = g.v === "y" ? g.a : g.b;
  return [-7, -4, -2.5, -1, 0.5, 1.5, 3, 6].map((t) => {
    const u = (t * t + F * F - g.c * g.c) / (2 * (F - g.c));
    return g.v === "y" ? [across + t, u] : [u, across + t];
  });
}

/* ------------------------------------------ evaluating a TeX line */

type Fn = (x: number, y: number) => number;
function side(tex: string): Fn {
  let js = tex.replace(/\\sqrt\{/g, "Math.sqrt(").replace(/\}/g, ")");
  let open = true;
  js = js.replace(/\|/g, () => {
    const out = open ? "Math.abs(" : ")";
    open = !open;
    return out;
  });
  js = js
    .replace(/([xy])\^2/g, "($1*$1)")
    .replace(/\)\^2/g, ")**2")
    .replace(/(\d)([xy(])/g, "$1*$2")
    .replace(/\)\(/g, ")*(");
  assert.ok(/^[-+*/().\dxyMathsqrtab ]+$/.test(js), `unexpected TeX: ${tex}`);
  return new Function("x", "y", `return ${js};`) as Fn;
}
/** A line's two sides and its residual left − right. */
function line(tex: string): { left: Fn; right: Fn; res: Fn; tex: string } {
  const body = tex.replace(/^\$|\$$/g, "");
  const parts = body.split("=");
  assert.equal(parts.length, 2, body);
  const left = side(parts[0]!),
    right = side(parts[1]!);
  return { left, right, res: (x, y) => left(x, y) - right(x, y), tex: body };
}
const randomPoints: [number, number][] = Array.from({ length: 24 }, (_, i) => [
  ((i * 7.31) % 19) - 9.3,
  ((i * 4.77) % 17) - 8.1,
]);
const same = (f: Fn, g: Fn, points = randomPoints) =>
  points.every(([x, y]) => Math.abs(f(x, y) - g(x, y)) < 1e-6);
const vanishes = (f: Fn, points: [number, number][]) =>
  points.every(([x, y]) => Math.abs(f(x, y)) < 1e-6);

/** Lines of the array in a check prompt. */
function promptLines(prompt: string): string[] {
  const m = /\\begin\{array\}\{rl\}(.*)\\end\{array\}/.exec(prompt);
  assert.ok(m, prompt);
  return m[1]!
    .split("\\\\")
    .map((row) => row.replace(/^\\text\{Line \d:\}&/, ""));
}

const label = (r: MultiPartChoiceResponse, p: GeneratedProblem, id: string) =>
  multiPartMarks(r, p.answer, p.answer).find((m) => m.blank.id === id)!.expected
    .label;

/* ------------------------------------------------------------- tests */

test("every problem is valid, deterministic and credited only for its key", () => {
  for (const id of [DERIVE, CHECK, POINT])
    for (let i = 0; i < 120; i++) {
      const p = gen(id, i);
      generatedProblemSchema.parse(p);
      assert.deepEqual(gen(id, i), p, `${id} ${i} not deterministic`);
      assert.equal(isValidResponse(p.public, p.answer), true);
      assert.equal(gradeAnswer(p, p.answer), true);
      const r = p.public.response;
      assert.equal(r.kind, id === POINT ? "choice" : "multi-part-choice");
      if (r.kind === "multi-part-choice") {
        assert.equal(JSON.stringify(p.public).includes(p.answer), false);
        for (const secret of ['"answer"', '"explanation"', '"hint"'])
          assert.equal(JSON.stringify(p.public).includes(secret), false);
      }
      if (r.kind === "multi-part-choice")
        for (const b of r.blanks) {
          assert.equal(
            new Set(b.options.map((o) => o.label)).size,
            b.options.length,
          );
          for (const o of b.options) assert.ok(o.label.length <= 80, o.label);
        }
      if (r.kind === "choice") {
        assert.equal(r.options.length, 4);
        for (const o of r.options) assert.ok(o.label.length <= 120, o.label);
        for (const o of r.options)
          if (o.id !== p.answer)
            assert.ok(p.choiceFeedback?.[o.id], `${id}: feedback`);
      }
    }
});

test("parameters stay in the spec's ranges and shares", () => {
  let even = 0,
    horizontal = 0;
  const n = 2000;
  for (let i = 0; i < n; i++) {
    const p = gen(DERIVE, i);
    const g = givensOf(p.public.prompt);
    const F = g.v === "y" ? g.b : g.a;
    const across = g.v === "y" ? g.a : g.b;
    for (const v of [g.a, g.b, g.c])
      assert.ok(Number.isInteger(v) && Math.abs(v) <= 6 && v !== 0);
    assert.ok(
      F !== g.c && F !== -g.c && Math.abs(F - g.c) <= 8 && across !== 0,
    );
    if ((F - g.c) % 2 === 0) even++;
    if (g.v === "y") horizontal++;
  }
  assert.ok(even / n > 0.7 && even / n < 0.8, `even share ${even / n}`);
  assert.ok(
    horizontal / n > 0.6 && horizontal / n < 0.7,
    `horizontal share ${horizontal / n}`,
  );
});

test("derive: every correct line holds on the parabola and every wrong line does not", () => {
  const seen = new Set<string>();
  const positions = new Map<string, Set<number>>();
  for (let i = 0; i < SEEDS; i++) {
    const p = gen(DERIVE, i);
    const r = p.public.response as MultiPartChoiceResponse;
    const g = givensOf(p.public.prompt);
    const on = curve(g);
    assert.ok(vanishes(truth(g), on), "the sample points are on the parabola");
    seen.add(`${g.v}:${p.variant!.axes!.ending}`);
    const marks = multiPartMarks(r, p.answer, p.answer);
    marks.forEach((m) => {
      const key = `${m.blank.id}:${r.blanks.length}`;
      positions.set(
        key,
        (positions.get(key) ?? new Set()).add(
          m.blank.options.findIndex((o) => o.id === m.expected.id),
        ),
      );
    });
    // Line 1: the definition itself, and squaring it gives the polynomial.
    const l1 = line(label(r, p, "line1"));
    assert.ok(same(l1.res, truth(g)), `${p.public.prompt} ${l1.tex}`);
    // Lines 2 and 3 (and 4 as an equation) are the same polynomial PF² − drop².
    const ids =
      p.variant!.axes!.ending === "values"
        ? ["line2", "line3"]
        : ["line2", "line3", "line4"];
    for (const id of ids) {
      const l = line(label(r, p, id));
      assert.ok(same(l.res, truthSquared(g)), `${id}: ${l.tex}`);
    }
    // Every distractor fails at some point of the parabola: a different set.
    for (const b of r.blanks) {
      if (b.id === "line4" && p.variant!.axes!.ending === "values") continue;
      const key = label(r, p, b.id);
      for (const o of b.options) {
        if (o.label === key) continue;
        const l = line(o.label);
        assert.equal(
          vanishes(l.res, on),
          false,
          `${b.id} distractor ${o.label} holds on the parabola`,
        );
      }
    }
    if (p.variant!.axes!.ending === "values") {
      const F = g.v === "y" ? g.b : g.a;
      const across = g.v === "y" ? g.a : g.b;
      const read = (text: string) => {
        const m =
          /^\$p=(-?[\d.]+)\$, vertex \$\((-?[\d.]+), (-?[\d.]+)\)\$$/.exec(
            text,
          );
        assert.ok(m, text);
        return { p: Number(m[1]), v: [Number(m[2]), Number(m[3])] };
      };
      const key = read(label(r, p, "line4"));
      const k = (F + g.c) / 2;
      assert.equal(key.p, (F - g.c) / 2);
      assert.deepEqual(key.v, g.v === "y" ? [across, k] : [k, across]);
      // The vertex is |p| from the focus and |p| from the directrix.
      assert.equal(Math.abs(k - F), Math.abs(key.p));
      assert.equal(Math.abs(k - g.c), Math.abs(key.p));
      for (const o of r.blanks.find((b) => b.id === "line4")!.options) {
        if (o.label === label(r, p, "line4")) continue;
        const d = read(o.label);
        assert.ok(d.p !== key.p || d.v.join() !== key.v.join(), o.label);
      }
    }
  }
  assert.deepEqual([...seen].sort(), [
    "x:equation",
    "x:values",
    "y:equation",
    "y:values",
  ]);
  for (const [slot, at] of positions)
    assert.ok(at.size >= 3, `${slot}: correct option only at ${[...at]}`);
});

/** The first line that does not follow, found from the definition: line 1
 * must be the definition and every later line the squared polynomial. */
function firstWrong(lines: ReturnType<typeof line>[], g: Givens): number {
  if (!same(lines[0]!.res, truth(g))) return 1;
  for (let i = 1; i < lines.length; i++)
    if (!same(lines[i]!.res, truthSquared(g))) return i + 1;
  return 0;
}
/** Each line after `from` follows from the line before it: squaring when
 * it removes a root, otherwise the same polynomial rearranged. */
function followsFrom(lines: ReturnType<typeof line>[], from: number) {
  for (let i = from; i < lines.length; i++) {
    const prev = lines[i - 1]!,
      next = lines[i]!;
    const squared: Fn = (x, y) => prev.left(x, y) ** 2 - prev.right(x, y) ** 2;
    const ok =
      same(next.res, prev.res) ||
      (prev.tex.includes("\\sqrt") && same(next.res, squared));
    assert.ok(ok, `line ${i + 1} does not follow: ${prev.tex} → ${next.tex}`);
  }
}
/** Whether a stated mistake is really in the shown lines. Each reason is
 * read for its claim and the claim tested against the lines. */
function claimHolds(
  reason: string,
  lines: ReturnType<typeof line>[],
  wrong: number,
): boolean {
  let m: RegExpExecArray | null;
  if (
    (m = /^The drop to \$[xy]=-?[\d.]+\$ was written \$([^$]+)\$; it is/.exec(
      reason,
    ))
  )
    return lines[0]!.tex.endsWith(`=${m[1]}`);
  if (
    (m =
      /^Focus and directrix were swapped: the root holds \$\((-?[\d.]+), (-?[\d.]+)\)\$/.exec(
        reason,
      ))
  ) {
    const c = /\\sqrt\{\(x([+-][\d.]+)\)\^2\+\(y([+-][\d.]+)\)\^2\}/.exec(
      lines[0]!.tex,
    );
    return (
      !!c && -Number(c[1]) === Number(m[1]) && -Number(c[2]) === Number(m[2])
    );
  }
  if (/^The root was split term by term/.test(reason))
    return !lines[1]!.tex.includes("^2") && !lines[1]!.tex.includes("|");
  if (/^Only the left side was squared/.test(reason))
    return lines[1]!.tex.includes("^2") && lines[1]!.tex.includes("|");
  if ((m = /^\$(\([xy][^$]*\)\^2)\$ was written \$([^$]+)\$/.exec(reason)))
    return lines[2]!.tex.endsWith(`=${m[2]}`);
  if (/was moved across without its sign changing/.test(reason))
    return wrong === 4;
  if ((m = /^The factor \$(-?[\d.]+)\$ should be/.exec(reason)))
    return lines[4]!.tex.includes(`=${m[1]}(`);
  if (
    (m =
      /^Taking \$(-?[\d.]+)\$ out of \$[^$]+\$ leaves \$[^$]+\$, not \$([^$]+)\$/.exec(
        reason,
      ))
  )
    return lines[4]!.tex.endsWith(`=${m[1]}(${m[2]})`);
  throw new Error(`unknown reason: ${reason}`);
}

test("check: one injected mistake, carried forward correctly, named by exactly one reason", () => {
  const codes = new Map<string, number>();
  const wrongLines = new Map<number, number>();
  let flaws = 0;
  for (let i = 0; i < SEEDS * 2; i++) {
    const p = gen(CHECK, i);
    if (p.variant!.axes!.task !== "flaw") continue;
    flaws++;
    const r = p.public.response as MultiPartChoiceResponse;
    const g = givensOf(p.public.prompt);
    const lines = promptLines(p.public.prompt).map(line);
    assert.equal(lines.length, 5);
    const wrong = firstWrong(lines, g);
    assert.ok(wrong >= 1, `no wrong line: ${p.public.prompt}`);
    assert.equal(label(r, p, "line"), `Line ${wrong}`);
    followsFrom(lines, wrong);
    // The error is real: the wrong line does not follow from the one above.
    if (wrong > 1) {
      const prev = lines[wrong - 2]!;
      const squared: Fn = (x, y) =>
        prev.left(x, y) ** 2 - prev.right(x, y) ** 2;
      assert.equal(same(lines[wrong - 1]!.res, prev.res), false);
      assert.equal(same(lines[wrong - 1]!.res, squared), false);
    }
    const reasons = r.blanks.find((b) => b.id === "mistake")!.options;
    const holding = reasons.filter((o) => claimHolds(o.label, lines, wrong));
    assert.deepEqual(
      holding.map((o) => o.label),
      [label(r, p, "mistake")],
      `${p.variant!.id}: ${p.public.prompt}`,
    );
    const code = p.variant!.id;
    codes.set(code, (codes.get(code) ?? 0) + 1);
    wrongLines.set(wrong, (wrongLines.get(wrong) ?? 0) + 1);
  }
  assert.deepEqual(
    [...codes.keys()].sort(),
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `flaw-e${n}`),
  );
  for (let k = 1; k <= 5; k++)
    assert.ok(
      (wrongLines.get(k) ?? 0) / flaws >= 0.1,
      `line ${k}: ${wrongLines.get(k)} of ${flaws}`,
    );
});

test("check: each marked step's reason is the one operation between its lines", () => {
  const pairs = new Set<string>();
  const kinds: [RegExp, number][] = [
    [/as far from the focus as from the directrix/, 0],
    [/^Square both sides/, 1],
    [/^Expand/, 2],
    [/^Subtract/, 3],
    [/^Factor/, 4],
  ];
  for (let i = 0; i < SEEDS * 2; i++) {
    const p = gen(CHECK, i);
    if (p.variant!.axes!.task !== "justify") continue;
    const r = p.public.response as MultiPartChoiceResponse;
    const g = givensOf(p.public.prompt);
    const lines = promptLines(p.public.prompt).map(line);
    assert.equal(firstWrong(lines, g), 0, "the shown derivation is correct");
    const steps = r.blanks.map((b) =>
      b.label === "Why Line 1 is true"
        ? 0
        : Number(/^From Line (\d) to Line \d$/.exec(b.label)![1]),
    );
    pairs.add(steps.join(""));
    r.blanks.forEach((b, j) => {
      const key = label(r, p, b.id);
      const kind = kinds.find(([re]) => re.test(key));
      assert.ok(kind, key);
      assert.equal(kind[1], steps[j], `${b.label}: ${key}`);
      // No other offered option names this step.
      for (const o of b.options)
        if (o.label !== key)
          assert.notEqual(
            kinds.find(([re]) => re.test(o.label))?.[1],
            steps[j],
            o.label,
          );
    });
    // The factor named is the coefficient in the last line, which is 4p.
    for (const o of r.blanks[0]!.options) {
      const m = /^Factor \$(-?[\d.]+)\$/.exec(o.label);
      if (m) {
        const F = g.v === "y" ? g.b : g.a;
        assert.equal(Number(m[1]), 2 * (F - g.c));
        assert.ok(lines[4]!.tex.includes(`=${m[1]}(`));
      }
    }
  }
  assert.equal(pairs.size, 10, `transition pairs: ${[...pairs]}`);
});

function readPoint(prompt: string) {
  const m = /\$([PQ])\((-?[\d.]+|[xy]), (-?[\d.]+|[xy])\)\$/.exec(prompt);
  assert.ok(m, prompt);
  return { name: m[1], x: m[2]!, y: m[3]! };
}

test("point: the missing coordinate puts P on the parabola; no distractor does", () => {
  const seen = new Set<string>();
  for (let i = 0; i < SEEDS; i++) {
    const p = gen(POINT, i);
    const r = p.public.response;
    if (r.kind !== "choice") throw new Error("kind");
    const g = givensOf(p.public.prompt);
    seen.add(`${p.variant!.id}:${g.v}`);
    if (p.variant!.id !== "coordinate") continue;
    const P = readPoint(p.public.prompt);
    const at = (v: number): [number, number] =>
      P.x === "x" || P.x === "y" ? [v, Number(P.y)] : [Number(P.x), v];
    for (const o of r.options) {
      const m = /^\$([xy])=(-?[\d.]+)\$$/.exec(o.label);
      assert.ok(m, o.label);
      const v = Number(m[2]);
      assert.ok(Math.abs(v) <= 20 && Number.isInteger(v * 2), o.label);
      const [x, y] = at(v);
      const onIt = Math.abs(truth(g)(x, y)) < 1e-9;
      assert.equal(onIt, o.id === p.answer, `${p.public.prompt} ${o.label}`);
    }
    // The figure never draws P, whose position is the answer.
    const pointsDrawn = JSON.stringify(p.public.figure).match(/"label":"P"/g);
    assert.equal(pointsDrawn, null);
  }
  for (const v of ["coordinate", "check-on", "check-off"])
    for (const d of ["x", "y"]) assert.ok(seen.has(`${v}:${d}`), `${v}:${d}`);
});

test("point: exactly one explanation is correct and complete", () => {
  let on = 0,
    checks = 0;
  for (let i = 0; i < SEEDS; i++) {
    const p = gen(POINT, i);
    if (p.variant!.id === "coordinate") continue;
    checks++;
    const r = p.public.response;
    if (r.kind !== "choice") throw new Error("kind");
    const g = givensOf(p.public.prompt);
    const Q = readPoint(p.public.prompt);
    const qx = Number(Q.x),
      qy = Number(Q.y);
    const qf = Math.hypot(qx - g.a, qy - g.b);
    const drop = Math.abs((g.v === "y" ? qy : qx) - g.c);
    const isOn = Math.abs(qf - drop) < 1e-9;
    if (isOn) on++;
    assert.equal(p.variant!.id, isOn ? "check-on" : "check-off");
    for (const o of r.options) {
      const verdict = o.label.startsWith("Yes")
        ? true
        : o.label.startsWith("No")
          ? false
          : null;
      const stated = /\$QF=\\sqrt\{(\d+)\^2\+(\d+)\^2\}=(\d+)\$/.exec(o.label);
      const dropText = /\$Q\$ is \$\|[^$]*\|=(-?[\d.]+)\$ from \$[xy]=/.exec(
        o.label,
      );
      const complete =
        verdict === isOn &&
        !!stated &&
        Number(stated[3]) === qf &&
        Math.hypot(Number(stated[1]), Number(stated[2])) === qf &&
        !!dropText &&
        Number(dropText[1]) === drop &&
        !/vertex/.test(o.label);
      assert.equal(
        complete,
        o.id === p.answer,
        `${p.public.prompt}\n${o.label}`,
      );
    }
  }
  assert.ok(on / checks > 0.4 && on / checks < 0.6, `on share ${on / checks}`);
});

test("figures validate, lay out in their box and draw the stated focus and directrix", () => {
  for (const id of [DERIVE, POINT])
    for (let i = 0; i < 80; i++) {
      const p = gen(id, i);
      const figure = p.public.figure;
      assert.ok(figure && figure.kind === "scene", `${id} ${i}: scene`);
      if (figure.kind !== "scene") continue;
      assert.equal(sceneSchema.safeParse(figure.scene).success, true);
      const l = layoutScene(figure.scene);
      assert.ok(l.width <= (figure.scene.width ?? 360) + 1);
      assert.ok(!JSON.stringify(l.items).includes("NaN"));
      assert.ok(describeScene(figure.scene).length > 20);
      const g = givensOf(p.public.prompt);
      const json = JSON.stringify(figure.scene);
      assert.ok(
        json.includes(`"x":${g.a},"y":${g.b},"label":"F"`),
        `${id}: focus drawn`,
      );
      assert.ok(
        json.includes(g.v === "y" ? `{"m":0,"b":${g.c}}` : `{"x":${g.c}}`),
        `${id}: directrix drawn`,
      );
    }
  assert.equal(gen(CHECK, 0).public.figure, undefined);
});
