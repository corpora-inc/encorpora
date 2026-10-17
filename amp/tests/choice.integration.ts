import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { generateProblem } from "../src/math/engine.js";
const url = process.env.AMP_TEST_DATABASE_URL;
test(
  "choice attempts validate owned immutable options, replay once and expose only selected feedback",
  { skip: !url },
  async () => {
    await migrate(url!);
    const repository = new PostgresRepository(url!, { development: true });
    const account = `test:${randomUUID()}`;
    const app = buildApp({
      repository,
      development: true,
      authenticate: async (request) =>
        String(request.headers["x-test-account"] ?? account),
    });
    const learner = await repository.create(account, "Choice explorer");
    const path = `/api/v1/learners/${learner.id}`;
    try {
      const instanceCount = async () =>
        (
          await repository.pool.query(
            "SELECT count(*)::int AS total FROM amp_instances WHERE learner_id=$1",
            [learner.id],
          )
        ).rows[0].total as number;
      for (const templateId of [
        "fraction-equivalence-choice",
        "equation-solution-count",
        "graph-equation-choice",
      ]) {
        const beforeUnsupported = await instanceCount();
        const unsupported = await app.inject({
          method: "POST",
          url: `${path}/batches`,
          payload: { templateId, count: 1 },
        });
        assert.equal(unsupported.statusCode, 400);
        assert.equal(await instanceCount(), beforeUnsupported);
        assert.match(unsupported.json().error, /updated app/);
        const batch = await app.inject({
          method: "POST",
          url: `${path}/batches`,
          payload: {
            templateId,
            count: 1,
            responseCapabilities: ["single-choice-v1"],
          },
        });
        assert.equal(batch.statusCode, 200);
        const p = batch.json().problems[0];
        assert.equal(p.response.kind, "choice");
        assert.equal("answer" in p, false);
        assert.equal("choiceFeedback" in p, false);
        const privateProblem = generateProblem(p.templateId, p.seed);
        const wrong = p.response.options.find(
          (o: { id: string }) => o.id !== privateProblem.answer,
        ).id;
        const input = {
          problemId: p.id,
          requestId: randomUUID(),
          response: wrong,
        };
        const foreign = await app.inject({
          method: "POST",
          url: `${path}/attempts`,
          headers: { "x-test-account": "foreign" },
          payload: input,
        });
        assert.equal(foreign.statusCode, 404);
        for (const response of [
          "option-z",
          "123",
          p.response.options[0].label,
        ]) {
          const invalid = await app.inject({
            method: "POST",
            url: `${path}/attempts`,
            payload: { ...input, response },
          });
          assert.equal(invalid.statusCode, 400);
        }
        const [first, replay] = await Promise.all(
          [0, 1].map(() =>
            app.inject({
              method: "POST",
              url: `${path}/attempts`,
              payload: input,
            }),
          ),
        );
        assert.equal(first.statusCode, 200);
        assert.deepEqual(first.json(), replay.json());
        assert.equal(first.json().correct, false);
        assert.deepEqual(first.json().explanation, [
          privateProblem.choiceFeedback![wrong],
          ...privateProblem.explanation,
        ]);
        assert.equal("choiceFeedback" in first.json(), false);
        const changed = await app.inject({
          method: "POST",
          url: `${path}/attempts`,
          payload: { ...input, response: privateProblem.answer },
        });
        assert.equal(changed.statusCode, 409);
        const repeat = await app.inject({
          method: "POST",
          url: `${path}/attempts`,
          payload: { ...input, requestId: randomUUID() },
        });
        assert.equal(repeat.statusCode, 409);
      }
      const legacy = await app.inject({
        method: "POST",
        url: `${path}/batches`,
        payload: { count: 5 },
      });
      assert.equal(legacy.statusCode, 200);
      assert.ok(
        legacy
          .json()
          .problems.every((problem: { response: { kind: string } }) =>
            ["number", "fraction"].includes(problem.response.kind),
          ),
      );
      const { rows } = await repository.pool.query(
        "SELECT count(*)::int AS total FROM amp_attempts WHERE learner_id=$1",
        [learner.id],
      );
      assert.equal(rows[0].total, 3);
    } finally {
      await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
        learner.id,
      ]);
      await app.close();
      await repository.close();
    }
  },
);

test(
  "legacy clients exclude a choice-only skill even when advanced evidence makes it due",
  { skip: !url },
  async () => {
    await migrate(url!);
    const repository = new PostgresRepository(url!, { development: true });
    const account = `test:${randomUUID()}`;
    const learner = await repository.create(account, "Compatibility explorer");
    const app = buildApp({
      repository,
      development: true,
      authenticate: async () => account,
    });
    try {
      await repository.transaction(account, learner.id, async (tx) => {
        for (const [index, correct] of [true, false].entries()) {
          const p = generateProblem("graph-equation-choice", randomUUID());
          await tx.saveProblem(p);
          await tx.saveAttempt({
            id: randomUUID(),
            requestId: randomUUID(),
            problemId: p.public.id,
            skillId: p.public.skillId,
            templateId: p.public.templateId,
            response: correct ? p.answer : Object.keys(p.choiceFeedback!)[0]!,
            correct,
            assisted: false,
            answer: p.answer,
            explanation: p.explanation,
            createdAt: new Date(
              Date.now() - (2 - index) * 86400000,
            ).toISOString(),
          });
        }
      });
      const legacy = await app.inject({
        method: "POST",
        url: `/api/v1/learners/${learner.id}/batches`,
        payload: { count: 5 },
      });
      const modern = await app.inject({
        method: "POST",
        url: `/api/v1/learners/${learner.id}/batches`,
        payload: { count: 5, responseCapabilities: ["single-choice-v1"] },
      });
      assert.equal(legacy.statusCode, 200);
      assert.equal(modern.statusCode, 200);
      assert.ok(
        modern
          .json()
          .problems.some(
            (p: { templateId: string }) =>
              p.templateId === "graph-equation-choice",
          ),
        "Positive control: due choice-only skill is eligible for a capable client",
      );
      assert.ok(
        legacy
          .json()
          .problems.every(
            (p: { response: { kind: string } }) => p.response.kind !== "choice",
          ),
      );
    } finally {
      await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
        learner.id,
      ]);
      await app.close();
      await repository.close();
    }
  },
);
