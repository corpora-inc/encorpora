import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate";
import { PostgresRepository } from "../src/server/repository";
import { buildApp } from "../src/server/app";
import { generateProblem } from "../src/math/engine";
const url = process.env.AMP_TEST_DATABASE_URL;
test(
  "PostgreSQL API ownership, durable attempts, idempotency, hints and access grants",
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
    let learnerId = "";
    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/learners",
        payload: { name: "Math explorer" },
      });
      assert.equal(created.statusCode, 201);
      learnerId = created.json().id;
      const path = `/api/v1/learners/${learnerId}`;
      const stolen = await app.inject({
        method: "POST",
        url: `${path}/batches`,
        headers: { "x-test-account": "other" },
        payload: {},
      });
      assert.equal(stolen.statusCode, 404);
      const batch = await app.inject({
        method: "POST",
        url: `${path}/batches`,
        payload: { templateId: "add-within-20", count: 2 },
      });
      assert.equal(batch.statusCode, 200);
      const publicProblem = batch.json().problems[0];
      assert.ok(!("answer" in publicProblem));
      assert.ok(!("explanation" in publicProblem));
      const answer = generateProblem(
        publicProblem.templateId,
        publicProblem.seed,
      ).answer;
      const input = {
        problemId: publicProblem.id,
        requestId: randomUUID(),
        response: answer,
      };
      const [first, duplicate] = await Promise.all([
        app.inject({ method: "POST", url: `${path}/attempts`, payload: input }),
        app.inject({ method: "POST", url: `${path}/attempts`, payload: input }),
      ]);
      assert.equal(first.statusCode, 200);
      assert.equal(duplicate.statusCode, 200);
      assert.deepEqual(first.json(), duplicate.json());
      assert.equal(first.json().correct, true);
      assert.equal(first.json().assisted, false);
      const mismatch = await app.inject({
        method: "POST",
        url: `${path}/attempts`,
        payload: { ...input, response: "999" },
      });
      assert.equal(mismatch.statusCode, 409);
      const twice = await app.inject({
        method: "POST",
        url: `${path}/attempts`,
        payload: { ...input, requestId: randomUUID() },
      });
      assert.equal(twice.statusCode, 409);
      const second = batch.json().problems[1];
      const malformed = await app.inject({
        method: "POST",
        url: `${path}/attempts`,
        payload: {
          problemId: second.id,
          requestId: randomUUID(),
          response: "banana",
        },
      });
      assert.equal(malformed.statusCode, 400);
      const hint = await app.inject({
        method: "POST",
        url: `${path}/hints`,
        payload: { problemId: second.id },
      });
      assert.equal(hint.statusCode, 200);
      const helped = await app.inject({
        method: "POST",
        url: `${path}/attempts`,
        payload: {
          problemId: second.id,
          requestId: randomUUID(),
          response: generateProblem(second.templateId, second.seed).answer,
        },
      });
      assert.equal(helped.json().assisted, true);
      const progress = await app.inject({
        method: "GET",
        url: `${path}/progress`,
      });
      const addition = progress
        .json()
        .skills.find(
          (s: { skillId: string }) => s.skillId === "addition-within-20",
        );
      assert.equal(addition.attempts, 2);
      assert.equal(addition.independentCorrect, 1);
      const mixed = await app.inject({
        method: "POST",
        url: `${path}/batches`,
        payload: { count: 3 },
      });
      assert.equal(mixed.statusCode, 200);
      assert.equal(
        new Set(
          mixed
            .json()
            .selection.map((entry: { strand: string }) => entry.strand),
        ).size,
        3,
      );
      const supportProblem = mixed.json().problems[0];
      const stolenSupport = await app.inject({
        method: "POST",
        url: `${path}/lesson-support`,
        headers: { "x-test-account": "other" },
        payload: { problemId: supportProblem.id },
      });
      assert.equal(stolenSupport.statusCode, 404);
      const support = await app.inject({
        method: "POST",
        url: `${path}/lesson-support`,
        payload: { problemId: supportProblem.id },
      });
      assert.equal(support.statusCode, 200);
      const supportedAnswer = await app.inject({
        method: "POST",
        url: `${path}/attempts`,
        payload: {
          problemId: supportProblem.id,
          requestId: randomUUID(),
          response: generateProblem(
            supportProblem.templateId,
            supportProblem.seed,
          ).answer,
        },
      });
      assert.equal(supportedAnswer.statusCode, 200);
      assert.equal(supportedAnswer.json().assisted, true);
      const reopened = new PostgresRepository(url!, { development: true });
      assert.equal((await reopened.list(account))[0].id, learnerId);
      await reopened.close();
      const hosted = buildApp({
        repository,
        authenticate: async () => account,
      });
      try {
        const denied = await hosted.inject({
          method: "POST",
          url: `${path}/batches`,
          payload: {},
        });
        assert.equal(denied.statusCode, 403);
        await repository.pool.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'test','test-only','fixture')",
          [account],
        );
        const unlicensed = await hosted.inject({
          method: "POST",
          url: `${path}/batches`,
          payload: {},
        });
        assert.equal(unlicensed.statusCode, 403);
        assert.match(unlicensed.json().error, /license/);
        await repository.pool.query(
          "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'pilot',$1,'active',now()-interval '1 hour',now()+interval '1 hour')",
          [randomUUID(), learnerId],
        );
        const licensed = await hosted.inject({
          method: "POST",
          url: `${path}/batches`,
          payload: {},
        });
        assert.equal(licensed.statusCode, 200);
        await repository.pool.query(
          "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id=$1",
          [account],
        );
        const withdrawn = await hosted.inject({
          method: "GET",
          url: `${path}/progress`,
        });
        assert.equal(withdrawn.statusCode, 403);
        await repository.pool.query(
          "DELETE FROM amp_parent_consents WHERE account_id=$1",
          [account],
        );
      } finally {
        await hosted.close();
      }
    } finally {
      if (learnerId)
        await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
          learnerId,
        ]);
      await app.close();
      await repository.close();
    }
  },
);
