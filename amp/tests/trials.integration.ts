import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { generateProblem } from "../src/math/engine.js";
import { purgeExpiredTrials, TRIAL_ATTEMPTS } from "../src/server/trials.js";

test(
  "an anonymous trial practices, hits its paywall, and is adopted with its progress",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_trials_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    // The parent authenticator: only bearer tokens identify a parent.
    const app = buildApp({
      repository,
      development: true,
      authenticate: async (request) => {
        if (request.headers.authorization !== "Bearer parent")
          throw Object.assign(new Error("Sign in to continue"), {
            statusCode: 401,
          });
        return "trial-parent";
      },
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);

      const created = await app.inject({
        method: "POST",
        url: "/api/v1/trials",
        payload: { birthYear: 2016 },
      });
      assert.equal(created.statusCode, 201);
      const { token, learnerId } = created.json();
      assert.match(token, /^[A-Za-z0-9_-]{40,}$/);
      const trial = { authorization: `Trial ${token}` };

      // The trial sees only its own nameless learner.
      const listed = await app.inject({
        method: "GET",
        url: "/api/v1/learners",
        headers: trial,
      });
      assert.deepEqual(
        listed.json().learners.map((l: { id: string }) => l.id),
        [learnerId],
      );
      // Trials cannot add learners or use an invalid token.
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/learners",
            headers: trial,
            payload: { name: "Another" },
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await app.inject({
            method: "GET",
            url: "/api/v1/learners",
            headers: { authorization: `Trial ${"x".repeat(43)}` },
          })
        ).statusCode,
        401,
      );

      // Practice until the allowance is used, then the paywall. A problem
      // fetched in advance cannot be answered past the allowance.
      const base = `/api/v1/learners/${learnerId}`;
      const stockpiled = (
        await app.inject({
          method: "POST",
          url: `${base}/batches`,
          headers: trial,
          payload: { count: 1 },
        })
      ).json().problems[0];
      let answered = 0;
      while (answered < TRIAL_ATTEMPTS) {
        const batch = await app.inject({
          method: "POST",
          url: `${base}/batches`,
          headers: trial,
          payload: { count: 1 },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        assert.equal(batch.json().trialRemaining, TRIAL_ATTEMPTS - answered);
        const problem = batch.json().problems[0];
        const answer = generateProblem(problem.templateId, problem.seed).answer;
        const attempt = await app.inject({
          method: "POST",
          url: `${base}/attempts`,
          headers: trial,
          payload: {
            problemId: problem.id,
            requestId: randomUUID(),
            response: answer,
          },
        });
        assert.equal(attempt.statusCode, 200, attempt.body);
        answered++;
      }
      const paywall = await app.inject({
        method: "POST",
        url: `${base}/batches`,
        headers: trial,
        payload: { count: 1 },
      });
      assert.equal(paywall.statusCode, 402);
      assert.equal(paywall.json().error, "trial-complete");
      const late = await app.inject({
        method: "POST",
        url: `${base}/attempts`,
        headers: trial,
        payload: {
          problemId: stockpiled.id,
          requestId: randomUUID(),
          response: generateProblem(stockpiled.templateId, stockpiled.seed)
            .answer,
        },
      });
      assert.equal(late.statusCode, 402);

      // Adoption needs a parent, moves the learner with every answer, and
      // ends the trial token.
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/trials/adopt",
            headers: trial,
            payload: { token, name: "Maya" },
          })
        ).statusCode,
        401,
      );
      const adopted = await app.inject({
        method: "POST",
        url: "/api/v1/trials/adopt",
        headers: { authorization: "Bearer parent" },
        payload: { token, name: "Maya" },
      });
      assert.equal(adopted.statusCode, 200, adopted.body);
      assert.deepEqual(adopted.json(), {
        id: learnerId,
        name: "Maya",
        birthYear: 2016,
      });
      const frontier = await app.inject({
        method: "GET",
        url: `${base}/frontier`,
        headers: { authorization: "Bearer parent" },
      });
      assert.equal(frontier.json().overall.answered, TRIAL_ATTEMPTS);
      assert.equal(
        (
          await app.inject({
            method: "GET",
            url: "/api/v1/learners",
            headers: trial,
          })
        ).statusCode,
        401,
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/trials/adopt",
            headers: { authorization: "Bearer parent" },
            payload: { token, name: "Maya" },
          })
        ).statusCode,
        404,
      );

      // Unadopted trials are deleted with their answers on expiry.
      const stale = await repository.createTrial(2014);
      await repository.pool.query(
        "UPDATE amp_trials SET expires_at=now()-interval '1 minute' WHERE learner_id=$1",
        [stale.learnerId],
      );
      assert.equal(await purgeExpiredTrials(repository.pool), 1);
      assert.equal(
        (
          await repository.pool.query(
            "SELECT 1 FROM amp_learners WHERE id=$1",
            [stale.learnerId],
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (
          await repository.pool.query(
            "SELECT 1 FROM amp_learners WHERE id=$1",
            [learnerId],
          )
        ).rowCount,
        1,
        "adopted learners are never purged",
      );
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
