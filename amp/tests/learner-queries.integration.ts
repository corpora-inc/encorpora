import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { generateProblem, templates } from "../src/math/engine";
import { PostgresRepository } from "../src/server/repository";

test(
  "reads inside a transaction see its own changes, and batches save and count like single rows",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `learner_queries_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const repository = new PostgresRepository(scoped.href, {
      development: false,
      freeProblems: 50,
    });
    try {
      const trial = await repository.createTrial(2015);
      const account = (await repository.trialAccount(trial.token))!;
      const inTransaction = <T>(
        run: Parameters<typeof repository.transaction<T>>[2],
      ) => repository.transaction(account, trial.learnerId, run);

      await inTransaction(async (tx) => {
        assert.equal(await tx.birthYear(), 2015);
        const before = (await tx.frontier()).expected;
        await tx.setBirthYear(2010);
        assert.equal(await tx.birthYear(), 2010);
        assert.equal((await tx.frontier()).expected, before + 5);
        assert.equal(await tx.satMathFocus(), false);
        await tx.setSatMathFocus(true);
        assert.equal(await tx.satMathFocus(), true);
        await tx.setSatMathFocus(false);
      });
      await inTransaction(async (tx) => {
        assert.equal(await tx.birthYear(), 2010, "kept after commit");
      });

      const family = templates.find((t) => !t.requiredResponseCapability)!;
      const problem = (seed: string) => generateProblem(family.id, seed);
      const saved = ["one", "two", "three"].map(problem);
      await inTransaction((tx) => tx.saveProblems(saved));
      await inTransaction(async (tx) => {
        for (const expected of saved)
          assert.deepEqual(
            (await tx.problem(expected.public.id))?.public,
            expected.public,
          );
      });

      // Another learner can't overwrite a problem by reusing its id.
      const other = await repository.createTrial(2012);
      const otherAccount = (await repository.trialAccount(other.token))!;
      await repository.transaction(otherAccount, other.learnerId, (tx) =>
        tx.saveProblems([{ ...saved[0]!, answer: "changed" } as never]),
      );
      await inTransaction(async (tx) => {
        assert.deepEqual(
          (await tx.problem(saved[0]!.public.id))?.answer,
          saved[0]!.answer,
        );
      });

      // Counted in the database, as the rows themselves would count.
      const outcome = (correct: boolean, assisted: boolean, id: string) => ({
        id: randomUUID(),
        problemId: id,
        requestId: randomUUID(),
        correct,
        assisted,
        templateId: family.id,
        skillId: family.skillId,
        response: "1",
        createdAt: new Date().toISOString(),
      });
      const skipped = problem("skipped");
      await inTransaction(async (tx) => {
        await tx.saveAttempt(
          outcome(true, false, saved[0]!.public.id) as never,
        );
        await tx.saveAttempt(outcome(true, true, saved[1]!.public.id) as never);
        await tx.saveAttempt(
          outcome(false, false, saved[2]!.public.id) as never,
        );
        await tx.saveSkip({
          ...skipped,
          skipped: true,
          skippedAt: new Date().toISOString(),
        } as never);
      });
      await inTransaction(async (tx) => {
        const progress = (await tx.trialProgress())!;
        assert.deepEqual(progress.totals, {
          answered: progress.totals.answered,
          correct: 2,
          assisted: 1,
          skipped: 1,
        });
        assert.ok(progress.totals.answered >= 3);
        assert.equal(progress.remaining, 50 - progress.totals.answered);
        assert.equal(await tx.trialRemaining(), progress.remaining);
      });
    } finally {
      await repository.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
