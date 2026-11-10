import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import {
  circleSimilarityProofCases,
  circleSimilarityProofTemplates,
} from "../src/math/circle-similarity-proof-practice";
import {
  gradeStructuredWork,
  type StructuredWorkResponse,
} from "../src/math/structured-work";
import { parseSelection } from "../src/math/selection-response";

const ids = circleSimilarityProofTemplates.map((t) => t.id);
const SEEDS = 600;
const cases = circleSimilarityProofCases;

test("templates are registered, deterministic and valid", () => {
  for (const id of ids) {
    assert.ok(
      templates.some((t) => t.id === id),
      `${id} registered`,
    );
    for (let i = 0; i < 60; i++) {
      const a = generateProblem(id, `det-${i}`);
      const b = generateProblem(id, `det-${i}`);
      assert.deepEqual(a, b, `${id} det-${i}`);
      generatedProblemSchema.parse(a);
      assert.equal(gradeAnswer(a, a.answer), true, `${id} key credited`);
      assert.equal(a.public.skillId, "circle-similarity");
      const pub = JSON.stringify(a.public);
      assert.equal(pub.includes('"explanation"'), false);
    }
  }
});

/* ------------------------------------------------- the two-column proof */

const proofIds = (r: StructuredWorkResponse) => {
  const st = new Map(r.banks[0]!.options.map((o) => [o.id, o.label]));
  const re = new Map(r.banks[1]!.options.map((o) => [o.id, o.label]));
  return { st, re };
};

test("proof steps: every mode, radius kind and missing line is reached", () => {
  const seen = new Set<string>();
  const order = new Set<string>();
  for (let i = 0; i < SEEDS; i++) {
    const c = cases["circle-similarity-proof-steps"](`sweep-${i}`);
    seen.add(`${c.axes.mode}:${c.axes.radii}`);
    if (c.axes.mode === "fill") seen.add(`missing:${c.problem.variant!.id}`);
    if (c.model.y.numeric)
      order.add(c.model.y.numeric.r < c.model.y.numeric.s ? "r<s" : "r>s");
    else order.add(c.model.y.rd < c.model.y.sd ? "sym r<s" : "sym r>s");
  }
  for (const mode of ["build", "fill", "order"])
    for (const radii of ["symbolic", "numeric"])
      assert.ok(seen.has(`${mode}:${radii}`), `${mode}:${radii}`);
  for (const v of [
    "symbolic-missing-move",
    "symbolic-missing-onto",
    "symbolic-missing-similar",
    "numeric-missing-move",
    "numeric-missing-onto",
  ])
    assert.ok(seen.has(`missing:${v}`), v);
  assert.deepEqual([...order].sort(), ["r<s", "r>s", "sym r<s", "sym r>s"]);
});

