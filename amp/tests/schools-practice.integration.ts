import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { practiceResponse } from "../src/schools/org-contracts.js";
import { readPractice } from "../src/schools/practice-views.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

const DAY = 86_400_000;
const plus = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
/** This week's Monday, so the fixture is "now" whenever the suite runs. */
const monday = (() => {
  const now = new Date();
  return new Date(now.getTime() - ((now.getUTCDay() + 6) % 7) * DAY)
    .toISOString()
    .slice(0, 10);
})();
const WEEKS = 5;
const termStart = plus(monday, -7 * WEEKS);
const wednesday = new Date(`${plus(monday, 2)}T12:00:00Z`);

test(
  "AMP for Schools practice views: heat map cells, dose-response and quartiles",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_practice_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: {
        secret: "test",
        origin: "https://amp.test",
        mail: async () => {},
        now: () => wednesday,
      },
    });
    await app.ready();
    const HEAD = "amp|head";
    const STRANGER = "amp|stranger";
    const signed = {
      version: "fixture",
      signerName: "Ruth Adeyemi",
      signerTitle: "Head of School",
    };

    const cedar = await schools.createOrg(
      { kind: "school", name: "Cedar School", timezone: "UTC" },
      signed,
    );
    const elm = await schools.createOrg(
      { kind: "school", name: "Elm School", timezone: "UTC" },
      signed,
    );
    await schools.addStaff({
      orgId: cedar.id,
      role: "admin",
      givenName: "Ruth",
      familyName: "Adeyemi",
      accountId: HEAD,
    });
    await schools.addStaff({
      orgId: elm.id,
      role: "admin",
      givenName: "Sol",
      accountId: STRANGER,
    });
    for (const org of [cedar, elm])
      await db.query(
        `INSERT INTO amp_academic_sessions(id,org_id,kind,name,starts_on,ends_on)
         VALUES($1,$2,'year','This year',$3,$4)`,
        [randomUUID(), org.id, termStart, plus(monday, 7 * 8 + 6)],
      );
    const quiet = await schools.createClass(cedar.id, {
      name: "Quiet Math",
      gradingKind: "year",
    });
    const busy = await schools.createClass(cedar.id, {
      name: "Busy Math",
      gradingKind: "year",
    });

    // Eight students a class. A Quiet Math student practices 5 + i minutes a
    // week and a Busy Math student 60 + 10i, one problem a minute; each
    // gains a hundredth of a grade a week per 3 minutes a week, plus a small fixed
    // wobble, so growth rises with practice but not on a perfect line. The
    // last Quiet Math student joined two weeks ago.
    type Fixture = {
      learner: string;
      person: string;
      minutes: number;
      from: number;
    };
    const roster: Fixture[] = [];
    const join = async (
      classId: string,
      orgId: string,
      name: string,
      minutes: number,
      from = 0,
    ) => {
      const made = await schools.provisionStudent(orgId, {
        givenName: name,
        familyName: "Test",
        gradeLevel: 5,
        classId,
      });
      const since = plus(termStart, 7 * from);
      await db.query(
        `UPDATE amp_org_roles SET begin_on=$2 WHERE person_id=$1`,
        [made.personId, since],
      );
      await db.query(
        `UPDATE amp_enrollments SET begin_on=$2 WHERE person_id=$1`,
        [made.personId, since],
      );
      roster.push({
        learner: made.learnerId,
        person: made.personId,
        minutes,
        from,
      });
    };
    for (let i = 0; i < 8; i++)
      await join(quiet.id, cedar.id, `Quiet${i}`, 5 + i, i === 7 ? 3 : 0);
    for (let i = 0; i < 8; i++)
      await join(busy.id, cedar.id, `Busy${i}`, 60 + 10 * i);
    const frontier = (level: number) =>
      JSON.stringify({
        overall: { level, sd: 0.4, answered: 60, independent: 40 },
        strands: {},
      });
    for (const [index, student] of roster.entries()) {
      const wobble = (((index * 37) % 7) - 3) / 200;
      for (let week = student.from; week <= WEEKS; week++) {
        const day = plus(termStart, 7 * week);
        // This week has had two of its days.
        const minutes =
          week === WEEKS ? Math.round(student.minutes / 2) : student.minutes;
        await db.query(
          `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms) VALUES($1,$2,'practice','s1',$3)`,
          [student.learner, day, minutes * 60_000],
        );
        await db.query(
          `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted) VALUES($1,$2,'s1',$3,$3,$3,0)`,
          [student.learner, day, minutes],
        );
        const gained = (week - student.from) * (student.minutes / 300);
        await db.query(
          `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'v')`,
          [
            student.learner,
            plus(day, 1),
            frontier(4 + gained + (week > student.from ? wobble : 0)),
          ],
        );
      }
    }
    // Three at Elm: too few to fit anything.
    const elmClass = await schools.createClass(elm.id, {
      name: "Elm Math",
      gradingKind: "year",
    });
    for (let i = 0; i < 3; i++) await join(elmClass.id, elm.id, `Elm${i}`, 30);
    for (const [index, student] of roster.slice(-3).entries())
      await db.query(
        `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$4,'v'),($1,$3,$5,'v')`,
        [student.learner, plus(termStart, 1), plus(monday, -6), frontier(5), frontier(5.2 + index / 10)],
      );

    try {
      await t.test("a class's week is every rostered student, zeros included", async () => {
        const view = practiceResponse.parse(
          await readPractice(db, cedar.id, wednesday),
        );
        assert.equal(view.rowKind, "class");
        assert.equal(view.current, monday);
        assert.equal(view.weeks[0], termStart);
        assert.equal(view.weeks.length, 14);
        const row = view.rows.find((entry) => entry.name === "Quiet Math")!;
        assert.equal(row.target, 60);
        assert.equal(row.students, 8);
        assert.equal(row.cells.length, view.weeks.length);
        // Weeks to come have no cell.
        assert.equal(row.cells[WEEKS + 1], null);
        // Week 2: the late joiner isn't on the roster yet, so seven students,
        // 5 to 11 minutes each.
        assert.deepEqual(row.cells[2], {
          n: 7,
          minutes: { mean: 8, median: 8, sd: 2.16 },
          problems: { mean: 8, median: 8, sd: 2.16 },
          practiced: 7,
        });
        // Week 4: all eight, 5 to 12.
        assert.deepEqual(row.cells[4]!.minutes, {
          mean: 8.5,
          median: 8.5,
          sd: 2.45,
        });
        // This week so far: half of each.
        assert.equal(row.cells[WEEKS]!.n, 8);
        // Problems' midpoint: the median finished student-week with any.
        assert.equal(view.problemsMidpoint, 60);
      });

      await t.test(
        "more practice, more growth: the line, r's interval, the band and the quartiles",
        async () => {
          const { dose } = await readPractice(db, cedar.id, wednesday);
          assert.equal(dose.placed, 16);
          assert.equal(dose.students.length, 16);
          const fit = dose.studentFit!;
          assert.equal(fit.n, 16);
          assert.ok(fit.slope > 0);
          assert.ok(fit.r > 0.9 && fit.rLow > 0 && fit.rHigh <= 1, `${fit.r}`);
          assert.equal(fit.band.length, 25);
          for (const point of fit.band) assert.ok(point.low <= point.fit && point.fit <= point.high);
          // A Busy Math student at 130 minutes a week: x is minutes this term
          // over weeks in it (five and a half, to Wednesday).
          const busiest = dose.students.reduce((best, point) =>
            point[0] > best[0] ? point : best,
          );
          assert.ok(Math.abs(busiest[0] - (130 * 5 + 65) / (5 + 3 / 7)) < 0.1);
          // Two classes: points, but too few for a line.
          assert.deepEqual(
            dose.groups.map((group) => [group.name, group.n]).sort(),
            [
              ["Busy Math", 8],
              ["Quiet Math", 8],
            ],
          );
          assert.equal(dose.groupFit, null);
          assert.deepEqual(dose.minimum, { students: 12, groups: 5 });
          const quarters = dose.quartiles!;
          assert.deepEqual(
            quarters.map((group) => group.n),
            [4, 4, 4, 4],
          );
          assert.ok(quarters[0]!.to <= quarters[1]!.from);
          const last = quarters.map((group) => group.weeks[WEEKS - 1]!.mean);
          assert.ok(last[0]! < last[1]! && last[1]! < last[2]! && last[2]! < last[3]!, `${last}`);
          // The first week has one settled day, so there is no pace yet.
          assert.equal(quarters[3]!.weeks[0], null);
          assert.equal(quarters[0]!.weeks[WEEKS + 2], null);
        },
      );

      await t.test("too few placed students: no fit, no quartiles", async () => {
        const { dose } = await readPractice(db, elm.id, wednesday);
        assert.equal(dose.placed, 3);
        assert.equal(dose.studentFit, null);
        assert.equal(dose.quartiles, null);
      });

      await t.test("the route: a head reads their own school only", async () => {
        const get = (org: string, token: string) =>
          app.inject({
            method: "GET",
            url: `/api/v1/school/orgs/${org}/practice`,
            headers: { authorization: `Bearer ${token}` },
          });
        const own = await get(cedar.id, HEAD);
        assert.equal(own.statusCode, 200, own.body);
        practiceResponse.parse(own.json());
        assert.equal(own.json().current, monday);
        assert.equal((await get(cedar.id, STRANGER)).statusCode, 404);
      });
    } finally {
      await app.close();
      await learning.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
