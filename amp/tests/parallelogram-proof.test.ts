import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import {
  counterexampleClaims,
  enoughFacts,
  flawedLines,
  notEnoughFacts,
  parallelogramProofCases,
  parallelogramProofGenerate,
  parallelogramProofTemplates,
  proofIds,
  proofOf,
  REASONS,
  type ProofId,
} from "../src/math/parallelogram-proof-practice";
import {
  gradeStructuredWork,
  structuredWorkGuessChance,
  type StructuredWorkResponse,
  type WorkGrading,
} from "../src/math/structured-work";
import type { GeneratedProblem } from "../src/math/contracts";
import type { Scene } from "../src/math/scene/spec";

/* ------------------------------------------------ independent geometry */

type P = [number, number];
const EPS = 1e-7;
const d = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const v = (a: P, b: P): P => [b[0] - a[0], b[1] - a[1]];
const cross = (a: P, b: P) => a[0] * b[1] - a[1] * b[0];
const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1];
const angle = (x: P, y: P, z: P) => {
  const a = v(y, x),
    b = v(y, z);
  return (
    (Math.acos(dot(a, b) / (Math.hypot(...a) * Math.hypot(...b))) * 180) /
    Math.PI
  );
};
const parallel = (a: P, b: P, c: P, e: P) =>
  Math.abs(cross(v(a, b), v(c, e))) < EPS;
const isParallelogram = (q: P[]) =>
  parallel(q[0]!, q[1]!, q[3]!, q[2]!) && parallel(q[0]!, q[3]!, q[1]!, q[2]!);

/** Vertex letters and their points, read from the figure's name labels. */
function pointsOf(scene: Scene): Map<string, P> {
  const out = new Map<string, P>();
  for (const e of scene.elements)
    if (e.type === "text" && e.id && /^n[A-E]$/.test(e.id))
      out.set(e.text, e.at as P);
  return out;
}

/** One statement's truth for the drawn figure, parsed from its text. */
function truth(tex: string, at: Map<string, P>): boolean {
  const p = (s: string) => {
    const x = at.get(s);
    assert.ok(x, `no point ${s} in ${tex}`);
    return x;
  };
  const ang = (s: string) => angle(p(s[0]!), p(s[1]!), p(s[2]!));
  let m: RegExpMatchArray | null;
  if ((m = tex.match(/^\$(\w{4})\$ is a parallelogram$/)))
    return isParallelogram([...m[1]!].map(p));
  if (
    (m = tex.match(
      /^\$(\w{4})\$ is a parallelogram, and \$\\angle (\w{3})\$ and \$\\angle (\w{3})\$ are right angles$/,
    ))
  )
    return (
      isParallelogram([...m[1]!].map(p)) &&
      Math.abs(ang(m[2]!) - 90) < EPS &&
      Math.abs(ang(m[3]!) - 90) < EPS
    );
  if (
    (m = tex.match(
      /^\$\\angle (\w{3})\$ is supplementary to \$\\angle (\w{3})\$ and to \$\\angle (\w{3})\$$/,
    ))
  )
    return (
      Math.abs(ang(m[1]!) + ang(m[2]!) - 180) < EPS &&
      Math.abs(ang(m[1]!) + ang(m[3]!) - 180) < EPS
    );
  if (
    (m = tex.match(
      /^\$\\angle (\w{3})\$ and \$\\angle (\w{3})\$ are supplementary$/,
    ))
  )
    return Math.abs(ang(m[1]!) + ang(m[2]!) - 180) < EPS;
  if (
    (m = tex.match(
      /^\$\\angle (\w{3})\$ and \$\\angle (\w{3})\$ are right angles$/,
    ))
  )
    return Math.abs(ang(m[1]!) - 90) < EPS && Math.abs(ang(m[2]!) - 90) < EPS;
  const atoms = tex.split(" and ");
  return atoms.every((atom) => {
    let a: RegExpMatchArray | null;
    if (
      (a = atom.match(
        /^\$\\overline\{(\w)(\w)\}\\cong\\overline\{(\w)(\w)\}\$$/,
      ))
    )
      return Math.abs(d(p(a[1]!), p(a[2]!)) - d(p(a[3]!), p(a[4]!))) < EPS;
    if (
      (a = atom.match(
        /^\$\\overline\{(\w)(\w)\}\\parallel\\overline\{(\w)(\w)\}\$$/,
      ))
    )
      return parallel(p(a[1]!), p(a[2]!), p(a[3]!), p(a[4]!));
    if ((a = atom.match(/^\$\\angle (\w{3})\\cong\\angle (\w{3})\$$/)))
      return Math.abs(ang(a[1]!) - ang(a[2]!)) < EPS;
    if (
      (a = atom.match(
        /^\$\\triangle (\w)(\w)(\w)\\cong\\triangle (\w)(\w)(\w)\$$/,
      ))
    ) {
      const [x, y, z, u, w, t] = a.slice(1) as string[];
      return (
        Math.abs(d(p(x!), p(y!)) - d(p(u!), p(w!))) < EPS &&
        Math.abs(d(p(y!), p(z!)) - d(p(w!), p(t!))) < EPS &&
        Math.abs(d(p(z!), p(x!)) - d(p(t!), p(u!))) < EPS
      );
    }
    assert.fail(`Unparsed statement: ${tex}`);
  });
}

