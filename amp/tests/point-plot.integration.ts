import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight";
import { migrate } from "../scripts/migrate";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import {
  latticeOnCurve,
  latticeOnLine,
  plotPoints,
} from "../src/math/point-plot";
import type { GeneratedProblem, PublicProblem } from "../src/math/contracts";

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
      const created = await repository.createTrial(2012);
      const learnerId = created.learnerId;
      const base = `/api/v1/learners/${learnerId}`;
      const headers = { authorization: `Trial ${created.token}` };
      const storedProblem = async (problem: PublicProblem) => {
        const result = await repository.pool.query(
          "SELECT content FROM amp_instances WHERE learner_id=$1 AND id=$2",
          [learnerId, problem.id],
        );
        const stored = result.rows[0]?.content as GeneratedProblem | undefined;
        assert.ok(stored);
        assert.deepEqual(stored.public, problem);
        return stored;
      };
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
      const lineSecret = await storedProblem(lineProblem);
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
      assert.ok(onLine.length >= 3, "The line has an alternative pair");
      const alternate = [onLine.at(-1)!, onLine[0]!];
      if (
        alternate.every((p) =>
          exemplar.some((q) => q[0] === p[0] && q[1] === p[1]),
        )
      )
        alternate[0] = onLine[1]!;
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
        JSON.stringify([
          alternate[0],
          [lineProblem.response.grid.xMax + lineProblem.response.grid.step, 0],
        ]),
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
      const anotherSecret = await storedProblem(another);
      assert.ok(
        another.response.kind === "point-plot" &&
          anotherSecret.pointGrading?.mode === "on-line",
      );
      const [p] = plotPoints(anotherSecret.answer);
      const grid = another.response.grid;
      const onAnother = latticeOnLine(grid, anotherSecret.pointGrading);
      let offPoint: [number, number] | undefined;
      for (let x = grid.xMin; x <= grid.xMax && !offPoint; x += grid.step)
        for (let y = grid.yMin; y <= grid.yMax; y += grid.step)
          if (!onAnother.some((q) => q[0] === x && q[1] === y)) {
            offPoint = [x, y];
            break;
          }
      assert.ok(offPoint, "The grid has a point off the line");
      const off = JSON.stringify([p, offPoint]);
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
      let imageSecret = await storedProblem(image);
      for (let tries = 0; tries < 300; tries++) {
        const pts = plotPoints(imageSecret.answer);
        const swappedPts = [pts[1]!, pts[0]!, ...pts.slice(2)];
        if (
          swappedPts.every((p, i) => i === 0 || byXY(swappedPts[i - 1]!, p) < 0)
        )
          break;
        image = await serve("place-transformed-image");
        imageSecret = await storedProblem(image);
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
      const plottedSecret = await storedProblem(plotted);
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

      // Exercise each grading contract, including descriptions that require
      // all three points. A missing variant
      // fails the test instead of silently omitting its grading assertions.
      const quadratic = async (requiredCount: 0 | 1 | 3) => {
        for (let tries = 0; tries < 100; tries++) {
          const problem = await serve("graph-quadratic-points");
          const secret = await storedProblem(problem);
          assert.ok(problem.response.kind === "point-plot");
          if (secret.pointGrading?.mode !== "on-curve") continue;
          const required = secret.pointGrading.required ?? [];
          if (required.length !== requiredCount) continue;
          const others = latticeOnCurve(
            problem.response.grid,
            secret.pointGrading.curve,
          ).filter(
            (p) => !required.some((q) => q[0] === p[0] && q[1] === p[1]),
          );
          const count = problem.response.pointCount;
          // Keep all but one required feature, then fill with other curve
          // points. Some narrow grids have no alternative; select one that does.
          if (
            others.length <
            count - required.length + (required.length ? 1 : 0)
          )
            continue;
          const answer = [
            ...required,
            ...others.slice(0, count - required.length),
          ];
          const wrong = required.length
            ? [
                ...required.slice(1),
                ...others.slice(0, count - required.length + 1),
              ]
            : undefined;
          assert.equal(answer.length, count);
          if (wrong) assert.equal(wrong.length, count);
          assert.equal(problem.response.connect, "curve");
          assert.equal(JSON.stringify(problem).includes("on-curve"), false);
          return { problem, secret, answer, wrong };
        }
        throw new Error(
          `No quadratic with ${requiredCount} required points in 100 serves`,
        );
      };
      for (const count of [1, 3, 0] as const) {
        let served = await quadratic(count);
        if (served.wrong) {
          // A full, valid set on the curve that omits a required point is wrong.
          const without = await send({
            problemId: served.problem.id,
            requestId: randomUUID(),
            response: JSON.stringify(served.wrong),
          });
          assert.equal(without.statusCode, 200, without.body);
          assert.equal(without.json().correct, false);
          if (count === 1) assert.equal(await attempts(), 5);
          const conflict = await send({
            problemId: served.problem.id,
            requestId: randomUUID(),
            response: JSON.stringify(served.answer),
          });
          assert.equal(conflict.statusCode, 409, conflict.body);
          served = await quadratic(count);
        }
        const good = await send({
          problemId: served.problem.id,
          requestId: randomUUID(),
          response: JSON.stringify([...served.answer].reverse()),
        });
        assert.equal(good.statusCode, 200, good.body);
        assert.equal(good.json().correct, true);
        assert.equal(good.json().answer, served.secret.answer);
      }

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
