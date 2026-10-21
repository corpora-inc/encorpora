import type { LightMyRequestResponse } from "fastify";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { generateProblem, templates } from "../src/math/engine.js";
import { insightsReport } from "../src/analytics/insights.js";
import { eventBatchSchema } from "../src/analytics/events.js";
import { recordEventBatch } from "../src/analytics/repository.js";
import { SKIP_USES_FREE_PROBLEM } from "../src/learning/skip.js";

test(
  "a skip is a neutral pass: it reveals the answer, writes no attempt, moves no estimate, uses a free problem, cannot be answered afterwards and shows in the insights skip rate",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_skips_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const app = buildApp({
      repository,
      development: true,
      authenticate: async () => "household",
    });
    const pool = new Pool({ connectionString: scoped.href, max: 2 });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const numeric = templates.find(
        (t) =>
          !t.requiredResponseCapability &&
          !t.requiredFigureCapability &&
          generateProblem(t.id, "probe").public.response.kind !== "choice",
      )!;
      const post = (
        path: string,
        headers: Record<string, string>,
        payload: object,
      ): Promise<LightMyRequestResponse> =>
        app.inject({ method: "POST", url: path, headers, payload });
      const trial = (
        await app.inject({
          method: "POST",
          url: "/api/v1/trials",
          payload: { birthYear: 2014 },
        })
      ).json();
      const auth = { authorization: `Trial ${trial.token}` };
      const base = `/api/v1/learners/${trial.learnerId}`;
      const serve = async () => {
        const batch = await post(`${base}/batches`, auth, {
          count: 1,
          templateId: numeric.id,
        });
        assert.equal(batch.statusCode, 200, batch.body);
        return batch.json().problems[0];
      };
      const answer = async (problem: { id: string; seed: string }) =>
        post(`${base}/attempts`, auth, {
          problemId: problem.id,
          requestId: randomUUID(),
          response: generateProblem(numeric.id, problem.seed).answer,
        });
      const progress = async () =>
        (
          await app.inject({
            method: "GET",
            url: `${base}/trial-progress`,
            headers: auth,
          })
        ).json();
      const state = async () => ({
        attempts: (
          await pool.query("SELECT count(*)::int AS n FROM amp_attempts")
        ).rows[0].n,
        evidence: (
          await pool.query(
            "SELECT skill_id,state FROM amp_skill_evidence ORDER BY skill_id",
          )
        ).rows,
        frontier: (await progress()).frontier.current,
      });

      // Two answers first, so there is an estimate and evidence to protect.
      for (let i = 0; i < 2; i++)
        assert.equal((await answer(await serve())).statusCode, 200);
      const before = await state();
      const usedBefore = (await progress()).totals.answered;

      const problem = await serve();
      const skip = await post(`${base}/skips`, auth, { problemId: problem.id });
      assert.equal(skip.statusCode, 200, skip.body);
      const reveal = skip.json();
      const solution = generateProblem(numeric.id, problem.seed);
      assert.equal(reveal.skipped, true);
      assert.equal(reveal.answer, solution.answer);
      assert.deepEqual(reveal.explanation, solution.explanation);
      assert.equal(reveal.correct, false);
      assert.equal(reveal.assisted, false);

      // Nothing about ability, mastery or evidence moved.
      const after = await state();
      assert.deepEqual(after, before);
      // Stored on the problem record, where the insights report reads it.
      const stored = (
        await pool.query("SELECT content FROM amp_instances WHERE id=$1", [
          problem.id,
        ])
      ).rows[0].content;
      assert.equal(stored.skipped, true);
      assert.ok(Date.parse(stored.skippedAt) > 0);

      // The trial counts it once, as one of its free problems by default.
      const used = await progress();
      assert.equal(
        used.totals.answered,
        usedBefore + (SKIP_USES_FREE_PROBLEM ? 1 : 0),
      );
      assert.equal(used.totals.skipped, 1);
      assert.equal(used.totals.correct, 2);

      // A retried skip returns the same reveal and counts nothing new.
      const again = await post(`${base}/skips`, auth, {
        problemId: problem.id,
      });
      assert.equal(again.statusCode, 200);
      assert.deepEqual(again.json(), reveal);
      assert.equal((await progress()).totals.skipped, 1);

      // The revealed answer cannot then be submitted for credit.
      const farmed = await answer(problem);
      assert.equal(farmed.statusCode, 409);
      assert.match(farmed.json().error, /skipped/);
      assert.deepEqual(await state(), before);

      // An answered problem cannot be skipped; an unknown one is not found.
      const answered = await serve();
      assert.equal((await answer(answered)).statusCode, 200);
      assert.equal(
        (await post(`${base}/skips`, auth, { problemId: answered.id }))
          .statusCode,
        409,
      );
      assert.equal(
        (await post(`${base}/skips`, auth, { problemId: "missing" }))
          .statusCode,
        404,
      );

      // A skipped problem can be reported; the report records the skip.
      const flagged = await post(`${base}/problem-flags`, auth, {
        problemId: problem.id,
        requestId: randomUUID(),
        reasons: ["tedious"],
        skipped: true,
        client: { kind: "web", viewport: { width: 390, height: 844 } },
      });
      assert.equal(flagged.statusCode, 201, flagged.body);

      // The insights report shows the family's skip rate.
      const report = await insightsReport(pool, {
        from: new Date(Date.now() - 86_400_000),
        to: new Date(Date.now() + 60_000),
      });
      const family = report.templates.find((t) => t.templateId === numeric.id)!;
      assert.equal(family.served, 4);
      assert.equal(family.skipped, 1 / 4);
      assert.equal(report.totals.skipped, 1);

      // The anonymous funnel accepts the skip event.
      const accepted = await recordEventBatch(
        pool,
        eventBatchSchema.parse({
          visitorId: randomUUID(),
          events: [{ event: "practice_skip", at: Date.now() }],
        }),
      );
      assert.ok(accepted);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_funnel_events WHERE event='practice_skip'",
          )
        ).rows[0].n,
        1,
      );
      // A fresh assessment must keep moving when every offered item is skipped.
      // Use ordinary batches: a focused family intentionally bypasses selection.
      const fresh = (
        await app.inject({
          method: "POST",
          url: "/api/v1/trials",
          payload: { birthYear: 2000 },
        })
      ).json();
      const freshAuth = { authorization: `Trial ${fresh.token}` };
      const freshBase = `/api/v1/learners/${fresh.learnerId}`;
      const readFresh = async () =>
        (
          await app.inject({
            method: "GET",
            url: `${freshBase}/trial-progress`,
            headers: freshAuth,
          })
        ).json();
      const untested = (await readFresh()).frontier.current;
      const seen = new Set<string>();
      for (let i = 0; i < 7; i++) {
        const batch = await post(`${freshBase}/batches`, freshAuth, {
          count: 1,
        });
        assert.equal(batch.statusCode, 200, batch.body);
        const offered = batch.json().problems[0];
        assert.ok(
          !seen.has(offered.templateId),
          `repeated skipped opener ${offered.templateId}`,
        );
        seen.add(offered.templateId);
        assert.equal(
          (
            await post(`${freshBase}/skips`, freshAuth, {
              problemId: offered.id,
            })
          ).statusCode,
          200,
        );
      }
      const passed = await readFresh();
      assert.equal(passed.totals.skipped, 7);
      assert.deepEqual(passed.frontier.current, untested);
    } finally {
      await app.close();
      await repository.close();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
