import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight";
import { migrate } from "../scripts/migrate";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { generateProblem } from "../src/math/engine";
import {
  latticeOnCurve,
  latticeOnLine,
  plotPoints,
} from "../src/math/point-plot";
import type { PublicProblem } from "../src/math/contracts";

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
      const lineSecret = generateProblem(
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
      const alternate = [onLine.at(-1)!, onLine[0]!];
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
        JSON.stringify([alternate[0], [7, 0]]),
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
      const anotherSecret = generateProblem(another.templateId, another.seed);
      const [p] = plotPoints(anotherSecret.answer);
      const off = JSON.stringify([p, [p![0], p![1] === 6 ? 5 : p![1] + 1]]);
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
      let imageSecret = generateProblem(image.templateId, image.seed);
      for (let tries = 0; tries < 300; tries++) {
        const pts = plotPoints(imageSecret.answer);
        const swappedPts = [pts[1]!, pts[0]!, ...pts.slice(2)];
        if (
          swappedPts.every((p, i) => i === 0 || byXY(swappedPts[i - 1]!, p) < 0)
        )
          break;
        image = await serve("place-transformed-image");
        imageSecret = generateProblem(image.templateId, image.seed);
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
      const plottedSecret = generateProblem(plotted.templateId, plotted.seed);
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
      const curveProblem = await serve("graph-quadratic-points");
      const curveSecret = generateProblem(
        curveProblem.templateId,
        curveProblem.seed,
      );
      if (
        curveProblem.response.kind !== "point-plot" ||
        curveSecret.pointGrading?.mode !== "on-curve"
      )
        throw new Error("Expected a graphed curve");
      assert.equal(curveProblem.response.connect, "curve");
      assert.equal(JSON.stringify(curveProblem).includes("on-curve"), false);
      const required = curveSecret.pointGrading.required ?? [];
      const onCurve = latticeOnCurve(
        curveProblem.response.grid,
        curveSecret.pointGrading.curve,
      );
      const others = onCurve.filter(
        (p) => !required.some((q) => q[0] === p[0] && q[1] === p[1]),
      );
      const curveAnswer = [
        ...required,
        ...others.slice(-(3 - required.length)),
      ];
      const wrongSet = others.slice(0, 3);
      if (required.length) {
        // The right curve without the required feature point is wrong.
        const without = await send({
          problemId: curveProblem.id,
          requestId: randomUUID(),
          response: JSON.stringify(wrongSet),
        });
        assert.equal(without.statusCode, 200, without.body);
        assert.equal(without.json().correct, false);
        assert.equal(await attempts(), 5);
      }
      const curveInput = {
        problemId: curveProblem.id,
        requestId: randomUUID(),
        response: JSON.stringify(
          required.length ? curveAnswer : others.slice(-3),
        ),
      };
      if (required.length) {
        // One attempt per problem: serve another for the accepted answer.
        assert.equal((await send(curveInput)).statusCode, 409);
      } else {
        const accepted = await send(curveInput);
        assert.equal(accepted.statusCode, 200, accepted.body);
        assert.equal(accepted.json().correct, true);
        assert.equal(accepted.json().answer, curveSecret.answer);
      }
      const secondCurve = await serve("graph-quadratic-points");
      const secondSecret = generateProblem(
        secondCurve.templateId,
        secondCurve.seed,
      );
      if (
        secondCurve.response.kind !== "point-plot" ||
        secondSecret.pointGrading?.mode !== "on-curve"
      )
        throw new Error("Expected a graphed curve");
      const secondPoints = latticeOnCurve(
        secondCurve.response.grid,
        secondSecret.pointGrading.curve,
      );
      const secondRequired = secondSecret.pointGrading.required ?? [];
      const secondRest = secondPoints.filter(
        (p) => !secondRequired.some((q) => q[0] === p[0] && q[1] === p[1]),
      );
      const secondAnswer = [
        ...secondRequired,
        ...secondRest.slice(0, 3 - secondRequired.length),
      ];
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
