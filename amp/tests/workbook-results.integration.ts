import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { workbookProblems } from "../src/workbook/compose.js";
import { workbookTemplateIds } from "../src/workbook/results.js";

test(
  "paper results are graded, stored as paper evidence, change skill evidence once, and hold printed problems out of the day's practice",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_paper_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const app = buildApp({
      repository,
      development: true,
      authenticate: async () => "paper-parent",
    });
    const pool = new Pool({ connectionString: scoped.href, max: 2 });
    const today = new Date().toISOString().slice(0, 10);
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const learner = await repository.create("paper-parent", "Paper", 2016);
      const base = `/api/v1/learners/${learner.id}`;
      const made = (
        await app.inject({
          method: "POST",
          url: `${base}/workbooks`,
          payload: { date: today, minutes: 45, paper: "letter" },
        })
      ).json();
      const view = await app.inject({
        url: `${base}/workbooks/${made.id}/results`,
      });
      assert.equal(view.statusCode, 200, view.body);
      const rows = view.json().rows as {
        n: number;
        entry: string;
        skillId: string;
      }[];
      const stored = await pool.query(
        "SELECT spec FROM amp_workbooks WHERE id=$1",
        [made.id],
      );
      const problems = workbookProblems(stored.rows[0].spec);
      const typed = rows.filter((r) => r.entry === "number").slice(0, 2);
      assert.equal(typed.length, 2, "two typed answers to grade");
      const marked = rows.find((r) => !typed.includes(r))!;
      const entries = [
        { n: typed[0]!.n, answer: problems[typed[0]!.n - 1]!.answer },
        { n: typed[1]!.n, answer: "999999" },
        { n: marked.n, mark: "right" },
      ];
      const evidence = async () =>
        new Map(
          (
            await pool.query(
              "SELECT skill_id,state FROM amp_skill_evidence WHERE learner_id=$1",
              [learner.id],
            )
          ).rows.map((r) => [r.skill_id, r.state]),
        );
      const before = await evidence();
      const save = () =>
        app.inject({
          method: "POST",
          url: `${base}/workbooks/${made.id}/results`,
          payload: { entries },
        });
      const first = await save();
      assert.equal(first.statusCode, 200, first.body);
      assert.equal(first.json().recorded, 3);
      const attempts = await pool.query(
        "SELECT problem_id,request_id,outcome FROM amp_attempts WHERE learner_id=$1 ORDER BY evidence_sequence",
        [learner.id],
      );
      assert.equal(attempts.rowCount, 3);
      const outcome = (n: number) =>
        attempts.rows.find((r) => r.request_id === `paper:${made.id}:${n}`)!
          .outcome;
      assert.equal(outcome(typed[0]!.n).correct, true);
      assert.equal(outcome(typed[0]!.n).evidenceSource, "paper");
      assert.equal(outcome(typed[1]!.n).correct, false);
      assert.equal(outcome(marked.n).evidenceWeight, 0.5);
      const instance = await pool.query(
        "SELECT content FROM amp_instances WHERE id=$1",
        [`paper:${made.id}:${typed[0]!.n}`],
      );
      assert.equal(instance.rows[0].content.selection.workbookId, made.id);

      const after = await evidence();
      const right = after.get(typed[0]!.skillId);
      assert.equal(
        right.independentCorrect,
        (before.get(typed[0]!.skillId)?.independentCorrect ?? 0) + 1,
      );
      const mark = after.get(marked.skillId);
      assert.equal(
        mark.independentCorrect,
        before.get(marked.skillId)?.independentCorrect ?? 0,
        "a mark is not independent credit",
      );
      assert.equal(
        mark.attempts,
        (before.get(marked.skillId)?.attempts ?? 0) + 1,
      );

      // Re-entry is idempotent: no new attempts, evidence unchanged.
      const second = await save();
      assert.equal(second.json().recorded, 0);
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM amp_attempts"))
          .rows[0].n,
        3,
      );
      assert.deepEqual(await evidence(), after);
      assert.equal(
        second.json().rows.filter((r: { recorded: unknown }) => r.recorded)
          .length,
        3,
      );
      // Progress reads the same evidence the results changed.
      const progress = await app.inject({
        url: `${base}/progress?skill=${typed[0]!.skillId}`,
      });
      assert.ok(progress.json().skills[0].independentCorrect >= 1);

      // Today's mixed practice holds back the printed templates.
      const printed = workbookTemplateIds([
        { spec: stored.rows[0].spec } as never,
      ]);
      for (let i = 0; i < 4; i++) {
        const batch = await app.inject({
          method: "POST",
          url: `${base}/batches`,
          payload: { count: 5 },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        for (const problem of batch.json().problems)
          assert.ok(
            !printed.has(problem.templateId),
            `${problem.templateId} was printed today`,
          );
      }
    } finally {
      await app.close();
      await pool.end();
      await repository.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
