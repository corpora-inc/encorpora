import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { clearStandingsCache } from "../src/schools/standings.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { alignGrowthStart } from "./helpers/growth-window.js";
import { schoolDay } from "./helpers/school-day.js";

/* The teacher in their class (docs/families.md): each teacher of a class who
   practices on their own adult learner is a line on the class's map and board,
   marked as the teacher and never ranked. Students can pass them. Nothing that
   counts students ever counts them. Every name here is made up. */
const DAY = 86_400_000;
const day = (back: number) => schoolDay(-back);
const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};
type Line = { name: string; value: number; inList: boolean };
type Top = { rank: number; name: string; value: number; you: boolean };
type MapTeacher = {
  id: string;
  name: string;
  you: boolean;
  level: { overall: { level: number } } | null;
};

test(
  "the teacher in their class: a line on the map and board, never a student",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_teacher_line_${randomUUID().replaceAll("-", "")}`;
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
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    const as = (token: string) => ({ authorization: `Bearer ${token}` });
    const get = (path: string, token: string) =>
      app.inject({
        method: "GET",
        url: `/api/v1/school/${path}`,
        headers: as(token),
      });
    const post = (path: string, token: string, payload: object = {}) =>
      app.inject({
        method: "POST",
        url: `/api/v1/school/${path}`,
        headers: as(token),
        payload,
      });
    const ok = async (
      response: ReturnType<typeof get>,
    ): Promise<Record<string, unknown> & { [key: string]: any }> => {
      const done = await response;
      assert.equal(done.statusCode, 200, done.body);
      return done.json();
    };

    const school = await schools.createOrg(
      {
        kind: "school",
        name: "Alder Street School",
        timezone: "America/New_York",
      },
      agreement,
    );
    await schools.issueLicense({
      orgId: school.id,
      seats: 100,
      endsAt: new Date(Date.now() + 365 * DAY).toISOString(),
    });
    const schoolAdmin = `amp|admin-${randomUUID()}`;
    await schools.addStaff({
      orgId: school.id,
      role: "admin",
      givenName: "Sam",
      familyName: "Admin",
      accountId: schoolAdmin,
    });
    const period = await schools.createClass(school.id, {
      name: "Grade 5 Math",
      courseBands: ["5"],
    });
    const club = await schools.createClass(school.id, { name: "Math Club" });
    const next = await schools.createClass(school.id, { name: "Grade 6 Math" });
    const staff = async (
      givenName: string,
      familyName: string,
      role: "teacher" | "aide",
      classId: string,
    ) => {
      const account = `amp|${givenName.toLowerCase()}-${randomUUID()}`;
      await schools.addStaff({
        orgId: school.id,
        role,
        givenName,
        familyName,
        accountId: account,
        classId,
      });
      return account;
    };
    const rivera = await staff("Elena", "Rivera", "teacher", period.id);
    await db.query(
      "UPDATE amp_people SET display_name='Ms. Rivera' WHERE account_id=$1",
      // A roster name never stands in for the adult's own (family-api.md):
      // every line below names her "Elena Rivera".
      [rivera],
    );
    await db.query(
      `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
       SELECT gen_random_uuid(),$1,id,'teacher',(now() AT TIME ZONE 'America/New_York')::date
       FROM amp_people WHERE account_id=$2`,
      [club.id, rivera],
    );
    const chen = await staff("Daniel", "Chen", "teacher", period.id);
    const aide = await staff("Abe", "Aide", "aide", period.id);
    const oren = await staff("Oren", "Other", "teacher", next.id);

    type Student = Awaited<ReturnType<typeof schools.provisionStudent>> & {
      token: string;
    };
    const enroll = async (classId: string, givenName: string) => {
      const student = await schools.provisionStudent(school.id, {
        givenName,
        familyName: "Fixture",
        gradeLevel: 5,
        classId,
      });
      const { token } = await schools.issueStudentSession({
        personId: student.personId,
        mode: "shared",
      });
      return { ...student, token } as Student;
    };
    /** Independent work, active time and a level, as the trigger, the
     * heartbeat and `/batches` would leave them. */
    const worked = async (
      learnerId: string,
      {
        problems,
        from,
        to,
        minutes,
        strands = { number: to },
      }: {
        problems: number;
        from: number;
        to: number;
        minutes: number;
        strands?: Record<string, number>;
      },
    ) => {
      await db.query(
        `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent)
         VALUES($1,$2,'fixture-skill',$3,$3,$3),($1,$4,'fixture-skill',$5,$5,$5)
         ON CONFLICT DO NOTHING`,
        [
          learnerId,
          day(0),
          problems - Math.floor(problems / 2),
          day(8),
          Math.floor(problems / 2),
        ],
      );
      await db.query(
        `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
         VALUES($1,$2,'practice','fixture-skill',$3),($1,$4,'practice','fixture-skill',$3)
         ON CONFLICT DO NOTHING`,
        [learnerId, day(0), minutes * 60_000, day(8)],
      );
      const estimate = (level: number) =>
        JSON.stringify({
          overall: { level, sd: 0.3, answered: 24, independent: 12 },
          strands: Object.fromEntries(
            Object.entries(strands).map(([id, at]) => [
              id,
              { level: at, sd: 0.4, answered: 24, independent: 12 },
            ]),
          ),
        });
      await db.query(
        `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
         VALUES($1,$2,$3,'test'),($1,$4,$5,'test')
         ON CONFLICT(learner_id,day) DO UPDATE SET frontier=EXCLUDED.frontier`,
        [learnerId, day(3), estimate(from), day(0), estimate(to)],
      );
      await alignGrowthStart(db, learnerId, day(3), period.id);
    };

    // 24 students, growth 5 to 120 points; one alone in the club.
    const roster: Student[] = [];
    for (let index = 0; index < 24; index++) {
      const student = await enroll(period.id, `Student${index}`);
      await worked(student.learnerId, {
        problems: 5 + index,
        from: 5,
        to: 5 + ((index + 1) * 5) / 100,
        minutes: 10 + index,
      });
      roster.push(student);
    }
    // They joined at the start of term, so their weeks count in the gradebook.
    await db.query(
      `UPDATE amp_enrollments SET begin_on=begin_on-30 WHERE role='student';
       UPDATE amp_org_roles SET begin_on=begin_on-30 WHERE role='student'`,
    );
    for (const student of roster)
      await alignGrowthStart(db, student.learnerId, day(3), period.id);
    const first = roster[23]!;
    const last = roster[0]!;
    const alone = await enroll(club.id, "Solo");
    await worked(alone.learnerId, {
      problems: 6,
      from: 5,
      to: 5.3,
      minutes: 9,
    });

    const CLASS = `classes/${period.id}`;
    const board = (student: Student, classId = period.id) =>
      app.inject({
        method: "GET",
        url: `/api/v1/school/student/standings/${classId}`,
        headers: as(student.token),
      });
    const standings = async (student: Student, classId = period.id) => {
      const response = await board(student, classId);
      assert.equal(response.statusCode, 200, response.body);
      return response.json() as {
        top: Top[];
        you: { rank: number | null; value: number };
        teachers: Line[];
        board: { scope: string };
      };
    };
    const map = async (reader: string) =>
      (await ok(get(`${CLASS}/map`, reader))) as {
        students: { id: string }[];
        teachers: MapTeacher[];
        strands: { id: string }[];
      };
    /** Everything that counts students, as it reads before any teacher
     * practices. */
    const counted = async () => {
      const book = await ok(get(`${CLASS}/gradebook`, rivera));
      const term = book.term.id as string;
      const text = async (path: string) => {
        const response = await get(path, rivera);
        assert.equal(response.statusCode, 200, `${path}: ${response.body}`);
        return response.body;
      };
      return {
        gradebook: book,
        today: await ok(get(`${CLASS}/today`, rivera)),
        time: await ok(get(`${CLASS}/time?period=term`, rivera)),
        reportCards: await ok(
          get(`${CLASS}/report-cards?term=${term}`, rivera),
        ),
        roster: await ok(get(`orgs/${school.id}/students`, schoolAdmin)),
        overview: await ok(get(`orgs/${school.id}/overview`, schoolAdmin)),
        gradebookCsv: await text(`${CLASS}/exports/gradebook.csv?term=${term}`),
        timeCsv: await text(`${CLASS}/exports/time.csv`),
        oneRoster: await text(`${CLASS}/exports/oneroster.zip?term=${term}`),
        seats: (
          await db.query(
            "SELECT person_id FROM amp_seats WHERE released_at IS NULL ORDER BY person_id",
          )
        ).rows,
      };
    };
    const before = await counted();
    const studentsBefore = (await map(rivera)).students;
    const strandsBefore = (await map(rivera)).strands;

    // The teachers start their own practice and work hard; an aide and a
    // teacher of another class have adult learners too.
    const start = async (account: string) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/practice",
        headers: as(account),
        payload: { start: "elementary", timezone: "America/New_York" },
      });
      assert.equal(response.statusCode, 201, response.body);
      return response.json().learnerId as string;
    };
    const riveraLearner = await start(rivera);
    const chenLearner = await start(chen);
    const orenLearner = await start(oren);
    const aideLearner = randomUUID();
    await db.query(
      `INSERT INTO amp_learners(id,account_id,name,adult,timezone) VALUES($1,$2,'Abe',true,'America/New_York')`,
      [aideLearner, aide],
    );
    // A teacher far past the class, with work on a strand no student has.
    await worked(riveraLearner, {
      problems: 400,
      from: 9,
      to: 9.92,
      minutes: 600,
      strands: { number: 10, algebra: 9.5 },
    });
    await worked(orenLearner, { problems: 500, from: 5, to: 9, minutes: 600 });
    await worked(aideLearner, { problems: 500, from: 5, to: 9, minutes: 600 });

    await t.test(
      "the map: each practicing teacher is a line of their own",
      async () => {
        const read = await map(rivera);
        assert.deepEqual(read.students, studentsBefore, "students unchanged");
        assert.deepEqual(read.strands, strandsBefore, "no teacher's strand");
        assert.deepEqual(
          read.teachers.map((line) => [line.name, line.you]),
          [
            ["Daniel Chen", false],
            ["Elena Rivera", true],
          ],
          "both teachers, not the aide or another class's teacher",
        );
        const own = read.teachers.find((line) => line.name === "Elena Rivera")!;
        assert.equal(own.level?.overall.level, 9.92);
        // Not started on any work yet: a line with no level.
        assert.equal(
          read.teachers.find((line) => line.name === "Daniel Chen")!.level,
          null,
        );
        // Each reader sees their own line as theirs; the admin sees neither.
        assert.deepEqual(
          (await map(chen)).teachers.map((line) => line.you),
          [true, false],
        );
        assert.deepEqual(
          (await map(schoolAdmin)).teachers.map((line) => line.you),
          [false, false],
        );
        assert.ok(!JSON.stringify(read).includes(riveraLearner));
        assert.ok(!JSON.stringify(read).includes(aideLearner));
      },
    );

    await t.test(
      "standings: the teacher sits in place by value, unranked",
      async () => {
        // Off means off: practicing teachers open no board.
        assert.equal((await board(first)).statusCode, 404);
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: "/api/v1/me",
              headers: as(first.token),
            })
          ).json().school.standings,
          false,
        );
        await post(`${CLASS}/experience`, rivera, {
          values: { standings: "class" },
        });
        await worked(chenLearner, {
          problems: 30,
          from: 5,
          to: 5.4,
          minutes: 40,
        });
        const top = await standings(first);
        // The students' board is exactly what it was: ten, ranked 1 to 10.
        assert.deepEqual(
          top.top.map((row) => [row.rank, row.value]),
          [120, 115, 110, 105, 100, 95, 90, 85, 80, 75].map((value, index) => [
            index + 1,
            value,
          ]),
        );
        assert.ok(top.top.every((row) => !row.name.includes("Rivera")));
        assert.equal(top.you.rank, 1);
        // 92 points sits in the list; 40 is below it.
        assert.deepEqual(top.teachers, [
          {
            name: "Elena Rivera",
            adultName: "Elena Rivera",
            value: 92,
            inList: true,
          },
          {
            name: "Daniel Chen",
            adultName: "Daniel Chen",
            value: 40,
            inList: false,
          },
        ]);
        // Off the list, a student's own line has no rank, as before.
        const low = await standings(last);
        assert.equal(low.you.rank, null);
        assert.equal(low.you.value, 5);
        assert.deepEqual(low.teachers, top.teachers);
        // A student who passes the teacher is above them, and nobody's rank
        // moves for it.
        await worked(roster[17]!.learnerId, {
          problems: 1,
          from: 5,
          to: 5.93,
          minutes: 0,
        });
        const passed = await standings(first);
        assert.deepEqual(
          passed.top.map((row) => [row.rank, row.value]),
          [120, 115, 110, 105, 100, 95, 93, 85, 80, 75].map((value, index) => [
            index + 1,
            value,
          ]),
        );
        assert.equal(passed.teachers[0]!.value, 92);
        assert.equal(passed.teachers[0]!.inList, true);
        await worked(roster[17]!.learnerId, {
          problems: 1,
          from: 5,
          to: 5.9,
          minutes: 0,
        });
        // Practice and level boards read the teacher the same way.
        await post(`${CLASS}/experience`, rivera, {
          values: { measure: "practice" },
        });
        const practice = await standings(first);
        assert.deepEqual(
          practice.top.map((row) => row.rank),
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        );
        assert.deepEqual(practice.teachers[0], {
          name: "Elena Rivera",
          adultName: "Elena Rivera",
          value: 400,
          inList: true,
        });
        await post(`${CLASS}/experience`, rivera, {
          values: { measure: "level", levels: "shown" },
        });
        const level = await standings(first);
        assert.deepEqual(level.teachers[0], {
          name: "Elena Rivera",
          adultName: "Elena Rivera",
          value: 9.9,
          inList: true,
        });
        await post(`${CLASS}/experience`, rivera, {
          values: { measure: "growth", levels: "hidden" },
        });
        // A board that lists nobody puts the teacher after your own line.
        await post(`classes/${club.id}/experience`, rivera, {
          values: { standings: "class" },
        });
        const solo = await standings(alone, club.id);
        assert.deepEqual(solo.top, []);
        assert.deepEqual(solo.teachers, [
          {
            name: "Elena Rivera",
            adultName: "Elena Rivera",
            value: 92,
            inList: false,
          },
        ]);
        // A wider board, by grade with made-up names: the class's own
        // teachers, and the students' places as they were.
        await post(`${CLASS}/experience`, rivera, {
          values: { standings: "school" },
        });
        clearStandingsCache();
        const wide = await standings(first);
        assert.equal(wide.board.scope, "school");
        assert.deepEqual(
          wide.top.map((row) => row.rank),
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        );
        assert.deepEqual(
          wide.teachers.map((line) => line.name),
          ["Elena Rivera", "Daniel Chen"],
        );
        await post(`${CLASS}/experience`, rivera, {
          values: { standings: "class" },
        });
      },
    );

    await t.test("the teacher's switch: Show me in my class", async () => {
      const experience = (account: string) =>
        ok(get(`${CLASS}/experience`, account));
      assert.deepEqual((await experience(rivera)).teacherLine, {
        shown: true,
      });
      assert.equal((await experience(schoolAdmin)).teacherLine, undefined);
      assert.equal((await experience(aide)).teacherLine, undefined);
      const hide = await post(`${CLASS}/experience/me`, rivera, {
        shown: false,
      });
      assert.equal(hide.statusCode, 200, hide.body);
      assert.deepEqual(hide.json().teacherLine, { shown: false });
      // Hidden from the map and the board, for everyone; Chen still shows.
      assert.deepEqual(
        (await map(rivera)).teachers.map((line) => line.name),
        ["Daniel Chen"],
      );
      assert.deepEqual(
        (await standings(first)).teachers.map((line) => line.name),
        ["Daniel Chen"],
      );
      // Only in this class: the club still shows her.
      assert.deepEqual(
        (await standings(alone, club.id)).teachers.map((line) => line.name),
        ["Elena Rivera"],
      );
      // A settings change keeps her choice.
      await post(`${CLASS}/experience`, rivera, {
        values: { measure: "practice" },
      });
      assert.deepEqual((await experience(rivera)).teacherLine, {
        shown: false,
      });
      await post(`${CLASS}/experience`, rivera, {
        values: { measure: "growth" },
      });
      // The same choice again writes nothing.
      await post(`${CLASS}/experience/me`, rivera, { shown: false });
      const events = await db.query(
        `SELECT actor_person_id,detail FROM amp_school_events
         WHERE action='standings.teacher_shown' AND target_id=$1`,
        [period.id],
      );
      assert.equal(events.rowCount, 1);
      assert.deepEqual(events.rows[0].detail, {
        before: { shown: true },
        after: { shown: false },
      });
      // Only a teacher of this class who practices has a line to switch.
      for (const account of [schoolAdmin, aide])
        assert.equal(
          (await post(`${CLASS}/experience/me`, account, { shown: false }))
            .statusCode,
          404,
          account,
        );
      assert.equal(
        (await post(`${CLASS}/experience/me`, oren, { shown: false }))
          .statusCode,
        404,
      );
      assert.equal(
        (await post(`${CLASS}/experience/me`, rivera, { shown: "no" }))
          .statusCode,
        400,
      );
      const show = await post(`${CLASS}/experience/me`, rivera, {
        shown: true,
      });
      assert.deepEqual(show.json().teacherLine, { shown: true });
      assert.deepEqual(
        (await map(rivera)).teachers.map((line) => line.name),
        ["Daniel Chen", "Elena Rivera"],
      );
      const stored = await db.query(
        `SELECT "values" FROM amp_scope_settings WHERE scope_kind='class' AND scope_id=$1`,
        [period.id],
      );
      assert.equal(stored.rows[0].values.teachersHidden, undefined);
    });

    await t.test(
      "never counted: grades, medians, Today, time, rosters, seats and exports",
      async () => {
        // The teachers' lines are on, and they worked far more than anyone.
        assert.equal((await map(rivera)).teachers.length, 2);
        const after = await counted();
        assert.deepEqual(after.gradebook, before.gradebook);
        assert.deepEqual(after.today, before.today);
        assert.deepEqual(after.time, before.time);
        assert.deepEqual(after.reportCards, before.reportCards);
        assert.deepEqual(after.roster, before.roster);
        assert.deepEqual(after.overview, before.overview);
        assert.equal(after.gradebookCsv, before.gradebookCsv);
        assert.equal(after.timeCsv, before.timeCsv);
        assert.deepEqual(after.seats, before.seats);
        for (const learner of [riveraLearner, chenLearner])
          assert.ok(!after.oneRoster.includes(learner));
        // No target is set here, so the class counts against the school's
        // default; the teacher's own line changes no student's suggestion.
        assert.equal(after.gradebook.weeklyTargetMinutes, 60);
        assert.ok(
          after.gradebook.students.every(
            (row: { suggestion: { status: string } }) =>
              row.suggestion.status === "ready",
          ),
          "every suggestion stands on the median",
        );
      },
    );
  },
);