test("proof steps: statements are true for the figure, false statements are false, the key is the only order", () => {
  for (let i = 0; i < 300; i++) {
    const c = cases["circle-similarity-proof-steps"](`truth-${i}`);
    const p = c.problem;
    const r = p.public.response as StructuredWorkResponse;
    const g = p.workGrading!;
    assert.equal(g.mode, "proof");
    if (g.mode !== "proof") continue;
    // Independent geometry on the drawn figure: centers and display radii.
    const scene = (
      p.public.figure as {
        scene: { elements: { id?: string; center?: number[]; r?: number }[] };
      }
    ).scene;
    const el = (id: string) => scene.elements.find((e) => e.id === id)!;
    const A = el("c1").center!;
    const B = el("c2").center!;
    const ra = el("c1").r!;
    const sb = el("c2").r!;
    // The translation by AB moves A to B and keeps ra: that is the dashed circle.
    assert.deepEqual(el("c1p").center, B);
    assert.ok(Math.abs(el("c1p").r! - ra) < 1e-9);
    // Dilating about B by sb/ra sends radius ra to sb and keeps B.
    assert.ok(Math.abs((sb / ra) * ra - sb) < 1e-9);
    if (c.model.y.numeric) {
      const { r: rr, s } = c.model.y.numeric;
      assert.ok(Math.abs(ra / sb - rr / s) < 1e-9, "drawn to scale");
      assert.ok(rr >= 1 && rr <= 12 && s >= 1 && s <= 12 && rr !== s);
    }
    const { st, re } = proofIds(r);
    // Each bank statement's truth, computed from the prompt's names and
    // radii: only true statements may carry a claim.
    const [rT, sT] = [...p.public.prompt.matchAll(/radius \$([^$]+)\$/g)].map(
      (m) => m[1]!,
    );
    const [c1, c2] = [
      ...p.public.prompt.matchAll(/Circle \$([^$]+)\$ has center/g),
    ].map((m) => m[1]!);
    const value = (t: string, v: Record<string, number>): number => {
      const frac = /^\\frac\{(.+)\}\{(.+)\}$/.exec(t);
      if (frac) return value(frac[1]!, v) / value(frac[2]!, v);
      const diff = /^(.+)-(.+)$/.exec(t);
      if (diff) return value(diff[1]!, v) - value(diff[2]!, v);
      return /^\d+$/.test(t) ? Number(t) : v[t]!;
    };
    // Two unequal sample radii for letters; the stated ones for numbers.
    const sample = { [rT!]: Number(rT) || 3, [sT!]: Number(sT) || 7 };
    const vec = (a: string, b: string) => `$\\overrightarrow{${a}${b}}$`;
    for (const [sid, label] of st) {
      let truth: boolean;
      if (label === "All circles are similar") truth = !c.model.y.numeric;
      else if (label === `Circle $${c1}$ is similar to circle $${c2}$`)
        truth = true;
      else if (label.startsWith(`The translation by ${vec(c1!, c2!)}`))
        truth = label.endsWith(`with center $${c2}$ and radius $${rT}$`);
      else if (label.startsWith(`The translation by ${vec(c2!, c1!)}`))
        truth = false; // center A goes to 2A - B, not B
      else if (label.startsWith(`The dilation about $${c1}$`))
        truth = false; // a dilation about A keeps the center at A
      else {
        const m =
          /^The dilation about \$(.+?)\$ by \$(.+?)\$ maps circle \$(.+?)'\$ onto circle \$(.+?)\$$/.exec(
            label,
          );
        assert.ok(m, label);
        assert.equal(m![1], c2);
        // Radius r of the translated circle times the factor must be s.
        truth =
          Math.abs(value(m![2]!, sample) * sample[rT!]! - sample[sT!]!) < 1e-9;
      }
      assert.equal(sid in g.claims, truth, label);
    }
    assert.equal(Object.keys(g.claims).length, c.model.path.length);
    // The key is credited and the shown order (for order mode) is not.
    assert.ok(gradeStructuredWork(r, g, p.answer));
    if (r.mode === "order") {
      const key = JSON.parse(p.answer) as string[];
      // Order uniqueness: every other permutation fails.
      const perms = (xs: string[]): string[][] =>
        xs.length <= 1
          ? [xs]
          : xs.flatMap((x, j) =>
              perms([...xs.slice(0, j), ...xs.slice(j + 1)]).map((rest) => [
                x,
                ...rest,
              ]),
            );
      for (const perm of perms(key))
        assert.equal(
          gradeStructuredWork(r, g, JSON.stringify(perm)),
          JSON.stringify(perm) === p.answer,
          `order ${perm}`,
        );
    }
    if (r.mode === "build") {
      const key = JSON.parse(p.answer) as [string, string][];
      // Any one wrong reason or false statement on a line is not credited.
      key.forEach(([s, reason], row) => {
        for (const other of re.keys())
          if (other !== reason) {
            const changed = key.map((x) => [...x]);
            changed[row]![1] = other;
            assert.equal(
              gradeStructuredWork(r, g, JSON.stringify(changed)),
              false,
            );
          }
        for (const other of st.keys())
          if (other !== s) {
            const changed = key.map((x) => [...x]);
            changed[row]![0] = other;
            assert.equal(
              gradeStructuredWork(r, g, JSON.stringify(changed)),
              false,
            );
          }
      });
    }
    // Generality guard: a numeric proof never concludes "all circles".
    if (c.model.y.numeric) {
      assert.equal(
        r.goal,
        `Circle $${c.model.y.c1}$ is similar to circle $${c.model.y.c2}$`,
      );
      const all = [...st.entries()].find(
        ([, l]) => l === "All circles are similar",
      )![0];
      assert.equal(g.claims[all], undefined);
    } else assert.equal(r.goal, "All circles are similar");
  }
});

