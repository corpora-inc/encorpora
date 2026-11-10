import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight";
import { migrate } from "../scripts/migrate";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { generateProblemFor } from "../src/math/engine";
/** The problem as the server generated it for a client that declared no
 * figure capabilities (the batches here send none). Regenerating with the full
 * engine can pick newer variants than the server served. */
const generateServed = (templateId: string, seed: string) =>
  generateProblemFor(templateId, seed, []);

import {
  latticeOnCurve,
  latticeOnLine,
  plotPoints,
  type LatticePoint,
  type PointPlotGrid,
} from "../src/math/point-plot";
import type { PublicProblem } from "../src/math/contracts";

const samePoint = (a: LatticePoint, b: LatticePoint) =>
  a[0] === b[0] && a[1] === b[1];
const pointKey = (p: LatticePoint) => `${p[0]},${p[1]}`;
/** One step past the served window: on the lattice, off this grid. */
const offGridPoint = (grid: PointPlotGrid): LatticePoint => [
  grid.xMax + grid.step,
  grid.yMin,
];
const samePointList = (
  a: readonly LatticePoint[],
  b: readonly LatticePoint[],
) => {
  const sort = (points: readonly LatticePoint[]) =>
    [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const left = sort(a),
    right = sort(b);
  return (
    left.length === right.length &&
    left.every((p, i) => samePoint(p, right[i]!))
  );
};
/** A pair on the line other than the worked answer. */
function alternateLinePair(
  onLine: readonly LatticePoint[],
  exemplar: readonly LatticePoint[],
): [LatticePoint, LatticePoint] {
  for (let i = 0; i < onLine.length; i++)
    for (let j = i + 1; j < onLine.length; j++) {
      const pair: [LatticePoint, LatticePoint] = [onLine[i]!, onLine[j]!];
      if (!samePointList(pair, exemplar)) return pair;
    }
  throw new Error("Line has no lattice pair besides the worked answer");
}
/** A lattice point of this grid that is not on the line. */
function offLinePoint(
  grid: PointPlotGrid,
  onLine: readonly LatticePoint[],
): LatticePoint {
  const on = new Set(onLine.map(pointKey));
  for (let x = grid.xMin; x <= grid.xMax; x += grid.step)
    for (let y = grid.yMin; y <= grid.yMax; y += grid.step)
      if (!on.has(`${x},${y}`)) return [x, y];
  throw new Error("Served grid has no lattice point off the line");
}
type ServedProblem = ReturnType<typeof generateServed>;
function onCurveFacts(problem: PublicProblem, secret: ServedProblem) {
  if (
    problem.response.kind !== "point-plot" ||
    secret.pointGrading?.mode !== "on-curve"
  )
    return null;
  const required = [...(secret.pointGrading.required ?? [])];
  const lattice = latticeOnCurve(
    problem.response.grid,
    secret.pointGrading.curve,
  );
  const others = lattice.filter((p) => !required.some((q) => samePoint(p, q)));
  return {
    required,
    lattice,
    others,
    count: problem.response.pointCount,
    response: problem.response,
  };
}
/** `count` curve points that include every required feature point. */
function correctCurvePoints(
  required: readonly LatticePoint[],
  others: readonly LatticePoint[],
  count: number,
): LatticePoint[] | null {
  if (required.length > count || others.length < count - required.length)
    return null;
  const points = [...required, ...others.slice(0, count - required.length)];
  return new Set(points.map(pointKey)).size === points.length ? points : null;
}
/** `count` curve points that leave out at least one required feature point. */
function curveMissingRequired(
  required: readonly LatticePoint[],
  others: readonly LatticePoint[],
  count: number,
): LatticePoint[] | null {
  if (!required.length || required.length > count) return null;
  const kept = required.slice(0, -1);
  const need = count - kept.length;
  if (others.length < need) return null;
  const points = [...others.slice(0, need), ...kept];
  if (
    points.length !== count ||
    new Set(points.map(pointKey)).size !== count ||
    required.every((point) => points.some((placed) => samePoint(placed, point)))
  )
    return null;
  return points;
}

const url = process.env.AMP_TEST_DATABASE_URL;
assertTestDatabaseTarget(url);
const families = [
  "plot-points",
  "graph-linear-equation",
  "place-transformed-image",
  "graph-quadratic-points",
  "graph-absolute-value-points",
  "graph-exponential-points",
  "graph-sqrt-points",
];

test(
  "point-plot attempts are gated by capability, graded on the server, idempotent and reportable",
  { skip: !url },
  async () => {
    const schema = `amp_point_plot_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url!, max: 1 });
    const scoped = new URL(url!);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
      freeProblems: 20,
    });
    const app = buildApp({
      repository,
      development: true,
      authenticate: async () => "point-plot-test-parent",
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/trials",
        payload: { birthYear: 2012 },
      });
      assert.equal(created.statusCode, 201, created.body);
      const learnerId = created.json().learnerId as string;
      const base = `/api/v1/learners/${learnerId}`;
      const headers = { authorization: `Trial ${created.json().token}` };
      const instances = async () =>
        Number(
          (
            await repository.pool.query(
              "SELECT count(*) FROM amp_instances WHERE learner_id=$1",
              [learnerId],
            )
          ).rows[0].count,
        );
      const attempts = async () =>
        Number(
          (
            await repository.pool.query(
              "SELECT count(*) FROM amp_attempts WHERE learner_id=$1",
              [learnerId],
            )
          ).rows[0].count,
        );
      const batch = (payload: object) =>
        app.inject({
          method: "POST",
          url: base + "/batches",
          headers,
          payload,
        });

      // A client that cannot draw the grid is refused a focused family and
      // nothing is issued; an older client listing a future value is invalid.
      for (const responseCapabilities of [
        [],
        ["single-choice-v1"],
        ["single-choice-v1", "multi-select-v1"],
      ])
        for (const templateId of families) {
          const before = await instances();
          const denied = await batch({
            templateId,
            count: 1,
            responseCapabilities,
            figureCapabilities: ["scenes-v1"],
          });
          assert.equal(denied.statusCode, 400, denied.body);
          assert.equal(await instances(), before);
        }
      assert.equal(
        (
          await batch({
            count: 1,
            responseCapabilities: ["point-plot-v2"],
          })
        ).statusCode,
        400,
      );

      const serve = async (templateId: string): Promise<PublicProblem> => {
        const r = await batch({
          templateId,
          count: 1,
          responseCapabilities: [
            "single-choice-v1",
            "multi-select-v1",
            "point-plot-v1",
          ],
        });
        assert.equal(r.statusCode, 200, r.body);
        const p = r.json().problems[0] as PublicProblem;
        for (const secret of ["answer", "pointGrading", "walkthrough"])
          assert.equal(secret in p, false, secret);
        assert.equal(p.response.kind, "point-plot");
        assert.equal(JSON.stringify(r.json()).includes("pointGrading"), false);
        return p;
      };
      const send = (payload: {
        problemId: string;
        requestId: string;
        response: string;
      }) =>
        app.inject({
          method: "POST",
          url: base + "/attempts",
          headers,
          payload,
        });

      // A graphed line: any two of its lattice points are correct.
      const lineProblem = await serve("graph-linear-equation");
      const lineSecret = generateServed(
        lineProblem.templateId,
        lineProblem.seed,
      );
      assert.equal(lineSecret.pointGrading?.mode, "on-line");
      if (
        lineProblem.response.kind !== "point-plot" ||
        lineSecret.pointGrading?.mode !== "on-line"
      )
        throw new Error("Expected a graphed line");
      const onLine = latticeOnLine(
        lineProblem.response.grid,
        lineSecret.pointGrading,
      );
      const exemplar = plotPoints(lineSecret.answer);
      const alternate = alternateLinePair(onLine, exemplar);
      assert.notDeepEqual(
        [...alternate].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
        exemplar,
      );
      const input = {
        problemId: lineProblem.id,
        requestId: randomUUID(),
        response: JSON.stringify(alternate),
      };
      for (const response of [
        "[]",
        JSON.stringify([alternate[0]]),
        JSON.stringify([alternate[0], alternate[0]]),
        // One step past the served window, so this point is off this grid.
        JSON.stringify([alternate[0], offGridPoint(lineProblem.response.grid)]),
        JSON.stringify([alternate[0], null]),
        JSON.stringify([...alternate, onLine[1]]),
        "malformed",
      ]) {
        const r = await send({ ...input, response });
        assert.equal(r.statusCode, 400, `${response}: ${r.body}`);
        assert.match(r.json().error, /Place 2 different points on the grid/);
      }
      assert.equal(await attempts(), 0);
      const first = await send(input);
      assert.equal(first.statusCode, 200, first.body);
      assert.equal(first.json().correct, true);
      // Stored canonically (sorted), with the worked answer for feedback.
      assert.equal(
        first.json().response,
        JSON.stringify(
          [...alternate].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
        ),
      );
      assert.equal(first.json().answer, lineSecret.answer);
      // A retry with the same points in another order is the same attempt.
      const retry = await send({
        ...input,
        response: JSON.stringify([...alternate].reverse()),
      });
      assert.equal(retry.statusCode, 200, retry.body);
      assert.equal(retry.json().id, first.json().id);
      assert.equal(await attempts(), 1);
      // Reusing the request id for different points is a conflict.
      assert.equal(
        (await send({ ...input, response: lineSecret.answer })).statusCode,
        409,
      );
      assert.equal(
        (await send({ ...input, requestId: randomUUID() })).statusCode,
        409,
        "one attempt per problem",
      );

      // A wrong line is graded incorrect, not rejected.
      const another = await serve("graph-linear-equation");
      const anotherSecret = generateServed(another.templateId, another.seed);
      if (
        another.response.kind !== "point-plot" ||
        anotherSecret.pointGrading?.mode !== "on-line"
      )
        throw new Error("Expected a graphed line");
      const anotherGrid = another.response.grid;
      const anotherCount = another.response.pointCount;
      const anotherOnLine = latticeOnLine(
        anotherGrid,
        anotherSecret.pointGrading,
      );
      const wrongLine: LatticePoint[] = [];
      const used = new Set<string>();
      const addPoint = (point: LatticePoint) => {
        const key = pointKey(point);
        if (used.has(key) || wrongLine.length === anotherCount) return;
        used.add(key);
        wrongLine.push(point);
      };
      // One point off the line, then points of the line, until the plot is full.
      addPoint(offLinePoint(anotherGrid, anotherOnLine));
      for (const point of anotherOnLine) addPoint(point);
      if (wrongLine.length !== anotherCount)
        throw new Error("Cannot place a full wrong answer on the served grid");
      assert.equal(
        wrongLine.every((point) =>
          anotherOnLine.some((on) => samePoint(point, on)),
        ),
        false,
      );
      const off = JSON.stringify(wrongLine);
      const miss = await send({
        problemId: another.id,
        requestId: randomUUID(),
        response: off,
      });
      assert.equal(miss.statusCode, 200, miss.body);
      assert.equal(miss.json().correct, false);

      // Ordered images: the right points under the wrong labels are wrong.
      // Pick an instance whose swapped answer is already in sorted order: the
      // stored response then looks like a set, and the retry check must still
      // treat a reordering as a conflict. Deterministic, not left to the seed.
      const byXY = (a: readonly number[], b: readonly number[]) =>
        a[0]! - b[0]! || a[1]! - b[1]!;
      let image = await serve("place-transformed-image");
      let imageSecret = generateServed(image.templateId, image.seed);
      for (let tries = 1; ; tries++) {
        const pts = plotPoints(imageSecret.answer);
        const swappedPts = [pts[1]!, pts[0]!, ...pts.slice(2)];
        if (
          pts.length >= 2 &&
          swappedPts.every((p, i) => i === 0 || byXY(swappedPts[i - 1]!, p) < 0)
        )
          break;
        if (tries >= 30)
          throw new Error(
            "No place-transformed-image whose swapped labels are already sorted, in 30 serves",
          );
        image = await serve("place-transformed-image");
        imageSecret = generateServed(image.templateId, image.seed);
      }
      const correctImages = plotPoints(imageSecret.answer);
      const swapped = [
        correctImages[1],
        correctImages[0],
        ...correctImages.slice(2),
      ];
      const imageInput = {
        problemId: image.id,
        requestId: randomUUID(),
        response: JSON.stringify(swapped),
      };
      const swappedReply = await send(imageInput);
      assert.equal(swappedReply.statusCode, 200, swappedReply.body);
      assert.equal(swappedReply.json().correct, false);
      assert.equal(
        swappedReply.json().response,
        JSON.stringify([...swapped].sort(byXY)),
        "the swapped answer is stored already sorted",
      );
      assert.equal(swappedReply.json().response, JSON.stringify(swapped));
      // Reusing the request id with the labels reordered is a conflict.
      assert.equal(
        (await send({ ...imageInput, response: imageSecret.answer }))
          .statusCode,
        409,
      );
      assert.equal((await send(imageInput)).json().id, swappedReply.json().id);

      // Exact sets: the given points in any order.
      const plotted = await serve("plot-points");
      const plottedSecret = generateServed(plotted.templateId, plotted.seed);
      const plottedReply = await send({
        problemId: plotted.id,
        requestId: randomUUID(),
        response: JSON.stringify(
          [...plotPoints(plottedSecret.answer)].reverse(),
        ),
      });
      assert.equal(plottedReply.statusCode, 200, plottedReply.body);
      assert.equal(plottedReply.json().correct, true);
      assert.equal(await attempts(), 4);
      const evidence = (
        await repository.pool.query(
          "SELECT skill_id,(state->>'attempts')::int AS attempts FROM amp_skill_evidence WHERE learner_id=$1 ORDER BY skill_id",
          [learnerId],
        )
      ).rows;
      assert.deepEqual(
        evidence.filter((row) =>
          ["coordinate-four-quadrants", "slope", "rigid-motions"].includes(
            row.skill_id,
          ),
        ),
        [
          { skill_id: "coordinate-four-quadrants", attempts: 1 },
          { skill_id: "rigid-motions", attempts: 1 },
          { skill_id: "slope", attempts: 2 },
        ],
      );

      // Lessons for a plotted problem show a solved example, not the problem.
      const pending = await serve("place-transformed-image");
      const lesson = await app.inject({
        method: "POST",
        url: base + "/lesson-support",
        headers,
        payload: { problemId: pending.id },
      });
      assert.equal(lesson.statusCode, 200, lesson.body);
      assert.notEqual(lesson.json().lesson.example.prompt, pending.prompt);
      assert.equal(lesson.json().lesson.example.figure.kind, "scene");
      assert.match(lesson.json().lesson.example.answer, /\$[A-Z]'\(/);

      // A report keeps the point-plot response kind (migration 0064).
      const report = await app.inject({
        method: "POST",
        url: base + "/problem-flags",
        headers,
        payload: {
          problemId: lineProblem.id,
          requestId: randomUUID(),
          reasons: ["confusing-wording"],
          client: { kind: "web", viewport: { width: 390, height: 844 } },
        },
      });
      assert.equal(report.statusCode, 201, report.body);
      const flag = (
        await repository.pool.query(
          "SELECT response_kind,response FROM amp_problem_flags WHERE id=$1",
          [report.json().id],
        )
      ).rows[0];
      assert.equal(flag.response_kind, "point-plot");
      assert.equal(flag.response, first.json().response);

      // A graphed curve: any distinct lattice points of the function, with a
      // required vertex or intercept among them; the function never leaves the server.
      const serveQuadratic = async (
        ready: (facts: NonNullable<ReturnType<typeof onCurveFacts>>) => boolean,
        why: string,
      ) => {
        for (let tries = 1; ; tries++) {
          const problem = await serve("graph-quadratic-points");
          const secret = generateServed(problem.templateId, problem.seed);
          const facts = onCurveFacts(problem, secret);
          if (facts && ready(facts)) return { problem, secret, facts };
          if (tries >= 30)
            throw new Error(`No graph-quadratic-points ${why} in 30 serves`);
        }
      };
      const featured = await serveQuadratic(
        (facts) =>
          facts.response.connect === "curve" &&
          curveMissingRequired(facts.required, facts.others, facts.count) !==
            null &&
          correctCurvePoints(facts.required, facts.others, facts.count) !==
            null,
        "with a required feature and another full set of lattice points",
      );
      const curveProblem = featured.problem;
      assert.equal(curveProblem.response.kind, "point-plot");
      assert.equal(featured.facts.response.connect, "curve");
      assert.equal(JSON.stringify(curveProblem).includes("on-curve"), false);
      const wrongSet = curveMissingRequired(
        featured.facts.required,
        featured.facts.others,
        featured.facts.count,
      );
      if (!wrongSet)
        throw new Error("Required-feature curve has no incomplete lattice set");
      assert.equal(
        wrongSet.every((point) =>
          featured.facts.lattice.some((on) => samePoint(point, on)),
        ),
        true,
      );
      assert.equal(
        featured.facts.required.every((point) =>
          wrongSet.some((placed) => samePoint(placed, point)),
        ),
        false,
      );
      // The right curve without the required feature point is wrong.
      const without = await send({
        problemId: curveProblem.id,
        requestId: randomUUID(),
        response: JSON.stringify(wrongSet),
      });
      assert.equal(without.statusCode, 200, without.body);
      assert.equal(without.json().correct, false);
      assert.equal(await attempts(), 5);
      const curveAnswer = correctCurvePoints(
        featured.facts.required,
        featured.facts.others,
        featured.facts.count,
      );
      if (!curveAnswer)
        throw new Error(
          "Required-feature curve has no complete lattice answer",
        );
      assert.equal(curveAnswer.length, featured.facts.count);
      assert.equal(
        featured.facts.required.every((point) =>
          curveAnswer.some((placed) => samePoint(placed, point)),
        ),
        true,
      );
      // One attempt per problem: a later correct set is a conflict.
      const rejected = await send({
        problemId: curveProblem.id,
        requestId: randomUUID(),
        response: JSON.stringify(curveAnswer),
      });
      assert.equal(rejected.statusCode, 409, rejected.body);

      // No required feature: any full set of lattice points on the curve is correct.
      const free = await serveQuadratic(
        (facts) =>
          facts.response.connect === "curve" &&
          facts.required.length === 0 &&
          correctCurvePoints(facts.required, facts.others, facts.count)
            ?.length === facts.count,
        "without a required feature point",
      );
      assert.equal(free.facts.response.connect, "curve");
      assert.equal(JSON.stringify(free.problem).includes("on-curve"), false);
      const freeAnswer = correctCurvePoints(
        free.facts.required,
        free.facts.others,
        free.facts.count,
      );
      if (!freeAnswer)
        throw new Error("Unconstrained curve has no lattice answer");
      const accepted = await send({
        problemId: free.problem.id,
        requestId: randomUUID(),
        response: JSON.stringify(freeAnswer),
      });
      assert.equal(accepted.statusCode, 200, accepted.body);
      assert.equal(accepted.json().correct, true);
      assert.equal(accepted.json().answer, free.secret.answer);

      const secondCurve = await serve("graph-quadratic-points");
      const secondSecret = generateServed(
        secondCurve.templateId,
        secondCurve.seed,
      );
      const secondFacts = onCurveFacts(secondCurve, secondSecret);
      if (!secondFacts) throw new Error("Expected a graphed curve");
      const secondAnswer = correctCurvePoints(
        secondFacts.required,
        secondFacts.others,
        secondFacts.count,
      );
      if (!secondAnswer)
        throw new Error("Served curve has no complete lattice answer");
      const good = await send({
        problemId: secondCurve.id,
        requestId: randomUUID(),
        response: JSON.stringify([...secondAnswer].reverse()),
      });
      assert.equal(good.statusCode, 200, good.body);
      assert.equal(good.json().correct, true);
      assert.equal(good.json().answer, secondSecret.answer);

      // Mixed practice for an older client never issues a plotted problem.
      for (let i = 0; i < 6; i++) {
        const r = await batch({
          count: 1,
          responseCapabilities: ["single-choice-v1", "multi-select-v1"],
          figureCapabilities: ["scenes-v1"],
        });
        if (r.statusCode === 402) break;
        assert.equal(r.statusCode, 200, r.body);
        for (const problem of r.json().problems as PublicProblem[])
          assert.notEqual(problem.response.kind, "point-plot");
      }
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
