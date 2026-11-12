import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { writeClassHistory } from "../src/schools/demo/history.js";
import {
  ANCHOR_ZONE,
  sharedDay,
  variantDay,
  zonedInstant,
} from "../src/schools/demo/roster.js";
import { shiftTerms } from "../src/schools/demo/shift.js";
import { demoTerms, variantJobs } from "../src/schools/demo/snapshot.js";
import { sumWeeks } from "../src/schools/demo/term.js";
import { generateHandle } from "../src/schools/repository.js";

/* The shared demo school's term is static: computed once a version for each
   weekday at a fixed anchor week and shipped with the image
   (`tests/demo-terms.test.ts`), and moved by whole weeks to the day it is
   written for. Moved to any day, it is the same term; and the bulk writer
   leaves the same rows the per-answer triggers do. Every name is made up. */
test(
  "Demo terms: static, moved by whole weeks, bulk or one at a time",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_terms_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    t.after(async () => {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    // Every anchor variant is a school day under way, in standard time.
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = variantDay(weekday);
      assert.equal(day.workToday, true);
      assert.equal(day.timezone, ANCHOR_ZONE);
      for (const date of [day.termStart, day.today])
        assert.equal(
          zonedInstant(date, 12, ANCHOR_ZONE) - Date.parse(`${date}T12:00:00Z`),
          5 * 3_600_000,
          `${date} is in standard time`,
        );
    }
    // Any day, in any zone, is its weekday's variant moved by whole weeks.
    for (let offset = 0; offset < 400; offset += 1) {
      const at = Date.parse("2026-11-11T15:00:00Z") + offset * 86_400_000;
      for (const zone of ["America/New_York", "Pacific/Auckland", "UTC"]) {
        const day = sharedDay(at, zone);
        assert.equal(day.shiftDays % 7, 0);
        assert.equal(
          new Date(`${day.day}T12:00:00Z`).getUTCDay(),
          new Date(`${variantDay(day.weekday).today}T12:00:00Z`).getUTCDay(),
        );
      }
    }

    // A Wednesday's term for the hero class, as the image ships it.
    const weekday = 2;
    const jobs = variantJobs("class", weekday);
    const read = await demoTerms("class", weekday);
    assert.equal(read.length, jobs.length);

    // Two Wednesdays a year apart, and in two zones: the same answers and
    // levels, with only the dates moved by whole weeks, each at the same
    // wall-clock time in its own zone.
    const wall = (at: string, zone: string) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).format(new Date(at));
    const strip = (terms: typeof read) =>
      terms.map((term) => ({
        ...term,
        answers: term.answers.map(({ at: _at, day: _day, ...row }) => row),
        help: term.help.map(({ at: _at, day: _day, ...row }) => row),
        active: term.active.map(({ day: _day, ...row }) => row),
        levels: term.levels.map(({ day: _day, ...row }) => row),
      }));
    const later = sharedDay(Date.parse("2026-11-11T15:00:00Z"), "America/Chicago");
    const year = sharedDay(Date.parse("2027-07-13T23:00:00Z"), "Pacific/Auckland");
    assert.equal(later.weekday, weekday);
    assert.equal(year.weekday, weekday);
    const a = shiftTerms(read, later.shiftDays, later.timezone);
    const b = shiftTerms(read, year.shiftDays, year.timezone);
    assert.deepEqual(strip(a), strip(b), "same answers, levels and help");
    assert.deepEqual(strip(a), strip(read));
    for (const [index, term] of a.entries()) {
      const other = b[index]!;
      for (const [row, answer] of term.answers.entries()) {
        const there = other.answers[row]!;
        const moved =
          (Date.parse(`${there.day}T12:00:00Z`) -
            Date.parse(`${answer.day}T12:00:00Z`)) /
          86_400_000;
        assert.equal(moved, year.shiftDays - later.shiftDays);
        assert.equal(wall(answer.at, later.timezone), wall(there.at, year.timezone));
        // The anchor's own wall clock, too.
        assert.equal(
          wall(answer.at, later.timezone),
          wall(read[index]!.answers[row]!.at, ANCHOR_ZONE),
        );
      }
      assert.equal(term.levels.at(-1)!.day <= later.day, true);
    }
    // The term ends today: today's sitting is there.
    assert.ok(
      a.some((term) => term.answers.some((answer) => answer.day === later.day)),
      "today's sitting",
    );

    // The moved term written in bulk, and written one answer at a time
    // through the triggers, leaves the same rows.
    const org = randomUUID();
    await db.query(
      `INSERT INTO amp_orgs(id,kind,path,name,timezone) VALUES($1,'school',ARRAY[$1]::uuid[],'Terms School',$2)`,
      [org, later.timezone],
    );
    const names = jobs.map((job) => job.options.name);
    const write = async (bulk: boolean) => {
      const learners = names.map(() => randomUUID());
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO amp_learners(id,account_id,name,birth_year,created_at)
           SELECT l,'school:'||p,n,2015,$4::date FROM unnest($1::text[],$2::uuid[],$3::text[]) AS t(l,p,n)`,
          [learners, learners.map(() => randomUUID()), names, "2026-01-01"],
        );
        await client.query(
          `INSERT INTO amp_people(id,tenant_id,given_name,handle,learner_id,timezone)
           SELECT gen_random_uuid(),$1,n,h,l,$4 FROM unnest($2::text[],$3::text[],$5::text[]) AS t(l,n,h)`,
          [
            org,
            learners,
            names.map((name) => name.split(" ")[0]),
            later.timezone,
            names.map(() => generateHandle()),
          ],
        );
        await client.query("SET LOCAL amp.rollup_weeks='deferred'");
        await writeClassHistory(client, learners, a, { bulk });
        await sumWeeks(client, "SELECT unnest($1::text[])", [learners]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return learners;
    };
    const bulk = await write(true);
    const single = await write(false);

    const rows = async (sql: string, learner: string) =>
      (await db.query(sql, [learner])).rows;
    let answers = 0;
    for (const [index, name] of names.entries()) {
      const pair = [bulk[index]!, single[index]!];
      const readBoth = async (sql: string) =>
        Promise.all(pair.map((learner) => rows(sql, learner)));
      const [attemptsA, attemptsB] = await readBoth(
        `SELECT a.id,a.evidence_sequence::text AS sequence,a.created_at,
           a.outcome-'id'-'problemId'-'requestId' AS outcome,
           i.content#-'{public,id}' AS content,i.created_at AS served_at
         FROM amp_attempts a JOIN amp_instances i ON i.id=a.problem_id
         WHERE a.learner_id=$1 ORDER BY a.evidence_sequence`,
      );
      const plain = (list: typeof attemptsA) =>
        list.map(({ id: _id, sequence: _sequence, ...row }) => row);
      assert.deepEqual(plain(attemptsA), plain(attemptsB), `${name}: answers`);
      answers += attemptsA.length;
      for (const row of attemptsA)
        assert.notEqual(String(row.outcome.response), "", `${name}: a response`);
      for (const sql of [
        "SELECT day,frontier,policy_version FROM amp_level_days WHERE learner_id=$1 ORDER BY day",
        "SELECT day,surface,skill_id,active_ms FROM amp_active_days WHERE learner_id=$1 ORDER BY 1,2,3",
        `SELECT day,skill_id,attempts,correct,independent,assisted,review,review_independent,
           with_hint,with_lesson,with_video,with_example,with_person
         FROM amp_skill_days WHERE learner_id=$1 ORDER BY 1,2`,
        `SELECT week,active_ms,attempts,assisted,lessons,hints,lesson_ms,hint_ms,with_hint,with_lesson
         FROM amp_learner_weeks WHERE learner_id=$1 ORDER BY 1`,
        `SELECT h."at",h.day,h.kind,h.skill_id,h.ref,h.step,i.content->'public'->>'seed' AS seed
         FROM amp_help_events h JOIN amp_instances i ON i.id=h.problem_id
         WHERE h.learner_id=$1 ORDER BY 1,3`,
      ]) {
        const [x, y] = await readBoth(sql);
        assert.ok(x.length > 0 || /help_events/.test(sql), `${name}: ${sql}`);
        assert.deepEqual(x, y, `${name}: ${sql.slice(0, 60)}`);
      }
      const [evidenceA, evidenceB] = await readBoth(
        "SELECT skill_id,state FROM amp_skill_evidence WHERE learner_id=$1 ORDER BY skill_id",
      );
      const normal = (
        evidence: typeof evidenceA,
        attempts: typeof attemptsA,
      ) => {
        const rank = new Map<string, number>();
        for (const [position, row] of attempts.entries()) {
          rank.set(`id:${row.id}`, position);
          rank.set(`seq:${row.sequence}`, position);
        }
        const observation = (value: Record<string, unknown> | null) =>
          value && {
            ...value,
            id: rank.get(`id:${value.id}`),
            ingestionSequence: rank.get(`seq:${value.ingestionSequence}`),
          };
        return evidence.map((row) => ({
          ...row,
          state: {
            ...row.state,
            recentOutcomes: row.state.recentOutcomes.map(observation),
            latestIndependent: observation(row.state.latestIndependent),
          },
        }));
      };
      assert.ok(evidenceA.length > 0);
      assert.deepEqual(
        normal(evidenceA, attemptsA),
        normal(evidenceB, attemptsB),
        `${name}: skill evidence`,
      );
    }
    assert.equal(
      answers,
      read.reduce((sum, term) => sum + term.answers.length, 0),
    );
  },
);