/* ------------------------------------------ justify, flaw, explanation */

test("justify-flaw: every variant is reached, one key, distinct options, no-flaw always offered and never right", () => {
  const seen = new Map<string, number>();
  const keyAt = new Map<number, number>();
  for (let i = 0; i < SEEDS; i++) {
    const c = cases["circle-similarity-justify-flaw"](`sweep-${i}`);
    const p = c.problem;
    seen.set(p.variant!.id, (seen.get(p.variant!.id) ?? 0) + 1);
    const r = p.public.response;
    assert.equal(r.kind, "choice");
    if (r.kind !== "choice") continue;
    assert.equal(r.options.length, 4);
    assert.equal(new Set(r.options.map((o) => o.label)).size, 4);
    const at = r.options.findIndex((o) => o.id === p.answer);
    keyAt.set(at, (keyAt.get(at) ?? 0) + 1);
    assert.equal(Object.keys(p.choiceFeedback!).length, 3);
    const noFlaw = r.options.find((o) =>
      o.label.startsWith("There is no flaw"),
    );
    if (c.model.ask === "flaw") {
      assert.ok(noFlaw, "no-flaw option present");
      assert.notEqual(noFlaw!.id, p.answer);
      const key = r.options.find((o) => o.id === p.answer)!;
      assert.ok(key.label.startsWith(`Step ${c.model.flawed + 1}:`));
      // Exactly one flawed step: the steps other than the flawed one are
      // the valid argument's steps or follow from it.
      assert.ok(c.model.flawed >= 0 && c.model.flawed < c.model.steps.length);
      if (c.model.image) {
        // The flawed step's real image is not circle B.
        const scene = (
          p.public.figure as {
            scene: {
              elements: { id?: string; center?: number[]; r?: number }[];
            };
          }
        ).scene;
        const B = scene.elements.find((e) => e.id === "c2")!;
        const off =
          Math.hypot(
            c.model.image.center[0] - B.center![0],
            c.model.image.center[1] - B.center![1],
          ) + Math.abs(c.model.image.r - B.r!);
        assert.ok(off > 0.1, `${c.model.flaw}: image differs from circle B`);
      }
      if (c.model.flaw === "example") {
        assert.ok(c.model.y.numeric);
        assert.ok(
          p.public.prompt.includes("Therefore all circles are similar."),
        );
      } else assert.equal(c.model.y.numeric, null);
    } else assert.equal(noFlaw, undefined);
    // Generality guard: only the example flaw has numeric radii and "all".
    if (c.model.y.numeric) assert.equal(c.model.flaw, "example");
  }
  for (const v of [
    "justify-move",
    "justify-onto",
    "justify-similar",
    "justify-all",
    "flaw-inverted",
    "flaw-center",
    "flaw-example",
    "flaw-circular",
    "flaw-slide",
    "flaw-ratio",
    "explain",
  ])
    assert.ok((seen.get(v) ?? 0) >= 10, `${v}: ${seen.get(v)}`);
  for (let k = 0; k < 4; k++)
    assert.ok((keyAt.get(k) ?? 0) > SEEDS / 8, `key at ${k}: ${keyAt.get(k)}`);
});