/** Angle pairs that a line calls alternate interior (or vertical) really
 * are, for the named transversal. */
function anglePairs(tex: string): [string, string][] {
  return [...tex.matchAll(/\\angle (\w{3})\\cong\\angle (\w{3})/g)].map((m) => [
    m[1]!,
    m[2]!,
  ]);
}
function alternateInterior(x: string, y: string, at: Map<string, P>) {
  const [a1, v1, b1] = [...x].map((c) => at.get(c)!);
  const [a2, v2, b2] = [...y].map((c) => at.get(c)!);
  const toward = (vtx: P, ray: P, other: P) =>
    Math.abs(cross(v(vtx, ray), v(vtx, other))) < EPS &&
    dot(v(vtx, ray), v(vtx, other)) > 0;
  // One ray of each angle runs along the transversal toward the other
  // vertex; the other rays are antiparallel (on opposite sides).
  const sides1 = toward(v1!, b1!, v2!)
    ? a1!
    : toward(v1!, a1!, v2!)
      ? b1!
      : null;
  const sides2 = toward(v2!, b2!, v1!)
    ? a2!
    : toward(v2!, a2!, v1!)
      ? b2!
      : null;
  if (!sides1 || !sides2) return false;
  const r1 = v(v1!, sides1),
    r2 = v(v2!, sides2);
  return Math.abs(cross(r1, r2)) < EPS && dot(r1, r2) < 0;
}
function vertical(x: string, y: string, at: Map<string, P>) {
  const [a1, v1, b1] = [...x].map((c) => at.get(c)!);
  const [a2, v2, b2] = [...y].map((c) => at.get(c)!);
  if (d(v1!, v2!) > EPS) return false;
  const opposite = (p: P, q: P) =>
    Math.abs(cross(v(v1!, p), v(v1!, q))) < EPS &&
    dot(v(v1!, p), v(v1!, q)) < 0;
  return opposite(a1!, a2!) && opposite(b1!, b2!);
}

/* ------------------------------------------- expected proofs, by hand */

/** Each proof's reason per line and the lines each line needs (1-based),
 * written independently of the generator's claims. */
