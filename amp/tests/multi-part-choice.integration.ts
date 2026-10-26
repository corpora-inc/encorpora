import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight";
import { migrate } from "../scripts/migrate";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { generateProblem } from "../src/math/engine";
import { chooseOption, multiPartMarks } from "../src/math/multi-part-choice";
import type { PublicProblem } from "../src/math/contracts";
import { answerText } from "../src/math/selection-response";

const url = process.env.AMP_TEST_DATABASE_URL;
assertTestDatabaseTarget(url);
const families = [
  "inline-linear-features",
  "proportional-match-table",
  "label-expression-parts",
];
const current = [
  "single-choice-v1",
  "multi-select-v1",
  "point-plot-v1",
  "multi-part-choice-v1",
];

test(
  "multi-part choices are gated by capability, graded on the server, idempotent and reportable",
  { skip: !url },
  async () => {
    const schema = `amp_multi_part_${randomUUID().replaceAll("-", "")}`;
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
      authenticate: async () => "multi-part-test-parent",
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

      // A client that cannot show multi-part choices is refused a focused
      // family, and nothing is issued.
      for (const responseCapabilities of [
        [],
        ["single-choice-v1"],
        ["single-choice-v1", "multi-select-v1", "point-plot-v1"],
      ])
        for (const templateId of families) {
          const before = await count("amp_instances");
          const denied = await batch({
            templateId,
            count: 1,
            responseCapabilities,
            figureCapabilities: ["scenes-v1", "function-displays-v1"],
          });
          assert.equal(denied.statusCode, 400, denied.body);
          assert.equal(await count("amp_instances"), before);
        }
      assert.equal(
        (
          await batch({
            count: 1,
            responseCapabilities: ["multi-part-choice-v2"],
          })
        ).statusCode,
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
        for (const secret of ["answer", "explanation", "choiceFeedback"])
          assert.equal(secret in p, false, secret);
        assert.equal(p.response.kind, "multi-part-choice");
        const secret = generateProblem(p.templateId, p.seed);
        assert.equal(JSON.stringify(r.json()).includes(secret.answer), false);
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

      // An inline sentence: one wrong blank is graded wrong, not rejected,
      // and the attempt records which blanks were right.
      const sentence = await serve("inline-linear-features");
      const sentenceKey = generateProblem(sentence.templateId, sentence.seed);
      if (sentence.response.kind !== "multi-part-choice")
        throw new Error("Expected a multi-part choice");
      const marks = multiPartMarks(
        sentence.response,
        sentenceKey.answer,
        sentenceKey.answer,
      );
      const first = marks[0]!;
      const other = first.blank.options.find(
        (o) => o.id !== first.expected.id,
      )!;
      const oneWrong = chooseOption(
        sentence.response,
        sentenceKey.answer,
        first.blank.id,
        other.id,
      );
      const input = {
        problemId: sentence.id,
        requestId: randomUUID(),
        response: oneWrong,
      };
      for (const response of [
        "{}",
        JSON.stringify({ [first.blank.id]: other.id }),
        oneWrong.replace(`"${first.blank.id}"`, '"zz"'),
        oneWrong.replace(`:"${other.id}"`, ':"f"'),
        JSON.stringify(Object.values(JSON.parse(oneWrong))),
        "malformed",
      ]) {
        const r = await send({ ...input, response });
        assert.equal(r.statusCode, 400, `${response}: ${r.body}`);
        assert.match(
          r.json().error,
          /Choose one of the displayed options for each/,
        );
      }
      assert.equal(await count("amp_attempts"), 0);
      const wrong = await send(input);
      assert.equal(wrong.statusCode, 200, wrong.body);
      assert.equal(wrong.json().correct, false);
      assert.deepEqual(
        wrong.json().parts,
        marks.map((_, i) => i !== 0),
      );
      assert.equal(wrong.json().answer, sentenceKey.answer);
      assert.match(
        wrong.json().explanation[0],
        new RegExp(
          `^${marks.length - 1} of ${marks.length} parts are correct\\. Recheck `,
        ),
      );
      // Stored canonically, in blank order.
      assert.equal(wrong.json().response, oneWrong);
      // A retry with the same choices in another key order is the same attempt.
      const reordered = JSON.stringify(
        Object.fromEntries(Object.entries(JSON.parse(oneWrong)).reverse()),
      );
      assert.notEqual(reordered, oneWrong);
      const retry = await send({ ...input, response: reordered });
      assert.equal(retry.statusCode, 200, retry.body);
      assert.equal(retry.json().id, wrong.json().id);
      assert.equal(await count("amp_attempts"), 1);
      // Reusing the request id for other choices is a conflict.
      assert.equal(
        (await send({ ...input, response: sentenceKey.answer })).statusCode,
        409,
      );
      assert.equal(
        (await send({ ...input, requestId: randomUUID() })).statusCode,
        409,
        "one attempt per problem",
      );
      // The stored attempt keeps its per-blank record.
      const stored = (
        await repository.pool.query(
          "SELECT outcome FROM amp_attempts WHERE learner_id=$1",
          [learnerId],
        )
      ).rows[0].outcome;
      assert.deepEqual(
        stored.parts,
        marks.map((_, i) => i !== 0),
      );

      // A table and slots answered right earn credit with no part feedback.
      for (const templateId of [
        "proportional-match-table",
        "label-expression-parts",
      ]) {
        const p = await serve(templateId);
        const key = generateProblem(p.templateId, p.seed);
        const right = await send({
          problemId: p.id,
          requestId: randomUUID(),
          response: JSON.stringify(
            Object.fromEntries(
              Object.entries(JSON.parse(key.answer)).reverse(),
            ),
          ),
        });
        assert.equal(right.statusCode, 200, right.body);
        assert.equal(right.json().correct, true);
        assert.equal(right.json().response, key.answer);
        assert.ok(right.json().parts.every((part: boolean) => part));
        assert.deepEqual(right.json().explanation, key.explanation);
      }
      assert.equal(await count("amp_attempts"), 3);
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
            "proportional-relationships",
            "variable-expressions",
          ].includes(row.skill_id),
        ),
        [
          { skill_id: "linear-models", attempts: 1 },
          { skill_id: "proportional-relationships", attempts: 1 },
          { skill_id: "variable-expressions", attempts: 1 },
        ],
      );

      // The lesson works another instance and never the learner's own.
      const pending = await serve("proportional-match-table");
      const lesson = await app.inject({
        method: "POST",
        url: base + "/lesson-support",
        headers,
        payload: { problemId: pending.id },
      });
      assert.equal(lesson.statusCode, 200, lesson.body);
      const own = generateProblem(pending.templateId, pending.seed);
      assert.notEqual(
        lesson.json().lesson.example.answer,
        answerText(pending.response, own.answer),
      );
      assert.doesNotMatch(lesson.json().lesson.example.answer, /\{"/);

      // A report keeps the multi-part response kind (migration 0065).
      const report = await app.inject({
        method: "POST",
        url: base + "/problem-flags",
        headers,
        payload: {
          problemId: sentence.id,
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
      assert.equal(flag.response_kind, "multi-part-choice");
      assert.equal(flag.response, oneWrong);

      // Mixed practice for an older client never issues a multi-part item.
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
          assert.notEqual(problem.response.kind, "multi-part-choice");
      }
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
