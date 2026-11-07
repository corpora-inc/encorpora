import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { buildApp } from "../src/server/app";
import { CHECKPOINT_EVERY } from "../src/server/learner-frontier";
import { PgTransaction, PostgresRepository } from "../src/server/repository";

test(
  "a learner's level is stored as they answer and always matches replaying their history",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `learner_frontier_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const repository = new PostgresRepository(scoped.href, {
      development: false,
      freeProblems: 1000,
    });
    try {
      const trial = await repository.createTrial(2015);
      const account = (await repository.trialAccount(trial.token))!;
      const app = buildApp({
        repository,
        development: false,
        logger: false,
        authenticate: async () => account,
      } as never);
      await app.ready();
      const base = `/api/v1/learners/${trial.learnerId}`;
      const headers = { authorization: "Bearer test" };
      const answer = async (count: number) => {
        for (let done = 0; done < count;) {
          const batch = await app.inject({
            method: "POST",
            url: `${base}/batches`,
            headers,
            payload: { count: Math.min(3, count - done) },
          });
          assert.equal(batch.statusCode, 200, batch.body);
          for (const problem of batch.json().problems) {
            const attempt = await app.inject({
              method: "POST",
              url: `${base}/attempts`,
              headers,
              payload: {
                problemId: problem.id,
                requestId: randomUUID(),
                response: done % 3 ? "1" : "2",
              },
            });
            assert.equal(attempt.statusCode, 200, attempt.body);
            done += 1;
          }
        }
      };
      const now = Date.now();
      /** Stored and fully replayed levels, read in one transaction. */
      const both = () =>
        repository.transaction(account, trial.learnerId, async (tx) => ({
          stored: await tx.frontier(now),
          replayed: await (tx as PgTransaction).frontier(now, 1_000_000),
        }));
      const row = async () =>
        (
          await repository.pool.query(
            "SELECT state,updated_at FROM amp_frontier_states WHERE learner_id=$1",
            [trial.learnerId],
          )
        ).rows[0] as { state: string; updated_at: Date } | undefined;

      // Too few answers to be worth a write.
      await answer(CHECKPOINT_EVERY - 5);
      let { stored, replayed } = await both();
      assert.deepEqual(stored, replayed);
      assert.equal(await row(), undefined);

      // Enough new answers: the level is stored.
      await answer(10);
      ({ stored, replayed } = await both());
      assert.deepEqual(stored, replayed);
      const first = await row();
      assert.ok(first, "stored after enough answers");

      // A few more are folded in from the stored level without rewriting it.
      await answer(4);
      ({ stored, replayed } = await both());
      assert.deepEqual(stored, replayed);
      assert.equal((await row())!.state, first.state);

      // A damaged state is replaced by replaying the history.
      await repository.pool.query(
        "UPDATE amp_frontier_states SET state='{damaged' WHERE learner_id=$1",
        [trial.learnerId],
      );
      ({ stored, replayed } = await both());
      assert.deepEqual(stored, replayed);
      assert.notEqual((await row())!.state, "{damaged");

      // Starting over changes the epoch, and the stored level no longer applies.
      const settings = await app.inject({
        method: "GET",
        url: `${base}/practice-state`,
        headers,
      });
      const reset = await app.inject({
        method: "POST",
        url: `${base}/practice-state`,
        headers,
        payload: {
          requestId: randomUUID(),
          revision: settings.json().revision,
          kind: "reset",
        },
      });
      assert.equal(reset.statusCode, 200, reset.body);
      ({ stored, replayed } = await both());
      assert.deepEqual(stored, replayed);
      assert.equal(stored.overall.answered, 0);

      // Every other reader of a learner's history still works from the route.
      const route = await app.inject({
        method: "GET",
        url: `${base}/frontier`,
        headers,
      });
      assert.equal(route.statusCode, 200, route.body);
      await app.close();

      // The stored level goes with the learner.
      await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
        trial.learnerId,
      ]);
      assert.equal(await row(), undefined);
    } finally {
      await repository.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
