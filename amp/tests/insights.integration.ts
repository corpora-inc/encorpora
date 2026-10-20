import type { LightMyRequestResponse } from "fastify";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { generateProblem, templates } from "../src/math/engine.js";
import {
  formatInsights,
  insightsCsv,
  insightsReport,
} from "../src/analytics/insights.js";

test(
  "the insights report counts right, wrong, left and reported problems per family, skill, strand and trial, without identifiers or notes by default",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_insights_${randomUUID().replaceAll("-", "")}`;
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
      const practice = async (
        learnerId: string,
        headers: Record<string, string>,
        results: (boolean | null)[],
      ) => {
        const ids: string[] = [];
        for (const correct of results) {
          const batch = await post(
            `/api/v1/learners/${learnerId}/batches`,
            headers,
            { count: 1, templateId: numeric.id },
          );
          assert.equal(batch.statusCode, 200, batch.body);
          const problem = batch.json().problems[0];
          ids.push(problem.id);
          if (correct === null) continue; // served, never answered
          const solution = generateProblem(problem.templateId, problem.seed);
          const attempt = await post(
            `/api/v1/learners/${learnerId}/attempts`,
            headers,
            {
              problemId: problem.id,
              requestId: randomUUID(),
              response: correct ? solution.answer : "999999",
            },
          );
          assert.equal(attempt.statusCode, 200, attempt.body);
        }
        return ids;
      };
      const flag = (
        learnerId: string,
        headers: Record<string, string>,
        problemId: string,
        reasons: string[],
        extra: object = {},
      ) =>
        post(`/api/v1/learners/${learnerId}/problem-flags`, headers, {
          problemId,
          requestId: randomUUID(),
          reasons,
          client: { kind: "web", viewport: { width: 390, height: 844 } },
          ...extra,
        });

      // A free trial: three right, one wrong, one left; one report.
      const trial = (
        await app.inject({
          method: "POST",
          url: "/api/v1/trials",
          payload: { birthYear: 2016 },
        })
      ).json();
      const trialAuth = { authorization: `Trial ${trial.token}` };
      const trialProblems = await practice(trial.learnerId, trialAuth, [
        true,
        true,
        true,
        false,
        null,
      ]);
      assert.equal(
        (
          await flag(trial.learnerId, trialAuth, trialProblems[3]!, [
            "wrong-answer",
          ])
        ).statusCode,
        201,
      );
      // A parent's adult learner, named, with a private note.
      const parent = { authorization: "Bearer parent" };
      const learner = (
        await post("/api/v1/learners", parent, {
          name: "Ada Example",
          birthYear: 1990,
        })
      ).json();
      const parentProblems = await practice(learner.id, parent, [false, true]);
      assert.equal(
        (
          await flag(
            learner.id,
            parent,
            parentProblems[0]!,
            ["confusing-wording", "wrong-answer"],
            { note: "=HYPERLINK(private detail)" },
          )
        ).statusCode,
        201,
      );

      const window = {
        from: new Date(Date.now() - 86_400_000),
        to: new Date(Date.now() + 60_000),
      };
      const report = await insightsReport(pool, window);
      assert.deepEqual(
        {
          served: report.totals.served,
          answered: report.totals.answered,
          flags: report.totals.flags,
          learners: report.totals.learners,
          trialLearners: report.totals.trialLearners,
        },
        { served: 7, answered: 6, flags: 2, learners: 2, trialLearners: 1 },
      );
      assert.equal(report.totals.correct, 4 / 6);
      const family = report.templates.find((t) => t.templateId === numeric.id)!;
      assert.equal(family.served, 7);
      assert.equal(family.answered, 6);
      assert.equal(family.correct, 4 / 6);
      assert.equal(family.incorrect, 2 / 6);
      assert.equal(family.unanswered, 1 / 7);
      assert.equal(family.skipped, null, "no skips recorded yet");
      assert.equal(family.flags, 2);
      assert.deepEqual(family.topReasons, [
        { reason: "wrong-answer", count: 2 },
        { reason: "confusing-wording", count: 1 },
      ]);
      assert.ok(family.medianSeconds !== null && family.medianSeconds >= 0);
      const skill = report.skills.find((s) => s.skillId === numeric.skillId)!;
      assert.equal(skill.learners, 2);
      const strand = report.strands.find((s) => s.strand === skill.strand)!;
      assert.equal(strand.learners, 2);
      assert.equal(strand.answered, 6);
      assert.equal(report.trial.started, 1);
      assert.deepEqual(
        report.trial.reached.slice(0, 2).map((r) => r.trials),
        [1, 0],
        "the trial answered 4: past 1, not 5",
      );
      assert.deepEqual(
        report.reasons.find((r) => r.reason === "wrong-answer"),
        { reason: "wrong-answer", count: 2 },
      );
      assert.equal(report.newestFlags.length, 2);
      assert.equal(report.newestFlags[0]!.outcome, "incorrect");

      // No identifiers, names or notes leave the default report.
      const text = formatInsights(report);
      const everything =
        text +
        JSON.stringify(report) +
        Object.values(insightsCsv(report)).join("");
      for (const secret of [
        trial.learnerId,
        trial.token,
        learner.id,
        "Ada Example",
        "household",
        "private detail",
      ])
        assert.ok(!everything.includes(secret), secret);
      assert.ok(!("note" in report.newestFlags[0]!));

      // The operator's view adds notes, neutralised for spreadsheets.
      const withNotes = await insightsReport(pool, window, { notes: true });
      assert.ok(
        withNotes.newestFlags.some(
          (f) => f.note === "=HYPERLINK(private detail)",
        ),
      );
      assert.match(
        insightsCsv(withNotes)["flags.csv"]!,
        /'=HYPERLINK\(private detail\)/,
      );
      assert.match(formatInsights(withNotes), /Note: =HYPERLINK/);
      // A window with nothing in it is empty, not an error.
      const empty = await insightsReport(pool, {
        from: new Date(Date.now() - 10 * 86_400_000),
        to: new Date(Date.now() - 9 * 86_400_000),
      });
      assert.equal(empty.totals.served, 0);
      assert.equal(empty.templates.length, 0);
      assert.match(formatInsights(empty), /0 problems served/);
    } finally {
      await app.close();
      await repository.close();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