const expected: Record<ProofId, { reasons: string[]; needs: number[][] }> = {
  a: {
    reasons: [
      REASONS.given,
      REASONS.defPar,
      REASONS.altInt,
      REASONS.reflexive,
      REASONS.asa,
      REASONS.cpctc,
    ],
    needs: [[], [1], [2], [], [3, 4], [5]],
  },
  b: {
    reasons: [
      REASONS.given,
      REASONS.defPar,
      REASONS.sameSide,
      REASONS.sameSide,
      REASONS.congSupp,
    ],
    needs: [[], [1], [2], [2], [3, 4]],
  },
  c: {
    reasons: [
      REASONS.given,
      REASONS.defPar,
      REASONS.altInt,
      REASONS.oppSides,
      REASONS.asa,
      REASONS.cpctc,
    ],
    needs: [[], [1], [2], [1], [3, 4], [5]],
  },
  d: {
    reasons: [
      REASONS.given,
      REASONS.vertical,
      REASONS.sas,
      REASONS.cpctc,
      REASONS.converseAlt,
      REASONS.defPar,
    ],
    needs: [[], [], [1, 2], [3], [4], [5]],
  },
  e: {
    reasons: [
      REASONS.given,
      REASONS.reflexive,
      REASONS.sss,
      REASONS.cpctc,
      REASONS.converseAlt,
      REASONS.defPar,
    ],
    needs: [[], [], [1, 2], [3], [4], [5]],
  },
  f: {
    reasons: [
      REASONS.defRect,
      REASONS.oppSides,
      REASONS.rightCong,
      REASONS.reflexive,
      REASONS.sas,
      REASONS.cpctc,
    ],
    needs: [[], [1], [1], [], [2, 3, 4], [5]],
  },
  g: {
    reasons: [
      REASONS.oppSides,
      REASONS.reflexive,
      REASONS.sss,
      REASONS.cpctc,
      REASONS.consec,
      REASONS.suppRight,
    ],
    needs: [[], [], [1, 2], [3], [], [4, 5]],
  },
};
/** Reasons a converse proof (or a proof of that very theorem) may never
 * cite: they assume what is being proved. */
const circular: Record<ProofId, string[]> = {
  a: [REASONS.oppSides],
  b: [REASONS.oppAngles],
  c: [REASONS.diagBisect],
  d: [REASONS.oppSides, REASONS.diagBisect, REASONS.oppAngles, REASONS.altInt],
  e: [REASONS.oppSides, REASONS.diagBisect, REASONS.oppAngles, REASONS.altInt],
  f: [REASONS.rectDiag],
  g: [REASONS.rectDiag, REASONS.defRect],
};

const permutations = <T>(items: T[]): T[][] =>
  items.length <= 1
    ? [items]
    : items.flatMap((x, i) =>
        permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(
          (rest) => [x, ...rest],
        ),
      );
const work = (p: GeneratedProblem) =>
  p.public.response as StructuredWorkResponse;
const label = (r: StructuredWorkResponse, bank: string, id: string) =>
  r.banks.find((b) => b.id === bank)!.options.find((o) => o.id === id)!.label;
const sceneOf = (p: GeneratedProblem) => {
  assert.equal(p.public.figure?.kind, "scene");
  return (p.public.figure as { kind: "scene"; scene: Scene }).scene;
};
const proofOfProblem = (p: GeneratedProblem) =>
  p.variant!.id.slice("proof-".length) as ProofId;
/** Rows of a fill-in or ordering in worked order: [statement, reason]. */
function workedRows(p: GeneratedProblem): [string, string][] {
  const r = work(p);
  if (r.mode === "order") {
    const order = JSON.parse(p.answer) as string[];
    return order.map((id) => {
      const row = r.rows.find((x) => x.id === id)!;
      return [row.fields[0]!.given!, row.fields[1]!.given!];
    });
  }
  const key = JSON.parse(p.answer) as string[][];
  return r.rows.map((row, i) => [
    row.fields[0]!.given ?? key[i]![0]!,
    row.fields[1]!.given ?? key[i]![1]!,
  ]);
}

/* --------------------------------------------------------------- tests */

