import { reportEditorialLimit } from "./fixtures/editorial";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import { angleArgumentTemplates } from "../src/math/angle-arguments-practice";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";

/**
 * Checks for the informal angle-argument types (8.G.A.5). Figures are read
 * back from their scene data and measured here; nothing calls the
 * generator's own geometry. The python oracle decides every reason from the
 * drawn lines, marks and arcs.
 */

const IDS = angleArgumentTemplates.map((t) => t.id);
const SEEDS = 240;
const sample = (id: string, n = SEEDS, prefix = "angle") =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `${prefix}-${i}`));

type El = Record<string, unknown> & { type: string; id?: string };
const elementsOf = (p: GeneratedProblem): El[] => {
  const figure = p.public.figure;
  assert.equal(figure?.kind, "scene");
  if (!figure || figure.kind !== "scene") throw new Error("scene");
  return figure.scene.elements as unknown as El[];
};
const byId = (els: El[], id: string) => {
  const found = els.find((e) => e.id === id);
  assert.ok(found, `element ${id}`);
  return found!;
};
type P = [number, number];
const pointOf = (els: El[], name: string): P => byId(els, `p-${name}`).at as P;
const dir = (a: P, b: P) =>
  ((((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI) % 360) + 360) %
  360;
/** Interior angle at v between rays to p and q, in degrees. */
const angleAt = (v: P, p: P, q: P) => {
  const d = Math.abs(dir(v, p) - dir(v, q));
  return Math.min(d, 360 - d);
};
const arcSweep = (els: El[], key: string) => {
  const arc = byId(els, `a-${key}-0`);
  return (arc.to as number) - (arc.from as number);
};
const near = (a: number, b: number, tol = 1e-3) => Math.abs(a - b) < tol;
const answerLabel = (p: GeneratedProblem) => {
  const r = p.public.response;
  assert.ok(r.kind === "choice");
  if (r.kind !== "choice") throw new Error("choice");
  return r.options.find((o) => o.id === p.answer)!.label;
};

test("every angle-argument template is registered, valid and deterministic", () => {
  const registered = new Set(templates.map((t) => t.id));
  for (const id of IDS) {
    assert.ok(registered.has(id), id);
    assert.ok(methods[id]?.watch, `${id} method`);
    reportEditorialLimit(
      methods[id]!.goal.length <= 140,
      `${id}: goal exceeds 140 characters`,
    );
    assert.ok(methods[id]!.method.length > 0, `${id}: missing method`);
    reportEditorialLimit(
      methods[id]!.method.length >= 2 && methods[id]!.method.length <= 4,
      `${id}: method outside 2–4 step budget`,
    );
    assert.ok(principles[id], `${id} principle`);
    for (const [i, p] of sample(id, 80).entries()) {
      assert.ok(generatedProblemSchema.safeParse(p).success, `${id} ${i}`);
      assert.deepEqual(generateProblem(id, `angle-${i}`), p, `${id} ${i}`);
      assert.equal(p.public.skillId, "triangle-angle-theorems");
    }
  }
});

test("every variant family and flaw template is reachable", () => {
  const want: Record<string, string[]> = {
    "triangle-angle-argument": [
      "copies-angle",
      "copies-line",
      ...[
        "assumed",
        "wrong-pair",
        "vertical",
        "look",
        "circular",
        "same-side",
        "none",
      ].map((f) => `sum-${f}`),
      ...[
        "wrong-pair",
        "wrong-reason",
        "look",
        "remote-minus",
        "near-angle",
        "none",
      ].map((f) => `exterior-${f}`),
    ],
    "triangle-angle-reasons": ["sum", "exterior"],
    "parallel-angle-argument": [
      "translation",
      "half-turn",
      "hypothesis",
      ...["alternate", "same-side", "corresponding"].map(
        (f) => `flaw-${f}-none`,
      ),
      ...["name-1", "all-equal", "look-1", "name-2", "swap", "circular"].map(
        (f) => `flaw-alternate-${f}`,
      ),
    ],
    "parallel-angle-reasons": ["alternate-interior", "same-side-interior"],
    "aa-similarity-argument": [
      "decide-similar",
      "decide-not-similar",
      ...["arith", "one-pair", "mismatch", "congruent", "sides", "none"].map(
        (f) => `flaw-${f}`,
      ),
    ],
    "aa-similarity-select": ["select-two", "select-three"],
  };
  for (const id of IDS) {
    const seen = new Set(sample(id, 1200, "reach").map((p) => p.variant!.id));
    for (const v of want[id]!) assert.ok(seen.has(v), `${id}: ${v}`);
  }
});

test("find-the-flaw items offer four steps in order, with no error 15–25% of the time", () => {
  for (const id of [
    "triangle-angle-argument",
    "parallel-angle-argument",
    "aa-similarity-argument",
  ]) {
    const flaws = sample(id, 1500, "flaw").filter((p) =>
      /first go wrong/.test(p.public.prompt),
    );
    const labels = flaws.map(answerLabel);
    for (const p of flaws) {
      const r = p.public.response;
      assert.ok(r.kind === "choice");
      if (r.kind === "choice")
        assert.deepEqual(
          r.options.map((o) => o.label),
          ["Step 1", "Step 2", "Step 3", "No step is wrong"],
        );
    }
    const none =
      labels.filter((l) => l === "No step is wrong").length / labels.length;
    assert.ok(none >= 0.15 && none <= 0.25, `${id}: no error ${none}`);
    for (const step of ["Step 2", "Step 3"])
      assert.ok(
        labels.filter((l) => l === step).length / labels.length > 0.15,
        `${id}: ${step}`,
      );
  }
});

test("triangle figures are true: angle 1 copies angle B, angle 3 copies angle C, copies line up", () => {
  for (const id of ["triangle-angle-reasons", "triangle-angle-argument"])
    for (const p of sample(id)) {
      const els = elementsOf(p);
      const [A, B, C] = (["A", "B", "C"] as const).map((n) => pointOf(els, n));
      const angB = angleAt(B!, A!, C!),
        angC = angleAt(C!, A!, B!),
        angA = angleAt(A!, B!, C!);
      assert.ok(near(angA + angB + angC, 180));
      for (const v of [angA, angB, angC])
        assert.ok(v >= 25 - 1e-3 && v <= 110 + 1e-3, `${id} ${v}`);
      if (els.some((e) => e.id === "a-1-0")) {
        assert.ok(near(arcSweep(els, "1"), angB), `${id} angle 1`);
        assert.ok(near(arcSweep(els, "2"), angA), `${id} angle 2`);
        assert.ok(near(arcSweep(els, "3"), angC), `${id} angle 3`);
      }
      if (els.some((e) => e.id === "a-4-0")) {
        assert.ok(near(arcSweep(els, "4"), angA), `${id} angle 4`);
        assert.ok(near(arcSweep(els, "5"), angB), `${id} angle 5`);
        const D = pointOf(els, "D");
        assert.ok(near(angleAt(C!, A!, D), angA + angB), "exterior angle");
      }
      if (els.some((e) => e.id === "p-Cp")) {
        const Cp = pointOf(els, "Cp"),
          Bp = pointOf(els, "Bp");
        const cross =
          (A![0] - Cp[0]) * (Bp[1] - Cp[1]) - (A![1] - Cp[1]) * (Bp[0] - Cp[0]);
        assert.ok(Math.abs(cross) < 1e-4, "C′, A and B′ are collinear");
        assert.ok(
          near(Cp[1], A![1], 1e-4) && near(Bp[1], A![1], 1e-4),
          "parallel to BC",
        );
      }
    }
});

test("parallel figures: marked lines are parallel; the hypothesis item is not, with measures 12–20° apart", () => {
  for (const id of ["parallel-angle-argument", "parallel-angle-reasons"])
    for (const p of sample(id)) {
      const els = elementsOf(p);
      const lp = byId(els, "l-p"),
        lq = byId(els, "l-q");
      const dp = dir(lp.from as P, lp.to as P),
        dq = dir(lq.from as P, lq.to as P);
      const marked = els.some((e) => e.id === "pm-p");
      if (marked) assert.ok(near(dp, dq), `${id} parallel`);
      else {
        const gap = Math.min(Math.abs(dp - dq), 360 - Math.abs(dp - dq));
        assert.ok(gap >= 12 - 1e-3 && gap <= 20 + 1e-3, `tilt ${gap}`);
        const measures = els
          .filter((e) => typeof e.id === "string" && e.id.startsWith("m-"))
          .map((e) => Number(String(e.text).replace("°", "")));
        assert.equal(measures.length, 2);
        assert.ok(
          near(Math.abs(measures[0]! - measures[1]!), gap),
          `${measures} ${gap}`,
        );
      }
      for (let n = 1; n <= 8; n++) byId(els, `n-${n}`);
    }
});

test("similarity: drawn angles match the stated ones and the key follows the three angles", () => {
  for (const p of sample("aa-similarity-argument")) {
    const els = elementsOf(p);
    const given = [
      ...p.public.prompt.matchAll(/\\angle ([A-F]) = (\d+)\^\\circ/g),
    ].map((m) => [m[1]!, Number(m[2])] as const);
    assert.ok(given.length >= 4);
    for (const [name, value] of given.slice(0, 4))
      assert.ok(
        Math.abs(arcSweep(els, name) - value) < 0.5,
        `${name} drawn ${value}`,
      );
    const angles = (names: string, shown: (readonly [string, number])[]) => {
      const known = shown.filter(([n]) => names.includes(n)).map(([, v]) => v);
      return [...known, 180 - known[0]! - known[1]!].sort((a, b) => a - b);
    };
    const abc = angles("ABC", given.slice(0, 4)),
      def = angles("DEF", given.slice(0, 4));
    const similar = abc.join() === def.join();
    if (!/first go wrong/.test(p.public.prompt)) {
      const label = answerLabel(p);
      assert.equal(label.startsWith("Yes."), similar, label);
      // At most one shown measure is shared, so the third angle is needed.
      const shownABC = given.slice(0, 2).map(([, v]) => v),
        shownDEF = given.slice(2, 4).map(([, v]) => v);
      assert.equal(shownABC.filter((v) => shownDEF.includes(v)).length, 1);
    }
  }
  for (const p of sample("aa-similarity-select")) {
    const m = /\\angle A = (\d+)\^\\circ\$ and \$\\angle B = (\d+)/.exec(
      p.public.prompt,
    )!;
    const a = Number(m[1]),
      b = Number(m[2]);
    const target = [a, b, 180 - a - b].sort((x, y) => x - y).join();
    const r = p.public.response;
    assert.ok(r.kind === "multi-select");
    if (r.kind !== "multi-select") continue;
    const good = r.options
      .filter((o) => {
        const [x, y] = [...o.label.matchAll(/(\d+)°/g)].map((v) =>
          Number(v[1]),
        );
        return [x!, y!, 180 - x! - y!].sort((u, v) => u - v).join() === target;
      })
      .map((o) => o.id)
      .sort();
    assert.equal(p.answer, JSON.stringify(good));
    assert.equal(r.selectionCount, good.length);
    assert.equal(r.options.length, 5);
  }
});

test("reason lists: four distinct reasons, lengths within 35% of their mean, keywords never mark the answer", () => {
  for (const id of ["triangle-angle-reasons", "parallel-angle-reasons"]) {
    const positions = new Map<string, number[]>();
    for (const p of sample(id, 400)) {
      const r = p.public.response;
      assert.ok(r.kind === "multi-part-choice");
      if (r.kind !== "multi-part-choice") continue;
      const key = JSON.parse(p.answer) as Record<string, string>;
      for (const b of r.blanks) {
        const labels = b.options.map((o) => o.label);
        assert.equal(new Set(labels).size, 4);
        const visible = labels.map(
          (l) => l.replaceAll("$", "").replaceAll("\\", "").length,
        );
        const mean = visible.reduce((s, v) => s + v, 0) / visible.length;
        for (const v of visible)
          assert.ok(Math.abs(v - mean) <= 0.35 * mean, `${id} ${labels}`);
        const correct = b.options.find((o) => o.id === key[b.id])!;
        if (/parallel|transversal/.test(correct.label))
          assert.ok(
            b.options.filter(
              (o) => o !== correct && /parallel|transversal/.test(o.label),
            ).length >= 2,
            `${id} keyword`,
          );
        const slot = positions.get(b.id) ?? [0, 0, 0, 0];
        slot[b.options.indexOf(correct)]!++;
        positions.set(b.id, slot);
      }
    }
    for (const [blank, counts] of positions)
      for (const c of counts)
        assert.ok(c > 60, `${id} ${blank} position ${counts}`);
  }
});

test("prose choices: correct position spread over the four slots", () => {
  for (const id of [
    "triangle-angle-argument",
    "parallel-angle-argument",
    "aa-similarity-argument",
  ]) {
    const counts = [0, 0, 0, 0];
    for (const p of sample(id, 800, "slot")) {
      if (/first go wrong/.test(p.public.prompt)) continue;
      counts["abcd".indexOf(p.answer.at(-1)!)]!++;
      const r = p.public.response;
      if (r.kind !== "choice") continue;
      const visible = r.options.map(
        (o) => o.label.replaceAll("$", "").replaceAll("\\", "").length,
      );
      const mean = visible.reduce((s, v) => s + v, 0) / visible.length;
      for (const v of visible)
        assert.ok(
          Math.abs(v - mean) <= 0.35 * mean,
          `${id}: ${r.options.map((o) => o.label).join(" | ")}`,
        );
    }
    const total = counts.reduce((s, c) => s + c, 0);
    for (const c of counts) assert.ok(c / total > 0.15, `${id} ${counts}`);
  }
});

test("independent oracle reviews 256 seeds of every template and rejects a wrong key", () => {
  const cases = IDS.flatMap((id) =>
    Array.from({ length: 256 }, (_, i) =>
      generateProblem(id, `independent-${i}`),
    ),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import copy, json, sys
sys.path.insert(0, 'scripts')
import angle_arguments_math_oracle as oracle
print(oracle.self_test())
cases = json.load(sys.stdin)
rejected = 0
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer'], problem['public']['templateId']
    assert oracle.solve(problem['public']) == problem['answer']
    bad = copy.deepcopy(problem)
    r = bad['public']['response']
    if r['kind'] == 'choice':
        bad['answer'] = next(o['id'] for o in r['options'] if o['id'] != problem['answer'])
    elif r['kind'] == 'multi-select':
        bad['answer'] = json.dumps(sorted(o['id'] for o in r['options'][:r['selectionCount']]), separators=(',', ':'))
        if bad['answer'] == problem['answer']:
            bad['answer'] = json.dumps(sorted(o['id'] for o in r['options'][-r['selectionCount']:]), separators=(',', ':'))
    else:
        key = json.loads(problem['answer'])
        blank = r['blanks'][0]
        key[blank['id']] = next(o['id'] for o in blank['options'] if o['id'] != key[blank['id']])
        bad['answer'] = json.dumps(key, separators=(',', ':'))
    try:
        oracle.review_problem(bad)
    except ValueError:
        rejected += 1
print({'cases': len(cases), 'rejected': rejected})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 300_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(
    result.stdout,
    new RegExp(`'cases': ${IDS.length * 256}, 'rejected': ${IDS.length * 256}`),
  );
});
