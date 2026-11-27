import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { FamilyRepository } from "../src/family/repository.js";
import { purgeFilmFlags } from "../src/feedback/retention.js";
import { filmFlagReports } from "../src/feedback/film-flag-store.js";
import { purgeTrialRecords } from "../src/privacy/retention.js";
import { RETENTION } from "../src/privacy/retention-periods.js";
import { ACCOUNT_TABLES } from "../src/account/delete-account.js";
import { lessonFilms } from "../src/content/lesson-films.js";

const client = { kind: "web", viewport: { width: 1280, height: 800 } };
const commit = "a".repeat(40);
const film = lessonFilms["multiply-fractions"]!;
const other = lessonFilms["add-ones-regroup"]!;

test(
  "film reports are stored from the server's manifest and the credential, retried idempotently, read newest first by film, and follow deletion, export and retention",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_film_flags_${randomUUID().replaceAll("-", "")}`;
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
        const header = request.headers.authorization ?? "";
        if (header.startsWith("Trial ")) return "trial-owner";
        const match = header.match(/^Bearer (\w+)$/);
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
      assert.equal(ACCOUNT_TABLES.amp_film_flags, "account");

      const report = (
        payload: Record<string, unknown>,
        headers: Record<string, string> = {},
      ) =>
        app.inject({
          method: "POST",
          url: "/api/v1/film-flags",
          headers,
          payload: {
            templateId: "multiply-fractions",
            filmVersion: film.version,
            requestId: randomUUID(),
            seconds: 12.34,
            layout: "wide",
            reasons: ["picture-wrong"],
            client,
            webCommit: commit,
            ...payload,
          },
        });
      const row = async (id: string) =>
        (await pool.query("SELECT * FROM amp_film_flags WHERE id=$1", [id]))
          .rows[0];

      // An adult's own sign-in: everything the film team needs, and a note.
      const parent = { authorization: "Bearer household" };
      const requestId = randomUUID();
      const sent = await report(
        {
          requestId,
          problemId: "problem-1",
          seconds: 83.06,
          layout: "tall",
          reasons: ["voice-wrong", "confusing"],
          note: "  The narration says 3/4 but the picture shows 2/3.  ",
        },
        parent,
      );
      assert.equal(sent.statusCode, 201, sent.body);
      const stored = await row(sent.json().id);
      assert.equal(stored.film_id, film.id);
      assert.equal(stored.film_version, film.version);
      assert.equal(stored.template_id, "multiply-fractions");
      assert.equal(stored.problem_id, "problem-1");
      assert.equal(Number(stored.seconds), 83.1);
      assert.equal(stored.layout, "tall");
      assert.deepEqual(stored.reasons, ["voice-wrong", "confusing"]);
      assert.equal(
        stored.note,
        "The narration says 3/4 but the picture shows 2/3.",
      );
      assert.equal(stored.viewer, "adult");
      assert.equal(stored.account_id, "household");
      assert.equal(stored.learner_id, null);
      assert.equal(stored.web_commit, commit);
      assert.equal(stored.api_commit, "b".repeat(40));
      assert.equal(stored.client_kind, "web");
      assert.equal(stored.viewport_width, 1280);
      assert.equal(stored.viewport_height, 800);
      assert.ok(stored.created_at instanceof Date);

      // A retry is the same report; the same film again is another report.
      const retry = await report({ requestId }, parent);
      assert.equal(retry.statusCode, 201);
      assert.equal(retry.json().id, sent.json().id);
      const again = await report({ seconds: 140 }, parent);
      assert.equal(again.statusCode, 201);
      assert.notEqual(again.json().id, sent.json().id);
      // Another viewer cannot reuse the request id.
      assert.equal((await report({ requestId })).statusCode, 409);

      // A visitor who is not signed in: reasons only, linked to nobody.
      const visitor = await report({
        templateId: "add-ones-regroup",
        filmVersion: other.version,
      });
      assert.equal(visitor.statusCode, 201, visitor.body);
      assert.deepEqual(
        await pool
          .query(
            "SELECT viewer,learner_id,account_id,film_id FROM amp_film_flags WHERE id=$1",
            [visitor.json().id],
          )
          .then((result) => result.rows),
        [
          {
            viewer: "signed-out",
            learner_id: null,
            account_id: null,
            film_id: other.id,
          },
        ],
      );
      assert.equal((await report({ note: "Hello" })).statusCode, 400);

      // A trial: reasons only, linked to its learner.
      const { token, learnerId } = await repository.createTrial(2016);
      const trial = { authorization: `Trial ${token}` };
      const trialReport = await report({}, trial);
      assert.equal(trialReport.statusCode, 201, trialReport.body);
      assert.equal((await row(trialReport.json().id)).learner_id, learnerId);
      assert.equal((await row(trialReport.json().id)).viewer, "trial");
      assert.equal((await report({ note: "Hi" }, trial)).statusCode, 400);

      // An unknown film is refused; the database holds only known shapes.
      assert.equal(
        (await report({ templateId: "no-such-film" }, parent)).statusCode,
        404,
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO amp_film_flags(id,request_id,film_id,film_version,template_id,seconds,layout,reasons,note,viewer,client_kind,viewport_width,viewport_height) VALUES($1,$2,'f',$3,'t',1,'wide',ARRAY['other'],'orphan note','signed-out','web',1,1)",
          [randomUUID(), randomUUID(), film.version],
        ),
        /check constraint/,
      );

      // The film team's read: newest first, one film's or all, notes only
      // when asked for, and never an account or learner identifier.
      const all = await filmFlagReports(pool, {
        days: 30,
        limit: 100,
        notes: false,
      });
      assert.equal(all.length, 4);
      assert.ok(
        all.every(
          (entry, i) => i === 0 || all[i - 1]!.createdAt >= entry.createdAt,
        ),
      );
      assert.ok(all.every((entry) => !("note" in entry)));
      assert.ok(
        !JSON.stringify(all).includes("household") &&
          !JSON.stringify(all).includes(learnerId),
      );
      const one = await filmFlagReports(pool, {
        filmId: film.id,
        days: 30,
        limit: 100,
        notes: true,
      });
      assert.equal(one.length, 3);
      assert.ok(one.every((entry) => entry.filmId === film.id));
      const first = one.find((entry) => entry.id === sent.json().id)!;
      assert.equal(first.at, "1:23");
      assert.equal(first.seconds, 83.1);
      assert.equal(first.viewport, "1280x800");
      assert.equal(
        first.note,
        "The narration says 3/4 but the picture shows 2/3.",
      );

      // The household's export includes the adult's own film reports.
      const family = new FamilyRepository(pool);
      let exported = "";
      for await (const chunk of family.export("household")) exported += chunk;
      assert.match(exported, /"type":"film-report"/);
      assert.match(exported, /the picture shows 2\/3/);

      // Deleting the account unlinks the adult's reports (the statement in
      // delete-account.ts); the trigger erases the note with the link.
      await pool.query(
        "UPDATE amp_film_flags SET account_id=NULL WHERE account_id=$1",
        ["household"],
      );
      assert.deepEqual(
        (
          await pool.query(
            "SELECT account_id,note,film_id FROM amp_film_flags WHERE id=$1",
            [sent.json().id],
          )
        ).rows,
        [{ account_id: null, note: null, film_id: film.id }],
      );

      // A trial's learner going (trial retention) unlinks its reports.
      const later = new Date(
        Date.now() + (RETENTION.trialRecordDays + 1) * 86_400_000,
      );
      await purgeTrialRecords(pool, later);
      assert.equal((await row(trialReport.json().id)).learner_id, null);

      // Notes, then reports, age out on the problem reports' clock.
      const noted = await report({ note: "Short note" }, parent);
      assert.equal(noted.statusCode, 201);
      const day = 86_400_000;
      assert.deepEqual(
        await purgeFilmFlags(
          pool,
          new Date(Date.now() + (RETENTION.problemFlagNoteDays - 1) * day),
        ),
        { expiredFilmFlagNotes: 0, expiredFilmFlags: 0 },
      );
      assert.deepEqual(
        await purgeFilmFlags(
          pool,
          new Date(Date.now() + (RETENTION.problemFlagNoteDays + 1) * day),
        ),
        { expiredFilmFlagNotes: 1, expiredFilmFlags: 0 },
      );
      assert.deepEqual(
        await purgeFilmFlags(
          pool,
          new Date(Date.now() + (RETENTION.problemFlagDays + 1) * day),
        ),
        { expiredFilmFlagNotes: 0, expiredFilmFlags: 5 },
      );
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
