import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientCanDraw,
  generatedProblemSchema,
  publicProblemSchema,
  responseCapabilities,
} from "../src/math/contracts";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import {
  canonicalPointSet,
  clipLineToGrid,
  draftSlots,
  gradePointPlot,
  latticeOnCurve,
  latticeOnLine,
  onCurve,
  lineThrough,
  moveDraftPoint,
  normalizePointPlot,
  parsePlotDraft,
  plotPoints,
  pointPlotAnswerText,
  pointPlotGuessChance,
  serializePlot,
  toggleDraftPoint,
  type LatticePoint,
  type PointPlotResponse,
} from "../src/math/point-plot";
import { guessChance } from "../src/math/guess-chance";
import { capabilitySchema, packSchema } from "../src/offline/contracts";
import { planMixedPractice } from "../src/server/mixed-practice";
import { skills } from "../src/curriculum/catalog";
import { answerText } from "../src/math/selection-response";

const families = [
  "plot-points",
  "graph-linear-equation",
  "place-transformed-image",
  "graph-quadratic-points",
  "graph-absolute-value-points",
  "graph-exponential-points",
  "graph-sqrt-points",
] as const;
const grid = {
  xMin: -6,
  xMax: 6,
  yMin: -6,
  yMax: 6,
  step: 1,
  xLabel: "x",
  yLabel: "y",
};
const set: PointPlotResponse = {
  kind: "point-plot",
  label: "Plot 3 points",
  grid,
  pointCount: 3,
  ordered: false,
  connect: "none",
};
const ordered: PointPlotResponse = {
  ...set,
  label: "Place A′, B′ and C′",
  ordered: true,
  pointLabels: ["A′", "B′", "C′"],
  connect: "polygon",
};
const line: PointPlotResponse = {
  ...set,
  label: "Place 2 points on the line",
  pointCount: 2,
  connect: "line",
};
const json = (points: (LatticePoint | null)[]) => JSON.stringify(points);

test("exact sets grade by membership, never by placement order", () => {
  const answer = serializePlot(
    [
      [3, -2],
      [0, 4],
      [-5, 0],
    ],
    false,
  );
  assert.equal(answer, "[[-5,0],[0,4],[3,-2]]");
  const grade = (raw: string) =>
    gradePointPlot(set, { mode: "exact" }, answer, raw);
  assert.equal(
    grade(
      json([
        [0, 4],
        [3, -2],
        [-5, 0],
      ]),
    ),
    true,
  );
  assert.equal(
    grade(
      json([
        [-5, 0],
        [0, 4],
        [3, -2],
      ]),
    ),
    true,
  );
  // Swapped coordinates, a near miss and a sign error are wrong.
  assert.equal(
    grade(
      json([
        [0, 4],
        [-2, 3],
        [-5, 0],
      ]),
    ),
    false,
  );
  assert.equal(
    grade(
      json([
        [0, 4],
        [3, -1],
        [-5, 0],
      ]),
    ),
    false,
  );
  assert.equal(
    grade(
      json([
        [0, 4],
        [3, 2],
        [-5, 0],
      ]),
    ),
    false,
  );
  assert.equal(
    normalizePointPlot(
      set,
      json([
        [0, 4],
        [3, -2],
        [-5, 0],
      ]),
    ),
    answer,
  );
});

test("ordered answers grade each labeled slot and reject any reordering", () => {
  const answer = json([
    [-2, 1],
    [-2, 4],
    [-5, 1],
  ]);
  assert.equal(normalizePointPlot(ordered, answer), answer);
  const grade = (raw: string) =>
    gradePointPlot(ordered, { mode: "exact" }, answer, raw);
  assert.equal(grade(answer), true);
  assert.equal(
    grade(
      json([
        [-2, 4],
        [-2, 1],
        [-5, 1],
      ]),
    ),
    false,
  );
  assert.equal(
    grade(
      json([
        [-5, 1],
        [-2, 4],
        [-2, 1],
      ]),
    ),
    false,
  );
  // An empty slot is a draft, never a submission.
  assert.equal(
    normalizePointPlot(ordered, json([[-2, 1], null, [-5, 1]])),
    null,
  );
});