test("justify-flaw: the computed flawed images are what the steps produce", () => {
  for (let i = 0; i < 200; i++) {
    const c = cases["circle-similarity-justify-flaw"](`image-${i}`, {
      ask: "flaw",
    });
    const { y } = c.model;
    const A = [0, 0];
    const B = [y.rd + Math.max(y.rd, y.sd) + 0.9, 0];
    if (c.model.flaw === "inverted") {
      // Dilate circle A' (center B, radius rd) about B by rd/sd.
      assert.deepEqual(c.model.image!.center, B);
      assert.ok(Math.abs(c.model.image!.r - (y.rd / y.sd) * y.rd) < 1e-9);
    }
    if (c.model.flaw === "center") {
      // Dilate circle A' about A by sd/rd: the center leaves B.
      const k = y.sd / y.rd;
      const center = [A[0]! + k * (B[0]! - A[0]!), A[1]! + k * (B[1]! - A[1]!)];
      assert.ok(
        Math.hypot(
          center[0]! - c.model.image!.center[0],
          center[1]! - c.model.image!.center[1],
        ) < 1e-9,
      );
      assert.ok(Math.abs(center[0]! - B[0]!) > 0.1);
    }
    if (c.model.flaw === "slide")
      assert.ok(Math.abs(c.model.image!.r - y.sd) > 0.1);
  }
});

/* ----------------------------------------------- the general sequence */

/** TeX expression in a, b, c, d, r, s → a function (independent of the
 * generator's own operation lists). */
function evaluator(tex: string): (v: Record<string, number>) => number {
  let js = tex.replace(/\s+/g, "");
  for (let i = 0; i < 4; i++)
    js = js.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))");
  js = js.replace(/([a-z])\^2/g, "($1**2)");
  js = js.replace(/(\d|\))(?=[a-z(])/g, "$1*");
  js = js.replace(/([a-z])(?=\()/g, "$1*");
  assert.match(js, /^[-+*/()\d.abcdrs]+$/, `parsed ${tex} → ${js}`);
  return new Function("v", `const {a,b,c,d,r,s}=v; return ${js};`) as (
    v: Record<string, number>,
  ) => number;
}
type Step =
  | {
      t: "tr";
      x: (v: Record<string, number>) => number;
      y: (v: Record<string, number>) => number;
    }
  | {
      t: "dil";
      x: (v: Record<string, number>) => number;
      y: (v: Record<string, number>) => number;
      k: (v: Record<string, number>) => number;
    };
function parseSequence(label: string): Step[] {
  const tr = /translate by \$\\langle (.+?),\\ (.+?)\\rangle\$/i;
  const dil = /dilate about \$\((.+?),(.+?)\)\$ by \$(.+?)\$/i;
  const parts = label.split(", then ");
  assert.equal(parts.length, 2, label);
  return parts.map((part): Step => {
    const t = tr.exec(part);
    if (t) return { t: "tr", x: evaluator(t[1]!), y: evaluator(t[2]!) };
    const d = dil.exec(part);
    assert.ok(d, part);
    return {
      t: "dil",
      x: evaluator(d![1]!),
      y: evaluator(d![2]!),
      k: evaluator(d![3]!),
    };
  });
}
const mapsOnto = (steps: Step[], v: Record<string, number>) => {
  let [x, y, rad] = [v.a!, v.b!, v.r!];
  for (const s of steps)
    if (s.t === "tr") [x, y] = [x + s.x(v), y + s.y(v)];
    else {
      const k = s.k(v);
      [x, y, rad] = [
        s.x(v) + k * (x - s.x(v)),
        s.y(v) + k * (y - s.y(v)),
        Math.abs(k) * rad,
      ];
    }
  return (
    Math.abs(x - v.c!) < 1e-7 &&
    Math.abs(y - v.d!) < 1e-7 &&
    Math.abs(rad - v.s!) < 1e-7
  );
};

