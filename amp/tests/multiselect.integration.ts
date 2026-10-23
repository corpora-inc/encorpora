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
  parseSelection,
  serializeSelection,
} from "../src/math/selection-response";
import type { PublicProblem } from "../src/math/contracts";

const url = process.env.AMP_TEST_DATABASE_URL;
assertTestDatabaseTarget(url);
const family = "quadrilateral-hierarchy-multiselect";

test(
  "multi-select attempts preserve ownership, one-time credit, assistance and trial limits",
  { skip: !url },
  async () => {
    const schema = `amp_selection_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url!, max: 1 });
    const scoped = new URL(url!);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
      freeProblems: 2,
    });
    const app = buildApp({
      repository,
      development: true,
      authenticate: async () => "selection-test-parent",
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const create = async () => {
        const r = await app.inject({
          method: "POST",
          url: "/api/v1/trials",
          payload: { birthYear: 2015 },
        });
        assert.equal(r.statusCode, 201, r.body);
        return {
          base: `/api/v1/learners/${r.json().learnerId}`,
          learnerId: r.json().learnerId as string,
          headers: { authorization: `Trial ${r.json().token}` },
        };
      };
      const trial = await create(),
        foreign = await create();
      const instances = async () =>
        Number(
          (
            await repository.pool.query(
              "SELECT count(*) FROM amp_instances WHERE learner_id=$1",
              [trial.learnerId],
            )
          ).rows[0].count,
        );
      for (const responseCapabilities of [[], ["single-choice-v1"]]) {
        const before = await instances();
        const denied = await app.inject({
          method: "POST",
          url: trial.base + "/batches",
          headers: trial.headers,
          payload: { templateId: family, count: 1, responseCapabilities },
        });
        assert.equal(denied.statusCode, 400, denied.body);
        assert.equal(await instances(), before);
      }
      const serve = async (
        who = trial,
        templateId = family,
      ): Promise<PublicProblem> => {
        const r = await app.inject({
          method: "POST",
          url: who.base + "/batches",
          headers: who.headers,
          payload: {
            templateId,
            count: 1,
            responseCapabilities: ["single-choice-v1", "multi-select-v1"],
          },
        });
        assert.equal(r.statusCode, 200, r.body);
        const p = r.json().problems[0];
        assert.equal("answer" in p, false);
        assert.equal("choiceFeedback" in p, false);
        if (p.response.kind === "multi-select")
          for (const option of p.response.options)
            assert.deepEqual(Object.keys(option).sort(), ["id", "label"]);
        return p;
      };
      const first = await serve(),
        assisted = await serve(),
        prefetched = await serve();
      const privateFirst = generateProblem(first.templateId, first.seed);
      const correct = parseSelection(privateFirst.answer)!;
      const requestId = randomUUID();
      const input = {
        problemId: first.id,
        requestId,
        response: serializeSelection(correct),
      };
      const send = (
        payload: typeof input,
        headers = trial.headers,
        base = trial.base,
      ) =>
        app.inject({
          method: "POST",
          url: base + "/attempts",
          headers,
          payload,
        });
      assert.equal((await send(input, foreign.headers)).statusCode, 404);
      for (const response of [
        "[]",
        JSON.stringify(correct.slice(1)),
        JSON.stringify([...correct, correct[0]]),
        JSON.stringify([correct[0], correct[1], "option-h"]),
        "malformed",
      ]) {
        const r = await send({ ...input, response });
        assert.equal(r.statusCode, 400, r.body);
      }
      const countAttempts = async () =>
        Number(
          (
            await repository.pool.query(
              "SELECT count(*) FROM amp_attempts WHERE learner_id=$1",
              [trial.learnerId],
            )
          ).rows[0].count,
        );
      assert.equal(await countAttempts(), 0);
      const replies = await Promise.all([
        send(input),
        send({
          ...input,
          response: JSON.stringify([...correct].reverse(), null, 1),
        }),
      ]);
      for (const r of replies) {
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().correct, true);
        assert.equal(r.json().response, privateFirst.answer);
      }
      assert.equal(replies[0]!.json().id, replies[1]!.json().id);
      assert.equal(await countAttempts(), 1);
      const state = (
        await repository.pool.query(
          "SELECT state FROM amp_skill_evidence WHERE learner_id=$1 AND skill_id='shape-hierarchy'",
          [trial.learnerId],
        )
      ).rows[0].state;
      assert.equal(state.attempts, 1);
      assert.equal(state.independentCorrect, 1);
      const wrongId =
        first.response.kind === "multi-select"
          ? first.response.options.find((o) => !correct.includes(o.id))!.id
          : "";
      const wrong = serializeSelection([wrongId, ...correct.slice(1)]);
      assert.equal((await send({ ...input, response: wrong })).statusCode, 409);
      assert.equal(
        (await send({ ...input, problemId: assisted.id })).statusCode,
        409,
      );
      assert.equal(
        (await send({ ...input, requestId: randomUUID() })).statusCode,
        409,
      );

      const lesson = await app.inject({
        method: "POST",
        url: trial.base + "/lesson-support",
        headers: trial.headers,
        payload: { problemId: assisted.id },
      });
      assert.equal(lesson.statusCode, 200, lesson.body);
      assert.ok([5, 6].includes(lesson.json().lesson.example.choices.length));
      assert.equal(
        lesson.json().lesson.example.answer.includes("option-"),
        false,
      );
      const second = await send({
        problemId: assisted.id,
        requestId: randomUUID(),
        response: generateProblem(assisted.templateId, assisted.seed).answer,
      });
      assert.equal(second.statusCode, 200, second.body);
      assert.equal(second.json().correct, true);
      assert.equal(second.json().assisted, true);
      assert.equal(await countAttempts(), 2);
      const exhausted = await send({
        problemId: prefetched.id,
        requestId: randomUUID(),
        response: generateProblem(prefetched.templateId, prefetched.seed)
          .answer,
      });
      assert.equal(exhausted.statusCode, 402);
      const replay = await send({
        ...input,
        response: JSON.stringify([...correct].reverse()),
      });
      assert.equal(replay.statusCode, 200, replay.body);
      assert.equal(replay.json().id, replies[0]!.json().id);
      assert.equal(await countAttempts(), 2);
      const progress = await app.inject({
        method: "GET",
        url: trial.base + "/trial-progress",
        headers: trial.headers,
      });
      assert.equal(progress.json().remaining, 0);
      assert.equal(progress.json().totals.answered, 2);

      const report = await app.inject({
        method: "POST",
        url: trial.base + "/problem-flags",
        headers: trial.headers,
        payload: {
          problemId: first.id,
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
      assert.equal(flag.response_kind, "multi-select");
      assert.equal(flag.response, privateFirst.answer);

      const skipped = await serve(foreign);
      const skip = await app.inject({
        method: "POST",
        url: foreign.base + "/skips",
        headers: foreign.headers,
        payload: { problemId: skipped.id },
      });
      assert.equal(skip.statusCode, 200, skip.body);
      assert.equal(skip.json().skipped, true);
      assert.equal(
        (
          await send(
            {
              problemId: skipped.id,
              requestId: randomUUID(),
              response: generateProblem(skipped.templateId, skipped.seed)
                .answer,
            },
            foreign.headers,
            foreign.base,
          )
        ).statusCode,
        409,
      );
      const legacy = await create();
      const numeric = await serve(legacy, "count-objects");
      const answer = generateProblem(numeric.templateId, numeric.seed).answer;
      const oldInput = {
        problemId: numeric.id,
        requestId: randomUUID(),
        response: answer,
      };
      assert.equal(
        (await send(oldInput, legacy.headers, legacy.base)).statusCode,
        200,
      );
      assert.equal(
        (
          await send(
            { ...oldInput, response: answer + ".0" },
            legacy.headers,
            legacy.base,
          )
        ).statusCode,
        409,
      );
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
