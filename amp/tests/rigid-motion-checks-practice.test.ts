import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import { gradeStructuredWork } from "../src/math/structured-work";

/**
 * Independent checks for the rigid-motion property types (8.G.A.1). The
 * coordinates are read back from the prompt and every length, slope, angle,
 * parallel pair and congruence is recomputed here from them; nothing calls
 * the generator's own helpers.
 */

const IDS = [
  "rigid-motion-measure-verify",
  "rigid-motion-property-claims",
  "rigid-motion-image-check",
  "rigid-motion-image-flaw",
] as const;
const CAPABILITY: Record<(typeof IDS)[number], string> = {
  "rigid-motion-measure-verify": "structured-work-v1",
  "rigid-motion-property-claims": "multi-select-v1",
  "rigid-motion-image-check": "figure-choice-v1",
  "rigid-motion-image-flaw": "single-choice-v1",
};
const SEEDS = 240;
const sample = (id: string, n = SEEDS) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `rmc-${i}`));

type Pt = [number, number];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
/** Plus zero turns −0 into 0, so strict equality reads as arithmetic. */
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0] + 0;
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1] + 0;
const d2 = (a: Pt, b: Pt) => dot(sub(a, b), sub(a, b));
const area2 = (q: Pt[]) =>
  q.reduce((s, p, i) => s + cross(p, q[(i + 1) % q.length]!), 0);

