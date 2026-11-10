import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
const url = process.env.AMP_TEST_DATABASE_URL;
test(
  "a reload serves the open problem again until it is answered or skipped",
  { skip: !url },
  async () => {
    await migrate(url!);
    const repository = new PostgresRepository(url!, { development: true });
    const account = `test:${randomUUID()}`;
    const app = buildApp({
      repository,
      development: true,
      authenticate: async () => account,
    });
    const learner = await repository.create(account, "Resume explorer");
    const path = `/api/v1/learners/${learner.id}`;
    const batch = async (body: Record<string, unknown> = {}) => {
      const response = await app.inject({
        method: "POST",
        url: `${path}/batches`,
        payload: { count: 1, ...body },
      });
      assert.equal(response.statusCode, 200, response.body);
      return response.json().problems[0] as { id: string };
    };
    const instances = async () =>
      (
        await repository.pool.query(
          "SELECT count(*)::int AS total FROM amp_instances WHERE learner_id=$1",
          [learner.id],
        )
      ).rows[0].total as number;
    try {
      const open = await batch();
      const before = await instances();
      assert.equal((await batch({ resumeProblemId: open.id })).id, open.id);
      assert.equal(await instances(), before, "resuming draws nothing new");
      // Unknown or foreign ids fall back to a new problem, never an error.
      assert.notEqual(
        (await batch({ resumeProblemId: `missing-${randomUUID()}` })).id,
        open.id,
      );
      const answered = await app.inject({
        method: "POST",
        url: `${path}/attempts`,
        payload: { problemId: open.id, requestId: randomUUID(), response: "0" },
      });
      assert.equal(answered.statusCode, 200, answered.body);
      assert.notEqual((await batch({ resumeProblemId: open.id })).id, open.id);
      const skipped = await batch();
      const skip = await app.inject({
        method: "POST",
        url: `${path}/skips`,
        payload: { problemId: skipped.id },
      });
      assert.equal(skip.statusCode, 200, skip.body);
      assert.notEqual(
        (await batch({ resumeProblemId: skipped.id })).id,
        skipped.id,
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
