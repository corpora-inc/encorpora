import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { ERASE_BATCH } from "../src/schools/privacy.js";
import { weeklyTargetsFor } from "../src/schools/term-grades.js";
import { readOverview } from "../src/schools/org-reads.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

const DAY = 86_400_000;
const YEAR_AHEAD = new Date(Date.now() + 365 * DAY).toISOString();
const iso = (offset: number) =>
  new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const signed = {
  version: "fixture",
  signerName: "Ruth Adeyemi",
  signerTitle: "Head of School",
};

test(
  "AMP for Schools district: overview, rollover, transfer, integrations, privacy, activity",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_org_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const mailed: { to: string; subject: string }[] = [];
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
        mail: async (to, subject) => {
          mailed.push({ to, subject });
        },
      },
    });
    await app.ready();
    const as = (token: string) => ({ authorization: `Bearer ${token}` });
    const get = (path: string, token: string) =>
      app.inject({
        method: "GET",
        url: `/api/v1/school${path}`,
        headers: as(token),
      });
    const post = (path: string, token: string, payload: object = {}) =>
      app.inject({
        method: "POST",
        url: `/api/v1/school${path}`,
        headers: as(token),
        payload,
      });
    const HEAD = "amp|head";
    const DISTRICT = "amp|superintendent";
    const VIEWER = "amp|viewer";
    const TEACHER = "amp|teacher";

    const district = await schools.createOrg(
      { kind: "district", name: "Juniper Valley Schools", timezone: "UTC" },
      signed,
    );
    await schools.addStaff({
      orgId: district.id,
      role: "admin",
      givenName: "Dana",
      familyName: "Ruiz",
      accountId: DISTRICT,
    });
    const alder = await schools.createOrg({
      kind: "school",
      name: "Alder Street School",
      parentId: district.id,
    });
    const birch = await schools.createOrg({
      kind: "school",
      name: "Birch Hill School",
      parentId: district.id,
    });
    await schools.addStaff({
      orgId: alder.id,
      role: "admin",
      givenName: "Ruth",
      familyName: "Adeyemi",
      accountId: HEAD,
    });
    await schools.addStaff({
      orgId: alder.id,
      role: "viewer",
      givenName: "Vera",
      accountId: VIEWER,
    });
    const staff = await schools.addStaff({
      orgId: alder.id,
      role: "teacher",
      givenName: "Grace",
      familyName: "Okafor",
      accountId: TEACHER,
    });
    const year = randomUUID();
    await db.query(
      `INSERT INTO amp_academic_sessions(id,org_id,kind,name,starts_on,ends_on)
       VALUES($1,$2,'year','This year',$3,$4)`,
      [year, district.id, iso(-120), iso(60)],
    );
    await schools.issueLicense({
      orgId: alder.id,
      seats: 3,
      endsAt: YEAR_AHEAD,
    });
    await schools.issueLicense({
      orgId: birch.id,
      seats: 2,
      endsAt: YEAR_AHEAD,
    });
    const grade5 = await schools.createClass(alder.id, {
      name: "Grade 5 Math",
      gradingKind: "year",
    });
    const untaught = await schools.createClass(alder.id, {
      name: "Math Support",
      gradingKind: "year",
    });
    const birchClass = await schools.createClass(birch.id, {
      name: "Birch Grade 5",
      gradingKind: "year",
    });
    await db.query(
      `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on) VALUES($1,$2,$3,'teacher',$4)`,
      [randomUUID(), grade5.id, staff.personId, iso(-100)],
    );
    const add = (
      orgId: string,
      givenName: string,
      familyName: string,
      gradeLevel: number,
      classId?: string,
    ) =>
      schools.provisionStudent(orgId, {
        givenName,
        familyName,
        gradeLevel,
        ...(classId ? { classId } : {}),
      });
    const amara = await add(alder.id, "Amara", "Osei", 5, grade5.id);
    const caleb = await add(alder.id, "Caleb", "Ortiz", 5, grade5.id);
    const senior = await add(alder.id, "Gia", "Lane", 8, grade5.id);
    const waiting = await add(alder.id, "Wen", "Liu", 4, untaught.id);
    await add(birch.id, "Bo", "Birch", 5, birchClass.id);

    const week = (() => {
      const now = new Date();
      const monday = new Date(
        now.getTime() - ((now.getUTCDay() + 6) % 7) * DAY,
      );
      return monday.toISOString().slice(0, 10);
    })();
    const plus = (base: string, days: number) =>
      new Date(Date.parse(`${base}T00:00:00Z`) + days * DAY)
        .toISOString()
        .slice(0, 10);
    const frontier = (level: number, answered = 40) =>
      JSON.stringify({
        overall: { level, sd: 0.4, answered, independent: 30 },
        strands: {},
      });
    // Day rows through the same statements practice uses, so the triggers run.
    await db.query(
      `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms) VALUES
       ($1,$2,'practice','s1',600000),($1,$2,'practice','s2',600000),($1,$3,'practice','s1',1200000)`,
      [amara.learnerId, week, plus(week, -7)],
    );
    await db.query(
      `UPDATE amp_active_days SET active_ms=active_ms+60000 WHERE learner_id=$1 AND day=$2 AND skill_id='s1'`,
      [amara.learnerId, week],
    );
    await db.query(
      `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted) VALUES($1,$2,'s1',5,3,3,2)`,
      [caleb.learnerId, week],
    );
    // Gia's only level is the starting guess before any answer: her grade
    // exactly, which must never read as "at grade level".
    await db.query(
      `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'v')`,
      [senior.learnerId, iso(-1), frontier(8, 0)],
    );
    await db.query(
      `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES
       ($1,$3,$4,'v'),($1,$2,$5,'v'),($6,$2,$7,'v')`,
      [
        amara.learnerId,
        iso(-1),
        iso(-90),
        frontier(5.2),
        frontier(5.8),
        caleb.learnerId,
        frontier(3.9),
      ],
    );

    try {
      await t.test(
        "the weekly rollup follows inserts and updates",
        async () => {
          const { rows } = await db.query(
            `SELECT week::text,active_ms::int,attempts FROM amp_learner_weeks WHERE learner_id=ANY($1::text[]) ORDER BY learner_id=$2 DESC,week`,
            [[amara.learnerId, caleb.learnerId], amara.learnerId],
          );
          assert.deepEqual(rows, [
            { week: plus(week, -7), active_ms: 1200000, attempts: 0 },
            { week, active_ms: 1260000, attempts: 0 },
            { week, active_ms: 0, attempts: 5 },
          ]);
          const assisted = await db.query(
            `SELECT assisted FROM amp_learner_weeks WHERE learner_id=$1 AND week=$2`,
            [caleb.learnerId, week],
          );
          assert.equal(assisted.rows[0].assisted, 2);
          // An answer added later adds to both.
          await db.query(
            `UPDATE amp_skill_days SET attempts=attempts+1,assisted=assisted+1 WHERE learner_id=$1 AND day=$2`,
            [caleb.learnerId, week],
          );
          const after = await db.query(
            `SELECT attempts,assisted FROM amp_learner_weeks WHERE learner_id=$1 AND week=$2`,
            [caleb.learnerId, week],
          );
          assert.deepEqual(after.rows[0], { attempts: 6, assisted: 3 });
        },
      );

      await t.test(
        "a school's overview reads seats, the week, standing, classes and attention",
        async () => {
          const response = await get(`/orgs/${alder.id}/overview`, HEAD);
          assert.equal(response.statusCode, 200, response.body);
          const view = response.json();
          assert.equal(view.org.name, "Alder Street School");
          assert.equal(view.personName, "Ruth Adeyemi");
          assert.equal(view.seats.seats, 3);
          assert.equal(view.seats.used, 3);
          assert.equal(view.seats.waiting, 1);
          assert.equal(view.seats.sharedWith, null);
          assert.deepEqual(view.week, {
            students: 4,
            active: 2,
            minutes: 21,
            lastActive: 1,
            lastMinutes: 20,
          });
          // Only placed students stand: Gia's unanswered starting guess and
          // Wen with no level at all are both "not placed yet".
          assert.equal(view.standing.at, 0);
          assert.equal(view.standing.ahead, 1);
          assert.equal(view.standing.behind, 1);
          assert.equal(view.standing.unplaced, 2);
          // This week's problems, split by help, beside its minutes.
          const thisWeek = view.trend.find(
            (row: { week: string }) => row.week === week,
          );
          assert.equal(thisWeek.problems, 6);
          assert.equal(thisWeek.assisted, 3);
          assert.equal(thisWeek.students, 2);
          assert.equal(
            view.standing.bins.reduce(
              (sum: number, bin: { students: number }) => sum + bin.students,
              0,
            ),
            2,
          );
          const math = view.classes.find(
            (row: { name: string }) => row.name === "Grade 5 Math",
          );
          assert.deepEqual(math.teachers, ["Grace Okafor"]);
          assert.equal(math.students, 3);
          assert.equal(math.active, 2);
          assert.equal(math.minutes, 21);
          // The growth median and how many it's over: Amara's 0.6 and Caleb's
          // 0, whose only reading starts and ends his term.
          assert.equal(math.growth, 0.3);
          assert.equal(math.placed, 2);
          // Amara went from 5.2 to 5.8 in the window; only she has two readings.
          assert.equal(view.schools, null);
          const ids = view.attention.map((item: { id: string }) => item.id);
          assert.ok(ids.includes("seats"));
          assert.ok(ids.includes("no-teacher"));
          assert.ok(ids.includes("never-signed-in"));
          for (const item of view.attention) {
            assert.ok(item.action.label && item.action.org);
            assert.ok(item.rule, item.id);
          }
        },
      );

      await t.test(
        "little practice is decided by the clock it's given: not Tuesday, from Wednesday",
        async () => {
          // Noon UTC on this week's Tuesday and Wednesday: the rows above are
          // in this week whatever day the suite runs.
          const at = (days: number) =>
            new Date(`${plus(week, days)}T12:00:00Z`);
          const flags = async (now: Date) =>
            (
              await readOverview(db, alder.id, null, true, now)
            ).attention.filter((item) => item.id.startsWith("little-practice"));
          assert.deepEqual(await flags(at(1)), []);
          const wednesday = await flags(at(2));
          const math = wednesday.find((item) =>
            item.title.startsWith("Grade 5 Math"),
          )!;
          // Amara's 21 minutes and Caleb's 6 problems practiced; Gia didn't.
          // The median, 0 minutes, is under 9 (a quarter of 60 by Wednesday).
          assert.equal(
            math.detail,
            "2 of 3 have practiced · median 0 of 60 min.",
          );
          assert.match(math.rule!, /\(9 minutes by today\)/);
          const view = await readOverview(db, alder.id, null, true, at(2));
          assert.equal(view.today, plus(week, 2));
        },
      );

      await t.test(
        "a school's weekly target: AMP's 60 until set, set once, followed by its classes",
        async () => {
          const path = `/orgs/${alder.id}/weekly-target`;
          assert.deepEqual((await get(path, HEAD)).json(), {
            minutes: 60,
            own: false,
            inherited: 60,
            setBy: null,
            lockedBy: null,
            canEdit: true,
          });
          const saved = await post(path, HEAD, { minutes: 90 });
          assert.equal(saved.statusCode, 200, saved.body);
          assert.equal(saved.json().minutes, 90);
          assert.equal(saved.json().setBy, "Alder Street School");
          // A viewer reads it and can't change it.
          assert.equal((await get(path, VIEWER)).json().canEdit, false);
          assert.equal(
            (await post(path, VIEWER, { minutes: 30 })).statusCode,
            404,
          );
          // Not a raw number: the stepper's range only.
          assert.equal(
            (await post(path, HEAD, { minutes: 7 })).statusCode,
            400,
          );
          const targets = await weeklyTargetsFor(db, [grade5.id]);
          assert.deepEqual(targets.get(grade5.id), {
            minutes: 90,
            locked: false,
            own: false,
            inherited: 90,
          });
          // A district lock above holds the school's own value out.
          await db.query(
            `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values",locked)
             VALUES('org',$1,'{"weeklyTargetMinutes":45}','{weeklyTargetMinutes}')`,
            [district.id],
          );
          const locked = (await get(path, HEAD)).json();
          assert.equal(locked.minutes, 45);
          assert.equal(locked.lockedBy, "Juniper Valley Schools");
          assert.equal(
            (await post(path, HEAD, { minutes: 60 })).statusCode,
            409,
          );
          await db.query(
            "DELETE FROM amp_scope_settings WHERE scope_kind='org' AND scope_id=$1",
            [district.id],
          );
          const cleared = await post(path, HEAD, { minutes: null });
          assert.deepEqual(cleared.json(), {
            minutes: 60,
            own: false,
            inherited: 60,
            setBy: null,
            lockedBy: null,
            canEdit: true,
          });
          const logged = await db.query(
            "SELECT count(*)::int AS n FROM amp_school_events WHERE action='settings.changed' AND target_id=$1",
            [alder.id],
          );
          assert.equal(logged.rows[0].n, 2);
        },
      );

      await t.test(
        "a district's overview rolls up its schools, with a schools table",
        async () => {
          const view = (
            await get(`/orgs/${district.id}/overview`, DISTRICT)
          ).json();
          assert.equal(view.classes, null);
          assert.deepEqual(
            view.schools.map((row: { name: string }) => row.name),
            ["Alder Street School", "Birch Hill School"],
          );
          assert.equal(view.schools[0].students, 4);
          assert.equal(view.seats.seats, 5);
          const list = (
            await get(`/orgs/${district.id}/schools`, DISTRICT)
          ).json();
          assert.equal(list.schools.length, 2);
          // A head at one school can't read the district, and a teacher sees no overview.
          assert.equal(
            (await get(`/orgs/${district.id}/overview`, HEAD)).statusCode,
            404,
          );
          assert.equal(
            (await get(`/orgs/${alder.id}/overview`, TEACHER)).statusCode,
            404,
          );
          assert.equal(
            (await get(`/orgs/${alder.id}/overview`, VIEWER)).statusCode,
            200,
          );
        },
      );

      await t.test(
        "a district adds a school, and only a district can",
        async () => {
          const added = await post(`/orgs/${district.id}/schools`, DISTRICT, {
            name: "Cedar Grove School",
            timezone: "America/Chicago",
          });
          assert.equal(added.statusCode, 201, added.body);
          const school = added.json().school.id;
          const row = (
            await db.query(
              "SELECT parent_id,timezone FROM amp_orgs WHERE id=$1",
              [school],
            )
          ).rows[0];
          assert.equal(row.parent_id, district.id);
          assert.equal(row.timezone, "America/Chicago");
          assert.equal(
            (
              await post(`/orgs/${alder.id}/schools`, HEAD, {
                name: "No",
                timezone: "UTC",
              })
            ).statusCode,
            404,
          );
        },
      );

      await t.test(
        "campus transfer: same person and learner, seat by license, grades intact",
        async () => {
          // A frozen grade from Alder, through the teacher's own screens.
          const final = await post(
            `/classes/${grade5.id}/students/${amara.personId}/final`,
            TEACHER,
            { term: year, value: "B+" },
          );
          assert.equal(final.statusCode, 200, final.body);
          const closed = await post(
            `/classes/${grade5.id}/gradebook/close`,
            TEACHER,
            {
              term: year,
            },
          );
          assert.equal(closed.statusCode, 200, closed.body);
          const options = await get(
            `/students/${amara.personId}/transfer`,
            DISTRICT,
          );
          assert.equal(options.statusCode, 200, options.body);
          const birchOption = options
            .json()
            .schools.find(
              (row: { name: string }) => row.name === "Birch Hill School",
            );
          assert.equal(birchOption.seat, "moves");
          // The head has no role at Birch: nothing to offer, and refused if tried.
          assert.deepEqual(
            (await get(`/students/${amara.personId}/transfer`, HEAD)).json()
              .schools,
            [],
          );
          assert.equal(
            (
              await post(`/students/${amara.personId}/transfer`, HEAD, {
                to: birch.id,
              })
            ).statusCode,
            404,
          );
          const moved = await post(
            `/students/${amara.personId}/transfer`,
            DISTRICT,
            {
              to: birch.id,
              classId: birchClass.id,
            },
          );
          assert.equal(moved.statusCode, 200, moved.body);
          assert.equal(moved.json().seat, "moves");
          const person = (
            await db.query(
              "SELECT learner_id,deleted_at FROM amp_people WHERE id=$1",
              [amara.personId],
            )
          ).rows[0];
          assert.equal(person.learner_id, amara.learnerId);
          assert.equal(person.deleted_at, null);
          const seat = (
            await db.query(
              `SELECT l.org_id FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
             WHERE s.person_id=$1 AND s.released_at IS NULL`,
              [amara.personId],
            )
          ).rows[0];
          assert.equal(seat.org_id, birch.id);
          const grade = (
            await db.query(
              "SELECT final_value,frozen_at FROM amp_term_grades WHERE person_id=$1",
              [amara.personId],
            )
          ).rows[0];
          assert.equal(grade.final_value, "B+");
          assert.ok(grade.frozen_at);
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_level_days WHERE learner_id=$1",
                [amara.learnerId],
              )
            ).rows[0].n,
            2,
          );
          // Old school's teacher loses them; the record says the new school.
          assert.equal(
            (await get(`/students/${amara.personId}/record`, TEACHER))
              .statusCode,
            404,
          );
          // Bo and Amara fill Birch: the next student moved there needs a seat.
          const needs = await post(
            `/students/${caleb.personId}/transfer`,
            DISTRICT,
            { to: birch.id },
          );
          assert.equal(needs.json().seat, "needs");
          // A waiting student's seat is released from Alder, and a district pool stays.
          const pool = await schools.issueLicense({
            orgId: district.id,
            seats: 10,
            endsAt: YEAR_AHEAD,
          });
          assert.ok(pool.licenseId);
          const pooled = await add(alder.id, "Pat", "Moss", 5);
          await db.query(
            `UPDATE amp_seats SET released_at=now() WHERE person_id=$1 AND released_at IS NULL`,
            [pooled.personId],
          );
          await db.query(
            `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
           VALUES('g-pool',$1,'pilot','s-pool','active',now(),$2)`,
            [pooled.learnerId, YEAR_AHEAD],
          );
          await db.query(
            `INSERT INTO amp_seats(id,license_id,person_id,grant_id) VALUES($1,$2,$3,'g-pool')`,
            [randomUUID(), pool.licenseId, pooled.personId],
          );
          const stays = await post(
            `/students/${pooled.personId}/transfer`,
            DISTRICT,
            { to: birch.id },
          );
          assert.equal(stays.json().seat, "stays");
          // Back to Alder for what follows.
          await post(`/students/${amara.personId}/transfer`, DISTRICT, {
            to: alder.id,
            classId: grade5.id,
          });
          await post(`/students/${caleb.personId}/transfer`, DISTRICT, {
            to: alder.id,
            classId: grade5.id,
          });
        },
      );

      const rollover = {
        startsOn: iso(61),
        endsOn: iso(61 + 300),
        division: "semester",
        classIds: [grade5.id],
        keepStudents: true,
        graduating: { [alder.id]: 8, [birch.id]: null },
      };
      await t.test(
        "year rollover: a dry run changes nothing and says what will happen",
        async () => {
          const options = (await get(`/orgs/${alder.id}/year`, HEAD)).json();
          assert.equal(options.current.name, "This year");
          assert.ok(options.suggested.startsOn > options.current.endsOn);
          assert.equal(options.schools.length, 1);
          assert.equal(options.schools[0].graduating, 8);
          const plan = await post(`/orgs/${alder.id}/year/plan`, HEAD, {
            ...rollover,
            graduating: { [alder.id]: 8 },
          });
          assert.equal(plan.statusCode, 200, plan.body);
          const summary = plan.json();
          assert.equal(summary.applied, false);
          assert.equal(summary.classes, 1);
          assert.equal(summary.teachers, 1);
          assert.deepEqual(
            summary.graduates.map((row: { name: string }) => row.name),
            ["Gia Lane"],
          );
          assert.equal(summary.terms.length, 2);
          const after = (
            await db.query(
              `SELECT (SELECT grade_level FROM amp_people WHERE id=$1) AS grade,
               (SELECT count(*)::int FROM amp_classes WHERE rolled_from IS NOT NULL) AS copies,
               (SELECT count(*)::int FROM amp_academic_sessions WHERE org_id=$2) AS years,
               (SELECT count(*)::int FROM amp_school_events WHERE action='year.rolled-over') AS events`,
              [caleb.personId, alder.id],
            )
          ).rows[0];
          assert.deepEqual(after, { grade: 5, copies: 0, years: 0, events: 0 });
        },
      );

      await t.test(
        "year rollover: all at once, idempotent, history stays",
        async () => {
          const body = { ...rollover, graduating: { [alder.id]: 8 } };
          const applied = await post(
            `/orgs/${alder.id}/year/apply`,
            HEAD,
            body,
          );
          assert.equal(applied.statusCode, 200, applied.body);
          const result = applied.json();
          assert.equal(result.applied, true);
          assert.equal(result.classes, 1);
          assert.equal(result.graduated, 1);
          const copy = (
            await db.query("SELECT * FROM amp_classes WHERE rolled_from=$1", [
              grade5.id,
            ])
          ).rows[0];
          assert.ok(copy);
          assert.notEqual(copy.join_code, grade5.joinCode);
          assert.equal(copy.session_id, result.year.id);
          assert.equal(copy.name, "Grade 5 Math");
          const teacher = await db.query(
            "SELECT 1 FROM amp_enrollments WHERE class_id=$1 AND person_id=$2 AND role='teacher'",
            [copy.id, staff.personId],
          );
          assert.equal(teacher.rowCount, 1);
          // Moved up, and into next year's copy from the day it starts.
          const caleb6 = await db.query(
            `SELECT p.grade_level,e.begin_on::text AS begin FROM amp_people p JOIN amp_enrollments e ON e.person_id=p.id
           WHERE p.id=$1 AND e.class_id=$2`,
            [caleb.personId, copy.id],
          );
          assert.equal(caleb6.rows[0].grade_level, 6);
          assert.equal(caleb6.rows[0].begin, rollover.startsOn);
          // Graduated: role and class ended, seat freed, not advanced.
          const gia = (
            await db.query(
              `SELECT p.grade_level,
               (SELECT count(*)::int FROM amp_seats s WHERE s.person_id=p.id AND s.released_at IS NULL) AS seats,
               (SELECT end_on::text FROM amp_org_roles r WHERE r.person_id=p.id AND r.role='student' ORDER BY begin_on DESC LIMIT 1) AS ended
             FROM amp_people p WHERE p.id=$1`,
              [senior.personId],
            )
          ).rows[0];
          assert.equal(gia.grade_level, 8);
          assert.equal(gia.seats, 0);
          assert.ok(gia.ended);
          assert.equal(
            (await get(`/students/${senior.personId}/record`, HEAD)).statusCode,
            404,
          );
          // Confirming the same thing again changes nothing.
          const again = (
            await post(`/orgs/${alder.id}/year/apply`, HEAD, body)
          ).json();
          assert.equal(again.alreadyDone, true);
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_classes WHERE rolled_from=$1",
                [grade5.id],
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await db.query("SELECT grade_level FROM amp_people WHERE id=$1", [
                caleb.personId,
              ])
            ).rows[0].grade_level,
            6,
          );
          // An overlapping year is refused.
          assert.equal(
            (
              await post(`/orgs/${alder.id}/year/apply`, HEAD, {
                ...body,
                startsOn: plus(rollover.startsOn, 7),
                endsOn: plus(rollover.endsOn, 7),
              })
            ).statusCode,
            409,
          );
          // The list stays on the running year, and the switcher reaches both.
          const current = (await get(`/orgs/${alder.id}/classes`, HEAD)).json()
            .classes;
          assert.ok(
            current.some((row: { id: string }) => row.id === grade5.id),
          );
          assert.ok(!current.some((row: { id: string }) => row.id === copy.id));
          const years = (await get(`/orgs/${alder.id}/years`, HEAD)).json()
            .years;
          assert.equal(years.length, 2);
          assert.equal(
            years.find((row: { inUse: boolean }) => row.inUse).id,
            year,
          );
          const next = (
            await get(`/orgs/${alder.id}/classes?year=${result.year.id}`, HEAD)
          ).json().classes;
          assert.deepEqual(
            next.map((row: { id: string }) => row.id),
            [copy.id],
          );
          // Last year's grade is still readable by the teacher who gave it.
          const book = await get(
            `/classes/${grade5.id}/gradebook?term=${year}`,
            TEACHER,
          );
          assert.equal(book.statusCode, 200, book.body);
        },
      );

      await t.test(
        "integrations list what's connected and take real requests",
        async () => {
          const view = (
            await get(`/orgs/${alder.id}/integrations`, VIEWER)
          ).json();
          assert.deepEqual(
            view.requests.map((row: { id: string }) => row.id),
            ["clever", "classlink", "google-classroom"],
          );
          assert.equal(view.providers[0].available, false);
          assert.equal(
            (
              await post(`/orgs/${alder.id}/integrations/request`, VIEWER, {
                id: "clever",
              })
            ).statusCode,
            404,
          );
          const asked = await post(
            `/orgs/${alder.id}/integrations/request`,
            HEAD,
            { id: "clever" },
          );
          assert.equal(asked.statusCode, 200, asked.body);
          assert.ok(asked.json().requests[0].requestedAt);
          assert.equal(mailed.at(-1)!.to, "support@corpora.inc");
          assert.match(
            mailed.at(-1)!.subject,
            /Clever for Alder Street School/,
          );
        },
      );

      let exported: Record<string, string> = {};
      await t.test(
        "the whole-school export streams every table, admin only",
        async () => {
          assert.equal(
            (await get(`/orgs/${alder.id}/privacy/export.zip`, VIEWER))
              .statusCode,
            404,
          );
          assert.equal(
            (await get(`/orgs/${alder.id}/privacy/export.zip`, TEACHER))
              .statusCode,
            404,
          );
          const response = await get(
            `/orgs/${alder.id}/privacy/export.zip`,
            HEAD,
          );
          assert.equal(response.statusCode, 200);
          assert.equal(response.headers["content-type"], "application/zip");
          assert.match(
            String(response.headers["content-disposition"]),
            /alder-street-school-student-data\.zip/,
          );
          const files = unzipSync(new Uint8Array(response.rawPayload));
          exported = Object.fromEntries(
            Object.entries(files).map(([name, data]) => [
              name,
              strFromU8(data).replace(/^﻿/, ""),
            ]),
          );
          assert.deepEqual(Object.keys(exported).sort(), [
            "active_days.csv",
            "enrollments.csv",
            "grades.csv",
            "level_days.csv",
            "roster.csv",
            "skill_days.csv",
          ]);
          assert.match(exported["roster.csv"]!, /Amara,Osei/);
          assert.match(exported["roster.csv"]!, /Gia,Lane.*left/);
          assert.match(exported["grades.csv"]!, /B\+/);
          // A header, Amara's two, Caleb's one and Gia's starting guess.
          assert.equal(
            exported["level_days.csv"]!.trim().split("\r\n").length,
            5,
          );
          assert.equal(
            exported["active_days.csv"]!.trim().split("\r\n").length,
            4,
          );
          // Someone who left for Birch stays on Alder's record as having left, and a
          // student who was only ever at Birch isn't in it.
          assert.match(exported["roster.csv"]!, /Pat,Moss.*left/);
          assert.doesNotMatch(exported["roster.csv"]!, /Bo,Birch/);
        },
      );

      await t.test(
        "the export holds no more than a batch: 2,500 rows arrive whole",
        async () => {
          await db.query(
            `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
           SELECT $1,$2::date-g,'practice','bulk',1000 FROM generate_series(1,2500) g`,
            [caleb.learnerId, iso(-200)],
          );
          const response = await get(
            `/orgs/${alder.id}/privacy/export.zip`,
            HEAD,
          );
          const days = strFromU8(
            unzipSync(new Uint8Array(response.rawPayload))["active_days.csv"]!,
          );
          assert.equal(days.trim().split("\r\n").length, 1 + 3 + 2500);
        },
      );

      await t.test(
        "someone who moved on: only their days here are this school's",
        async () => {
          const moved = (
            await db.query(
              "SELECT id,learner_id FROM amp_people WHERE given_name='Pat'",
            )
          ).rows[0];
          await db.query(
            `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
             VALUES($1,$2,'practice','here',1000),($1,$3,'practice','there',1000)`,
            [moved.learner_id, iso(-10), iso(0)],
          );
          const response = await get(
            `/orgs/${alder.id}/privacy/export.zip`,
            HEAD,
          );
          const days = strFromU8(
            unzipSync(new Uint8Array(response.rawPayload))["active_days.csv"]!,
          );
          assert.match(days, /here/);
          assert.doesNotMatch(days, /there/);
        },
      );

      await t.test(
        "a class knows when its year is over, and only then",
        async () => {
          const past = (classId: string) =>
            get(`/classes/${classId}/year`, HEAD).then(
              (reply) => reply.json().past,
            );
          assert.equal(await past(grade5.id), false);
          const next = (
            await db.query("SELECT id FROM amp_classes WHERE rolled_from=$1", [
              grade5.id,
            ])
          ).rows[0].id;
          assert.equal(await past(next), false);
          const school = await schools.createOrg({
            kind: "school",
            name: "Hazel Lane School",
            parentId: district.id,
          });
          await schools.addStaff({
            orgId: school.id,
            role: "admin",
            givenName: "Hal",
            accountId: "amp|hazel",
          });
          const ended = randomUUID();
          await db.query(
            `INSERT INTO amp_academic_sessions(id,org_id,kind,name,starts_on,ends_on) VALUES
           ($1,$2,'year','Long ago',$3,$4)`,
            [ended, school.id, iso(-800), iso(-500)],
          );
          const old = await schools.createClass(school.id, {
            name: "Old Class",
            sessionId: ended,
          });
          assert.equal(
            (await get(`/classes/${old.id}/year`, "amp|hazel")).json().past,
            true,
          );
        },
      );

      await t.test(
        "the log reads as sentences, pages at the database and filters",
        async () => {
          const first = await get(`/orgs/${district.id}/activity`, DISTRICT);
          assert.equal(first.statusCode, 200, first.body);
          const page = first.json();
          assert.ok(page.events.length > 0);
          assert.ok(
            page.events.every(
              (event: { sentence: string }) => event.sentence.length > 5,
            ),
          );
          // Newest first with no repeats across pages.
          const seen = new Set<string>();
          let next: string | null = null;
          let pages = 0;
          do {
            const response = await get(
              `/orgs/${district.id}/activity${next ? `?before=${next}` : ""}`,
              DISTRICT,
            );
            const body = response.json();
            for (const event of body.events) {
              assert.ok(!seen.has(event.id));
              seen.add(event.id);
            }
            next = body.next;
            pages++;
          } while (next && pages < 20);
          // Filters.
          const grades = (
            await get(`/orgs/${alder.id}/activity?kind=calendar`, HEAD)
          ).json();
          assert.ok(
            grades.events.some((event: { sentence: string }) =>
              /Ruth Adeyemi started/.test(event.sentence),
            ),
          );
          const people = await post(`/orgs/${alder.id}/activity/people`, HEAD, {
            q: "cal",
          });
          const found = people.json().people[0];
          assert.equal(found.name, "Caleb Ortiz");
          const onePerson = (
            await get(
              `/orgs/${district.id}/activity?person=${found.id}`,
              DISTRICT,
            )
          ).json();
          assert.equal(onePerson.person.name, "Caleb Ortiz");
          assert.ok(onePerson.events.length > 0);
          assert.ok(
            onePerson.events.every((event: { sentence: string }) =>
              /Caleb Ortiz/.test(event.sentence),
            ),
          );
          const future = (
            await get(`/orgs/${alder.id}/activity?from=${iso(5)}`, HEAD)
          ).json();
          assert.equal(future.events.length, 0);
          const bad = await get(
            `/orgs/${alder.id}/activity?from=nonsense&kind=nope&before=x`,
            HEAD,
          );
          assert.equal(bad.statusCode, 200);
          // A viewer and a teacher don't read it.
          assert.equal(
            (await get(`/orgs/${alder.id}/activity`, VIEWER)).statusCode,
            404,
          );
          assert.equal(
            (await get(`/orgs/${alder.id}/activity`, TEACHER)).statusCode,
            404,
          );
        },
      );

      await t.test("nothing written to the log holds a name", async () => {
        const { rows } = await db.query(
          `SELECT detail::text AS detail FROM amp_school_events`,
        );
        for (const row of rows)
          assert.doesNotMatch(row.detail, /Amara|Caleb|Osei|Ortiz|Okafor/);
      });

      await t.test(
        "the privacy page shows who signed, inherited from the district",
        async () => {
          const view = (await get(`/orgs/${alder.id}/privacy`, VIEWER)).json();
          assert.equal(view.agreement.signerName, "Ruth Adeyemi");
          assert.equal(view.agreement.signedBy, "Juniper Valley Schools");
          assert.equal(view.erasing, null);
        },
      );

      await t.test(
        "deleting a school's data: typed name, batches, resumes, leaves others alone",
        async () => {
          const erase = (confirm: string) =>
            post(`/orgs/${alder.id}/privacy/erase`, HEAD, { confirm });
          assert.equal(
            (
              await post(`/orgs/${alder.id}/privacy/erase`, VIEWER, {
                confirm: "x",
              })
            ).statusCode,
            404,
          );
          assert.equal(
            (
              await post(`/orgs/${district.id}/privacy/erase`, DISTRICT, {
                confirm: "Juniper Valley Schools",
              })
            ).statusCode,
            404,
          );
          const wrong = await erase("Alder");
          assert.equal(wrong.statusCode, 409);
          assert.equal(wrong.json().error, "confirm_mismatch");
          // More than a batch, so it takes more than one request.
          for (let index = 0; index < ERASE_BATCH + 2; index++)
            await add(alder.id, `Extra${index}`, "Student", 3);
          // Pat moved to Birch and stays Birch's. Someone who left Alder for Birch too.
          const first = await erase("alder street school");
          assert.equal(first.statusCode, 200, first.body);
          const batch = first.json();
          assert.equal(batch.removed, ERASE_BATCH);
          assert.ok(batch.remaining > 0);
          // Midway the page knows, from the log alone.
          const underway = (
            await get(`/orgs/${alder.id}/privacy`, HEAD)
          ).json();
          assert.equal(underway.erasing.remaining, batch.remaining);
          let remaining = batch.remaining;
          let requests = 1;
          while (remaining > 0 && requests < 10) {
            remaining = (await erase("Alder Street School")).json().remaining;
            requests++;
          }
          assert.equal(remaining, 0);
          assert.ok(requests >= 2);
          assert.equal(
            (await get(`/orgs/${alder.id}/privacy`, HEAD)).json().erasing,
            null,
          );
          const gone = (
            await db.query(
              `SELECT
               (SELECT count(*)::int FROM amp_term_grades WHERE person_id=$1) AS grades,
               (SELECT count(*)::int FROM amp_level_days WHERE learner_id=$2) AS levels,
               (SELECT count(*)::int FROM amp_learner_weeks WHERE learner_id=$2) AS weeks,
               (SELECT given_name FROM amp_people WHERE id=$1) AS name,
               (SELECT identifier FROM amp_people WHERE id=$1) AS identifier`,
              [amara.personId, amara.learnerId],
            )
          ).rows[0];
          assert.deepEqual(gone, {
            grades: 0,
            levels: 0,
            weeks: 0,
            name: "Removed",
            identifier: null,
          });
          // Birch's student, once of Alder? Never touched.
          const pat = (
            await db.query(
              `SELECT p.given_name FROM amp_people p WHERE p.given_name='Pat'`,
            )
          ).rows[0];
          assert.equal(pat.given_name, "Pat");
          assert.equal(
            (await get(`/orgs/${alder.id}/overview`, HEAD)).json().week
              .students,
            0,
          );
          assert.equal(waiting.personId.length, 36);
        },
      );
    } finally {
      await app.close();
      await learning.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