const fill = parallelogramProofCases["parallelogram-proof-fill"];
const order = parallelogramProofCases["parallelogram-proof-order"];
const reasoning = parallelogramProofCases["parallelogram-converse-reasoning"];

test("deterministic, valid, and every proof, fill kind and task reachable", () => {
  for (const t of parallelogramProofTemplates)
    for (let i = 0; i < 40; i++) {
      const a = parallelogramProofGenerate(t.id, `det-${i}`);
      assert.deepEqual(a, parallelogramProofGenerate(t.id, `det-${i}`));
      generatedProblemSchema.parse(a);
      assert.ok(a.hint.length > 40 && a.explanation.length >= 2);
    }
  const fills = new Map<string, number>();
  const orders = new Set<string>();
  const tasks = new Set<string>();
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const f = fill(`reach-${i}`);
    const kind = f.axes.fill;
    fills.set(
      `${kind}:${f.model.proof}`,
      (fills.get(`${kind}:${f.model.proof}`) ?? 0) + 1,
    );
    orders.add(order(`reach-${i}`).model.proof);
    tasks.add(reasoning(`reach-${i}`).model.task);
  }
  for (const id of proofIds) assert.ok(fills.has(`reasons:${id}`), id);
  for (const id of ["a", "c", "d", "e", "f", "g"])
    assert.ok(fills.has(`statement:${id}`), id);
  const statement = [...fills]
    .filter(([k]) => k.startsWith("statement"))
    .reduce((s, [, n]) => s + n, 0);
  assert.ok(
    Math.abs(statement / N - 0.3) < 0.05,
    `statement share ${statement / N}`,
  );
  assert.deepEqual([...orders].sort(), [...proofIds].sort());
  assert.deepEqual([...tasks].sort(), [
    "counterexample",
    "enough",
    "explanation",
    "flaw-circular",
    "flaw-cpctc-early",
    "flaw-criterion",
    "flaw-direction",
    "flaw-false-theorem",
  ]);
});

test("every statement in a bank is true for the drawn figure exactly when the claims justify it", () => {
  let checked = 0;
  for (let i = 0; i < 600; i++)
    for (const make of [fill, order]) {
      const p = make(`truth-${i}`).problem;
      const r = work(p);
      const at = pointsOf(sceneOf(p));
      const claims = (p.workGrading as Extract<WorkGrading, { mode: "proof" }>)
        .claims;
      for (const o of r.banks[0]!.options) {
        const claimed = Object.keys(claims[o.id] ?? {}).length > 0;
        assert.equal(
          truth(o.label, at),
          claimed,
          `${p.public.seed} ${o.label}`,
        );
        checked++;
      }
      // Pairs a line names as alternate interior or vertical really are.
      for (const [s, reason] of workedRows(p)) {
        const text = label(r, "statements", s);
        const why = label(r, "reasons", reason);
        if (why === REASONS.altInt)
          for (const [x, y] of anglePairs(text))
            assert.ok(alternateInterior(x, y, at), `${text} alt int`);
        if (why === REASONS.vertical)
          for (const [x, y] of anglePairs(text))
            assert.ok(vertical(x, y, at), `${text} vertical`);
        // The CPCTC angle pairs of a converse proof are the alternate
        // interior angles its next line turns into parallel sides.
        if (
          why === REASONS.cpctc &&
          /parallelogram/.test(r.goal!) &&
          anglePairs(text).length === 2
        )
          for (const [x, y] of anglePairs(text))
            assert.ok(alternateInterior(x, y, at), `${text} cpctc alt int`);
      }
    }
  assert.ok(checked > 5000);
});

