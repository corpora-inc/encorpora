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
  "below-catalog placement persists and adaptive practice continues with introductory material",
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
      {
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
            `answer ${index + 1}: ${answered.body}`,
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
        assert.equal(progress.json().phase, "practice");
        assert.equal(progress.json().totals.answered, 20);
        // The first answer is a lucky pick on a four-option fraction choice.
        // The server estimator discounts it by its guess chance, so fractions
        // no longer jump about two grades above the learner's level on it.
        const frontier = await repository.transaction(
          account,
          trial.learnerId,
          (tx) => tx.frontier(),
        );
        const fractions = frontier.strands.fractions;
        assert.ok(fractions, JSON.stringify(frontier.strands));
        assert.ok(
          fractions.level - frontier.overall.level < 1.4,
          `fractions ${fractions.level}, overall ${frontier.overall.level}`,
        );
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
        assert.equal(batch.statusCode, 200, batch.body);
        const selected = templates.find(
          (t) => t.id === batch.json().problems[0].templateId,
        )!;
        // Each strand aims at its own estimate, so a strand with a (guessed,
        // discounted) success may still sit above the overall level. Whatever strand is chosen,
        // the learner gets that strand's easiest material, never an advanced
        // fallback, and never more than a grade above the catalog's start.
        const strandOf = (t: (typeof templates)[number]) =>
          nodes.get(t.skillId)?.strand ?? t.skillId;
        const strandFloor = Math.min(
          ...templates
            .filter((t) => strandOf(t) === strandOf(selected))
            .map((t) => templateGrade(t, nodes)),
        );
        assert.equal(
          templateGrade(selected, nodes),
          strandFloor,
          `a below-catalog learner gets introductory material, not an advanced fallback (${selected.id})`,
        );
        assert.ok(
          strandFloor <= earliest + 1,
          `${selected.id} is within a grade of the catalog's earliest material`,
        );
        const saved = await app.inject({
          method: "POST",
          url: "/api/v1/trials/adopt",
          headers: { authorization: "Bearer parent" },
          payload: { token: trial.token, name: "Saved fixture" },
        });
        assert.equal(saved.statusCode, 200, saved.body);
      }
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
