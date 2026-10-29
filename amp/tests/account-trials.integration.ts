import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { FamilyRepository } from "../src/family/repository";
import { recordEventBatch } from "../src/analytics/repository";
import { eventBatchSchema } from "../src/analytics/events";
import { migrate } from "../scripts/migrate";
import { PostgresRepository } from "../src/server/repository";

test(
  "account trials resume, serialize creation, isolate owners and claim legacy tokens once",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `account_trials_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repo = new PostgresRepository(scoped.href, { development: true });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const starts = await Promise.all(
        Array.from({ length: 8 }, () => repo.createTrial(2013, "parent-a")),
      );
      assert.equal(new Set(starts.map((s) => s.learnerId)).size, 1);
      const current = await repo.currentTrial("parent-a");
      assert.equal(current?.learnerId, starts[0].learnerId);
      assert.equal(current?.birthYear, 2013);
      assert.ok(await repo.trialAccount(current!.token, "parent-a"));
      assert.equal(await repo.trialAccount(current!.token, "parent-b"), null);
      assert.equal(await repo.trialAccount(current!.token), null);
      assert.equal(await repo.currentTrial("parent-b", current!.token), null);
      await assert.rejects(
        repo.adoptTrial("parent-b", current!.token, "Learner"),
      );
      const legacy = await repo.createTrial(2016);
      const claims = await Promise.all([
        repo.currentTrial("parent-c", legacy.token),
        repo.currentTrial("parent-d", legacy.token),
      ]);
      assert.equal(claims.filter(Boolean).length, 1);
      const winner = claims[0] ? "parent-c" : "parent-d";
      assert.ok(await repo.trialAccount(legacy.token, winner));
      assert.equal(await repo.trialAccount(legacy.token, "parent-b"), null);
      await repo.pool.query(
        "UPDATE amp_trials SET expires_at=now()-interval '1 second' WHERE learner_id=$1",
        [current!.learnerId],
      );
      assert.equal(await repo.currentTrial("parent-a"), null);
      assert.equal(await repo.trialAccount(current!.token, "parent-a"), null);
      const fresh = await repo.createTrial(2014, "parent-a");
      assert.notEqual(fresh.learnerId, current!.learnerId);
      const family = new FamilyRepository(repo.pool, true);
      const exported: string[] = [];
      for await (const line of family.export("parent-a")) exported.push(line);
      assert.ok(exported.join("").includes(fresh.learnerId));
      assert.ok(!exported.join("").includes(legacy.learnerId));
      await family.deleteLearning("parent-a");
      assert.equal(await repo.currentTrial("parent-a"), null);
      assert.equal(
        (
          await repo.pool.query(
            "SELECT id FROM amp_learners WHERE id=ANY($1)",
            [[fresh.learnerId, current!.learnerId]],
          )
        ).rowCount,
        0,
      );
      assert.equal(
        await recordEventBatch(
          repo.pool,
          eventBatchSchema.parse({
            visitorId: randomUUID(),
            events: [
              { at: Date.now(), event: "try_click", props: {} },
              { at: Date.now(), event: "trial_problem_view", props: {} },
              {
                at: Date.now(),
                event: "auth_failure",
                props: { method: "passkey", reason: "cancelled" },
              },
            ],
          }),
        ),
        3,
      );
    } finally {
      await repo.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