test("each worked line has its expected reason, and every other reason in the bank fails it", () => {
  for (let i = 0; i < 400; i++) {
    const p = fill(`reasons-${i}`, { fill: "reasons" }).problem;
    const id = proofOfProblem(p);
    const r = work(p);
    const rows = workedRows(p);
    assert.deepEqual(
      rows.map(([, reason]) => label(r, "reasons", reason)),
      expected[id].reasons,
    );
    const key = JSON.parse(p.answer) as string[][];
    const blanks = key.flatMap((row, k) => (row[1] ? [k] : []));
    assert.ok(blanks.length >= 2 && blanks.length <= 3);
    assert.equal(
      new Set(blanks.map((k) => key[k]![1])).size,
      blanks.length,
      "two blanks never share a reason",
    );
    for (const k of blanks) {
      assert.notEqual(expected[id].reasons[k], REASONS.given);
      assert.notEqual(expected[id].reasons[k], REASONS.reflexive);
      for (const o of r.banks[1]!.options) {
        const tryKey = key.map((row) => [...row]);
        tryKey[k]![1] = o.id;
        const credited = gradeStructuredWork(
          r,
          p.workGrading!,
          JSON.stringify(tryKey),
        );
        assert.equal(
          credited,
          o.id === key[k]![1],
          `${id} line ${k + 1}: ${o.label}`,
        );
        if (circular[id].includes(o.label)) assert.equal(credited, false);
      }
    }
    // Converse proofs always offer a circular reason, and the theorem
    // proofs offer the theorem they prove.
    const labels = r.banks[1]!.options.map((o) => o.label);
    assert.ok(
      labels.some((l) => circular[id].includes(l)),
      `${id} circular`,
    );
    if (id === "c") assert.ok(labels.includes(REASONS.diagBisect));
    if (id === "f") assert.ok(labels.includes(REASONS.rectDiag));
    if (id === "f" || id === "g") assert.ok(labels.includes(REASONS.perpDiag));
    assert.ok(labels.length <= 12 && labels.length >= blanks.length + 4);
    assert.ok(structuredWorkGuessChance(r, p.workGrading!) < 0.05);
  }
});

test("a statement blank has exactly one statement its reason justifies there", () => {
  let seen = 0;
  for (let i = 0; i < 300; i++) {
    const p = fill(`statement-${i}`, { fill: "statement" }).problem;
    const r = work(p);
    const key = JSON.parse(p.answer) as string[][];
    const k = key.findIndex((row) => row[0] !== "");
    assert.ok(k >= 0);
    assert.equal(r.rows[k]!.fields[0]!.given, undefined);
    assert.ok(r.rows[k]!.fields[1]!.given);
    // The blank is never the line the Prove already shows.
    assert.notEqual(label(r, "statements", key[k]![0]!), r.goal);
    const reason = label(r, "reasons", r.rows[k]!.fields[1]!.given!);
    assert.ok(
      [
        REASONS.vertical,
        REASONS.altInt,
        REASONS.cpctc,
        REASONS.asa,
        REASONS.sas,
        REASONS.sss,
      ].includes(reason as never),
    );
    const credited = r.banks[0]!.options.filter((o) => {
      const tryKey = key.map((row) => [...row]);
      tryKey[k]![0] = o.id;
      return gradeStructuredWork(r, p.workGrading!, JSON.stringify(tryKey));
    });
    assert.deepEqual(
      credited.map((o) => o.id),
      [key[k]![0]],
    );
    // Three wrong statements beside the proof's own.
    assert.ok(r.banks[0]!.options.length >= r.rows.length + 3);
    // A blind pick succeeds at most 4 times in 9 by the engine's bound, the
    // common case (a third-line blank with three wrong statements), so the
    // family's sampled chance is never understated by a rare instance.
    assert.ok(structuredWorkGuessChance(r, p.workGrading!) <= 4 / 9 + 1e-12);
    seen++;
  }
  assert.equal(seen, 300);
});

