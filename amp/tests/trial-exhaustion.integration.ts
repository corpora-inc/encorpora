import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { PostgresRepository } from "../src/server/repository";
import { buildApp } from "../src/server/app";
import { generateProblem, templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { templateGrade } from "../src/server/mixed-practice";

// Captured from a real anonymous adaptive run: answer 20 returned 409 and
// rolled back because the posterior fell below the earliest catalog grade.
const fixture: [string, string][] = JSON.parse(
  await readFile(
    new URL("./fixtures/trial-low-frontier.json", import.meta.url),
    "utf8",
  ),
);

test(
  "below-catalog placement persists; genuinely exhausted teaching material offers a savable result",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_exhaustion_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const app = buildApp({
      repository,
      development: true,
      authenticate: async (request) => {
        if (request.headers.authorization !== "Bearer parent")
          throw Object.assign(new Error("Sign in"), { statusCode: 401 });
        return "exhaustion-parent";
      },
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const nodes = new Map(skills.map((s) => [s.id, s]));
      const earliest = Math.min(
        ...templates.map((t) => templateGrade(t, nodes)),
      );
      for (const exhaust of [false, true]) {
        const trial = await repository.createTrial(
          new Date().getUTCFullYear() - 10,
        );
        const account = await repository.trialAccount(trial.token);
        assert.ok(account);
        const headers = { authorization: `Trial ${trial.token}` };
        const base = `/api/v1/learners/${trial.learnerId}`;
        let finalPayload!: {
          problemId: string;
          requestId: string;
          response: string;
        };
        for (const [index, [templateId, seed]] of fixture.entries()) {
          const problem = generateProblem(templateId, seed);
          // Replay the same mathematical fixture in two independent learners;
          // persisted instance ids are globally unique across learner accounts.
          problem.public.id = `${problem.public.id}:${trial.learnerId}`;
          await repository.transaction(account, trial.learnerId, (tx) =>
            tx.saveProblem(problem),
          );
          if (exhaust && index === 19) {
            // Exhaust the bounded candidate space for every introductory family,
            // without answering any of these extra issued questions.
            const issued = templates
              .filter((t) => templateGrade(t, nodes) === earliest)
              .flatMap((t) =>
                Array.from({ length: 128 }, (_, i) =>
                  generateProblem(
                    t.id,
                    `${trial.learnerId}:trial-teaching:${i}`,
                  ),
                ),
              );
            await repository.pool.query(
              `INSERT INTO amp_instances(id,learner_id,content)
            SELECT item->'public'->>'id',$1,item FROM jsonb_array_elements($2::jsonb) item ON CONFLICT DO NOTHING`,
              [trial.learnerId, JSON.stringify(issued)],
            );
          }
          const response = problem.public.response;
          finalPayload = {
            problemId: problem.public.id,
            requestId: randomUUID(),
            response: response.kind === "choice" ? response.options[0].id : "1",
          };
          const answered = await app.inject({
            method: "POST",
            url: `${base}/attempts`,
            headers,
            payload: finalPayload,
          });
          assert.equal(
            answered.statusCode,
            200,
            `answer ${index + 1}, exhausted=${exhaust}: ${answered.body}`,
          );
        }
        assert.equal(
          (
            await repository.pool.query(
              "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
              [trial.learnerId],
            )
          ).rows[0].n,
          20,
        );
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: `${base}/attempts`,
              headers,
              payload: finalPayload,
            })
          ).statusCode,
          200,
          "last-answer retry remains idempotent",
        );
        const progress = await app.inject({
          method: "GET",
          url: `${base}/trial-progress`,
          headers,
        });
        assert.equal(progress.statusCode, 200, progress.body);
        assert.equal(progress.json().phase, exhaust ? "unavailable" : "lesson");
        assert.equal(progress.json().placementAnswered, 20);
        const start = await app.inject({
          method: "POST",
          url: `${base}/trial-teaching`,
          headers,
          payload: {},
        });
        assert.equal(start.statusCode, exhaust ? 409 : 200, start.body);
        const batch = await app.inject({
          method: "POST",
          url: `${base}/batches`,
          headers,
          payload: {
            count: 1,
            responseCapabilities: ["single-choice-v1"],
            figureCapabilities: ["measurement-models-v1"],
          },
        });
        assert.equal(batch.statusCode, exhaust ? 402 : 200, batch.body);
        if (!exhaust) {
          const selected = templates.find(
            (t) => t.id === batch.json().problems[0].templateId,
          )!;
          assert.equal(
            templateGrade(selected, nodes),
            earliest,
            "a below-catalog learner gets introductory material, not an advanced fallback",
          );
        } else {
          const events = await repository.pool.query(
            "SELECT e.event FROM amp_trial_events e JOIN amp_trials t ON t.analytics_id=e.trial_id WHERE t.learner_id=$1 ORDER BY e.event",
            [trial.learnerId],
          );
          assert.deepEqual(
            events.rows.map((r) => r.event),
            ["placement_done", "trial_started"],
          );
          const saved = await app.inject({
            method: "POST",
            url: "/api/v1/trials/adopt",
            headers: { authorization: "Bearer parent" },
            payload: { token: trial.token, name: "Saved fixture" },
          });
          assert.equal(saved.statusCode, 200, saved.body);
        }
      }
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
