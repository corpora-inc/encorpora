import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate";
import { PostgresRepository } from "../src/server/repository";
import { buildApp } from "../src/server/app";
import { FamilyRepository } from "../src/family/repository";
import { satPracticeEligible } from "../src/curriculum/sat";
import { templates, generateProblem } from "../src/math/engine";
import { figureCapabilities } from "../src/math/contracts";
const url = process.env.AMP_TEST_DATABASE_URL;
test(
  "SAT setting persists per learner, enforces ownership, and preserves active problems and evidence",
  { skip: !url },
  async () => {
    await migrate(url!);
    const repository = new PostgresRepository(url!, { development: true });
    const account = `sat-test:${randomUUID()}`;
    const app = buildApp({
      repository,
      development: true,
      authenticate: async (req) =>
        String(req.headers["x-test-account"] ?? account),
    });
    try {
      const first = await repository.create(account, "SAT learner", 2010);
      const sibling = await repository.create(account, "General learner", 2016);
      const path = `/api/v1/learners/${first.id}`;
      const families = new FamilyRepository(repository.pool, true);
      assert.equal(
        (await families.summary(account)).learners.find(
          (l) => l.id === first.id,
        )!.satMathFocus,
        false,
      );
      const active = await app.inject({
        method: "POST",
        url: `${path}/batches`,
        payload: { templateId: "logarithm-integer", count: 1 },
      });
      assert.equal(active.statusCode, 200, active.body);
      const problem = active.json().problems[0];
      const stolen = await app.inject({
        method: "POST",
        url: `${path}/practice-settings`,
        headers: { "x-test-account": "another-account" },
        payload: { satMathFocus: true },
      });
      assert.equal(stolen.statusCode, 404);
      for (const payload of [
        { satMathFocus: "true" },
        { satMathFocus: true, extra: 1 },
        {},
      ]) {
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: `${path}/practice-settings`,
              payload,
            })
          ).statusCode,
          400,
        );
      }
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `${path}/practice-settings`,
            payload: { satMathFocus: true },
          })
        ).statusCode,
        200,
      );
      const family = await families.summary(account);
      assert.equal(
        family.learners.find((l) => l.id === first.id)!.satMathFocus,
        true,
      );
      assert.equal(
        family.learners.find((l) => l.id === sibling.id)!.satMathFocus,
        false,
      );
      assert.equal(
        (await repository.list(account)).find((l) => l.id === first.id)!
          .satMathFocus,
        true,
      );
      for (let i = 0; i < 5; i++) {
        const batch = await app.inject({
          method: "POST",
          url: `${path}/batches`,
          payload: {
            count: 5,
            responseCapabilities: ["single-choice-v1"],
            figureCapabilities: [...figureCapabilities],
          },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        assert(
          batch
            .json()
            .problems.every((p: { templateId: string }) =>
              satPracticeEligible(
                templates.find((t) => t.id === p.templateId)!,
              ),
            ),
        );
      }
      // Already served work is answerable even when it is beyond the new scope.
      const answer = generateProblem(problem.templateId, problem.seed).answer;
      const attempt = await app.inject({
        method: "POST",
        url: `${path}/attempts`,
        payload: {
          problemId: problem.id,
          requestId: randomUUID(),
          response: answer,
        },
      });
      assert.equal(attempt.statusCode, 200, attempt.body);
      assert.equal(attempt.json().correct, true);
      // An explicit learner-selected drill can intentionally leave the automatic scope.
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `${path}/batches`,
            payload: { templateId: "logarithm-integer", count: 1 },
          })
        ).statusCode,
        200,
      );
      await app.inject({
        method: "POST",
        url: `${path}/practice-settings`,
        payload: { satMathFocus: false },
      });
      await repository.transaction(account, first.id, async (tx) => {
        assert.equal(await tx.satMathFocus(), false);
        assert.equal((await tx.recentAttempts()).length, 1);
      });
    } finally {
      await app.close();
      await repository.pool.query(
        "DELETE FROM amp_learners WHERE account_id=$1",
        [account],
      );
      await repository.close();
    }
  },
);