test("on-line grading accepts any distinct lattice points of the line and nothing else", () => {
  // y = 2x - 1, stored as 2x - y = 1.
  const grading = { mode: "on-line" as const, a: 2, b: -1, c: 1 };
  const answer = json([
    [0, -1],
    [1, 1],
  ]);
  const grade = (raw: string) => gradePointPlot(line, grading, answer, raw);
  for (const pair of [
    [
      [0, -1],
      [1, 1],
    ],
    [
      [2, 3],
      [-2, -5],
    ],
    [
      [3, 5],
      [1, 1],
    ],
  ] as LatticePoint[][])
    assert.equal(grade(json(pair)), true, json(pair));
  assert.equal(
    grade(
      json([
        [0, -1],
        [1, 2],
      ]),
    ),
    false,
  );
  assert.equal(
    grade(
      json([
        [0, 1],
        [1, 3],
      ]),
    ),
    false,
    "parallel line",
  );
  assert.equal(
    grade(
      json([
        [0, -1],
        [0, -1],
      ]),
    ),
    false,
    "one point twice",
  );
  assert.equal(grade(json([[0, -1]])), false, "too few");
  assert.equal(
    grade(
      json([
        [0, -1],
        [1, 1],
        [2, 3],
      ]),
    ),
    false,
    "too many",
  );
  // Equivalent coefficients describe the same line.
  const scaled = { mode: "on-line" as const, a: -4, b: 2, c: -2 };
  assert.equal(
    gradePointPlot(
      line,
      scaled,
      answer,
      json([
        [2, 3],
        [3, 5],
      ]),
    ),
    true,
  );
  assert.deepEqual(lineThrough([0, -1], [1, 1]), { a: 2, b: -1, c: 1 });
  assert.deepEqual(lineThrough([1, 1], [0, -1]), { a: 2, b: -1, c: 1 });
  assert.deepEqual(lineThrough([4, 2], [-1, 2]), { a: 0, b: 1, c: 2 });
  assert.deepEqual(
    latticeOnLine(grid, { a: 2, b: -1, c: 1 }).map((p) => p.join(",")),
    ["-2,-5", "-1,-3", "0,-1", "1,1", "2,3", "3,5"],
  );
});

test("duplicates, off-grid, off-lattice and malformed responses are invalid, not wrong", () => {
  for (const raw of [
    json([
      [0, 4],
      [0, 4],
      [3, -2],
    ]),
    json([
      [0, 4],
      [7, 0],
      [3, -2],
    ]),
    json([
      [0, 4],
      [0, -7],
      [3, -2],
    ]),
    json([
      [0, 4],
      [0.5, 1],
      [3, -2],
    ]),
    json([
      [0, 4],
      [3, -2],
    ]),
    json([
      [0, 4],
      [3, -2],
      [1, 1],
      [2, 2],
    ]),
    json([[0, 4], null, [3, -2]]),
    "[[0,4],[3,-2],[1]]",
    '[["0","4"],[3,-2],[1,1]]',
    "{}",
    "",
    "not json",
    " ".repeat(101),
  ]) {
    assert.equal(normalizePointPlot(set, raw), null, raw);
    assert.equal(
      gradePointPlot(set, { mode: "exact" }, "[[0,4],[1,1],[3,-2]]", raw),
      false,
    );
  }
  const stepped = { ...set, grid: { ...grid, xMin: -6, xMax: 6, step: 2 } };
  assert.equal(
    normalizePointPlot(
      stepped,
      json([
        [0, 4],
        [2, 2],
        [4, -2],
      ]),
    ),
    "[[0,4],[2,2],[4,-2]]",
  );
  assert.equal(
    normalizePointPlot(
      stepped,
      json([
        [0, 4],
        [1, 2],
        [4, -2],
      ]),
    ),
    null,
  );
  assert.equal(
    parsePlotDraft(
      json([
        [1, 1],
        [1, 1],
      ]),
    ),
    null,
  );
  assert.deepEqual(parsePlotDraft(""), []);
});