test("an ordering credits exactly the orders its dependencies allow", () => {
  for (const id of proofIds)
    for (let i = 0; i < 6; i++) {
      const p = order(`order-${id}-${i}`, { proof: id }).problem;
      const r = work(p);
      const n = r.rows.length;
      // Identify each shown row by its place in the worked order.
      const worked = JSON.parse(p.answer) as string[];
      const place = new Map(worked.map((rowId, k) => [rowId, k + 1]));
      const valid = (seq: string[]) =>
        seq.every((rowId, pos) =>
          expected[id].needs[place.get(rowId)! - 1]!.every(
            (need) => seq.indexOf(worked[need - 1]!) < pos,
          ),
        ) && place.get(seq.at(-1)!) === n;
      let credited = 0;
      for (const seq of permutations(r.rows.map((x) => x.id))) {
        const ok = gradeStructuredWork(r, p.workGrading!, JSON.stringify(seq));
        assert.equal(ok, valid(seq), `${id} ${seq.join(",")}`);
        if (ok) credited++;
      }
      assert.ok(credited >= 1);
      // Shown order: not valid, at least half the lines displaced.
      const shown = r.rows.map((x) => x.id);
      assert.equal(
        gradeStructuredWork(r, p.workGrading!, JSON.stringify(shown)),
        false,
      );
      const displaced = shown.filter(
        (rowId, pos) => place.get(rowId) !== pos + 1,
      ).length;
      assert.ok(displaced >= Math.ceil(n / 2));
      // The Given line is never shown first.
      assert.notEqual(
        label(r, "reasons", r.rows[0]!.fields[1]!.given!),
        REASONS.given,
      );
      // Repeats and omissions are rejected.
      assert.equal(
        gradeStructuredWork(
          r,
          p.workGrading!,
          JSON.stringify([...worked.slice(0, -1), worked[0]]),
        ),
        false,
      );
      assert.ok(structuredWorkGuessChance(r, p.workGrading!) <= 0.5);
    }
  // Across many seeds the Given line is never the first line shown.
  for (let i = 0; i < 400; i++) {
    const r = work(order(`given-first-${i}`).problem);
    assert.notEqual(
      label(r, "reasons", r.rows[0]!.fields[1]!.given!),
      REASONS.given,
      `seed ${i}`,
    );
  }
  // Alternative orders really occur: the reflexive line of proof A may come
  // before the angle lines.
  const a = order("order-alt", { proof: "a" }).problem;
  const worked = JSON.parse(a.answer) as string[];
  const moved = [
    worked[0]!,
    worked[3]!,
    worked[1]!,
    worked[2]!,
    worked[4]!,
    worked[5]!,
  ];
  assert.ok(
    gradeStructuredWork(work(a), a.workGrading!, JSON.stringify(moved)),
  );
});

test("the statements hold for every layout: four label sets, eight placements, all sizes", async () => {
  const { rolePoints, lettersOf, relabel } =
    await import("../src/math/parallelogram-proof-practice");
  let checked = 0;
  for (const id of proofIds) {
    const proof = proofOf(id);
    const rect = id === "f" || id === "g";
    for (let w = 7; w <= 10; w++)
      for (let h = 4; h <= 6; h++)
        for (const s of rect ? [0] : [-3, -2, 2, 3])
          for (let start = 0; start < 4; start++)
            for (const flip of [false, true])
              for (let set = 0; set < 4; set++) {
                const pts = rolePoints({ w, h, s, start, flip, set });
                const L = lettersOf(set);
                const at = new Map<string, P>(
                  (["A", "B", "C", "D", "E"] as const).map((k) => [
                    L[k],
                    pts[k],
                  ]),
                );
                for (const line of proof.lines) {
                  assert.ok(
                    truth(relabel(line.tex, L), at),
                    `${id} ${line.tex}`,
                  );
                  checked++;
                }
                for (const wrong of Object.values(
                  proof.statementBlanks,
                ).flat()) {
                  const claimed = Object.keys(wrong!.claim).length > 0;
                  assert.equal(
                    truth(relabel(wrong!.tex, L), at),
                    claimed,
                    `${id} ${wrong!.tex}`,
                  );
                }
              }
  }
  assert.ok(checked > 10000);
});

