import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight";
import { migrate } from "../scripts/migrate";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { generateProblem } from "../src/math/engine";
import type { PublicProblem } from "../src/math/contracts";

const url = process.env.AMP_TEST_DATABASE_URL;
assertTestDatabaseTarget(url);
const families = [
  "solve-justify-linear",
  "two-column-congruence-proof",
  "show-work-box-cost",
];
const current = [
  "single-choice-v1",
  "multi-select-v1",
  "point-plot-v1",
  "multi-part-choice-v1",
  "figure-choice-v1",
  "structured-work-v1",
];

test(
  "structured work is gated by capability, graded per step on the server, idempotent and reportable",
  { skip: !url },
  async () => {
    const schema = `amp_structured_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url!, max: 1 });
    const scoped = new URL(url!);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
      freeProblems: 30,
    });
    const app = buildApp({
      repository,
      development: true,
      authenticate: async () => "structured-work-test-parent",
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/trials",
        payload: { birthYear: 2010 },
      });
      assert.equal(created.statusCode, 201, created.body);
      const learnerId = created.json().learnerId as string;
      const base = `/api/v1/learners/${learnerId}`;
      const headers = { authorization: `Trial ${created.json().token}` };
      const count = async (table: string) =>
        Number(
          (
            await repository.pool.query(
              `SELECT count(*) FROM ${table} WHERE learner_id=$1`,
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

      // A client without the capability is refused a focused family and
      // nothing is issued; an unknown capability is rejected outright.
      for (const responseCapabilities of [[], current.slice(0, -1)])
        for (const templateId of families) {
          const before = await count("amp_instances");
          const denied = await batch({
            templateId,
            count: 1,
            responseCapabilities,
            figureCapabilities: ["scenes-v1"],
          });
          assert.equal(denied.statusCode, 400, denied.body);
          assert.equal(await count("amp_instances"), before);
        }
      assert.equal(
        (
          await batch({
            count: 1,
            responseCapabilities: ["structured-work-v2"],
          })
        ).statusCode,
        400,
      );

      // Served problems carry no key, rule or worked steps.
      const serve = async (templateId: string): Promise<PublicProblem> => {
        for (let i = 0; i < 12; i++) {
          const r = await batch({
            templateId,
            count: 1,
            responseCapabilities: current,
            figureCapabilities: ["scenes-v1"],
          });
          assert.equal(r.statusCode, 200, r.body);
          const p = r.json().problems[0] as PublicProblem;
          for (const secret of ["answer", "explanation", "workGrading"])
            assert.equal(secret in p, false, secret);
          const body = JSON.stringify(r.json());
          for (const secret of ['"workGrading"', '"claims"', '"moves"'])
            assert.equal(body.includes(secret), false, secret);
          const key = generateProblem(p.templateId, p.seed);
          assert.equal(body.includes(key.answer), false, "key leaked");
          // The derivation tests below want an open list to build.
          if (
            p.response.kind === "structured-work" &&
            (templateId !== "solve-justify-linear" ||
              p.response.mode === "build")
          )
            return p;
        }
        throw new Error(`No ${templateId} instance to test`);
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

      // A derivation: a slip in one step is graded wrong (not rejected), the
      // attempt marks each step and names the one to recheck.
      const linear = await serve("solve-justify-linear");
      const linearKey = generateProblem(linear.templateId, linear.seed);
      const path = JSON.parse(linearKey.answer) as string[][];
      const slipped = path.map((row, i) =>
        i === 0 ? [row[0]!, row[1] === "su" ? "ad" : "su"] : row,
      );
      const input = {
        problemId: linear.id,
        requestId: randomUUID(),
        response: JSON.stringify(slipped),
      };
      for (const response of [
        "[]",
        JSON.stringify([["", path[0]![1]]]),
        JSON.stringify([[path[0]![0], "zz"]]),
        JSON.stringify([["x==", "su"]]),
        JSON.stringify([["y=2", "su"]]),
        JSON.stringify(Array(6).fill(path[0])),
        "malformed",
      ]) {
        const r = await send({ ...input, response });
        assert.equal(r.statusCode, 400, `${response}: ${r.body}`);
        assert.match(r.json().error, /Complete every step with a valid entry/);
      }
      assert.equal(await count("amp_attempts"), 0);
      const wrong = await send(input);
      assert.equal(wrong.statusCode, 200, wrong.body);
      assert.equal(wrong.json().correct, false);
      assert.deepEqual(
        wrong.json().parts,
        path.map((_, i) => i !== 0),
      );
      assert.match(
        wrong.json().explanation[0],
        new RegExp(
          `^${path.length - 1} of ${path.length} steps are correct\\. Recheck step 1\\.`,
        ),
      );
      assert.match(wrong.json().explanation[1], /^Step 1 /);
      assert.equal(wrong.json().answer, linearKey.answer);
      // A retry spelling the same lines differently (spaces, ≤) is the same
      // attempt; another response under the same request id is a conflict.
      const spaced = JSON.stringify(
        slipped.map(([line, reason]) => [line!.replace("=", " = "), reason]),
      );
      const retry = await send({ ...input, response: spaced });
      assert.equal(retry.statusCode, 200, retry.body);
      assert.equal(retry.json().id, wrong.json().id);
      assert.equal(await count("amp_attempts"), 1);
      assert.equal(
        (await send({ ...input, response: linearKey.answer })).statusCode,
        409,
      );
      assert.equal(
        (await send({ ...input, requestId: randomUUID() })).statusCode,
        409,
        "one attempt per problem",
      );
      const stored = (
        await repository.pool.query(
          "SELECT outcome FROM amp_attempts WHERE learner_id=$1",
          [learnerId],
        )
      ).rows[0].outcome;
      assert.deepEqual(
        stored.parts,
        path.map((_, i) => i !== 0),
      );
      assert.equal(stored.response, JSON.stringify(slipped));

      // A proof and labeled steps answered right earn credit with every
      // row marked right and no row feedback.
      for (const templateId of [
        "two-column-congruence-proof",
        "show-work-box-cost",
      ]) {
        const p = await serve(templateId);
        const key = generateProblem(p.templateId, p.seed);
        const right = await send({
          problemId: p.id,
          requestId: randomUUID(),
          response: key.answer,
        });
        assert.equal(right.statusCode, 200, right.body);
        assert.equal(right.json().correct, true);
        assert.ok(right.json().parts.every((part: boolean) => part));
        assert.deepEqual(right.json().explanation, key.explanation);
      }
      assert.equal(await count("amp_attempts"), 3);
      const evidence = (
        await repository.pool.query(
          "SELECT skill_id,(state->>'attempts')::int AS attempts FROM amp_skill_evidence WHERE learner_id=$1 ORDER BY skill_id",
          [learnerId],
        )
      ).rows.filter((row) =>
        [
          "congruence-criteria",
          "equation-reasoning",
          "variable-expressions",
        ].includes(row.skill_id),
      );
      assert.deepEqual(evidence, [
        { skill_id: "congruence-criteria", attempts: 1 },
        { skill_id: "equation-reasoning", attempts: 1 },
        { skill_id: "variable-expressions", attempts: 1 },
      ]);

      // A skip shows the worked key and is never an attempt.
      const skipped = await serve("show-work-box-cost");
      const skip = await app.inject({
        method: "POST",
        url: base + "/skips",
        headers,
        payload: { problemId: skipped.id },
      });
      if (skip.statusCode !== 404) {
        assert.equal(skip.statusCode, 200, skip.body);
        assert.equal(skip.json().skipped, true);
        assert.equal(await count("amp_attempts"), 3);
      }

      // The lesson works another instance, never the learner's own key.
      const pending = await serve("two-column-congruence-proof");
      const lesson = await app.inject({
        method: "POST",
        url: base + "/lesson-support",
        headers,
        payload: { problemId: pending.id },
      });
      assert.equal(lesson.statusCode, 200, lesson.body);
      assert.notEqual(lesson.json().lesson.example.prompt, pending.prompt);
      assert.doesNotMatch(lesson.json().lesson.example.answer, /\[\[/);

      // A report keeps the structured-work response kind (migration 0068).
      const report = await app.inject({
        method: "POST",
        url: base + "/problem-flags",
        headers,
        payload: {
          problemId: linear.id,
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
      assert.equal(flag.response_kind, "structured-work");
      assert.equal(flag.response, JSON.stringify(slipped));

      // Mixed practice for an older client never issues structured work.
      for (let i = 0; i < 6; i++) {
        const r = await batch({
          count: 2,
          responseCapabilities: current.slice(0, -1),
          figureCapabilities: ["scenes-v1"],
        });
        if (r.statusCode === 402) break;
        assert.equal(r.statusCode, 200, r.body);
        for (const problem of r.json().problems as PublicProblem[])
          assert.notEqual(problem.response.kind, "structured-work");
      }
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