test("drafts toggle, move and keep labeled slots without duplicates", () => {
  let draft = "";
  draft = toggleDraftPoint(ordered, draft, [1, 1]);
  draft = toggleDraftPoint(ordered, draft, [2, 2]);
  assert.equal(draft, "[[1,1],[2,2],null]");
  draft = toggleDraftPoint(ordered, draft, [1, 1]);
  assert.equal(draft, "[null,[2,2],null]");
  // The next point fills the first empty slot (A′ again).
  draft = toggleDraftPoint(ordered, draft, [3, 3]);
  assert.equal(draft, "[[3,3],[2,2],null]");
  draft = moveDraftPoint(ordered, draft, [2, 2], [3, 3]);
  assert.equal(
    draft,
    "[[3,3],[2,2],null]",
    "a move onto a placed point is refused",
  );
  draft = moveDraftPoint(ordered, draft, [2, 2], [-4, 5]);
  assert.equal(draft, "[[3,3],[-4,5],null]");
  draft = toggleDraftPoint(ordered, draft, [0, 0]);
  assert.equal(toggleDraftPoint(ordered, draft, [1, 2]), draft, "full draft");
  assert.equal(toggleDraftPoint(ordered, draft, [9, 9]), draft, "off grid");
  let points = "";
  for (const p of [
    [2, 1],
    [-1, 0],
    [0, 3],
  ] as LatticePoint[])
    points = toggleDraftPoint(set, points, p);
  assert.equal(points, "[[-1,0],[0,3],[2,1]]");
  assert.deepEqual(draftSlots(set, points).length, 3);
  assert.equal(toggleDraftPoint(set, points, [5, 5]), points);
  assert.equal(
    toggleDraftPoint(set, toggleDraftPoint(set, points, [0, 3]), [0, 3]),
    points,
  );
  assert.equal(
    canonicalPointSet("[[2,1],[-1,0]]"),
    canonicalPointSet("[[-1,0],[2,1]]"),
  );
  assert.equal(canonicalPointSet("[[2,1],null]"), null);
});

test("readable answers name the line or the labeled images, never the transport format", () => {
  assert.equal(
    pointPlotAnswerText(line, "[[0,-1],[1,1]]"),
    "the line through $(0, -1)$ and $(1, 1)$",
  );
  assert.equal(
    answerText(ordered, "[[-2,1],[-2,4],[-5,1]]"),
    "$A'(-2, 1)$, $B'(-2, 4)$ and $C'(-5, 1)$",
  );
  assert.throws(() => answerText(ordered, "[[-2,1],null,[-5,1]]"));
  assert.deepEqual(clipLineToGrid(grid, [0, -1], [1, 1]), [
    [-2.5, -6],
    [3.5, 6],
  ]);
});