test("general map: the keyed sequences work for every substitution; every other sequence fails for at least 19 of 20", () => {
  let rand = 12345;
  const next = () =>
    (rand = (rand * 1103515245 + 12345) % 2147483648) / 2147483648;
  const seen = new Set<string>();
  for (let i = 0; i < SEEDS; i++) {
    const c = cases["circle-similarity-general-map"](`sweep-${i}`);
    const p = c.problem;
    seen.add(p.variant!.id);
    const r = p.public.response;
    assert.equal(r.kind, "multi-select");
    if (r.kind !== "multi-select") continue;
    assert.equal(r.options.length, 5);
    assert.ok(r.selectionCount === 2 || r.selectionCount === 3);
    assert.equal(new Set(r.options.map((o) => o.label)).size, 5);
    const keyed = new Set(parseSelection(p.answer));
    if (!p.variant!.id.startsWith("sequence")) continue;
    const centers = [
      ...p.public.prompt.matchAll(/center \$\((-?\d+),(-?\d+)\)\$/g),
    ].map((m) => [Number(m[1]), Number(m[2])]);
    const numeric = p.variant!.id === "sequence-numeric";
    assert.equal(centers.length, numeric ? 2 : 0);
    for (const o of r.options) {
      const steps = parseSequence(o.label);
      let works = 0;
      for (let k = 0; k < 20; k++) {
        const v = numeric
          ? {
              a: centers[0]![0]!,
              b: centers[0]![1]!,
              c: centers[1]![0]!,
              d: centers[1]![1]!,
            }
          : {
              a: 20 * next() - 10,
              b: 20 * next() - 10,
              c: 20 * next() - 10,
              d: 20 * next() - 10,
            };
        const rr = 0.5 + 9 * next();
        let s = 0.5 + 9 * next();
        if (Math.abs(s - rr) < 0.1) s += 1;
        if (mapsOnto(steps, { ...v, r: rr, s })) works++;
      }
      if (keyed.has(o.id)) assert.equal(works, 20, `keyed: ${o.label}`);
      else assert.ok(works <= 1, `distractor works ${works}/20: ${o.label}`);
    }
    if (numeric) assert.ok(centers.flat().every((n) => Math.abs(n) <= 8));
  }
  assert.deepEqual([...seen].sort(), [
    "sequence-numeric",
    "sequence-symbolic",
    "statements",
  ]);
});

test("general map: statements true for every pair of circles are exactly the keyed ones", () => {
  const truth: [RegExp, boolean][] = [
    [/^The dilation's scale factor is \$\\frac\{s\}\{r\}\$/, true],
    [/^If the circles are concentric/, true],
    [/^If \$r=s\$/, true],
    [/^Any rigid motion that carries center/, true],
    [/^A translation alone/, false],
    [/^The dilation must be centered at the origin/, false],
    [/^The scale factor is \$\\frac\{s\^2\}\{r\^2\}\$/, false],
    [/^The scale factor is \$s-r\$/, false],
    [/^Circles with different radii are not similar/, false],
    [/^The proof works only when/, false],
  ];
  let checked = 0;
  for (let i = 0; i < 600; i++) {
    const p = cases["circle-similarity-general-map"](`st-${i}`).problem;
    if (p.variant!.id !== "statements") continue;
    checked++;
    const r = p.public.response;
    if (r.kind !== "multi-select") continue;
    const keyed = new Set(parseSelection(p.answer));
    for (const o of r.options) {
      const row = truth.find(([re]) => re.test(o.label));
      assert.ok(row, o.label);
      assert.equal(keyed.has(o.id), row![1], o.label);
    }
  }
  assert.ok(checked > 150, `${checked} statement items`);
});

test("hints name the instance and never give the keyed option", () => {
  for (const id of ids)
    for (let i = 0; i < 40; i++) {
      const p = generateProblem(id, `hint-${i}`);
      const r = p.public.response;
      if (r.kind === "choice") {
        const key = r.options.find((o) => o.id === p.answer)!.label;
        assert.equal(p.hint.includes(key), false, `${id}: ${p.hint}`);
      }
      assert.ok(p.hint.length > 40);
    }
});
