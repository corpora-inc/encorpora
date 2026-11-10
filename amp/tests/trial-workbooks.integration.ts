import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { purgeExpiredTrials } from "../src/server/trials.js";

/** The free assessment's workbooks on PostgreSQL, with hosted access rules
 * (not development): a trial makes only what it has earned, reaches only its
 * own learner, never enters results, and after adoption the learner follows
 * the separate workbook allowance. Expired trials take their workbooks with them. */
/** The trial's adoption, now only the server's own move (no route). */
async function adoptTrial(
  repository: {
    adoptTrial(account: string, token: string, name: string): Promise<unknown>;
  },
  account: string,
  token: string,
  name: string,
) {
  try {
    const learner = await repository.adoptTrial(account, token, name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { statusCode: 200, body: "", json: () => learner as any };
  } catch (error) {
    const failure = error as { statusCode?: number; message: string };
    if (!failure.statusCode) throw error;
    return {
      statusCode: failure.statusCode,
      body: failure.message,
      json: () => ({ error: failure.message }),
    };
  }
}

test(
  "a free assessment offers an immediate workbook then earns more, for its own learner only",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_trial_wb_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      freeProblems: 100,
    });
    const rendered: string[] = [];
    // Hosted rules: a signed-in owner plus the trial token; parents need
    // consent and an available workbook allowance or active license.
    const app = buildApp({
      repository,
      development: false,
      // Printed results pages link here; a trial's never do.
      publicUrl: "https://amp.example",
      workbookRenderer: {
        render: async ({ html }) => {
          rendered.push(html);
          return Buffer.from("%PDF-1.7 stand-in");
        },
      },
      authenticate: async (request) => {
        const account = request.headers["x-test-account"];
        if (typeof account !== "string")
          throw Object.assign(new Error("Sign in to continue"), {
            statusCode: 401,
          });
        return account;
      },
    });
    const parent = "amp|wb-parent";
    const today = new Date().toISOString().slice(0, 10);
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await repository.pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','reviewed-fixture','synthetic-evidence')",
        [parent],
      );
      const start = async (owner: string) => {
        const { token, learnerId } = await repository.createTrial(2016, owner);
        return {
          learnerId,
          token,
          headers: { authorization: `Trial ${token}`, "x-test-account": owner },
        };
      };
      const trial = await start(parent);
      const base = `/api/v1/learners/${trial.learnerId}`;
      let used = 0;
      /** Answers through the app, as the assessment does. */
      const answer = async (count: number) => {
        for (let i = 0; i < count; i++) {
          const batch = await app.inject({
            method: "POST",
            url: `${base}/batches`,
            headers: trial.headers,
            payload: { count: 1 },
          });
          assert.equal(batch.statusCode, 200, batch.body);
          const problem = batch.json().problems[0];
          const attempt = await app.inject({
            method: "POST",
            url: `${base}/attempts`,
            headers: trial.headers,
            payload: {
              problemId: problem.id,
              requestId: randomUUID(),
              // Any valid response counts as an answer; correctness is not
              // what this test is about (as in trial-exhaustion).
              response:
                problem.response?.kind === "choice"
                  ? problem.response.options[0].id
                  : "1",
            },
          });
          assert.equal(attempt.statusCode, 200, attempt.body);
          used++;
        }
      };
      const status = async () => {
        const response = await app.inject({
          method: "GET",
          url: `${base}/trial-progress`,
          headers: trial.headers,
        });
        assert.equal(response.statusCode, 200, response.body);
        return response.json().workbooks;
      };
      const make = (
        payload: Record<string, unknown> = {},
        headers: Record<string, string> = trial.headers,
      ) =>
        app.inject({
          method: "POST",
          url: `${base}/workbooks`,
          headers,
          payload: { date: today, minutes: 30, paper: "a4", ...payload },
        });

      // An age-based workbook is available before answering any problems.
      assert.deepEqual(await status(), {
        total: 5,
        earned: 1,
        made: 0,
        available: 1,
        nextAt: 20,
        pdf: true,
        items: [],
      });
      // Zero answers: one workbook, made once, reprinted unchanged.
      assert.equal((await status()).available, 1);
      const first = await make({ number: 1 });
      assert.equal(first.statusCode, 201, first.body);
      const again = await make({ number: 1, paper: "letter" });
      assert.equal(again.statusCode, 200, "the same workbook comes back");
      assert.equal(again.json().id, first.json().id);
      const beyond = await make({ number: 2 });
      assert.equal(beyond.statusCode, 403, "no second workbook before 20");
      assert.equal(
        beyond.json().error,
        "The next free workbook unlocks at 20 problems.",
      );
      assert.equal((await make()).statusCode, 403, "Roll another refused");
      const one = await status();
      assert.equal(one.made, 1);
      assert.equal(one.available, 0);
      assert.deepEqual(one.items, [
        { id: first.json().id, date: today, number: 1, paper: "letter" },
      ]);

      // Downloads: a write-in name line (the trial learner has no name) and
      // no results link, because results need an account.
      const document = await app.inject({
        method: "GET",
        url: `${base}/workbooks/${first.json().id}/document`,
        headers: trial.headers,
      });
      assert.equal(document.statusCode, 200, document.body);
      assert.match(document.headers["content-type"] as string, /text\/html/);
      assert.doesNotMatch(document.body, /Workbook for Trial/);
      const resultsQr = /QR code that opens this workbook/;
      assert.doesNotMatch(document.body, resultsQr);
      const pdf = await app.inject({
        method: "GET",
        url: `${base}/workbooks/${first.json().id}/pdf`,
        headers: trial.headers,
      });
      assert.equal(pdf.statusCode, 200, pdf.body);
      assert.doesNotMatch(rendered.at(-1)!, /Workbook for Trial/);
      const listed = await app.inject({
        method: "GET",
        url: `${base}/workbooks`,
        headers: trial.headers,
      });
      assert.equal(listed.statusCode, 200);
      assert.equal(listed.json().workbooks.length, 1);
      // Results become evidence; a trial gets them only by answering.
      for (const method of ["GET", "POST"] as const) {
        const results = await app.inject({
          method,
          url: `${base}/workbooks/${first.json().id}/results`,
          headers: trial.headers,
          ...(method === "POST"
            ? { payload: { entries: [{ n: 1, mark: "right" }] } }
            : {}),
        });
        assert.equal(results.statusCode, 403, `${method} results`);
      }
      assert.equal(
        (
          await repository.pool.query(
            "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
            [trial.learnerId],
          )
        ).rows[0].n,
        0,
        "no paper evidence was recorded",
      );

      // The token reaches only its own learner: not a parent's learner, not
      // another trial's, and not without the owner's session.
      const theirs = await repository.create(parent, "Sibling", 2014);
      const other = await start("amp|wb-other-owner");
      for (const learnerId of [theirs.id, other.learnerId]) {
        const crossed = await app.inject({
          method: "POST",
          url: `/api/v1/learners/${learnerId}/workbooks`,
          headers: trial.headers,
          payload: { date: today, minutes: 30, paper: "a4", number: 1 },
        });
        assert.equal(crossed.statusCode, 404, crossed.body);
        const read = await app.inject({
          method: "GET",
          url: `/api/v1/learners/${learnerId}/workbooks`,
          headers: trial.headers,
        });
        assert.equal(read.statusCode, 404);
      }
      const ownerless = await app.inject({
        method: "GET",
        url: `${base}/workbooks`,
        headers: { authorization: trial.headers.authorization },
      });
      assert.equal(ownerless.statusCode, 401);
      const stranger = await app.inject({
        method: "GET",
        url: `${base}/workbooks`,
        headers: {
          authorization: trial.headers.authorization,
          "x-test-account": "amp|wb-other-owner",
        },
      });
      assert.equal(stranger.statusCode, 401, "another owner's session");

      // Nineteen answers do not earn another; twenty do. Concurrent requests
      // can consume only the one additional workbook.
      await answer(19);
      assert.equal((await make()).statusCode, 403);
      await answer(1);
      const race = await Promise.all([
        make({ number: 2 }),
        make({ number: 3 }),
      ]);
      assert.deepEqual(
        race.map((r) => r.statusCode).sort(),
        [201, 403],
        race.map((r) => r.body).join(" / "),
      );

      // A hundred: five in all, never a sixth.
      await answer(80);
      assert.equal(used, 100);
      const full = await status();
      assert.equal(full.earned, 5);
      assert.equal(full.available, 3);
      for (let i = 0; i < 3; i++)
        assert.equal((await make()).statusCode, 201, `workbook ${i + 3}`);
      const sixth = await make();
      assert.equal(sixth.statusCode, 403);
      assert.equal(
        sixth.json().error,
        "All free workbooks are made. Choose a plan to print more.",
      );
      const done = await status();
      assert.equal(done.made, 5);
      assert.equal(done.items.length, 5);
      assert.equal(done.nextAt, null);
      const madeIds = done.items.map((w: { id: string }) => w.id).sort();

      // Adoption keeps the five issued workbooks readable. A sixth requires
      // access because the separate free workbook allowance is spent.
      const adopted = await adoptTrial(repository, parent, trial.token, "Ada");
      assert.equal(adopted.statusCode, 200, adopted.body);
      assert.equal(adopted.json().id, trial.learnerId);
      assert.equal((await make()).statusCode, 401, "the trial token ended");
      const asParent = { "x-test-account": parent };
      const unlicensed = await app.inject({
        method: "GET",
        url: `${base}/workbooks`,
        headers: asParent,
      });
      assert.equal(unlicensed.statusCode, 200);
      assert.equal(
        (await make({}, asParent)).statusCode,
        402,
        "no sixth free workbook after adoption without a license",
      );
      await repository.pool.query(
        "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'pilot',$1,'active',now()-interval '1 hour',now()+interval '1 month')",
        [randomUUID(), trial.learnerId],
      );
      const licensed = await app.inject({
        method: "GET",
        url: `${base}/workbooks`,
        headers: asParent,
      });
      assert.equal(licensed.statusCode, 200, licensed.body);
      assert.deepEqual(
        licensed
          .json()
          .workbooks.map((w: { id: string }) => w.id)
          .sort(),
        madeIds,
      );
      assert.equal((await make({}, asParent)).statusCode, 201, "a sixth");
      const named = await app.inject({
        method: "GET",
        url: `${base}/workbooks/${first.json().id}/document`,
        headers: asParent,
      });
      assert.equal(named.statusCode, 200);
      assert.match(named.body, /Ada/);
      assert.match(named.body, resultsQr, "a parent's copy links results");

      // An expired, unadopted trial is purged with its workbooks.
      const lapsed = await start("amp|wb-lapsed");
      const lapsedBase = `/api/v1/learners/${lapsed.learnerId}`;
      for (let i = 0; i < 20; i++) {
        const batch = await app.inject({
          method: "POST",
          url: `${lapsedBase}/batches`,
          headers: lapsed.headers,
          payload: { count: 1 },
        });
        const problem = batch.json().problems[0];
        const skipped = await app.inject({
          method: "POST",
          url: `${lapsedBase}/skips`,
          headers: lapsed.headers,
          payload: { problemId: problem.id },
        });
        assert.equal(skipped.statusCode, 200, skipped.body);
      }
      const kept = await app.inject({
        method: "POST",
        url: `${lapsedBase}/workbooks`,
        headers: lapsed.headers,
        payload: { date: today, minutes: 30, paper: "letter", number: 1 },
      });
      assert.equal(kept.statusCode, 201, "skips count, as on the meter");
      await repository.pool.query(
        "UPDATE amp_trials SET expires_at=now()-interval '1 minute' WHERE learner_id=$1",
        [lapsed.learnerId],
      );
      assert.ok((await purgeExpiredTrials(repository.pool)) >= 1);
      const left = await repository.pool.query(
        "SELECT learner_id FROM amp_workbooks WHERE learner_id=ANY($1)",
        [[lapsed.learnerId, trial.learnerId]],
      );
      assert.deepEqual(
        [...new Set(left.rows.map((r) => r.learner_id))],
        [trial.learnerId],
        "the purged trial's workbooks are gone; the adopted ones stay",
      );
    } finally {
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
