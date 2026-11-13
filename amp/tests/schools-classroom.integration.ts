import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { templates } from "../src/math/engine.js";
import { clearStandingsCache, listedCount } from "../src/schools/standings.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { alignGrowthStart } from "./helpers/growth-window.js";
import { schoolDay } from "./helpers/school-day.js";

const YEAR_AHEAD = new Date(Date.now() + 365 * 86_400_000).toISOString();
const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};
const blankPdf = async (pages: number) => {
  const doc = await PDFDocument.create();
  for (let page = 0; page < pages; page++) doc.addPage();
  return Buffer.from(await doc.save());
};

test(
  "AMP for Schools classroom: settings, standings and the workbook stack",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_classroom_${randomUUID().replaceAll("-", "")}`;
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
    const rendered: { html: string; format: string }[] = [];
    let rendererDown = false;
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: {
        secret: "x".repeat(32),
        origin: "https://amp.example",
        learning,
        renderer: {
          render: async ({ html, format }) => {
            if (rendererDown) throw new Error("render service is down");
            rendered.push({ html, format });
            return blankPdf(2);
          },
        },
      },
    });
    await app.ready();

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

    const district = await schools.createOrg(
      {
        kind: "district",
        name: "Riverbend District",
        timezone: "America/New_York",
      },
      agreement,
    );
    const north = await schools.createOrg({
      kind: "school",
      name: "Alder Street School",
      parentId: district.id,
    });
    const south = await schools.createOrg({
      kind: "school",
      name: "Birch Lane School",
      parentId: district.id,
    });
    await schools.issueLicense({
      orgId: district.id,
      seats: 200,
      endsAt: YEAR_AHEAD,
    });
    const districtAdmin = `amp|district-${randomUUID()}`;
    await schools.addStaff({
      orgId: district.id,
      role: "admin",
      givenName: "Dana",
      accountId: districtAdmin,
    });
    const schoolAdmin = `amp|school-${randomUUID()}`;
    await schools.addStaff({
      orgId: north.id,
      role: "admin",
      givenName: "Sam",
      accountId: schoolAdmin,
    });
    const period = await schools.createClass(north.id, {
      name: "Grade 5 Math",
    });
    const quiet = await schools.createClass(north.id, { name: "Math Support" });
    const away = await schools.createClass(south.id, { name: "Grade 5 Math" });
    const teacher = `amp|teacher-${randomUUID()}`;
    await schools.addStaff({
      orgId: north.id,
      role: "teacher",
      givenName: "Grace",
      accountId: teacher,
      classId: period.id,
    });
    const aide = `amp|aide-${randomUUID()}`;
    await schools.addStaff({
      orgId: north.id,
      role: "aide",
      givenName: "Abe",
      accountId: aide,
      classId: period.id,
    });
    const otherTeacher = `amp|other-${randomUUID()}`;
    await schools.addStaff({
      orgId: north.id,
      role: "teacher",
      givenName: "Oren",
      accountId: otherTeacher,
      classId: quiet.id,
    });

    type Student = Awaited<ReturnType<typeof schools.provisionStudent>> & {
      token: string;
    };
    const enroll = async (
      orgId: string,
      classId: string,
      givenName: string,
      familyName: string,
      gradeLevel = 5,
    ): Promise<Student> => {
      const student = await schools.provisionStudent(orgId, {
        givenName,
        familyName,
        gradeLevel,
        classId,
      });
      const { token } = await schools.issueStudentSession({
        personId: student.personId,
        mode: "shared",
      });
      return { ...student, token };
    };
    /** Independent work and a level for today, as the trigger and `/batches`
     * would leave them. */
    const worked = async (
      learnerId: string,
      {
        problems = 0,
        from = 5,
        to = 5,
      }: { problems?: number; from?: number; to?: number },
    ) => {
      const day = (offset: number) => schoolDay(-offset);
      if (problems)
        await db.query(
          `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent)
           VALUES($1,$2,'fixture-skill',$3,$3,$3)
           ON CONFLICT(learner_id,day,skill_id) DO UPDATE SET independent=amp_skill_days.independent+EXCLUDED.independent`,
          [learnerId, day(0), problems],
        );
      const estimate = (level: number) =>
        JSON.stringify({
          overall: { level, sd: 0.3, answered: 20, independent: 10 },
          strands: {},
        });
      await db.query(
        `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
         VALUES($1,$2,$3,'test'),($1,$4,$5,'test')
         ON CONFLICT(learner_id,day) DO UPDATE SET frontier=EXCLUDED.frontier`,
        [learnerId, day(3), estimate(from), day(0), estimate(to)],
      );
      await alignGrowthStart(db, learnerId, day(3));
    };
    const board = (student: Student, classId: string) =>
      app.inject({
        method: "GET",
        url: `/api/v1/school/student/standings/${classId}`,
        headers: as(student.token),
      });
    const boards = async (student: Student) =>
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/school/student/standings",
          headers: as(student.token),
        })
      ).json().boards as { classId: string; scope: string }[];

    // 24 students with growth from 1 to 24 grade-hundredths * 5.
    const roster: Student[] = [];
    for (let index = 0; index < 24; index++) {
      const student = await enroll(
        north.id,
        period.id,
        `Student${index}`,
        `Family${index}`,
      );
      await worked(student.learnerId, {
        problems: 5 + index,
        from: 5,
        to: 5 + ((index + 1) * 5) / 100,
      });
      roster.push(student);
    }
    const first = roster[23]!;
    const last = roster[0]!;
    const neighbor = await enroll(south.id, away.id, "Far", "Away");
    await worked(neighbor.learnerId, { problems: 30, from: 5, to: 7 });
    const other = await enroll(north.id, quiet.id, "Quiet", "Student");
    await worked(other.learnerId, { problems: 40, from: 5, to: 8 });

    try {
      await t.test("a small board never lists down to last place", () => {
        assert.equal(listedCount(24), 10);
        assert.equal(listedCount(14), 10);
        assert.equal(listedCount(8), 6);
        assert.equal(listedCount(2), 1);
        assert.equal(listedCount(1), 0);
        assert.equal(listedCount(0), 0);
      });

      await t.test(
        "settings: scope, who set it, locks and events",
        async () => {
          const read = (
            await get(`classes/${period.id}/experience`, teacher)
          ).json();
          assert.equal(read.settings.levels.value, "hidden");
          assert.equal(read.settings.levels.setBy, null);
          assert.equal(read.canEdit, true);
          assert.equal(read.canLock, false);
          assert.deepEqual(read.standingsOptions, [
            "off",
            "class",
            "school",
            "district",
          ]);
          assert.equal(read.students.length, 24);
          // A teacher writes their own class, and no one else's.
          const mine = await post(`classes/${period.id}/experience`, teacher, {
            values: { levels: "shown" },
          });
          assert.equal(mine.statusCode, 200);
          assert.equal(mine.json().settings.levels.value, "shown");
          assert.equal(mine.json().settings.levels.setBy.name, "Grade 5 Math");
          assert.equal(
            (
              await post(`classes/${quiet.id}/experience`, teacher, {
                values: { levels: "shown" },
              })
            ).statusCode,
            404,
          );
          assert.equal(
            (
              await post(`orgs/${north.id}/experience`, teacher, {
                values: { levels: "shown" },
              })
            ).statusCode,
            404,
          );
          // An aide reads, but doesn't change.
          assert.equal(
            (await get(`classes/${period.id}/experience`, aide)).json().canEdit,
            false,
          );
          assert.equal(
            (
              await post(`classes/${period.id}/experience`, aide, {
                values: { levels: "shown" },
              })
            ).statusCode,
            404,
          );
          // A teacher can't send a lock at all.
          assert.equal(
            (
              await post(`classes/${period.id}/experience`, teacher, {
                values: {},
                locks: { levels: true },
              })
            ).statusCode,
            400,
          );
          // A district locks it: below it's ignored, and writing is refused.
          const locked = await post(
            `orgs/${district.id}/experience`,
            districtAdmin,
            {
              values: { levels: "hidden" },
              locks: { levels: true },
            },
          );
          assert.equal(locked.statusCode, 200);
          assert.equal(locked.json().canLock, true);
          const below = (
            await get(`classes/${period.id}/experience`, teacher)
          ).json();
          assert.equal(below.settings.levels.value, "hidden");
          assert.equal(
            below.settings.levels.lockedBy.name,
            "Riverbend District",
          );
          assert.equal(below.settings.levels.setBy.name, "Riverbend District");
          for (const [path, token] of [
            [`classes/${period.id}/experience`, teacher],
            [`orgs/${north.id}/experience`, schoolAdmin],
          ] as const) {
            const refused = await post(path, token, {
              values: { levels: "shown" },
            });
            assert.equal(refused.statusCode, 409, path);
            assert.deepEqual(refused.json(), { error: "setting_locked" });
          }
          const student = roster[3]!;
          const me = await app.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: as(student.token),
          });
          assert.equal(me.json().school.levels, "hidden");
          await post(`orgs/${district.id}/experience`, districtAdmin, {
            locks: { levels: false },
            values: { levels: null },
          });
          // Back to this class's own value, kept all along.
          assert.equal(
            (
              await app.inject({
                method: "GET",
                url: "/api/v1/me",
                headers: as(student.token),
              })
            ).json().school.levels,
            "shown",
          );
          const events = await db.query(
            `SELECT action,target_kind,detail FROM amp_school_events WHERE action='settings.changed' AND target_id=$1 ORDER BY at`,
            [period.id],
          );
          assert.deepEqual(events.rows[0].detail.before.values, {
            levels: null,
          });
          assert.deepEqual(events.rows[0].detail.after.values, {
            levels: "shown",
          });
          // Most restrictive across a student's classes.
          const both = await enroll(north.id, period.id, "Two", "Classes");
          await db.query(
            `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
           SELECT gen_random_uuid(),$1,$2,'student',begin_on FROM amp_enrollments WHERE person_id=$2 LIMIT 1`,
            [quiet.id, both.personId],
          );
          await post(`classes/${quiet.id}/experience`, otherTeacher, {
            values: { levels: "choice" },
          });
          assert.equal(
            (
              await app.inject({
                method: "GET",
                url: "/api/v1/me",
                headers: as(both.token),
              })
            ).json().school.levels,
            "choice",
          );
          await db.query(
            "UPDATE amp_enrollments SET end_on=begin_on WHERE person_id=$1",
            [both.personId],
          );
        },
      );

      await t.test("standings: off until a class turns them on", async () => {
        assert.deepEqual(await boards(first), []);
        assert.equal((await board(first, period.id)).statusCode, 404);
        const me = await app.inject({
          method: "GET",
          url: "/api/v1/me",
          headers: as(first.token),
        });
        assert.equal(me.json().school.standings, false);
        // A parent or staff credential is never a student's.
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: `/api/v1/school/student/standings/${period.id}`,
              headers: as(teacher),
            })
          ).statusCode,
          401,
        );
      });

      await t.test("a class board: the top ten and your own line", async () => {
        await post(`classes/${period.id}/experience`, teacher, {
          values: { standings: "class" },
        });
        const open = await board(first, period.id);
        assert.equal(open.statusCode, 200);
        const top = open.json();
        assert.equal(top.board.scope, "class");
        assert.equal(top.board.measure, "growth");
        assert.equal(top.top.length, 10);
        assert.deepEqual(
          top.top.map((row: { rank: number }) => row.rank),
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        );
        assert.equal(top.top[0].name, "Student23 F.");
        assert.equal(top.top[0].value, 120);
        assert.equal(top.top[0].you, true);
        assert.equal(top.you.rank, 1);
        assert.equal(top.you.name, "Student23 F.");
        // Last place reads as their own progress: no rank, no one below.
        const low = (await board(last, period.id)).json();
        assert.equal(low.top.length, 10);
        assert.equal(
          low.top.some((row: { you: boolean }) => row.you),
          false,
        );
        assert.equal(low.you.rank, null);
        assert.equal(low.you.value, 5);
        // This week's growth is the week's pace over its elapsed days
        // (growth.ts): 5 points in the last 3 days, over the 6 the week has
        // run so far.
        assert.equal(low.you.thisWeek, 10);
        assert.equal(JSON.stringify(low).includes("Student0 F."), true);
        assert.equal(
          low.top.some((row: { name: string }) => row.name === "Student0 F."),
          false,
        );
        // Practice and level measures read independent work.
        await post(`classes/${period.id}/experience`, teacher, {
          values: { measure: "practice" },
        });
        const practice = (await board(first, period.id)).json();
        assert.equal(practice.board.measure, "practice");
        assert.equal(practice.top[0].value, 28);
        await post(`classes/${period.id}/experience`, teacher, {
          values: { measure: "level", levels: "shown" },
        });
        const level = (await board(first, period.id)).json();
        assert.equal(level.board.measure, "level");
        assert.equal(level.top[0].value, 6.2);
        // With levels hidden a level board counts growth, so levels stay hidden.
        await post(`classes/${period.id}/experience`, teacher, {
          values: { levels: "hidden" },
        });
        assert.equal(
          (await board(first, period.id)).json().board.measure,
          "growth",
        );
        await post(`classes/${period.id}/experience`, teacher, {
          values: { measure: "growth" },
        });
      });

      await t.test("you can't see another class's board", async () => {
        await post(`classes/${quiet.id}/experience`, otherTeacher, {
          values: { standings: "class" },
        });
        assert.equal((await board(first, quiet.id)).statusCode, 404);
        assert.equal((await board(other, period.id)).statusCode, 404);
        assert.equal((await board(other, "not-a-class")).statusCode, 404);
        assert.equal((await board(neighbor, period.id)).statusCode, 404);
        await post(`classes/${quiet.id}/experience`, otherTeacher, {
          values: { standings: "off" },
        });
        assert.equal((await board(other, quiet.id)).statusCode, 404);
      });

      await t.test("a student left off", async () => {
        const student = roster[23]!;
        const staff = await post(
          `classes/${period.id}/students/${student.personId}/standings`,
          teacher,
          { leftOff: true },
        );
        assert.equal(staff.statusCode, 200);
        assert.equal(
          staff
            .json()
            .students.find((s: { id: string }) => s.id === student.personId)
            .leftOff,
          true,
        );
        // Not on anyone's board, and not offered it.
        const next = (await board(roster[22]!, period.id)).json();
        assert.equal(next.top[0].value, 115);
        assert.equal(
          next.top.some((row: { name: string }) => row.name === "Student23 F."),
          false,
        );
        assert.equal((await board(student, period.id)).statusCode, 404);
        assert.deepEqual(await boards(student), []);
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: "/api/v1/me",
              headers: as(student.token),
            })
          ).json().school.standings,
          false,
        );
        // Only someone on this roster, and only a teacher who has them.
        assert.equal(
          (
            await post(
              `classes/${period.id}/students/${other.personId}/standings`,
              teacher,
              { leftOff: true },
            )
          ).statusCode,
          404,
        );
        assert.equal(
          (
            await post(
              `classes/${period.id}/students/${roster[1]!.personId}/standings`,
              otherTeacher,
              { leftOff: true },
            )
          ).statusCode,
          404,
        );
        const event = await db.query(
          `SELECT detail FROM amp_school_events WHERE action='standings.left_off' AND target_id=$1`,
          [student.personId],
        );
        assert.deepEqual(event.rows[0].detail.after, { leftOff: true });
        await post(
          `classes/${period.id}/students/${student.personId}/standings`,
          teacher,
          { leftOff: false },
        );
        assert.equal((await board(student, period.id)).statusCode, 200);
      });

      await t.test("wider boards: names, by grade, opted in", async () => {
        await post(`classes/${period.id}/experience`, teacher, {
          values: { standings: "school" },
        });
        const school = (await board(first, period.id)).json();
        assert.equal(school.board.scope, "school");
        assert.equal(school.board.placeName, "Alder Street School");
        assert.equal(school.board.gradeLevel, 5);
        assert.equal(school.top.length, 10);
        assert.equal(school.you.name, "Student23 F.");
        assert.equal(school.top[0].name, school.you.name);
        for (const row of school.top) {
          assert.match(row.name, /^Student\d+ F\.$/);
        }
        // The quiet class next door stays off a board it never agreed to.
        assert.equal(school.top[0].value, 120);
        // Grade levels stay apart.
        const younger = await enroll(
          north.id,
          period.id,
          "Young",
          "Learner",
          3,
        );
        await worked(younger.learnerId, { problems: 50, from: 3, to: 6 });
        clearStandingsCache();
        const youngBoard = (await board(younger, period.id)).json();
        assert.equal(youngBoard.board.gradeLevel, 3);
        assert.equal(youngBoard.top.length, 0, "alone in the grade, unlisted");
        assert.equal(youngBoard.you.value, 300);
        assert.equal((await board(first, period.id)).json().top[0].value, 120);
        // Cached briefly: one more pass reads the cache, and a settings change
        // on this pod clears it.
        await db.query(
          "UPDATE amp_people SET display_name='Maya' WHERE id=$1",
          [first.personId],
        );
        assert.notEqual(
          (await board(first, period.id)).json().top[0].name,
          "Maya F.",
        );
        await post(`classes/${period.id}/experience`, teacher, {
          values: { standings: "district" },
        });
        // A district board reaches only classes that opted in that far.
        const wide = (await board(first, period.id)).json();
        assert.equal(wide.board.scope, "district");
        assert.equal(wide.board.placeName, "Riverbend District");
        assert.equal(wide.top[0].name, "Maya F.");
        assert.notEqual(wide.top[0].value, 200);
        const birch = `amp|birch-${randomUUID()}`;
        await schools.addStaff({
          orgId: south.id,
          role: "teacher",
          givenName: "Bea",
          accountId: birch,
          classId: away.id,
        });
        await post(`classes/${away.id}/experience`, birch, {
          values: { standings: "district" },
        });
        const joined = (await board(neighbor, away.id)).json();
        assert.equal(joined.top[0].value, 200);
        assert.equal(joined.you.rank, 1);
        assert.equal(joined.you.name, "Far A.");
        assert.equal(joined.top[0].name, "Far A.");
        // A student left off anywhere is off every wider board.
        await post(
          `classes/${period.id}/students/${first.personId}/standings`,
          teacher,
          { leftOff: true },
        );
        assert.equal(
          (await board(roster[22]!, period.id))
            .json()
            .top.some((row: { name: string }) => row.name === "Maya F."),
          false,
        );
        await post(
          `classes/${period.id}/students/${first.personId}/standings`,
          teacher,
          { leftOff: false },
        );
        await post(`classes/${period.id}/experience`, teacher, {
          values: { standings: "off" },
        });
        await post(`classes/${away.id}/experience`, birch, {
          values: { standings: "off" },
        });
      });

      await t.test(
        "every board uses the same names, without handles or disambiguators",
        async () => {
          const cases = [
            {
              student: first,
              display: "Maya",
              family: "Reed",
              name: "Maya R.",
            },
            {
              student: roster[22]!,
              display: "Maya",
              family: "Ross",
              name: "Maya R.",
            },
            {
              student: roster[21]!,
              display: "Noor",
              family: null,
              name: "Noor",
            },
            {
              student: roster[20]!,
              display: null,
              family: null,
              name: "Student20",
            },
            {
              student: roster[19]!,
              display: null,
              family: "Lane",
              name: "Student19 L.",
            },
          ];
          for (const entry of cases)
            await db.query(
              "UPDATE amp_people SET display_name=$2,family_name=$3 WHERE id=$1",
              [entry.student.personId, entry.display, entry.family],
            );
          const handles = (await db.query("SELECT handle FROM amp_people"))
            .rows;
          for (const scope of ["class", "school", "district"]) {
            await post(`classes/${period.id}/experience`, teacher, {
              values: { standings: scope },
            });
            const result = (await board(first, period.id)).json();
            assert.equal(result.board.scope, scope);
            assert.equal(
              result.top.filter(
                (row: { name: string }) => row.name === "Maya R.",
              ).length,
              2,
            );
            for (const row of result.top)
              assert.deepEqual(Object.keys(row).sort(), [
                "name",
                "rank",
                "value",
                "you",
              ]);
            for (const entry of cases) {
              const own = (await board(entry.student, period.id)).json();
              assert.equal(own.you.name, entry.name);
              assert.equal(
                own.top.find((row: { you: boolean }) => row.you).name,
                entry.name,
              );
              for (const { handle } of handles)
                assert.equal(JSON.stringify(own).includes(handle), false);
            }
            const unlisted = (await board(last, period.id)).json();
            assert.equal(unlisted.you.name, "Student0 F.");
            assert.equal(unlisted.you.rank, null);
          }
          for (const [index, entry] of cases.entries())
            await db.query(
              "UPDATE amp_people SET display_name=NULL,family_name=$2 WHERE id=$1",
              [entry.student.personId, `Family${23 - index}`],
            );
          await post(`classes/${period.id}/experience`, teacher, {
            values: { standings: "off" },
          });
        },
      );

      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
      }).format(new Date());
      const skill = templates.find(
        (t) => t.id && !t.id.includes("assess"),
      )!.skillId;
      await t.test(
        "the stack: a workbook for one student, fixed number",
        async () => {
          const student = roster[5]!;
          const made = await post(
            `classes/${period.id}/students/${student.personId}/workbooks`,
            teacher,
            { date, minutes: 30, paper: "letter", number: 1 },
          );
          assert.equal(made.statusCode, 201);
          const workbook = made.json();
          assert.equal(workbook.number, 1);
          // Retrying finds the same one; an aide can print too.
          const again = await post(
            `classes/${period.id}/students/${student.personId}/workbooks`,
            aide,
            { date, minutes: 30, paper: "letter", number: 1 },
          );
          assert.equal(again.statusCode, 200);
          assert.equal(again.json().id, workbook.id);
          const count = await db.query(
            "SELECT count(*)::int AS n FROM amp_workbooks WHERE learner_id=$1",
            [student.learnerId],
          );
          assert.equal(count.rows[0].n, 1);
          // A week ahead works; further doesn't, nor does the past.
          const ahead = (days: number) =>
            new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
              .toISOString()
              .slice(0, 10);
          assert.equal(
            (
              await post(
                `classes/${period.id}/students/${student.personId}/workbooks`,
                teacher,
                { date: ahead(7), minutes: 30, paper: "letter", number: 1 },
              )
            ).statusCode,
            201,
          );
          for (const days of [8, -1]) {
            const refused = await post(
              `classes/${period.id}/students/${student.personId}/workbooks`,
              teacher,
              { date: ahead(days), minutes: 30, paper: "letter", number: 1 },
            );
            assert.equal(refused.statusCode, 400, String(days));
            assert.deepEqual(refused.json(), { error: "workbook_date" });
          }
          // Not this class's student; a viewer of another class isn't either.
          assert.equal(
            (
              await post(
                `classes/${period.id}/students/${other.personId}/workbooks`,
                teacher,
                { date, minutes: 30, paper: "letter", number: 1 },
              )
            ).statusCode,
            404,
          );
          assert.equal(
            (
              await post(
                `classes/${period.id}/students/${student.personId}/workbooks`,
                otherTeacher,
                { date, minutes: 30, paper: "letter", number: 1 },
              )
            ).statusCode,
            404,
          );
          // The PDF: rendered outside the learner, and the QR opens the teacher's
          // marking route.
          const pdf = await get(
            `classes/${period.id}/students/${student.personId}/workbooks/${workbook.id}/pdf`,
            teacher,
          );
          assert.equal(pdf.statusCode, 200);
          assert.equal(pdf.headers["content-type"], "application/pdf");
          assert.match(rendered.at(-1)!.html, /class="wb-qr"/);
          assert.match(rendered.at(-1)!.html, /Workbook for Student5/);
          rendererDown = true;
          const down = await get(
            `classes/${period.id}/students/${student.personId}/workbooks/${workbook.id}/pdf`,
            teacher,
          );
          rendererDown = false;
          assert.equal(down.statusCode, 503);
          assert.deepEqual(down.json(), {
            error: "workbook_renderer_unavailable",
            retryAfter: 5,
          });
          assert.equal(down.headers["retry-after"], "5");
          // A workbook that isn't this student's isn't found.
          const elsewhere = (
            await post(
              `classes/${period.id}/students/${roster[6]!.personId}/workbooks`,
              teacher,
              { date, minutes: 30, paper: "letter", number: 1 },
            )
          ).json();
          assert.equal(
            (
              await get(
                `classes/${period.id}/students/${student.personId}/workbooks/${elsewhere.id}/pdf`,
                teacher,
              )
            ).statusCode,
            404,
          );
          // A focus skill reaches compose.
          const focused = await post(
            `classes/${period.id}/students/${roster[7]!.personId}/workbooks`,
            teacher,
            { date, minutes: 45, paper: "letter", number: 2, skill },
          );
          assert.equal(focused.statusCode, 201);
          const spec = (
            await db.query("SELECT spec FROM amp_workbooks WHERE id=$1", [
              focused.json().id,
            ])
          ).rows[0].spec;
          assert.equal(spec.focusSkill, skill);
          const hits = spec.sections
            .flatMap((s: { items: { skillId: string }[] }) => s.items)
            .filter((item: { skillId: string }) => item.skillId === skill);
          assert.ok(
            hits.length >= 2,
            `focus skill printed ${hits.length} times`,
          );
          assert.equal(
            (await get(`classes/${period.id}/workbooks`, teacher))
              .json()
              .recent.find(
                (set: { number: number; minutes: number }) =>
                  set.number === 2 && set.minutes === 45,
              ).focus,
            skill,
          );
          // The stack says what was made.
          const view = (
            await get(`classes/${period.id}/workbooks`, teacher)
          ).json();
          assert.equal(view.canPrint, true);
          assert.equal(view.pdf, true);
          assert.equal(view.today, date);
          assert.equal(view.lastDate, ahead(7));
          assert.ok(view.students.length >= 24);
          assert.equal(
            view.recent.find(
              (set: { date: string; number: number; minutes: number }) =>
                set.date === date && set.number === 1 && set.minutes === 30,
            ).students,
            2,
          );
          // An exhausted allowance needs paid access for another workbook.
          await db.query(
            "UPDATE amp_grants SET status='revoked' WHERE learner_id=$1",
            [roster[8]!.learnerId],
          );
          await db.query(
            "UPDATE amp_learners SET free_workbooks_used=5 WHERE id=$1",
            [roster[8]!.learnerId],
          );
          const waiting = await post(
            `classes/${period.id}/students/${roster[8]!.personId}/workbooks`,
            teacher,
            { date, minutes: 30, paper: "letter", number: 1 },
          );
          assert.equal(waiting.statusCode, 402);
          assert.deepEqual(waiting.json(), {
            error: "free_workbooks_unavailable",
          });
          assert.equal(
            (await get(`classes/${period.id}/workbooks`, teacher))
              .json()
              .students.find(
                (s: { id: string }) => s.id === roster[8]!.personId,
              ).seated,
            false,
          );
        },
      );

      await t.test(
        "marking: idempotent, teacher-entered, level day written",
        async () => {
          const student = roster[5]!;
          const view = (
            await get(
              `classes/${period.id}/workbooks/marks?date=${date}&set=1`,
              teacher,
            )
          ).json();
          assert.equal(view.set, 1);
          assert.equal(view.canMark, true);
          const row = view.students.find(
            (s: { id: string }) => s.id === student.personId,
          );
          assert.ok(row.workbook.problems.length > 3);
          assert.equal(row.workbook.problems[0].mark, null);
          assert.equal(typeof row.workbook.problems[0].label, "string");
          assert.equal(
            view.students.find((s: { id: string }) => s.id === other.personId),
            undefined,
          );
          const path = `classes/${period.id}/students/${student.personId}/workbooks/${row.workbook.id}/marks`;
          await db.query(
            "DELETE FROM amp_level_days WHERE learner_id=$1 AND day=(now() AT TIME ZONE 'America/New_York')::date",
            [student.learnerId],
          );
          const saved = await post(path, teacher, {
            entries: [
              { n: 1, mark: "right" },
              { n: 2, mark: "not-yet" },
            ],
          });
          assert.equal(saved.statusCode, 200);
          assert.equal(saved.json().recorded, 2);
          assert.equal(saved.json().problems[0].mark, "right");
          assert.equal(saved.json().problems[1].mark, "not-yet");
          // Sending it again changes nothing, and a saved mark stays.
          const repeat = await post(path, teacher, {
            entries: [
              { n: 1, mark: "not-yet" },
              { n: 3, mark: "right" },
            ],
          });
          assert.equal(repeat.json().recorded, 1);
          assert.equal(repeat.json().problems[0].mark, "right");
          const attempts = await db.query(
            "SELECT outcome FROM amp_attempts WHERE learner_id=$1 AND request_id LIKE 'paper:%'",
            [student.learnerId],
          );
          assert.equal(attempts.rowCount, 3);
          for (const { outcome } of attempts.rows) {
            assert.equal(outcome.evidenceSource, "paper");
            assert.equal(outcome.evidenceWeight, 0.5);
          }
          const stored = await db.query(
            `SELECT content->'selection' AS selection FROM amp_instances
           WHERE learner_id=$1 AND id LIKE 'paper:%'`,
            [student.learnerId],
          );
          assert.equal(stored.rows[0].selection.enteredBy, "teacher");
          assert.equal(stored.rows[0].selection.reason, "paper");
          const level = await db.query(
            "SELECT 1 FROM amp_level_days WHERE learner_id=$1 AND day=(now() AT TIME ZONE 'America/New_York')::date",
            [student.learnerId],
          );
          assert.equal(level.rowCount, 1, "the day's level is written");
          // Another read sees them, and half-weight marks don't count as
          // independent work on a board.
          const after = (
            await get(
              `classes/${period.id}/workbooks/marks?date=${date}&set=1`,
              teacher,
            )
          ).json();
          assert.equal(
            after.students.find(
              (s: { id: string }) => s.id === student.personId,
            ).workbook.problems[2].mark,
            "right",
          );
          const roll = await db.query(
            "SELECT sum(independent)::int AS independent FROM amp_skill_days WHERE learner_id=$1 AND skill_id<>'fixture-skill'",
            [student.learnerId],
          );
          assert.equal(roll.rows[0].independent, 0);
          assert.equal(
            (await get(`classes/${period.id}/workbooks`, teacher))
              .json()
              .recent.find(
                (set: { date: string; number: number; minutes: number }) =>
                  set.date === date && set.number === 1 && set.minutes === 30,
              ).marked,
            1,
          );
          // A problem that isn't on this sheet is refused, not guessed.
          assert.equal(
            (
              await post(path, teacher, {
                entries: [{ n: 199, mark: "right" }],
              })
            ).statusCode,
            400,
          );
          // Another class's teacher can't read or mark this class.
          assert.equal(
            (
              await get(
                `classes/${period.id}/workbooks/marks?date=${date}`,
                otherTeacher,
              )
            ).statusCode,
            404,
          );
          assert.equal(
            (
              await post(path, otherTeacher, {
                entries: [{ n: 4, mark: "right" }],
              })
            ).statusCode,
            404,
          );
          // An empty date is an honest empty sheet.
          const quietDay = (
            await get(
              `classes/${period.id}/workbooks/marks?date=2020-01-01`,
              teacher,
            )
          ).json();
          assert.equal(quietDay.set, null);
          assert.equal(quietDay.students[0].workbook, null);
          assert.equal(
            (
              await get(
                `classes/${period.id}/workbooks/marks?date=nope`,
                teacher,
              )
            ).statusCode,
            400,
          );
        },
      );

      await t.test("standings never touch what's scheduled next", async () => {
        const before = await db.query(
          "SELECT count(*)::int AS n FROM amp_instances WHERE learner_id=$1",
          [first.learnerId],
        );
        await post(`classes/${period.id}/experience`, teacher, {
          values: { standings: "class" },
        });
        await board(first, period.id);
        const after = await db.query(
          "SELECT count(*)::int AS n FROM amp_instances WHERE learner_id=$1",
          [first.learnerId],
        );
        assert.equal(after.rows[0].n, before.rows[0].n);
      });
    } finally {
      await app.close();
      await learning.close?.();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
