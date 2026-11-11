import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { termGrowth } from "../src/schools/growth.js";
import { studentFacts, usageOf } from "../src/schools/org-reads.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { studentBoard } from "../src/schools/standings.js";
import { levelsBySpan, type TermStudent } from "../src/schools/term-grades.js";

const DAY = 86_400_000;
const day = (offset: number) =>
  new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const two = (value: number | null | undefined) =>
  value === null || value === undefined ? value : Math.round(value * 100) / 100;

test(
  "A term's growth is the settled pace, in the overview, the grade model and the standings alike",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_start_level_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    const schools = new SchoolRepository(db);
    try {
      const org = await schools.createOrg(
        { kind: "school", name: "Fixture School", timezone: "UTC" },
        {
          version: "fixture-1",
          signerName: "Fixture Signer",
          signerTitle: "Head of School",
        },
      );
      await schools.issueLicense({
        orgId: org.id,
        seats: 10,
        endsAt: new Date(Date.now() + 30 * DAY).toISOString(),
      });
      // A semester running now, and a class on it with a class board.
      const year = randomUUID();
      const semester = randomUUID();
      await db.query(
        `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on) VALUES
           ($1,$3,NULL,'year','This year',$4,$5),($2,$3,$1,'semester','Semester 1',$4,$5)`,
        [year, semester, org.id, day(-60), day(100)],
      );
      const klass = await schools.createClass(org.id, {
        name: "Grade 5 Math",
        courseBands: ["5"],
        gradingKind: "semester",
        sessionId: year,
      });
      await db.query(
        `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values") VALUES('class',$1,'{"standings":"class"}')`,
        [klass.id],
      );
      const student = (givenName: string) =>
        schools.provisionStudent(org.id, {
          givenName,
          gradeLevel: 5,
          classId: klass.id,
        });
      const settles = await student("Settles");
      const placing = await student("Placing");
      const continuing = await student("Continuing");
      const level = (
        learnerId: string,
        offset: number,
        value: number,
        answered: number,
        sd = 0.4,
      ) =>
        db.query(
          `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'fixture')`,
          [
            learnerId,
            day(offset),
            JSON.stringify({
              overall: { level: value, sd, answered, independent: 0 },
              strands: {},
            }),
          ],
        );
      // The roster opened with the term, so the window includes these days.
      await db.query(
        `UPDATE amp_org_roles SET begin_on=$1 WHERE org_id=$2 AND role='student'`,
        [day(-60), org.id],
      );
      await db.query(`UPDATE amp_enrollments SET begin_on=$1 WHERE class_id=$2`, [
        day(-60),
        klass.id,
      ]);
      // The estimate is still wide, then it settles and the student climbs.
      await level(settles.learnerId, -59, 6.8, 6, 1.5);
      await level(settles.learnerId, -57, 5.6, 19, 1.2);
      await level(settles.learnerId, -55, 4.4, 40, 0.4);
      await level(settles.learnerId, -30, 4.9, 120, 0.4);
      await level(settles.learnerId, -2, 5.3, 260, 0.4);
      // Still wide: no settled pace, so no growth figure.
      await level(placing.learnerId, -3, 5.0, 8, 1.4);
      await level(placing.learnerId, -1, 5.2, 18, 1.1);
      // Settled before the term: the term's first settled day is the start.
      await level(continuing.learnerId, -80, 2.6, 280, 0.3);
      await level(continuing.learnerId, -58, 3.0, 300, 0.4);
      await level(continuing.learnerId, -1, 3.4, 400, 0.4);

      // Independent work this term, which a growth board counts.
      for (const person of [settles, placing, continuing])
        await db.query(
          `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent) VALUES($1,$2,'s1',6,5,5)`,
          [person.learnerId, day(-2)],
        );

      const term = { name: "Semester 1", startsOn: day(-60), endsOn: day(100) };
      const facts = await studentFacts(db, org.id, term, day(0));
      const fact = (personId: string) =>
        facts.find((row) => row.id === personId)!;
      const settlesGrowth = termGrowth(
        [
          { day: 5, level: 4.4, sd: 0.4 },
          { day: 30, level: 4.9, sd: 0.4 },
          { day: 58, level: 5.3, sd: 0.4 },
        ],
        60,
      )!;
      const continuingGrowth = termGrowth(
        [
          { day: 2, level: 3.0, sd: 0.4 },
          { day: 59, level: 3.4, sd: 0.4 },
        ],
        60,
      )!;
      assert.equal(two(fact(settles.personId).startLevel), 4.4);
      assert.equal(two(fact(settles.personId).level), 5.3);
      assert.equal(fact(placing.personId).startLevel, null);
      assert.equal(fact(placing.personId).growthMu, null);
      assert.equal(two(fact(continuing.personId).startLevel), 3);
      assert.equal(
        usageOf([fact(settles.personId)]).growth,
        two(settlesGrowth.mu),
        "the settled pace, not the fall from the wide first guesses",
      );
      assert.equal(
        usageOf([fact(placing.personId)]).growth,
        null,
        "no growth figure rather than a zero",
      );

      const span = (person: typeof settles, name: string): TermStudent => ({
        id: person.personId,
        learnerId: person.learnerId,
        name,
        first: name,
        identifier: null,
        gradeLevel: 5,
        from: term.startsOn,
        to: day(0),
        beginOn: term.startsOn,
        endOn: null,
      });
      const levels = await levelsBySpan(db, [
        span(settles, "Settles"),
        span(placing, "Placing"),
        span(continuing, "Continuing"),
      ]);
      assert.equal(levels.get(settles.personId)?.start?.overall.level, 4.4);
      assert.equal(levels.get(settles.personId)?.end?.overall.level, 5.3);
      assert.equal(levels.get(placing.personId)?.start, null);
      assert.equal(levels.get(continuing.personId)?.start?.overall.level, 3);

      // The board a student sees agrees with the teacher: the same start.
      const growth = async (person: typeof settles) =>
        (await studentBoard(db, person.personId, klass.id)).you.value;
      assert.equal(
        await growth(settles),
        Math.round(settlesGrowth.mu * 100),
        "the same pace the overview shows",
      );
      assert.equal(await growth(placing), 0, "nothing shown while unsettled");
      assert.equal(
        await growth(continuing),
        Math.round(continuingGrowth.mu * 100),
        "from this term's settled days, not last term's 2.6",
      );
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
