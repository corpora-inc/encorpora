import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { seedProgress } from "./progress.fixture.js";
import type { ProgressSnapshot } from "../src/server/progress.js";
const url = process.env.AMP_TEST_DATABASE_URL;
test(
  "progress projects ordered private evidence without exposing internal attempt identifiers",
  { skip: !url },
  async () => {
    await migrate(url!);
    const repository = new PostgresRepository(url!, { development: true }),
      account = `progress:${randomUUID()}`;
    const learner = await seedProgress(repository, account);
    const app = buildApp({
      repository,
      development: true,
      authenticate: async (request) =>
        String(request.headers["x-account"] ?? account),
    });
    try {
      const response = await app.inject({
        url: `/api/v1/learners/${learner.id}/progress`,
      });
      assert.equal(response.statusCode, 200);
      const snapshot = response.json<ProgressSnapshot>();
      assert.ok(Number.isFinite(Date.parse(snapshot.asOf)));
      const count = snapshot.skills.find((s) => s.skillId === "count-to-20")!;
      assert.equal(count.attempts, 5);
      assert.equal(count.independentOccasions, 1);
      assert.equal(count.recent.length, 5);
      assert.ok(Date.parse(count.reviewDueAt!) > Date.parse(snapshot.asOf));
      assert.ok(count.recent.every((o) => o.correct && !o.assisted));
      assert.deepEqual(Object.keys(count.recent[0]!).sort(), [
        "assisted",
        "at",
        "correct",
      ]);
      const multiply = snapshot.skills.find(
        (s) => s.skillId === "multiplication-facts",
      )!;
      assert.equal(multiply.independentOccasions, 2);
      const helped = snapshot.skills.find(
        (s) => s.skillId === "fraction-equivalence",
      )!;
      assert.equal(helped.independentOccasions, 0);
      assert.equal(helped.recent[0]!.assisted, true);
      assert.ok(Date.parse(helped.reviewDueAt!) < Date.parse(snapshot.asOf));
      const untouched = snapshot.skills.find((s) => s.attempts === 0)!;
      assert.deepEqual(untouched.recent, []);
      assert.equal(untouched.reviewDueAt, null);
      assert.equal(
        (
          await app.inject({
            url: `/api/v1/learners/${learner.id}/progress`,
            headers: { "x-account": "foreign" },
          })
        ).statusCode,
        404,
      );
      await repository.pool.query(
        "UPDATE amp_learners SET deleted_at=now() WHERE id=$1",
        [learner.id],
      );
      assert.equal(
        (await app.inject({ url: `/api/v1/learners/${learner.id}/progress` }))
          .statusCode,
        404,
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