test("every family is reachable, valid, self-consistent and leaks no grading data", () => {
  for (const id of families) {
    const template = templates.find((t) => t.id === id);
    assert.ok(template, id);
    assert.equal(template.requiredResponseCapability, "point-plot-v1");
    const prompts = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const problem = generateProblem(id, `point-plot-${i}`);
      generatedProblemSchema.parse(problem);
      publicProblemSchema.parse(problem.public);
      prompts.add(problem.public.prompt);
      const response = problem.public.response;
      assert.equal(response.kind, "point-plot");
      if (response.kind !== "point-plot") continue;
      assert.ok(problem.pointGrading);
      // The public payload carries no answer, grading rule or worked figure.
      const pub = JSON.stringify(problem.public);
      for (const secret of [
        "pointGrading",
        "answer",
        "walkthrough",
        "on-line",
        "on-curve",
        "exact",
      ])
        assert.equal(pub.includes(`"${secret}"`), false, `${id}: ${secret}`);
      if (id !== "plot-points")
        assert.equal(pub.includes(problem.answer), false, `${id} answer leak`);
      assert.equal(problem.public.figure, undefined);
      // The stored answer passes its own grader and the engine.
      assert.equal(isValidResponse(problem.public, problem.answer), true);
      assert.equal(gradeAnswer(problem, problem.answer), true);
      const points = plotPoints(problem.answer);
      if (!response.ordered) {
        assert.equal(
          gradeAnswer(problem, JSON.stringify([...points].reverse())),
          true,
        );
      } else if (points.length > 1) {
        const swapped = [points[1], points[0], ...points.slice(2)];
        assert.equal(gradeAnswer(problem, JSON.stringify(swapped)), false);
      }
      if (problem.pointGrading.mode === "on-line") {
        const all = latticeOnLine(response.grid, problem.pointGrading);
        assert.ok(all.length >= 3, problem.public.prompt);
        const other = serializePlot([all[0]!, all.at(-1)!], false);
        assert.equal(gradeAnswer(problem, other), true);
        const off: LatticePoint = [
          all[0]![0],
          all[0]![1] + (all[0]![1] < 6 ? 1 : -1),
        ];
        if (!all.some((p) => p[0] === off[0] && p[1] === off[1]))
          assert.equal(
            gradeAnswer(problem, serializePlot([all[1]!, off], false)),
            false,
          );
      } else if (problem.pointGrading.mode === "on-curve") {
        const { curve, required = [] } = problem.pointGrading;
        const all = latticeOnCurve(response.grid, curve);
        assert.ok(all.length >= 3, problem.public.prompt);
        // Every accepted set grades correct; one off-curve point never does.
        const feature = required.map((p) => serializePlot([p], false));
        const others = all.filter(
          (p) => !required.some((q) => q[0] === p[0] && q[1] === p[1]),
        );
        const accepted = [...required, ...others].slice(0, 3);
        assert.equal(
          gradeAnswer(problem, serializePlot(accepted, false)),
          true,
          problem.public.prompt,
        );
        const off: LatticePoint = [accepted[0]![0], accepted[0]![1] + 1];
        if (
          !onCurve(curve, off) &&
          isValidResponse(
            problem.public,
            serializePlot([off, ...accepted.slice(1)], false),
          )
        )
          assert.equal(
            gradeAnswer(
              problem,
              serializePlot([off, ...accepted.slice(1)], false),
            ),
            false,
          );
        // A required feature point cannot be swapped for another curve point.
        if (required.length && others.length >= 3) {
          const without = others.slice(0, 3);
          assert.equal(
            gradeAnswer(problem, serializePlot(without, false)),
            false,
            `${problem.public.prompt}: ${feature}`,
          );
        }
      } else {
        // Moving any one point by one unit makes the answer wrong.
        const moved = points.map((p, j) =>
          j === 0 ? ([p[0] + (p[0] < 6 ? 1 : -1), p[1]] as LatticePoint) : p,
        );
        const raw = serializePlot(moved, response.ordered);
        if (isValidResponse(problem.public, raw))
          assert.equal(gradeAnswer(problem, raw), false);
      }
      assert.equal(gradeAnswer(problem, "[]"), false);
    }
    // Lines are fewer: a 13-by-13 window holds a bounded set of graphable lines.
    const least =
      id === "graph-exponential-points"
        ? 10
        : id === "graph-sqrt-points"
          ? 100
          : id === "graph-quadratic-points" ||
              id === "graph-absolute-value-points"
            ? 200
            : id === "graph-linear-equation"
              ? 150
              : 250;
    assert.ok(prompts.size > least, `${id}: ${prompts.size} distinct prompts`);
  }
});

test("a grading rule must accept the stored answer and appear only on point plots", () => {
  const problem = generateProblem("graph-linear-equation", "contract");
  assert.equal(generatedProblemSchema.safeParse(problem).success, true);
  const { pointGrading, ...withoutRule } = problem;
  assert.ok(pointGrading);
  assert.equal(generatedProblemSchema.safeParse(withoutRule).success, false);
  assert.equal(
    generatedProblemSchema.safeParse({
      ...problem,
      pointGrading: { mode: "on-line", a: 1, b: 1, c: 100 },
    }).success,
    false,
  );
  assert.equal(
    generatedProblemSchema.safeParse({ ...problem, answer: "[[0,0],[0,0]]" })
      .success,
    false,
  );
  const typed = generateProblem("count-objects", "contract");
  assert.equal(
    generatedProblemSchema.safeParse({
      ...typed,
      pointGrading: { mode: "exact" },
    }).success,
    false,
  );
  assert.equal(
    publicProblemSchema.safeParse({ ...problem.public, pointGrading }).success,
    false,
  );
  // An ordered response must label every slot; a line needs two unordered points.
  const bad = (response: object) =>
    publicProblemSchema.safeParse({ ...problem.public, response }).success;
  assert.equal(bad({ ...ordered, pointLabels: ["A′", "B′"] }), false);
  assert.equal(
    bad({ ...line, ordered: true, pointLabels: ["A′", "B′"] }),
    false,
  );
  assert.equal(bad({ ...set, grid: { ...grid, xMax: 30 } }), false);
  assert.equal(bad({ ...set, pointCount: 5 }), false);
  assert.equal(bad(set), true);
});

