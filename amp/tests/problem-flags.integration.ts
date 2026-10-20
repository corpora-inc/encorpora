import type { LightMyRequestResponse } from "fastify";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { FamilyRepository } from "../src/family/repository.js";
import { generateProblem } from "../src/math/engine.js";
import { purgeProblemFlags } from "../src/feedback/retention.js";
import { purgeTrialRecords } from "../src/privacy/retention.js";
import { RETENTION } from "../src/privacy/retention-periods.js";
import { FLAG_RATE_LIMIT } from "../src/feedback/problem-flags.js";

const client = { kind: "web", viewport: { width: 390, height: 844 } };
const commit = "a".repeat(40);

test(
  "a resolved problem is reported once, from server records, with notes only for consented learners 13 and older, and reports follow deletion and retention",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_flags_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const previousCommit = process.env.AMP_BUILD_COMMIT;
    process.env.AMP_BUILD_COMMIT = "b".repeat(40);
    const app = buildApp({
      repository,
      development: true,
      authenticate: async (request) => {
        const match = request.headers.authorization?.match(/^Bearer (\w+)$/);
        if (!match)
          throw Object.assign(new Error("Sign in to continue"), {
            statusCode: 401,
          });
        return match[1]!;
      },
    });
    const pool = new Pool({ connectionString: scoped.href, max: 2 });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);

      const created = await app.inject({
        method: "POST",
        url: "/api/v1/trials",
        payload: { birthYear: 2016 },
      });
      const { token, learnerId } = created.json();
      const trial = { authorization: `Trial ${token}` };
      const base = `/api/v1/learners/${learnerId}`;
      const serve = async (headers: Record<string, string>, path = base) => {
        const batch = await app.inject({
          method: "POST",
          url: `${path}/batches`,
          headers,
          payload: { count: 1 },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        return batch.json().problems[0];
      };
      const answer = async (
        headers: Record<string, string>,
        problem: {
          id: string;
          templateId: string;
          seed: string;
          response: { kind: string; options?: { id: string }[] };
        },
        correct: boolean,
        path = base,
      ) => {
        const solution = generateProblem(problem.templateId, problem.seed);
        const response = correct
          ? solution.answer
          : problem.response.kind === "choice"
            ? problem.response.options!.find((o) => o.id !== solution.answer)!
                .id
            : "999999";
        const attempt = await app.inject({
          method: "POST",
          url: `${path}/attempts`,
          headers,
          payload: { problemId: problem.id, requestId: randomUUID(), response },
        });
        assert.equal(attempt.statusCode, 200, attempt.body);
        return response;
      };
      const report = (
        headers: Record<string, string>,
        payload: Record<string, unknown>,
        path = base,
      ): Promise<LightMyRequestResponse> =>
        app.inject({
          method: "POST",
          url: `${path}/problem-flags`,
          headers,
          payload: { client, webCommit: commit, ...payload },
        });

      // Not before the problem resolves.
      const open = await serve(trial);
      const early = await report(trial, {
        problemId: open.id,
        requestId: randomUUID(),
        reasons: ["confusing-wording"],
      });
      assert.equal(early.statusCode, 409, early.body);

      // After a wrong answer: the stored row comes from the server's records.
      const response = await answer(trial, open, false);
      const requestId = randomUUID();
      const sent = await report(trial, {
        problemId: open.id,
        requestId,
        reasons: ["wrong-answer", "figure-wrong"],
      });
      assert.equal(sent.statusCode, 201, sent.body);
      assert.equal(sent.json().recorded, true);
      const [row] = (
        await pool.query("SELECT * FROM amp_problem_flags WHERE id=$1", [
          sent.json().id,
        ])
      ).rows;
      const solved = generateProblem(open.templateId, open.seed);
      assert.equal(row.learner_id, learnerId);
      assert.equal(row.problem_id, open.id);
      assert.equal(row.template_id, open.templateId);
      assert.equal(row.template_version, 1);
      assert.equal(row.seed, open.seed);
      assert.equal(row.skill_id, open.skillId);
      assert.equal(row.prompt, solved.public.prompt);
      assert.equal(row.figure_kind, solved.public.figure?.kind ?? null);
      assert.equal(row.response_kind, open.response.kind);
      assert.equal(row.response, response);
      assert.equal(row.outcome, "incorrect");
      assert.deepEqual(row.reasons, ["wrong-answer", "figure-wrong"]);
      assert.equal(row.note, null);
      assert.equal(row.web_commit, commit);
      assert.equal(row.api_commit, "b".repeat(40));
      assert.equal(row.client_kind, "web");
      assert.equal(row.viewport_width, 390);
      assert.equal(row.viewport_height, 844);

      // A retry returns the same report; a second report is refused.
      const retry = await report(trial, {
        problemId: open.id,
        requestId,
        reasons: ["wrong-answer", "figure-wrong"],
      });
      assert.equal(retry.statusCode, 201);
      assert.equal(retry.json().id, sent.json().id);
      const again = await report(trial, {
        problemId: open.id,
        requestId: randomUUID(),
        reasons: ["other"],
      });
      assert.equal(again.statusCode, 409);
      assert.equal(again.json().error, "This problem was already reported");

      // Validation: known reasons only, no duplicates, no extra fields.
      const second = await serve(trial);
      await answer(trial, second, true);
      for (const payload of [
        { reasons: [] },
        { reasons: ["bogus"] },
        { reasons: ["other", "other"] },
        { reasons: ["other"], answer: "42" },
        { reasons: ["other"], note: "x".repeat(281) },
        { reasons: ["other"], webCommit: "main" },
      ])
        assert.equal(
          (
            await report(trial, {
              problemId: second.id,
              requestId: randomUUID(),
              ...payload,
            })
          ).statusCode,
          400,
          JSON.stringify(payload),
        );
      // A trial is anonymous and unconsented: reasons only, never a note.
      const noted = await report(trial, {
        problemId: second.id,
        requestId: randomUUID(),
        reasons: ["other"],
        note: "my name is",
      });
      assert.equal(noted.statusCode, 400);
      assert.equal(
        noted.json().error,
        "Notes are not available for this learner",
      );
      // A blank note is no note.
      assert.equal(
        (
          await report(trial, {
            problemId: second.id,
            requestId: randomUUID(),
            reasons: ["tedious"],
            note: "   ",
          })
        ).statusCode,
        201,
      );
      // A skip resolves a problem without an attempt.
      const skipped = await serve(trial);
      const skip = await report(trial, {
        problemId: skipped.id,
        requestId: randomUUID(),
        reasons: ["tedious"],
        skipped: true,
      });
      assert.equal(skip.statusCode, 201, skip.body);
      assert.equal(
        (
          await pool.query(
            "SELECT outcome,response FROM amp_problem_flags WHERE id=$1",
            [skip.json().id],
          )
        ).rows[0].outcome,
        "skipped",
      );

      // Parent learners: a note needs a learner certainly 13 or older.
      const parent = { authorization: "Bearer household" };
      const year = new Date().getUTCFullYear();
      const learner = async (birthYear: number) =>
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/learners",
            headers: parent,
            payload: { name: `Learner ${birthYear}`, birthYear },
          })
        ).json().id as string;
      const teen = await learner(year - 14);
      const borderline = await learner(year - 13);
      for (const [id, status] of [
        [teen, 201],
        [borderline, 400],
      ] as const) {
        const path = `/api/v1/learners/${id}`;
        const problem = await serve(parent, path);
        await answer(parent, problem, true, path);
        const result = await report(
          parent,
          {
            problemId: problem.id,
            requestId: randomUUID(),
            reasons: ["confusing-wording"],
            note: "  The second sentence reads twice.  ",
          },
          path,
        );
        assert.equal(result.statusCode, status, result.body);
      }
      const teenNote = await pool.query(
        "SELECT note,outcome FROM amp_problem_flags WHERE learner_id=$1",
        [teen],
      );
      assert.deepEqual(teenNote.rows, [
        { note: "The second sentence reads twice.", outcome: "correct" },
      ]);
      // Another household cannot report this learner's problem.
      const foreign = await serve(trial);
      await answer(trial, foreign, true);
      assert.equal(
        (
          await report(
            parent,
            {
              problemId: foreign.id,
              requestId: randomUUID(),
              reasons: ["other"],
            },
            `/api/v1/learners/${teen}`,
          )
        ).statusCode,
        404,
      );

      // Parent export includes the household's reports.
      const family = new FamilyRepository(pool);
      let exported = "";
      for await (const chunk of family.export("household")) exported += chunk;
      assert.match(exported, /"type":"problem-report"/);
      assert.match(exported, /The second sentence reads twice\./);

      // Deleting the learner's learning data unlinks the report and erases
      // its note; the content report stays.
      // A paid learner keeps an opaque billing tombstone, so the report is
      // unlinked explicitly rather than by the foreign key.
      await pool.query(
        "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'stripe',$3,'active',now(),now()+interval '1 year')",
        [randomUUID(), teen, randomUUID()],
      );
      await family.deleteLearning("household", teen);
      assert.equal(
        (await pool.query("SELECT name FROM amp_learners WHERE id=$1", [teen]))
          .rows[0]?.name,
        "Deleted learner",
      );
      const unlinked = await pool.query(
        "SELECT learner_id,note,template_id FROM amp_problem_flags WHERE prompt IS NOT NULL AND learner_id IS NULL AND outcome='correct' AND reasons=ARRAY['confusing-wording']",
      );
      assert.equal(unlinked.rowCount, 1);
      assert.equal(unlinked.rows[0].note, null);

      // A learner deleted outright: the foreign key unlinks and its trigger
      // erases the note in the same statement.
      const adult = await learner(year - 30);
      const adultPath = `/api/v1/learners/${adult}`;
      const adultProblem = await serve(parent, adultPath);
      await answer(parent, adultProblem, true, adultPath);
      const adultReport = await report(
        parent,
        {
          problemId: adultProblem.id,
          requestId: randomUUID(),
          reasons: ["other"],
          note: "Personal detail",
        },
        adultPath,
      );
      assert.equal(adultReport.statusCode, 201);
      await family.deleteLearning("household", adult);
      assert.equal(
        (await pool.query("SELECT 1 FROM amp_learners WHERE id=$1", [adult]))
          .rowCount,
        0,
      );
      assert.deepEqual(
        (
          await pool.query(
            "SELECT learner_id,note FROM amp_problem_flags WHERE id=$1",
            [adultReport.json().id],
          )
        ).rows,
        [{ learner_id: null, note: null }],
      );

      // A trial's learner row going (trial retention) also unlinks.
      const trialFlags = async () =>
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_problem_flags WHERE learner_id=$1",
            [learnerId],
          )
        ).rows[0].n;
      assert.equal(await trialFlags(), 3);
      const later = new Date(
        Date.now() + (RETENTION.trialRecordDays + 1) * 86_400_000,
      );
      await purgeTrialRecords(pool, later);
      assert.equal(await trialFlags(), 0);
      const total = async () =>
        (
          await pool.query(
            "SELECT count(*)::int AS n, count(note)::int AS notes FROM amp_problem_flags",
          )
        ).rows[0];
      assert.deepEqual(await total(), { n: 5, notes: 0 });

      // Notes, then reports, age out.
      const young = await learner(year - 20);
      const youngPath = `/api/v1/learners/${young}`;
      const problem = await serve(parent, youngPath);
      await answer(parent, problem, false, youngPath);
      assert.equal(
        (
          await report(
            parent,
            {
              problemId: problem.id,
              requestId: randomUUID(),
              reasons: ["other"],
              note: "Short note",
            },
            youngPath,
          )
        ).statusCode,
        201,
      );
      const day = 86_400_000;
      assert.deepEqual(
        await purgeProblemFlags(
          pool,
          new Date(Date.now() + (RETENTION.problemFlagNoteDays - 1) * day),
        ),
        { expiredProblemFlagNotes: 0, expiredProblemFlags: 0 },
      );
      assert.deepEqual(
        await purgeProblemFlags(
          pool,
          new Date(Date.now() + (RETENTION.problemFlagNoteDays + 1) * day),
        ),
        { expiredProblemFlagNotes: 1, expiredProblemFlags: 0 },
      );
      assert.deepEqual(
        await purgeProblemFlags(
          pool,
          new Date(Date.now() + (RETENTION.problemFlagDays + 1) * day),
        ),
        { expiredProblemFlagNotes: 0, expiredProblemFlags: 6 },
      );
      assert.deepEqual(await total(), { n: 0, notes: 0 });

      // Reports are rate limited per credential.
      const limited = await serve(parent, youngPath);
      await answer(parent, limited, true, youngPath);
      let status = 0;
      for (let i = 0; i <= FLAG_RATE_LIMIT && status !== 429; i++)
        status = (
          await report(
            parent,
            {
              problemId: limited.id,
              requestId: randomUUID(),
              reasons: ["other"],
            },
            youngPath,
          )
        ).statusCode;
      assert.equal(status, 429);
    } finally {
      if (previousCommit === undefined) delete process.env.AMP_BUILD_COMMIT;
      else process.env.AMP_BUILD_COMMIT = previousCommit;
      await app.close();
      await repository.close();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
