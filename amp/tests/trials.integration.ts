import type { LightMyRequestResponse } from "fastify";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { applyCommerceEvent } from "../src/commerce/postgres.js";
import { generateProblem, templates } from "../src/math/engine.js";
import { purgeExpiredTrials, trialLimits } from "../src/server/trials.js";

/** A small allowance keeps the run short; production defaults to 100. */
const FREE = 10;
const { placement: PLACEMENT } = trialLimits(FREE);

test(
  "an anonymous trial places, practices adaptively to its allowance, hits its paywall, and is adopted with its progress",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_trials_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
      freeProblems: FREE,
    });
    // The parent authenticator: only bearer tokens identify a parent.
    const app = buildApp({
      repository,
      development: true,
      authenticate: async (request) => {
        if (request.headers.authorization === "Bearer other")
          return "other-parent";
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

      // Placement, then adaptive practice until the allowance is used, then
      // the paywall. A problem fetched in advance cannot pass the allowance.
      const base = `/api/v1/learners/${learnerId}`;
      const progress = async () => {
        const response = await app.inject({
          method: "GET",
          url: `${base}/trial-progress`,
          headers: trial,
        });
        assert.equal(response.statusCode, 200, response.body);
        return response.json();
      };
      const fresh = await progress();
      assert.equal(fresh.phase, "placement");
      assert.equal(fresh.free, FREE);
      assert.equal(fresh.remaining, FREE);
      assert.equal(fresh.frontier.placement, null);
      // Before any answer the trend is the starting estimate from age alone.
      assert.deepEqual(
        fresh.trend.map((point: { answered: number }) => point.answered),
        [0],
      );
      assert.equal(fresh.trend[0].level, fresh.frontier.current.overall.level);
      const stockpiled = (
        await app.inject({
          method: "POST",
          url: `${base}/batches`,
          headers: trial,
          payload: { count: 1 },
        })
      ).json().problems[0];
      // One numeric family, focused, makes a mastery moment deterministic:
      // a miss, then four independent correct answers.
      const numeric = templates.find(
        (t) =>
          !t.requiredResponseCapability &&
          !t.requiredFigureCapability &&
          generateProblem(t.id, "probe").public.response.kind !== "choice",
      )!;
      const answer = async (
        payload: object,
        correct: boolean,
        hint = false,
      ) => {
        const batch: LightMyRequestResponse = await app.inject({
          method: "POST",
          url: `${base}/batches`,
          headers: trial,
          payload: { count: 1, ...payload },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        assert.equal(batch.json().trialRemaining, FREE - answered);
        const problem = batch.json().problems[0];
        assert.equal(problem.answer, undefined, "no answer in the payload");
        if (hint)
          assert.equal(
            (
              await app.inject({
                method: "POST",
                url: `${base}/hints`,
                headers: trial,
                payload: { problemId: problem.id },
              })
            ).statusCode,
            200,
          );
        const solution = generateProblem(problem.templateId, problem.seed);
        const attempt = await app.inject({
          method: "POST",
          url: `${base}/attempts`,
          headers: trial,
          payload: {
            problemId: problem.id,
            requestId: randomUUID(),
            response: correct
              ? solution.answer
              : problem.response.kind === "choice"
                ? problem.response.options.find(
                    (o: { id: string }) => o.id !== solution.answer,
                  ).id
                : "999999",
          },
        });
        assert.equal(attempt.statusCode, 200, attempt.body);
        answered++;
        return attempt.json();
      };
      let answered = 0;
      // Placement: the first answer used a hint.
      while (answered < PLACEMENT) await answer({}, true, answered === 0);
      const placed = await progress();
      assert.equal(placed.phase, "practice");
      assert.equal(placed.placement, PLACEMENT);
      assert.ok(placed.frontier.placement, "the placement map is kept");
      assert.equal(placed.frontier.current.overall.answered, PLACEMENT);
      // Adaptive practice continues past placement with the same planner.
      const focus = { templateId: numeric.id };
      const missed = await answer(focus, false);
      assert.equal(missed.correct, false);
      assert.equal(missed.mastered, undefined);
      const streak = [];
      for (let i = 0; i < 4; i++) streak.push(await answer(focus, true));
      assert.deepEqual(
        streak.map((outcome) => outcome.mastered?.skillId ?? null),
        [null, null, null, numeric.skillId],
        "the answer that makes a missed skill review-ready is a mastery moment",
      );
      assert.ok(streak[3].mastered.title.length > 0);
      while (answered < FREE) await answer({}, true);
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
      const complete = await progress();
      assert.equal(complete.phase, "complete");
      assert.equal(complete.remaining, 0);
      assert.deepEqual(complete.totals, {
        answered: FREE,
        correct: FREE - 1,
        assisted: 1,
        skipped: 0,
      });
      assert.ok(complete.mastered.includes(numeric.skillId));
      assert.equal(complete.frontier.current.overall.answered, FREE);
      assert.equal(complete.frontier.placement.overall.answered, PLACEMENT);
      // The level over the run: the start, every fifth answer, the latest.
      // Its last point is the current estimate, and more answers narrow it.
      assert.deepEqual(
        complete.trend.map((point: { answered: number }) => point.answered),
        [0, 5, 10],
      );
      const last = complete.trend.at(-1);
      assert.equal(last.level, complete.frontier.current.overall.level);
      assert.equal(last.sd, complete.frontier.current.overall.sd);
      assert.ok(last.sd < complete.trend[0].sd, "the range narrows");
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
        ["paywall", "placement_done", "trial_started"],
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
      assert.equal(frontier.json().overall.answered, FREE);
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
      // A retry after a lost response returns the same learner; the token
      // is spent for every other account.
      const again = await app.inject({
        method: "POST",
        url: "/api/v1/trials/adopt",
        headers: { authorization: "Bearer parent" },
        payload: { token, name: "Different" },
      });
      assert.equal(again.statusCode, 200, again.body);
      assert.deepEqual(again.json(), {
        id: learnerId,
        name: "Maya",
        birthYear: 2016,
      });
      const other = await app.inject({
        method: "POST",
        url: "/api/v1/trials/adopt",
        headers: { authorization: "Bearer other" },
        payload: { token, name: "Maya" },
      });
      assert.equal(other.statusCode, 404);
      assert.equal(other.json().error, "trial_ended");

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
        4,
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