function pointsOf(prompt: string): Record<string, Pt> {
  const out: Record<string, Pt> = {};
  for (const m of prompt.matchAll(/\$([A-Z]'?)\((-?\d+), (-?\d+)\)\$/g))
    out[m[1]!] = [Number(m[2]), Number(m[3])];
  return out;
}
/** The motion named in the prompt, applied independently of the generator. */
function motionOf(prompt: string): { kind: string; move: (p: Pt) => Pt } {
  let m =
    /translated (\d+) units? (right|left)(?: and (\d+) units? (up|down))?/.exec(
      prompt,
    );
  if (m) {
    const dx = Number(m[1]) * (m[2] === "right" ? 1 : -1);
    const dy = m[3] ? Number(m[3]) * (m[4] === "up" ? 1 : -1) : 0;
    return { kind: "slide", move: ([x, y]) => [x + dx, y + dy] };
  }
  m = /translated (\d+) units? (up|down)/.exec(prompt);
  if (m) {
    const dy = Number(m[1]) * (m[2] === "up" ? 1 : -1);
    return { kind: "slide", move: ([x, y]) => [x, y + dy] };
  }
  const flips: [string, (p: Pt) => Pt][] = [
    ["over the $x$-axis", ([x, y]) => [x, -y]],
    ["over the $y$-axis", ([x, y]) => [-x, y]],
    ["over the line $y = x$", ([x, y]) => [y, x]],
    ["over the line $y = -x$", ([x, y]) => [-y, -x]],
  ];
  for (const [words, move] of flips)
    if (prompt.includes(`reflected ${words}`)) return { kind: "flip", move };
  if (prompt.includes("rotated $90^\\circ$ counterclockwise"))
    return { kind: "turn", move: ([x, y]) => [-y, x] };
  if (prompt.includes("rotated $90^\\circ$ clockwise"))
    return { kind: "turn", move: ([x, y]) => [y, -x] };
  if (prompt.includes("rotated $180^\\circ$"))
    return { kind: "turn", move: ([x, y]) => [-x, -y] };
  throw new Error(`No motion in ${prompt}`);
}
const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];
const boxOf = (ps: Pt[]) => ({
  x0: Math.min(...ps.map((p) => p[0])),
  x1: Math.max(...ps.map((p) => p[0])),
  y0: Math.min(...ps.map((p) => p[1])),
  y1: Math.max(...ps.map((p) => p[1])),
});
function assertApart(a: Pt[], b: Pt[]) {
  const p = boxOf(a),
    q = boxOf(b);
  assert.ok(
    q.x0 >= p.x1 + 1 ||
      p.x0 >= q.x1 + 1 ||
      q.y0 >= p.y1 + 1 ||
      p.y0 >= q.y1 + 1,
    "original and image boxes are apart",
  );
}
const inRange = (ps: Pt[], lo: number, hi: number) =>
  ps.every(([x, y]) => x >= lo && x <= hi && y >= lo && y <= hi);
/** Checks the stated motion and the ranges; returns [originals, images]. */
function moved(p: GeneratedProblem, names: string[]): [Pt[], Pt[], string] {
  const pts = pointsOf(p.public.prompt);
  const { kind, move } = motionOf(p.public.prompt);
  const orig = names.map((n) => pts[n]!);
  const image = names.map((n) => pts[`${n}'`]!);
  orig.forEach((o, i) =>
    assert.ok(same(move(o), image[i]!), `image of ${names[i]}`),
  );
  assert.ok(inRange(orig, -8, 8), "original in [−8, 8]");
  assert.ok(inRange(image, -10, 10), "image in [−10, 10]");
  assertApart(orig, image);
  return [orig, image, kind];
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const slopeText = (a: Pt, b: Pt) => {
  let n = b[1] - a[1],
    d = b[0] - a[0];
  assert.notEqual(d, 0, "no vertical image segment");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(Math.abs(n), d);
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
};
const congruentInOrder = (p: Pt[], q: Pt[]) =>
  (
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 2],
      [1, 3],
    ] as const
  ).every(([i, j]) => d2(p[i]!, p[j]!) === d2(q[i]!, q[j]!));

test("every template is registered, valid and deterministic", () => {
  for (const id of IDS) {
    const meta = templates.find((t) => t.id === id);
    assert.ok(meta, id);
    assert.equal(meta.skillId, "rigid-motion-properties");
    assert.equal(meta.gradeBand, "6–8");
    assert.equal(meta.requiredResponseCapability, CAPABILITY[id]);
    for (const p of sample(id, 120)) {
      assert.ok(
        generatedProblemSchema.safeParse(p).success,
        `${id} ${p.public.seed}`,
      );
      assert.equal(
        JSON.stringify(generateProblem(id, p.public.seed)),
        JSON.stringify(p),
      );
      assert.equal(p.public.skillId, "rigid-motion-properties");
    }
  }
});

test("measure-and-verify: lengths, slopes and squares recomputed from the coordinates", () => {
  const seen = new Set<string>();
  const classes = new Map<string, number>();
  for (const p of sample("rigid-motion-measure-verify")) {
    const r = p.public.response;
    assert.equal(r.kind, "structured-work");
    if (r.kind !== "structured-work") continue;
    const key = JSON.parse(p.answer) as string[][];
    const values = key.slice(0, -1).map((row) => row[0]!);
    const claimId = key.at(-1)![0]!;
    const claim = r.banks[0]!.options.find((o) => o.id === claimId)!.label;
    const prompt = p.public.prompt;
    let check: string, kind: string;
    if (prompt.startsWith("Segment")) {
      const [[a, b], [a1, b1], k] = moved(p, ["A", "B"]);
      const len = Math.sqrt(d2(a!, b!));
      assert.ok(Number.isInteger(len) && len >= 3 && len <= 10);
      assert.deepEqual(values, [`${len}`, `${Math.sqrt(d2(a1!, b1!))}`]);
      assert.match(
        claim,
        /^\$A'B' = AB\$\. A (translation|reflection|rotation) keeps the length of every segment\.$/,
      );
      [check, kind] = ["segment-length", k];
    } else if (prompt.startsWith("Points")) {
      const [[pp, q, rr], [p1, q1, r1], k] = moved(p, ["P", "Q", "R"]);
      assert.equal(cross(sub(q!, pp!), sub(rr!, pp!)), 0, "P, Q, R collinear");
      assert.deepEqual(values, [slopeText(p1!, q1!), slopeText(q1!, r1!)]);
      for (const n of values[0]!.split("/"))
        assert.ok(Math.abs(Number(n)) <= 3, "slope terms at most 3");
      assert.match(
        claim,
        /^The slopes are equal, so \$P'\$, \$Q'\$ and \$R'\$ lie on one line\./,
      );
      [check, kind] = ["line-to-line", k];
    } else if (prompt.startsWith("In quadrilateral")) {
      const [[a, b, c, d], [a1, b1, c1, d1], k] = moved(p, [
        "A",
        "B",
        "C",
        "D",
      ]);
      assert.equal(cross(sub(b!, a!), sub(c!, d!)), 0, "AB ∥ DC");
      assert.deepEqual(values, [slopeText(a1!, b1!), slopeText(d1!, c1!)]);
      assert.match(
        claim,
        /^The slopes are equal, so \$A'B' \\parallel D'C'\$\./,
      );
      [check, kind] = ["parallel-lines", k];
    } else {
      const [[a, b, c], [a1, b1, c1], k] = moved(p, ["A", "B", "C"]);
      assert.equal(dot(sub(a!, b!), sub(c!, b!)), 0, "right angle at B");
      const sq = [d2(a1!, b1!), d2(b1!, c1!), d2(a1!, c1!)];
      assert.deepEqual(values, sq.map(String));
      assert.equal(sq[0]! + sq[1]!, sq[2]!);
      assert.ok(sq[2]! <= 200, "squared lengths at most 200");
      assert.ok(
        Math.sqrt(sq[0]!) <= 8 && Math.sqrt(sq[1]!) <= 8,
        "legs at most 8",
      );
      assert.match(claim, /^Yes\. \$A'B'\^2 \+ B'C'\^2 = A'C'\^2\$/);
      [check, kind] = ["right-angle", k];
    }
    seen.add(`${check}-${kind}`);
    classes.set(kind, (classes.get(kind) ?? 0) + 1);
    assert.equal(p.variant?.id, `${check}-${kind}`);
    // Four distinct claims; the key is credited and a wrong claim is not.
    const labels = r.banks[0]!.options.map((o) => o.label);
    assert.equal(new Set(labels).size, 4);
    assert.ok(gradeStructuredWork(r, p.workGrading!, p.answer));
    const other = r.banks[0]!.options.find((o) => o.id !== claimId)!.id;
    const wrong = JSON.stringify([...key.slice(0, -1), [other]]);
    assert.equal(gradeStructuredWork(r, p.workGrading!, wrong), false);
    // An equivalent fraction for a slope earns credit.
    if (values[0]!.includes("/")) {
      const [n, d] = values[0]!.split("/").map(Number);
      const doubled = JSON.stringify([
        [`${2 * n!}/${2 * d!}`],
        ...key.slice(1),
      ]);
      assert.ok(gradeStructuredWork(r, p.workGrading!, doubled));
    }
  }
  assert.equal(seen.size, 12, [...seen].join(", "));
  for (const [kind, n] of classes)
    assert.ok(n / SEEDS > 0.22 && n / SEEDS < 0.45, `${kind}: ${n}`);
});

test("property claims: every statement's truth recomputed; two to four are true", () => {
  const rows = new Map<string, number>();
  for (const p of sample("rigid-motion-property-claims")) {
    const r = p.public.response;
    assert.equal(r.kind, "multi-select");
    if (r.kind !== "multi-select") continue;
    const [orig, image] = moved(p, ["A", "B", "C", "D"]);
    const [a, b, c, d] = orig as [Pt, Pt, Pt, Pt];
    const name: Record<string, Pt> = { A: a, B: b, C: c, D: d };
    ["A", "B", "C", "D"].forEach((n, i) => (name[`${n}'`] = image[i]!));
    const angle = (x: Pt, y: Pt, z: Pt) =>
      Math.round(
        (Math.atan2(
          Math.abs(cross(sub(x, y), sub(z, y))),
          dot(sub(x, y), sub(z, y)),
        ) *
          180) /
          Math.PI,
      );
    const stated = Number(/m\\angle ABC = (\d+)/.exec(p.public.prompt)![1]);
    assert.equal(angle(a, b, c), stated);
    assert.ok([45, 90, 135].includes(stated));
    assert.ok(Number.isInteger(Math.sqrt(d2(a, d))), "AD is a whole number");
    const truth = r.options.map(({ label }) => {
      let m = /^\$([A-D]')([A-D]') = (\d+)\$$/.exec(label);
      if (m) {
        rows.set("length", (rows.get("length") ?? 0) + 1);
        return d2(name[m[1]!]!, name[m[2]!]!) === Number(m[3]) ** 2;
      }
      m = /^\$m\\angle ([A-D]')([A-D]')([A-D]') = (\d+)\^\\circ\$$/.exec(label);
      if (m)
        return angle(name[m[1]!]!, name[m[2]!]!, name[m[3]!]!) === Number(m[4]);
      m = /^\$([A-D]'?)([A-D]'?) \\parallel ([A-D]'?)([A-D]'?)\$$/.exec(label);
      if (m) {
        rows.set(label, (rows.get(label) ?? 0) + 1);
        const [w, x, y, z] = [1, 2, 3, 4].map((i) => name[m![i]!]!);
        return cross(sub(x!, w!), sub(z!, y!)) === 0;
      }
      if (label.startsWith("Going")) {
        rows.set("orientation", (rows.get("orientation") ?? 0) + 1);
        return Math.sign(area2(image)) === Math.sign(area2(orig));
      }
      assert.equal(label, "$A'B'C'D'$ has the same area as $ABCD$");
      rows.set("area", (rows.get("area") ?? 0) + 1);
      return Math.abs(area2(image)) === Math.abs(area2(orig));
    });
    const key = r.options
      .filter((_, i) => truth[i])
      .map((o) => o.id)
      .sort();
    assert.equal(p.answer, JSON.stringify(key));
    assert.equal(r.options.length, 6);
    assert.ok(key.length >= 2 && key.length <= 4);
    assert.equal(r.selectionCount, key.length);
  }
  for (const row of [
    "orientation",
    "area",
    "$A'B' \\parallel AB$",
    "$A'D' \\parallel B'C'$",
  ])
    assert.ok((rows.get(row) ?? 0) / SEEDS >= 0.05, `${row} appears`);
});

test("image check: exactly one congruent candidate; decoys break one property each", () => {
  let mirrored = 0;
  for (const p of sample("rigid-motion-image-check")) {
    const r = p.public.response;
    assert.equal(r.kind, "figure-choice");
    if (r.kind !== "figure-choice") continue;
    const pts = pointsOf(p.public.prompt);
    const orig = ["A", "B", "C", "D"].map((n) => pts[n]!);
    const candidates = r.options.map((o) => {
      const graph = o.scene.elements.find((e) => e.type === "graph");
      assert.ok(graph && graph.type === "graph");
      const at = (n: string) => graph.points!.find((q) => q.label === n)!;
      return ["P", "Q", "R", "S"].map((n) => [at(n).x, at(n).y] as Pt);
    });
    const matches = candidates.flatMap((q, i) =>
      congruentInOrder(orig, q) ? [r.options[i]!.id] : [],
    );
    assert.deepEqual(matches, [p.answer]);
    const signatures = candidates.map((q) =>
      JSON.stringify([
        q.map((x, i) => d2(x, q[(i + 1) % 4]!)).sort((u, v) => u - v),
        [d2(q[0]!, q[2]!), d2(q[1]!, q[3]!)].sort((u, v) => u - v),
      ]),
    );
    assert.equal(new Set(signatures).size, 4, "pairwise non-congruent");
    for (const q of candidates) assert.ok(inRange(q, -10, 10));
    for (const o of r.options)
      assert.doesNotMatch(o.label, /image|correct|rigid/i);
    const right = candidates[r.options.findIndex((o) => o.id === p.answer)]!;
    if (Math.sign(area2(right)) !== Math.sign(area2(orig))) mirrored++;
    assert.equal(Object.keys(p.choiceFeedback ?? {}).length, 3);
  }
  assert.ok(mirrored / SEEDS >= 0.4, `mirror images: ${mirrored}`);
});

test("image flaw: exactly one statement is true of the drawn candidate", () => {
  const kinds = new Map<string, number>();
  for (const p of sample("rigid-motion-image-flaw")) {
    const r = p.public.response;
    assert.equal(r.kind, "choice");
    if (r.kind !== "choice") continue;
    const pts = pointsOf(p.public.prompt);
    const [a, b, , d] = ["A", "B", "C", "D"].map((n) => pts[n]!) as [
      Pt,
      Pt,
      Pt,
      Pt,
    ];
    const orig = ["A", "B", "C", "D"].map((n) => pts[n]!);
    const q = ["P", "Q", "R", "S"].map((n) => pts[n]!);
    const [P, Q, R, S] = q as [Pt, Pt, Pt, Pt];
    const right = (x: Pt, y: Pt, z: Pt) => dot(sub(y, x), sub(z, x)) === 0;
    const truth = r.options.map(({ label }) => {
      let m = /^No\. \$PQ = (\d+)\$ but \$AB = (\d+)\$\.$/.exec(label);
      if (m)
        return d2(P, Q) === Number(m[1]) ** 2 && d2(a, b) === Number(m[2]) ** 2;
      if (
        label === "No. $\\angle SPQ$ is a right angle but $\\angle DAB$ is not."
      )
        return right(P, S, Q) && !right(a, d, b);
      if (
        label === "No. $\\angle SPQ$ is not a right angle but $\\angle DAB$ is."
      )
        return !right(P, S, Q) && right(a, d, b);
      m =
        /^No\. \$PQ\$ and \$PS\$ match \$AB\$ and \$AD\$, but \$QS\^2 = (\d+)\$ while \$BD\^2 = (\d+)\$\.$/.exec(
          label,
        );
      if (m)
        return (
          d2(P, Q) === d2(a, b) &&
          d2(P, S) === d2(a, d) &&
          d2(Q, S) === Number(m[1]) &&
          d2(b, d) === Number(m[2]) &&
          m[1] !== m[2]
        );
      if (label === "No. $SR$ is not parallel to $PQ$.")
        return cross(sub(Q, P), sub(R, S)) !== 0;
      assert.match(label, /^Yes\. Every side length/);
      return congruentInOrder(orig, q);
    });
    assert.equal(truth.filter(Boolean).length, 1, p.public.prompt);
    assert.equal(r.options[truth.indexOf(true)]!.id, p.answer);
    kinds.set(
      p.variant!.id.split("-")[0]!,
      (kinds.get(p.variant!.id.split("-")[0]!) ?? 0) + 1,
    );
  }
  for (const [kind, n] of kinds)
    assert.ok(n / SEEDS >= 0.18 && n / SEEDS <= 0.32, `${kind}: ${n}`);
  assert.equal(kinds.size, 4);
});

test("hints name the problem's own coordinates and never the claim", () => {
  for (const id of IDS)
    for (const p of sample(id, 40)) {
      const pairs = [...p.public.prompt.matchAll(/\((-?\d+), (-?\d+)\)/g)].map(
        (m) => m[0],
      );
      assert.ok(
        pairs.some((pair) => p.hint.includes(pair)),
        `${id}: ${p.hint}`,
      );
      assert.doesNotMatch(
        p.hint,
        /keeps the length of every segment|lie on one line\. The line/,
      );
    }
});

test("the independent oracle reviews 256 seeds of every template", () => {
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
import json, sys
sys.path.insert(0, 'scripts')
import rigid_motion_checks_math_oracle as oracle
print(oracle.self_test())
cases = json.load(sys.stdin)
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer'], problem['public']['seed']
    assert oracle.solve(problem['public']) == problem['answer']
print({'cases': len(cases)})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 1024/);
  assert.match(result.stdout, /'mutations': 13/);
});