test("clients without point-plot-v1 are never served these families, online or offline", () => {
  const plotTemplates = templates.filter((t) =>
    families.includes(t.id as (typeof families)[number]),
  );
  assert.equal(plotTemplates.length, families.length);
  assert.deepEqual(
    [...responseCapabilities],
    ["single-choice-v1", "multi-select-v1", "point-plot-v1"],
  );
  for (const client of [
    { responseCapabilities: [], figureCapabilities: [] },
    { responseCapabilities: ["single-choice-v1"], figureCapabilities: [] },
    {
      responseCapabilities: ["single-choice-v1", "multi-select-v1"],
      figureCapabilities: ["scenes-v1"],
    },
  ]) {
    for (const t of plotTemplates)
      assert.equal(clientCanDraw(t, client), false);
    const supported = templates.filter((t) => clientCanDraw(t, client));
    for (let seed = 0; seed < 20; seed++) {
      const plan = planMixedPractice({
        templates: supported,
        skills,
        attempts: [],
        evidence: [],
        count: 5,
        seed: `negotiation-${seed}`,
        learnerKey: "learner",
      });
      for (const choice of plan)
        assert.equal(
          choice.template.requiredResponseCapability === "point-plot-v1",
          false,
        );
    }
  }
  for (const t of plotTemplates)
    assert.equal(
      clientCanDraw(t, {
        responseCapabilities: ["point-plot-v1"],
        figureCapabilities: [],
      }),
      true,
    );
  // Offline packs never declare it, and grader v1 rejects a plotted item.
  assert.equal(
    capabilitySchema.safeParse({ responseCapabilities: ["point-plot-v1"] })
      .success,
    false,
  );
  const problem = generateProblem("plot-points", "offline");
  const pack = {
    format: "amp-offline-v1",
    serviceId: "https://example.invalid",
    accountBinding: "a".repeat(64),
    authorization: {
      consentRevision: "b".repeat(64),
      grantBinding: "c".repeat(64),
    },
    packId: "00000000-0000-4000-8000-000000000001",
    learnerId: "00000000-0000-4000-8000-000000000002",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T01:00:00.000Z",
    selectionPolicy: "mixed-five-three-variants-v1",
    evidence: "offline-provisional",
    capabilities: {
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities: [],
    },
    items: [
      {
        problem: problem.public,
        graderVersion: 1,
        reason: "frontier",
        strand: "geometry",
        selfCheck: {
          answer: problem.answer,
          hint: problem.hint,
          explanation: problem.explanation,
        },
      },
    ],
  };
  assert.equal(packSchema.safeParse(pack).success, false);
});

test("blind placement has a tiny, never understated chance of being graded correct", () => {
  // One exact 3-point set among C(169, 3); any pair on a line of at most 13 lattice points.
  assert.ok(Math.abs(pointPlotGuessChance(set) - 1 / 790244) < 1e-12);
  assert.ok(Math.abs(pointPlotGuessChance(line) - 78 / 14196) < 1e-12);
  assert.ok(pointPlotGuessChance(ordered) < pointPlotGuessChance(set));
  for (const id of families) {
    const template = templates.find((t) => t.id === id)!;
    const chance = guessChance(template);
    assert.ok(chance > 0 && chance < 0.01, `${id}: ${chance}`);
    for (let i = 0; i < 40; i++) {
      const p = generateProblem(id, `guess-${i}`);
      if (
        p.public.response.kind !== "point-plot" ||
        p.pointGrading?.mode !== "on-line"
      )
        continue;
      // The bound covers the actual number of accepted pairs.
      const m = latticeOnLine(p.public.response.grid, p.pointGrading).length;
      assert.ok(chance >= (m * (m - 1)) / 2 / 14196 - 1e-12);
    }
  }
});

