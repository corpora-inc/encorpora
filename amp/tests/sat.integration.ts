import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { satTasks } from "../src/curriculum/sat-tasks";
import { satPracticeConfiguration } from "../src/learning/assessment-profile";
import {
  createPracticePolicy,
  practiceParameters,
  type PracticePolicy,
} from "../src/learning/practice-policy";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate";
import { PostgresRepository } from "../src/server/repository";
import { buildApp } from "../src/server/app";
import { FamilyRepository } from "../src/family/repository";
import { templates, generateProblem } from "../src/math/engine";
import { clientCanDraw, figureCapabilities } from "../src/math/contracts";
const url = process.env.AMP_TEST_DATABASE_URL;
test(
  "SAT setting persists per learner, enforces ownership, and preserves active problems and evidence",
  { skip: !url },
  async () => {
    const schema = `amp_sat_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url!, max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(url!);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await migrate(scoped.href);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const parameters = practiceParameters();
    parameters.version = "sat-integration-custom";
    parameters.target.levelOffset = -0.75;
    const basePolicy = createPracticePolicy(parameters);
    const capabilities = {
      responseCapabilities: ["single-choice-v1"] as const,
      figureCapabilities: [...figureCapabilities],
    };
    const supported = templates.filter((t) => clientCanDraw(t, capabilities));
    const satPolicy = satPracticeConfiguration(supported, basePolicy).policy;
    const mapped = new Set(satTasks.flatMap((task) => task.templateIds));
    const account = `sat-test:${randomUUID()}`;
    const app = buildApp({
      repository,
      development: true,
      practicePolicy: basePolicy,
      authenticate: async (req) =>
        String(req.headers["x-test-account"] ?? account),
    });
    try {
      const first = await repository.create(account, "SAT learner", 2010);
      const sibling = await repository.create(account, "General learner", 2016);
      const path = `/api/v1/learners/${first.id}`;
      async function assertPolicy(
        learner: string,
        id: string,
        policy: PracticePolicy,
        trace = true,
      ) {
        await repository.transaction(account, learner, async (tx) => {
          const saved = await tx.problem(id);
          const selection = saved?.selection as {
            practiceFingerprint: string;
            trace?: { policyFingerprint: string };
          };
          assert.equal(selection.practiceFingerprint, policy.fingerprint);
          if (trace)
            assert.equal(
              selection.trace?.policyFingerprint,
              policy.fingerprint,
            );
        });
      }
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
      const resumed = await app.inject({
        method: "POST",
        url: `${path}/batches`,
        payload: { resumeProblemId: problem.id },
      });
      assert.equal(resumed.statusCode, 200, resumed.body);
      assert.deepEqual(resumed.json().problems, [problem]);
      await assertPolicy(first.id, problem.id, basePolicy, false);
      for (let i = 0; i < 5; i++) {
        const batch = await app.inject({
          method: "POST",
          url: `${path}/batches`,
          payload: {
            count: 5,
            ...capabilities,
            // Recovery cannot reintroduce an unmapped family, even if its
            // requested strand has no supported SAT content.
            ...(i === 0 ? { recoveryStrand: "arithmetic" } : {}),
          },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        for (const selected of batch.json().problems) {
          assert(mapped.has(selected.templateId), selected.templateId);
          await assertPolicy(first.id, selected.id, satPolicy);
        }
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
      for (const learner of [first.id, sibling.id]) {
        const general = await app.inject({
          method: "POST",
          url: `/api/v1/learners/${learner}/batches`,
          payload: { count: 1, ...capabilities },
        });
        assert.equal(general.statusCode, 200, general.body);
        await assertPolicy(
          learner,
          general.json().problems[0].id,
          basePolicy,
          false,
        );
      }
      await repository.transaction(account, first.id, async (tx) => {
        assert.equal(await tx.satMathFocus(), false);
        assert.equal((await tx.recentAttempts()).length, 1);
      });
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
