import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight";
import { PostgresRepository } from "../src/server/repository";
import { generateProblem } from "../src/math/engine";

test(
  "production frontier uses the retained problem version and preserves unsupported-version attempts",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `amp_frontier_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const trial = await repository.createTrial(2016);
      const account = (await repository.trialAccount(trial.token))!;
      const problem = generateProblem("multiply-facts", randomUUID());
      await repository.transaction(account, trial.learnerId, async (tx) => {
        await tx.saveProblem(problem);
        await tx.saveAttempt({
          id: randomUUID(),
          requestId: randomUUID(),
          problemId: problem.public.id,
          templateId: problem.public.templateId,
          skillId: problem.public.skillId,
          correct: true,
          assisted: false,
          response: problem.answer,
          answer: problem.answer,
          explanation: problem.explanation,
          createdAt: new Date().toISOString(),
        });
        assert.equal((await tx.frontier()).overall.answered, 1);
      });
      // Simulate a retained future/unsupported generator version at the storage
      // boundary; public version-one schemas deliberately cannot submit it.
      await repository.pool.query(
        "UPDATE amp_instances SET content=jsonb_set(content,'{public,templateVersion}','2') WHERE id=$1",
        [problem.public.id],
      );
      await repository.transaction(account, trial.learnerId, async (tx) => {
        assert.equal((await tx.frontier()).overall.answered, 0);
        assert.equal((await tx.skillEvidence())[0]!.attempts, 1);
      });
    } finally {
      await repository.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