test("hints teach the first move without placing an answer point", () => {
  for (const id of [
    "graph-linear-equation",
    "place-transformed-image",
    ...families.slice(3),
  ]) {
    for (let i = 0; i < 300; i++) {
      const problem = generateProblem(id, `hint-${i}`);
      const pair = ([x, y]: LatticePoint) => `(${x}, ${y})`;
      for (const p of plotPoints(problem.answer))
        if (!problem.public.prompt.includes(pair(p)))
          assert.equal(
            problem.hint.includes(pair(p)),
            false,
            `${id}: ${problem.hint}`,
          );
    }
  }
});

test("a lesson never works an example whose answer also answers the learner's line", async () => {
  const { problemLesson } = await import("../src/content/problem-lessons");
  let overlapsWithoutGuard = 0;
  for (let i = 0; i < 400; i++) {
    const problem = generateProblem("graph-linear-equation", `x${i}`);
    const pub = problem.public;
    const lesson = problemLesson(
      pub.templateId,
      pub.seed,
      pub.prompt,
      pub.response,
      problem,
    );
    const unguarded = problemLesson(
      pub.templateId,
      pub.seed,
      pub.prompt,
      pub.response,
    );
    for (const [view, guarded] of [
      [lesson, true],
      [unguarded, false],
    ] as const) {
      const example = [0, ...Array.from({ length: 23 }, (_, k) => k + 1)]
        .map((k) => generateProblem(pub.templateId, `${pub.seed}:lesson:${k}`))
        .find((p) => p.public.prompt === view.example.prompt)!;
      const solves = gradeAnswer(problem, example.answer);
      if (guarded)
        assert.equal(solves, false, `${pub.prompt} / ${example.public.prompt}`);
      else if (solves) overlapsWithoutGuard++;
    }
  }
  // The guard matters: equivalent forms of one line do occur.
  assert.ok(overlapsWithoutGuard > 0);
});