test("find the flaw: exactly one altered line, and it is the answer", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const c = reasoning(`flaw-${i}`);
    if (!c.model.task.startsWith("flaw-")) continue;
    const p = c.problem;
    const lines = p.public.prompt.split("\n").filter((l) => /^\d+\. /.test(l));
    const r = p.public.response;
    assert.equal(r.kind, "choice");
    if (r.kind !== "choice") continue;
    const answer = r.options.find((o) => o.id === p.answer)!.label;
    const k = Number(answer.replace("Line ", ""));
    // The flawed line's reason is never the expected reason for its
    // statement, or the line sits above the line it needs.
    const reasonOf = (l: string) => l.slice(l.lastIndexOf(" — ") + 3, -1);
    const bad = lines[k - 1]!;
    const flawText = reasonOf(bad);
    seen.add(c.model.task);
    assert.ok(lines.length >= 5);
    if (c.model.task === "flaw-cpctc-early") {
      assert.equal(flawText, REASONS.cpctc);
      assert.match(reasonOf(lines[k]!), /^(SSS|SAS|ASA)$/);
    } else
      assert.ok(
        [
          REASONS.altInt,
          REASONS.oppSides,
          REASONS.diagBisect,
          REASONS.defPar,
          REASONS.sas,
          REASONS.asa,
          REASONS.ssa,
          REASONS.consecCong,
        ].includes(flawText as never),
      );
    assert.equal(r.options.length, 4);
    assert.ok(r.options.every((o) => /^Line \d$/.test(o.label)));
  }
  assert.equal(seen.size, 5);
  // A flaw case changes one line's reason, or swaps two adjacent lines.
  const changed = (
    proof: ProofId,
    line: string,
    reason?: keyof typeof REASONS,
    swap?: true,
  ) => {
    const { lines, bad } = flawedLines({
      proof,
      line,
      ...(reason ? { reason } : {}),
      ...(swap ? { swap } : {}),
      why: "",
    });
    const canonical = proofOf(proof).path;
    const diff = lines.filter(
      (x, i) => x.key !== canonical[i]![0] || x.reason !== canonical[i]![1],
    );
    return { diff: diff.length, bad };
  };
  assert.equal(changed("d", "par", "altInt").diff, 1);
  assert.equal(changed("a", "goal", undefined, true).diff, 2);
  assert.equal(changed("a", "goal", undefined, true).bad, 4);
});

test("enough to prove a parallelogram: every insufficient fact has a true counterexample", () => {
  type Q = [P, P, P, P];
  const facts: Record<string, (q: Q) => boolean> = {
    sides: ([A, B, C, D]) =>
      Math.abs(d(A, B) - d(C, D)) < EPS && Math.abs(d(A, D) - d(B, C)) < EPS,
    diagonals: ([A, B, C, D]) =>
      d(
        [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2],
        [(B[0] + D[0]) / 2, (B[1] + D[1]) / 2],
      ) < EPS,
    "one-pair": ([A, B, C, D]) =>
      parallel(A, B, C, D) && Math.abs(d(A, B) - d(C, D)) < EPS,
    angles: ([A, B, C, D]) =>
      Math.abs(angle(D, A, B) - angle(B, C, D)) < EPS &&
      Math.abs(angle(A, B, C) - angle(C, D, A)) < EPS,
    definition: ([A, B, C, D]) => parallel(A, B, C, D) && parallel(A, D, B, C),
    "leg-base": ([A, B, C, D]) =>
      Math.abs(d(A, B) - d(C, D)) < EPS && parallel(A, D, B, C),
    "base-leg": ([A, B, C, D]) =>
      parallel(A, B, C, D) && Math.abs(d(A, D) - d(B, C)) < EPS,
    "equal-diagonals": ([A, B, C, D]) => Math.abs(d(A, C) - d(B, D)) < EPS,
    "one-side-pair": ([A, B, C, D]) => Math.abs(d(A, B) - d(C, D)) < EPS,
    "one-angle-pair": ([A, B, C, D]) =>
      Math.abs(angle(D, A, B) - angle(B, C, D)) < EPS,
    perpendicular: ([A, B, C, D]) => Math.abs(dot(v(A, C), v(B, D))) < EPS,
  };
  const pool = notEnoughFacts.map((f) => f.example as unknown as Q);
  for (const f of notEnoughFacts) {
    const q = f.example as unknown as Q;
    assert.ok(facts[f.key]!(q), `${f.key} fits its counterexample`);
    assert.equal(
      isParallelogram(q),
      false,
      `${f.key} counterexample is not a parallelogram`,
    );
  }
  for (const f of enoughFacts)
    for (const q of pool)
      assert.ok(
        !facts[f.key]!(q) || isParallelogram(q),
        `${f.key} has no counterexample`,
      );
  // The prompt asks in both directions, with four distinct options.
  const forms = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const c = reasoning(`enough-${i}`, { task: "enough" });
    forms.add(
      c.problem.public.prompt.includes("is not enough") ? "not" : "enough",
    );
    const r = c.problem.public.response;
    assert.ok(
      r.kind === "choice" && new Set(r.options.map((o) => o.label)).size === 4,
    );
  }
  assert.equal(forms.size, 2);
});

