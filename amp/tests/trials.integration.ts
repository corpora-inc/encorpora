import type { LightMyRequestResponse } from "fastify";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import {
  teachingMaterial,
  teachingSurface,
} from "../src/server/trial-material.js";
import { TEACHING_ATTEMPTS } from "../src/server/trial-progress.js";
import { applyCommerceEvent } from "../src/commerce/postgres.js";
import { generateProblem, templates } from "../src/math/engine.js";
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
      const seenSurfaces = new Set<string>();
      let answered = 0;
      while (answered < TRIAL_ATTEMPTS) {
        const batch: LightMyRequestResponse = await app.inject({
          method: "POST",
          url: `${base}/batches`,
          headers: trial,
          payload: { count: 1 },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        assert.equal(batch.json().trialRemaining, TRIAL_ATTEMPTS - answered);
        const problem = batch.json().problems[0];
        seenSurfaces.add(teachingSurface(problem));
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

      const progress = (
        await app.inject({
          method: "GET",
          url: `${base}/trial-progress`,
          headers: trial,
        })
      ).json();
      assert.equal(progress.phase, "lesson");
      assert.equal(progress.placementAnswered, TRIAL_ATTEMPTS);
      assert.ok(progress.lesson.example.steps.length > 0);
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `${base}/trial-paywall`,
            headers: trial,
            payload: {},
          })
        ).statusCode,
        409,
      );
      const printable = await app.inject({
        method: "GET",
        url: `${base}/trial-printable`,
        headers: trial,
      });
      assert.equal(printable.statusCode, 200);
      assert.equal(printable.json().examples.length, 3);
      for (const example of [
        progress.lesson.example,
        ...printable.json().examples,
      ])
        seenSurfaces.add(teachingSurface(example));
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `${base}/trial-teaching`,
            headers: trial,
            payload: {},
          })
        ).statusCode,
        200,
      );
      // Stockpiled placement instances cannot consume the teaching allowance.
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `${base}/attempts`,
            headers: trial,
            payload: {
              problemId: stockpiled.id,
              requestId: randomUUID(),
              response: "1",
            },
          })
        ).statusCode,
        409,
      );
      for (let i = 0; i < TEACHING_ATTEMPTS; i++) {
        const batch: LightMyRequestResponse = await app.inject({
          method: "POST",
          url: `${base}/batches`,
          headers: trial,
          payload: {
            count: 1,
            responseCapabilities: ["single-choice-v1"],
            figureCapabilities: ["measurement-models-v1"],
          },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        const problem = batch.json().problems[0];
        assert.equal(problem.templateId, progress.templateId);
        assert.equal(
          seenSurfaces.has(teachingSurface(problem)),
          false,
          "teaching is separate from revealed answers",
        );
        seenSurfaces.add(teachingSurface(problem));
        assert.equal(problem.answer, undefined);
        if (i === 0) {
          const support = await app.inject({
            method: "POST",
            url: `${base}/lesson-support`,
            headers: trial,
            payload: { problemId: problem.id },
          });
          assert.deepEqual(
            support.json().lesson,
            progress.lesson,
            "support reuses the safe worked example",
          );
          await app.inject({
            method: "POST",
            url: `${base}/hints`,
            headers: trial,
            payload: { problemId: problem.id },
          });
          const repeated = await app.inject({
            method: "POST",
            url: `${base}/batches`,
            headers: trial,
            payload: {
              count: 1,
              responseCapabilities: ["single-choice-v1"],
              figureCapabilities: ["measurement-models-v1"],
            },
          });
          assert.equal(
            repeated.json().problems[0].id,
            problem.id,
            "refresh serves the immutable next question",
          );
        }
        const payload = {
          problemId: problem.id,
          requestId: randomUUID(),
          response: generateProblem(problem.templateId, problem.seed).answer,
        };
        const outcome = await app.inject({
          method: "POST",
          url: `${base}/attempts`,
          headers: trial,
          payload,
        });
        assert.equal(outcome.statusCode, 200, outcome.body);
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: `${base}/attempts`,
              headers: trial,
              payload,
            })
          ).statusCode,
          200,
        );
      }
      const completed = (
        await app.inject({
          method: "GET",
          url: `${base}/trial-progress`,
          headers: trial,
        })
      ).json();
      assert.equal(completed.phase, "complete");
      assert.deepEqual(completed.after, {
        correct: 4,
        answered: 4,
        assisted: 1,
        independentCorrect: 3,
      });
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `${base}/batches`,
            headers: trial,
            payload: { count: 1 },
          })
        ).statusCode,
        402,
      );
      for (let i = 0; i < 2; i++)
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: `${base}/trial-paywall`,
              headers: trial,
              payload: {},
            })
          ).statusCode,
          200,
        );
      const analytics = (
        await repository.pool.query(
          "SELECT id,analytics_id,token_hash FROM amp_trials WHERE learner_id=$1",
          [learnerId],
        )
      ).rows[0];
      assert.notEqual(analytics.analytics_id, analytics.id);
      assert.notEqual(analytics.analytics_id, analytics.token_hash);
      assert.deepEqual(
        (
          await repository.pool.query(
            "SELECT event FROM amp_trial_events WHERE trial_id=$1 ORDER BY event",
            [analytics.analytics_id],
          )
        ).rows.map((r) => r.event),
        ["paywall", "placement_done", "teaching_done", "trial_started"],
      );

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
      assert.equal(
        frontier.json().overall.answered,
        TRIAL_ATTEMPTS + TEACHING_ATTEMPTS,
      );
      // A confirmed settlement records one conversion; repeats and renewals do not duplicate it.
      const orderId = randomUUID();
      const occurredAt = new Date(Date.now() - 1000).toISOString();
      const envelope = {
        channel: "stripe",
        channelReference: "trial-test",
        orderId,
        occurredAt,
      };
      await applyCommerceEvent(repository.pool, {
        ...envelope,
        id: "created",
        type: "order.created",
        order: {
          id: orderId,
          account: { id: "trial-parent" },
          license: {
            learnerId,
            accountId: "trial-parent",
            sku: "test",
            startsAt: occurredAt,
            endsAt: new Date(Date.now() + 86400000).toISOString(),
          },
          channel: "stripe",
          channelReference: "trial-test",
          externalOrderId: orderId,
          currency: "USD",
          amountMinor: 100,
          activationPolicy: "after-settlement",
        },
      });
      assert.equal(
        (
          await repository.pool.query(
            "SELECT 1 FROM amp_trial_events WHERE trial_id=$1 AND event='purchase'",
            [analytics.analytics_id],
          )
        ).rowCount,
        0,
      );
      const settled = {
        ...envelope,
        id: "settled",
        type: "order.settled",
        currency: "USD",
        amountMinor: 100,
        evidence: "confirmed test payment",
      };
      await applyCommerceEvent(repository.pool, settled);
      await applyCommerceEvent(repository.pool, settled);
      assert.equal(
        (
          await repository.pool.query(
            "SELECT 1 FROM amp_trial_events WHERE trial_id=$1 AND event='purchase'",
            [analytics.analytics_id],
          )
        ).rowCount,
        1,
      );
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

      // A finite family without four unseen questions falls back to a reachable
      // existing family, and does not borrow the original family's baseline.
      const finite = templates.find(
        (t) => !teachingMaterial(t.id, "finite-check"),
      );
      assert.ok(finite);
      const second = await repository.createTrial(2016);
      const secondHeaders = { authorization: `Trial ${second.token}` };
      const secondBase = `/api/v1/learners/${second.learnerId}`;
      for (let i = 0; i < TRIAL_ATTEMPTS; i++) {
        const batch: LightMyRequestResponse = await app.inject({
          method: "POST",
          url: `${secondBase}/batches`,
          headers: secondHeaders,
          payload: {
            templateId: finite.id,
            count: 1,
            responseCapabilities: ["single-choice-v1"],
            figureCapabilities: ["measurement-models-v1"],
          },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        const problem = batch.json().problems[0];
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: `${secondBase}/attempts`,
              headers: secondHeaders,
              payload: {
                problemId: problem.id,
                requestId: randomUUID(),
                response: generateProblem(problem.templateId, problem.seed)
                  .answer,
              },
            })
          ).statusCode,
          200,
        );
      }
      const fallback = (
        await app.inject({
          method: "GET",
          url: `${secondBase}/trial-progress`,
          headers: secondHeaders,
        })
      ).json();
      assert.notEqual(fallback.templateId, finite.id);
      assert.deepEqual(fallback.before, { correct: 0, answered: 0 });
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `${secondBase}/trial-teaching`,
            headers: secondHeaders,
            payload: {},
          })
        ).statusCode,
        200,
      );

      const pack = await app.inject({
        method: "POST",
        url: `${secondBase}/batches`,
        headers: secondHeaders,
        payload: {
          count: 4,
          responseCapabilities: ["single-choice-v1"],
          figureCapabilities: ["measurement-models-v1"],
        },
      });
      const packProblems = pack.json().problems;
      assert.equal(packProblems.length, 4);
      for (const problem of [...packProblems].reverse()) {
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: `${secondBase}/attempts`,
              headers: secondHeaders,
              payload: {
                problemId: problem.id,
                requestId: randomUUID(),
                response: generateProblem(problem.templateId, problem.seed)
                  .answer,
              },
            })
          ).statusCode,
          200,
        );
        const next = await app.inject({
          method: "POST",
          url: `${secondBase}/batches`,
          headers: secondHeaders,
          payload: {
            count: 1,
            responseCapabilities: ["single-choice-v1"],
            figureCapabilities: ["measurement-models-v1"],
          },
        });
        if (problem.id === packProblems[0].id)
          assert.equal(next.statusCode, 402);
        else {
          assert.equal(next.statusCode, 200);
          assert.equal(
            next.json().problems[0].id,
            packProblems[0].id,
            "out-of-order answers leave the first unanswered problem available",
          );
        }
      }

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
      await repository.pool.query(
        "UPDATE amp_learners SET deleted_at=now() WHERE id=$1",
        [learnerId],
      );
      assert.equal(
        (
          await repository.pool.query(
            "SELECT 1 FROM amp_trials WHERE learner_id=$1",
            [learnerId],
          )
        ).rowCount,
        0,
        "learning deletion removes the analytics identity mapping",
      );
      assert.equal(
        (
          await repository.pool.query(
            "SELECT 1 FROM amp_trial_events WHERE trial_id=$1",
            [analytics.analytics_id],
          )
        ).rowCount,
        5,
        "aggregate anonymous events survive without an identity mapping",
      );
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
