import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { PostgresRepository } from "../src/server/repository";
import { buildApp } from "../src/server/app";
import { generateProblem, templates } from "../src/math/engine";
import { clientCanDraw } from "../src/math/contracts";
import { skills } from "../src/curriculum/catalog";
import { planMixedPractice, templateGrade } from "../src/server/mixed-practice";

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
  async (t) => {
    // Fix the age prior, evidence times and review windows as well as the
    // selection seeds. The fixture must not change with the school year.
    t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 24, 12) });
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
          // Persisted instance ids are globally unique across learner accounts.
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
        assert.ok(frontier.adaptive!.level < earliest);
        const capabilities = {
          responseCapabilities: ["single-choice-v1" as const],
          figureCapabilities: ["measurement-models-v1" as const],
        };
        const supported = templates.filter((template) =>
          clientCanDraw(template, capabilities),
        );
        const strandOf = (template: (typeof templates)[number]) =>
          nodes.get(template.skillId)?.strand ?? template.skillId;
        const assertIntroductory = (selected: (typeof templates)[number]) => {
          const grade = templateGrade(selected, nodes);
          const strandFloor = Math.min(
            ...supported
              .filter((template) => strandOf(template) === strandOf(selected))
              .map((template) => templateGrade(template, nodes)),
          );
          // A nearby introductory item can win the weighted draw: K comparison
          // and grade-1 ordering/clock items share the measurement strand.
          // Bound the selected item itself, not just the strand's minimum.
          assert.ok(
            grade <= strandFloor + 1,
            `${selected.id}: grade ${grade} exceeds introductory material in its strand (${strandFloor})`,
          );
          assert.ok(
            grade <= earliest + 1,
            `${selected.id}: grade ${grade} exceeds a grade above the catalog start (${earliest})`,
          );
        };
        const state = await repository.transaction(
          account,
          trial.learnerId,
          async (tx) => ({
            attempts: await tx.recentAttempts(),
            evidence: await tx.skillEvidence(),
            skips: await tx.recentSkips(),
          }),
        );
        const seen = new Set<string>();
        // Use the route's persisted inputs and client-compatible pool. Fixed
        // seeds exercise the reported failures instead of hoping a UUID draw
        // happens to visit them. Check both one item and the default batch.
        for (const count of [1, 3]) {
          for (let seed = 0; seed < 256; seed++) {
            const choices = planMixedPractice({
              templates: supported,
              skills,
              ...state,
              frontier,
              count,
              seed: `introductory:${seed}`,
              now: Date.now(),
              learnerKey: trial.learnerId,
            });
            assert.equal(choices.length, count);
            for (const choice of choices) {
              assertIntroductory(choice.template);
              seen.add(choice.template.id);
            }
          }
        }
        for (const id of ["order-lengths", "match-clock-half-hour"])
          assert.ok(seen.has(id), `the seed sweep must exercise ${id}`);
        const batch = await app.inject({
          method: "POST",
          url: `${base}/batches`,
          headers,
          payload: {
            count: 1,
            ...capabilities,
          },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        const selected = templates.find(
          (t) => t.id === batch.json().problems[0].templateId,
        )!;
        assertIntroductory(selected);
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