test("counterexample figures: exactly one fits the condition and breaks the conclusion", () => {
  type Q = [P, P, P, P];
  const pars = (q: Q) => isParallelogram(q);
  const rect = (q: Q) =>
    pars(q) && Math.abs(angle(q[3], q[0], q[1]) - 90) < EPS;
  const fits = {
    "leg-base": (q: Q) =>
      (Math.abs(d(q[0], q[1]) - d(q[2], q[3])) < EPS &&
        parallel(q[0], q[3], q[1], q[2])) ||
      (Math.abs(d(q[0], q[3]) - d(q[1], q[2])) < EPS &&
        parallel(q[0], q[1], q[3], q[2])),
    "equal-diagonals": (q: Q) => Math.abs(d(q[0], q[2]) - d(q[1], q[3])) < EPS,
  };
  const breaks = {
    "leg-base": (q: Q) => !pars(q),
    "equal-diagonals": (q: Q) => !rect(q),
  };
  for (const key of ["leg-base", "equal-diagonals"] as const) {
    const panels = counterexampleClaims[key].panels;
    const counter = panels.filter(
      (x) => fits[key](x.points as Q) && breaks[key](x.points as Q),
    );
    assert.deepEqual(
      counter.map((x) => x.key),
      ["isosceles-trapezoid"],
    );
    assert.equal(counter[0]!.feedback, "");
  }
  for (let i = 0; i < 100; i++) {
    const c = reasoning(`counter-${i}`, { task: "counterexample" });
    const r = c.problem.public.response;
    assert.ok(r.kind === "choice");
    if (r.kind === "choice")
      assert.deepEqual(
        r.options.map((o) => o.label),
        ["Figure 1", "Figure 2", "Figure 3", "Figure 4"],
      );
    assert.equal(Object.keys(c.problem.choiceFeedback ?? {}).length, 3);
  }
});

test("explanations and every choice: four distinct options, one key, feedback for each wrong one", () => {
  const position = [0, 0, 0, 0];
  for (let i = 0; i < 600; i++) {
    const p = reasoning(`choice-${i}`).problem;
    const r = p.public.response;
    assert.ok(r.kind === "choice");
    if (r.kind !== "choice") continue;
    assert.equal(new Set(r.options.map((o) => o.label)).size, 4);
    position[r.options.findIndex((o) => o.id === p.answer)]!++;
    for (const o of r.options)
      if (o.id !== p.answer)
        assert.ok((p.choiceFeedback?.[o.id] ?? "").length > 20, o.label);
  }
  for (const n of position) assert.ok(n > 60, `${position}`);
});
