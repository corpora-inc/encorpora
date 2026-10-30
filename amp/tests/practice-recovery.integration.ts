import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { PostgresRepository } from "../src/server/repository";
import { buildApp } from "../src/server/app";
import { skills } from "../src/curriculum/catalog";
import { generateProblem } from "../src/math/engine";

test(
  "practice recovery keeps earned history, rejects stale changes, and isolates late answers and assistance",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_recovery_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
      freeProblems: 100,
    });
    const app = buildApp({
      repository,
      development: true,
      authenticate: async () => "synthetic-family",
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const trial = (
        await app.inject({
          method: "POST",
          url: "/api/v1/trials",
          payload: { birthYear: 2016 },
        })
      ).json();
      const second = (
        await app.inject({
          method: "POST",
          url: "/api/v1/trials",
          payload: { birthYear: 2016 },
        })
      ).json();
      const headers = { authorization: `Trial ${trial.token}` };
      const base = `/api/v1/learners/${trial.learnerId}`;
      const get = (path: string) =>
        app.inject({ method: "GET", url: base + path, headers });
      const post = (path: string, payload: object) =>
        app.inject({ method: "POST", url: base + path, headers, payload });
      const state = async () => (await get("/practice-state")).json();
      const change = async (intent: object) => {
        const current = await state();
        const payload = {
          ...intent,
          revision: current.revision,
          requestId: randomUUID(),
        };
        const result = await post("/practice-state", payload);
        assert.equal(result.statusCode, 200, result.body);
        return { payload, state: result.json() };
      };
      const serve = async (templateId?: string) => {
        const result = await post("/batches", {
          count: 1,
          ...(templateId ? { templateId } : {}),
        });
        assert.equal(result.statusCode, 200, result.body);
        return result.json().problems[0];
      };
      const answer = async (problem: {
        id: string;
        templateId: string;
        seed: string;
      }) => {
        const r = await post("/attempts", {
          problemId: problem.id,
          requestId: randomUUID(),
          response: generateProblem(problem.templateId, problem.seed).answer,
        });
        assert.equal(r.statusCode, 200, r.body);
        return r.json();
      };
      const progress = async () => (await get("/trial-progress")).json();
      const history = async () => ({
        attempts: (
          await repository.pool.query(
            "SELECT id,outcome FROM amp_attempts ORDER BY evidence_sequence",
          )
        ).rows,
        skills: (
          await repository.pool.query(
            "SELECT skill_id,state FROM amp_skill_evidence ORDER BY skill_id",
          )
        ).rows,
      });
      for (let n = 0; n < 8; n++) await answer(await serve("linear-equation"));
      const before = await history();
      const priorSkip = await serve("linear-equation");
      await post("/skips", { problemId: priorSkip.id });
      const late = await serve("linear-equation");
      const budget = (await progress()).remaining;
      const reset = await change({ kind: "reset" });
      assert.equal(reset.state.epoch, 1);
      const trialAccount = await repository.trialAccount(trial.token);
      assert.deepEqual(
        await repository.transaction(trialAccount!, trial.learnerId, (tx) =>
          tx.recentSkips(),
        ),
        [],
      );
      assert.deepEqual(
        await history(),
        before,
        "reset must preserve XP and skill evidence exactly",
      );
      assert.equal(
        (await progress()).remaining,
        budget,
        "reset must not replenish free access",
      );
      assert.equal((await progress()).frontier.current.overall.answered, 0);
      assert.equal(
        (await post("/practice-state", reset.payload)).json().epoch,
        1,
        "retry resets once",
      );
      assert.equal(
        (
          await post("/practice-state", {
            ...reset.payload,
            kind: "focus",
            skillId: null,
          })
        ).statusCode,
        409,
      );
      assert.equal(
        (
          await post("/practice-state", {
            kind: "reset",
            revision: 0,
            requestId: randomUUID(),
          })
        ).statusCode,
        409,
      );
      const foreign = await app.inject({
        method: "POST",
        url: base + "/practice-state",
        headers: { authorization: `Trial ${second.token}` },
        payload: { kind: "reset", revision: 1, requestId: randomUUID() },
      });
      assert.equal(foreign.statusCode, 404);
      await answer(late);
      assert.equal(
        (await history()).attempts.length,
        before.attempts.length + 1,
        "late work is retained",
      );
      assert.equal(
        (await progress()).frontier.current.overall.answered,
        0,
        "old served work cannot undo reset",
      );
      const helped = await serve("multiply-facts");
      await change({ kind: "together", enabled: true, problemId: helped.id });
      await change({ kind: "together", enabled: false, problemId: helped.id });
      const outcome = await answer(helped);
      assert.equal(outcome.assisted, true);
      const independent = await answer(await serve("multiply-facts"));
      assert.equal(independent.assisted, false);
      await change({ kind: "focus", skillId: "multiplication-facts" });
      for (let n = 0; n < 3; n++)
        assert.equal((await serve()).skillId, "multiplication-facts");
      const skipped = await serve("linear-equation");
      assert.equal(
        (
          await post("/practice-state", {
            kind: "easier",
            problemId: skipped.id,
            revision: (await state()).revision,
            requestId: randomUUID(),
          })
        ).statusCode,
        409,
      );
      const beforeSkip = (await progress()).frontier.current;
      assert.equal(
        (await post("/skips", { problemId: skipped.id })).statusCode,
        200,
      );
      const afterSkip = (await progress()).frontier.current;
      assert.equal(
        afterSkip.overall.level,
        beforeSkip.overall.level,
        "ordinary skip is neutral",
      );
      const earned = await history();
      const easier = await change({ kind: "easier", problemId: skipped.id });
      assert.equal(easier.state.epoch, 1);
      assert.equal(easier.state.focusSkillId, null);
      assert.ok(easier.state.strandStarts.algebra.level <= 4);
      assert.deepEqual(
        (await progress()).frontier.current.strands.operations,
        afterSkip.strands.operations,
        "local recovery preserves other strands",
      );
      assert.deepEqual(await history(), earned);
      const recovery = await post("/batches", {
        count: 1,
        recoveryStrand: "algebra",
      });
      assert.equal(recovery.statusCode, 200, recovery.body);
      const fresh = recovery.json().problems[0];
      assert.equal(
        skills.find((s) => s.id === fresh.skillId)?.strand,
        "algebra",
        "the first recovery problem addresses the requested area",
      );
      const saved = (
        await repository.pool.query(
          "SELECT content FROM amp_instances WHERE id=$1",
          [fresh.id],
        )
      ).rows[0].content;
      assert.equal(saved.practiceEpoch, 1);
      assert.equal(saved.practiceRevision, easier.state.revision);
      assert.ok(saved.selection.reason);
      assert.ok(saved.selection.frontierPolicy);
      assert.ok(saved.selection.practiceFingerprint);
      assert.equal(
        (
          await post("/practice-state", {
            kind: "easier",
            problemId: skipped.id,
            revision: easier.state.revision,
            requestId: randomUUID(),
          })
        ).statusCode,
        409,
      );
      assert.equal(
        (
          await repository.pool.query(
            "SELECT birth_year FROM amp_learners WHERE id=$1",
            [trial.learnerId],
          )
        ).rows[0].birth_year,
        2016,
      );
      const raceState = await state();
      const racing = await Promise.all(
        [true, false].map((enabled) =>
          post("/practice-state", {
            kind: "together",
            enabled,
            revision: raceState.revision,
            requestId: randomUUID(),
          }),
        ),
      );
      assert.deepEqual(
        racing.map((r) => r.statusCode).sort(),
        [200, 409],
        "concurrent tabs cannot overwrite the same revision",
      );
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