test("on-curve grading is exact for every curve kind, with required features and domain limits", () => {
  const curveResponse = (
    grid: PointPlotResponse["grid"],
  ): PointPlotResponse => ({
    kind: "point-plot",
    label: "Place 3 points on the curve",
    grid,
    pointCount: 3,
    ordered: false,
    connect: "curve",
  });
  const r = curveResponse(grid);
  const grade = (
    grading: Parameters<typeof gradePointPlot>[1],
    points: LatticePoint[],
    response = r,
  ) => gradePointPlot(response, grading, "[]", serializePlot(points, false));
  // y = 2(x - 1)^2 - 3, vertex (1, -3)
  const parabola = {
    mode: "on-curve",
    curve: { kind: "quadratic", a: [2, 1], h: [1, 1], k: [-3, 1] },
    required: [[1, -3]],
  } as const;
  assert.equal(
    grade(parabola, [
      [0, -1],
      [1, -3],
      [2, -1],
    ]),
    true,
  );
  assert.equal(
    grade(parabola, [
      [1, -3],
      [3, 5],
      [-1, 5],
    ]),
    true,
  );
  // The right points without the required vertex, or one point off by one.
  assert.equal(
    grade(parabola, [
      [0, -1],
      [2, -1],
      [3, 5],
    ]),
    false,
  );
  assert.equal(
    grade(parabola, [
      [0, -1],
      [1, -3],
      [2, 0],
    ]),
    false,
  );
  // Only the required point is checked: no required list accepts any curve points.
  assert.equal(
    grade({ ...parabola, required: undefined }, [
      [0, -1],
      [2, -1],
      [3, 5],
    ]),
    true,
  );
  // Duplicates and off-grid points are invalid, not accepted.
  assert.equal(
    grade(parabola, [
      [1, -3],
      [1, -3],
      [2, -1],
    ]),
    false,
  );
  assert.equal(
    grade(parabola, [
      [1, -3],
      [2, -1],
      [7, 69],
    ]),
    false,
  );
  // A fractional leading coefficient needs even offsets.
  const half = {
    mode: "on-curve",
    curve: { kind: "quadratic", a: [1, 2], h: [0, 1], k: [0, 1] },
  } as const;
  assert.equal(
    grade(half, [
      [0, 0],
      [2, 2],
      [-2, 2],
    ]),
    true,
  );
  assert.equal(
    grade(half, [
      [0, 0],
      [1, 1],
      [2, 2],
    ]),
    false,
  );
  // Absolute value, both sides of the vertex.
  const v = {
    mode: "on-curve",
    curve: { kind: "absolute", a: [-2, 1], h: [-1, 1], k: [3, 1] },
  } as const;
  assert.equal(
    grade(v, [
      [-1, 3],
      [0, 1],
      [-2, 1],
    ]),
    true,
  );
  assert.equal(
    grade(v, [
      [-1, 3],
      [0, 1],
      [-2, 5],
    ]),
    false,
  );
  // Square roots exist only from the starting point, and only perfect squares are whole.
  const root = {
    mode: "on-curve",
    curve: { kind: "root", a: [2, 1], h: [-3, 1], k: [-1, 1] },
    required: [[-3, -1]],
  } as const;
  assert.equal(
    grade(root, [
      [-3, -1],
      [-2, 1],
      [1, 3],
    ]),
    true,
  );
  assert.equal(
    grade(root, [
      [-3, -1],
      [-2, 1],
      [-1, 2],
    ]),
    false,
  );
  assert.equal(
    grade(root, [
      [-4, 1],
      [-2, 1],
      [1, 3],
    ]),
    false,
  );
  // Exponentials: negative inputs divide, and fractions are not lattice points.
  const wide = { ...grid, xMin: -4, xMax: 4, yMin: -2, yMax: 12 };
  const exp = {
    mode: "on-curve",
    curve: { kind: "exponential", a: [3, 1], b: [1, 2] },
  } as const;
  assert.equal(
    grade(
      exp,
      [
        [-2, 12],
        [-1, 6],
        [0, 3],
      ],
      curveResponse(wide),
    ),
    true,
  );
  assert.equal(
    grade(
      exp,
      [
        [0, 3],
        [1, 2],
        [-1, 6],
      ],
      curveResponse(wide),
    ),
    false,
  );
  assert.equal(
    onCurve({ kind: "exponential", a: [1, 1], b: [2, 1] }, [-1, 0]),
    false,
  );
  // The curve is the same as a line grading would never accept.
  assert.equal(
    grade(parabola, [
      [0, 0],
      [1, 1],
      [2, 2],
    ]),
    false,
  );
});

test("curve families keep their function private and state the required feature in the prompt", () => {
  const seen = new Set<string>();
  for (const id of families.slice(3)) {
    for (let i = 0; i < 200; i++) {
      const problem = generateProblem(id, `curve-${i}`);
      const grading = problem.pointGrading;
      assert.equal(grading?.mode, "on-curve");
      if (grading?.mode !== "on-curve") continue;
      const pub = JSON.stringify(problem.public);
      assert.equal(
        pub.includes('"curve"') && pub.includes('"kind":"quadratic"'),
        false,
      );
      assert.equal(
        problem.public.response.kind === "point-plot" &&
          problem.public.response.connect,
        "curve",
      );
      for (const [x, y] of grading.required ?? []) {
        assert.ok(
          /vertex|intercept|starting point/.test(problem.public.prompt),
          problem.public.prompt,
        );
        assert.ok(
          plotPoints(problem.answer).some((p) => p[0] === x && p[1] === y),
        );
        seen.add(`${id}:required`);
      }
      if (!grading.required) seen.add(`${id}:free`);
      // The worked scene draws the curve; the public problem has no figure.
      assert.ok(problem.walkthrough);
      assert.equal(problem.public.figure, undefined);
    }
  }
  for (const id of families.slice(3)) assert.ok(seen.has(`${id}:free`), id);
  for (const id of [
    "graph-quadratic-points",
    "graph-absolute-value-points",
    "graph-sqrt-points",
  ])
    assert.ok(seen.has(`${id}:required`), id);
});
