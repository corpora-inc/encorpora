import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PLACEMENT_ATTEMPTS } from "../src/learning/placement.js";
import { studentFacts, usageOf } from "../src/schools/org-reads.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { levelsBySpan, type TermStudent } from "../src/schools/term-grades.js";

const DAY = 86_400_000;
const day = (offset: number) =>
  new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const two = (value: number | null | undefined) =>
  value === null || value === undefined ? value : Math.round(value * 100) / 100;

test(
  "A term's growth starts where placement settled, in the overview and the grade model alike",
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
      const klass = await schools.createClass(org.id, {
        name: "Grade 5 Math",
        courseBands: ["5"],
      });
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
      ) =>
        db.query(
          `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'fixture')`,
          [
            learnerId,
            day(offset),
            JSON.stringify({
              overall: { level: value, sd: 0.4, answered, independent: 0 },
              strands: {},
            }),
          ],
        );
      // Placement guesses high, drops as it settles, then the student climbs.
      await level(settles.learnerId, -59, 6.8, 6);
      await level(settles.learnerId, -57, 5.6, PLACEMENT_ATTEMPTS - 1);
      await level(settles.learnerId, -55, 4.4, PLACEMENT_ATTEMPTS);
      await level(settles.learnerId, -30, 4.9, 120);
      await level(settles.learnerId, -2, 5.3, 260);
      // Still placing: no start level, so no growth figure.
      await level(placing.learnerId, -3, 5.0, 8);
      await level(placing.learnerId, -1, 5.2, PLACEMENT_ATTEMPTS - 2);
      // Placed long before the term: the term's first reading is the start.
      await level(continuing.learnerId, -80, 2.6, 280);
      await level(continuing.learnerId, -58, 3.0, 300);
      await level(continuing.learnerId, -1, 3.4, 400);

      const term = { name: "Semester 1", startsOn: day(-60), endsOn: day(100) };
      const facts = await studentFacts(db, org.id, term, day(0));
      const fact = (personId: string) =>
        facts.find((row) => row.id === personId)!;
      assert.equal(two(fact(settles.personId).startLevel), 4.4);
      assert.equal(two(fact(settles.personId).level), 5.3);
      assert.equal(fact(placing.personId).startLevel, null);
      assert.equal(two(fact(continuing.personId).startLevel), 3);
      assert.equal(
        usageOf([fact(settles.personId)]).growth,
        0.9,
        "the climb, not the fall from placement's first guess",
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
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
