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
      for (const templateId of [
        "fraction-equivalence-choice",
        "equation-solution-count",
        "graph-equation-choice",
      ]) {
        const batch = await app.inject({
          method: "POST",
          url: `${path}/batches`,
          payload: { templateId, count: 1 },
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
