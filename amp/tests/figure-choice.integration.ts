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
  "graph-of-linear-rule",
  "graph-of-proportional-rate",
  "graph-of-inequality-number-line",
  "graph-of-quadratic-or-exponential",
];
const current = [
  "single-choice-v1",
  "multi-select-v1",
  "point-plot-v1",
  "figure-choice-v1",
];

test(
  "figure-choice attempts are gated by capability, graded on the server, idempotent and reportable",
  { skip: !url },
  async () => {
    const schema = `amp_figure_choice_${randomUUID().replaceAll("-", "")}`;
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
      authenticate: async () => "figure-choice-test-parent",
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/trials",
        payload: { birthYear: 2011 },
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

      // A client that cannot show figure options, or cannot draw scenes, is
      // refused a focused family and nothing is issued.
      for (const [responseCapabilities, figureCapabilities] of [
        [[], ["scenes-v1"]],
        [["single-choice-v1"], ["scenes-v1"]],
        [
          ["single-choice-v1", "multi-select-v1", "point-plot-v1"],
          ["scenes-v1"],
        ],
        [current, []],
      ] as const)
        for (const templateId of families) {
          const before = await count("amp_instances");
          const denied = await batch({
            templateId,
            count: 1,
            responseCapabilities,
            figureCapabilities,
          });
          assert.equal(denied.statusCode, 400, denied.body);
          assert.equal(await count("amp_instances"), before);
        }
      assert.equal(
        (await batch({ count: 1, responseCapabilities: ["figure-choice-v2"] }))
          .statusCode,
        400,
      );

      const serve = async (templateId: string): Promise<PublicProblem> => {
        const r = await batch({
          templateId,
          count: 1,
          responseCapabilities: current,
          figureCapabilities: ["scenes-v1"],
        });
        assert.equal(r.statusCode, 200, r.body);
        const p = r.json().problems[0] as PublicProblem;
        for (const secret of ["answer", "choiceFeedback", "walkthrough"])
          assert.equal(secret in p, false, secret);
        assert.equal(p.response.kind, "figure-choice");
        const wire = JSON.stringify(r.json().problems);
        for (const secret of ["choiceFeedback", "walkthrough", '"answer"'])
          assert.equal(wire.includes(secret), false, secret);
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

      const line = await serve("graph-of-linear-rule");
      const lineSecret = generateProblem(line.templateId, line.seed);
      if (line.response.kind !== "figure-choice") throw new Error("kind");
      const input = {
        problemId: line.id,
        requestId: randomUUID(),
        response: lineSecret.answer,
      };
      for (const response of ["option-e", "Graph A", "A", '["option-a"]']) {
        const r = await send({ ...input, response });
        assert.equal(r.statusCode, 400, `${response}: ${r.body}`);
        assert.match(r.json().error, /Choose one of the displayed graphs/);
      }
      assert.equal(await count("amp_attempts"), 0);
      const first = await send(input);
      assert.equal(first.statusCode, 200, first.body);
      assert.equal(first.json().correct, true);
      assert.equal(first.json().answer, lineSecret.answer);
      assert.deepEqual(first.json().explanation, lineSecret.explanation);
      // A retry is the same attempt; reusing its id for another figure is a
      // conflict; a second attempt at the problem is refused.
      const retry = await send(input);
      assert.equal(retry.json().id, first.json().id);
      const other = line.response.options.find(
        (o) => o.id !== lineSecret.answer,
      )!.id;
      assert.equal((await send({ ...input, response: other })).statusCode, 409);
      assert.equal(
        (await send({ ...input, requestId: randomUUID() })).statusCode,
        409,
      );
      assert.equal(await count("amp_attempts"), 1);

      // A distractor is graded wrong, and its misconception leads the
      // explanation.
      const rule = await serve("graph-of-inequality-number-line");
      const ruleSecret = generateProblem(rule.templateId, rule.seed);
      if (rule.response.kind !== "figure-choice") throw new Error("kind");
      const wrong = rule.response.options.find(
        (o) => o.id !== ruleSecret.answer,
      )!.id;
      const miss = await send({
        problemId: rule.id,
        requestId: randomUUID(),
        response: wrong,
      });
      assert.equal(miss.statusCode, 200, miss.body);
      assert.equal(miss.json().correct, false);
      assert.equal(miss.json().response, wrong);
      assert.equal(
        miss.json().explanation[0],
        ruleSecret.choiceFeedback![wrong],
      );
      assert.match(miss.json().explanation[0], /^Number line [A-D] /);
      const invalid = await send({
        problemId: (await serve("graph-of-inequality-number-line")).id,
        requestId: randomUUID(),
        response: "option-z",
      });
      assert.match(invalid.json().error, /displayed number lines/);

      for (const templateId of [
        "graph-of-proportional-rate",
        "graph-of-quadratic-or-exponential",
      ]) {
        const p = await serve(templateId);
        const secret = generateProblem(p.templateId, p.seed);
        const r = await send({
          problemId: p.id,
          requestId: randomUUID(),
          response: secret.answer,
        });
        assert.equal(r.json().correct, true, templateId);
      }
      const evidence = (
        await repository.pool.query(
          "SELECT skill_id,(state->>'attempts')::int AS attempts FROM amp_skill_evidence WHERE learner_id=$1 ORDER BY skill_id",
          [learnerId],
        )
      ).rows;
      assert.deepEqual(
        evidence.filter((row) =>
          [
            "linear-models",
            "linear-inequalities",
            "proportional-relationships",
            "function-transformations",
          ].includes(row.skill_id),
        ),
        [
          { skill_id: "function-transformations", attempts: 1 },
          { skill_id: "linear-inequalities", attempts: 1 },
          { skill_id: "linear-models", attempts: 1 },
          { skill_id: "proportional-relationships", attempts: 1 },
        ],
      );

      // A lesson works another instance and draws its correct figure.
      const pending = await serve("graph-of-quadratic-or-exponential");
      const lesson = await app.inject({
        method: "POST",
        url: base + "/lesson-support",
        headers,
        payload: { problemId: pending.id },
      });
      assert.equal(lesson.statusCode, 200, lesson.body);
      assert.notEqual(lesson.json().lesson.example.prompt, pending.prompt);
      assert.equal(lesson.json().lesson.example.figure.kind, "scene");
      assert.equal(/option-[a-d]/.test(lesson.body), false);

      // A report keeps the figure-choice response kind (migration 0066).
      const report = await app.inject({
        method: "POST",
        url: base + "/problem-flags",
        headers,
        payload: {
          problemId: rule.id,
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
      assert.equal(flag.response_kind, "figure-choice");
      assert.equal(flag.response, wrong);

      // Mixed practice for an older client never issues a figure choice.
      for (let i = 0; i < 6; i++) {
        const r = await batch({
          count: 1,
          responseCapabilities: [
            "single-choice-v1",
            "multi-select-v1",
            "point-plot-v1",
          ],
          figureCapabilities: ["scenes-v1"],
        });
        if (r.statusCode === 402) break;
        assert.equal(r.statusCode, 200, r.body);
        for (const problem of r.json().problems as PublicProblem[])
          assert.notEqual(problem.response.kind, "figure-choice");
      }
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
