import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { strFromU8, unzipSync } from "fflate";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { FamilyRepository } from "../src/family/repository.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { templates } from "../src/math/engine.js";
import { purgeHelpEvents } from "../src/privacy/retention.js";
import { RETENTION } from "../src/privacy/retention-periods.js";
import { sumWeeks } from "../src/schools/demo/term.js";
import { helpWeeks } from "../src/schools/help-events.js";
import { schoolExport } from "../src/schools/privacy.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* Help events (migration 0111): lessons, hints, videos and worked examples
   opened ride on the active-time heartbeat, roll up on write into day and week
   counters, and travel with export and deletion. Every name is made up. */
const skillOf = (template: string) =>
  templates.find((t) => t.id === template)!.skillId;
const monday = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

test(
  "help events: heartbeat writes, rollups, answers, reads, export and deletion",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_help_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const families = new FamilyRepository(db);
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
      app.inject({ method: "GET", url: path, headers: as(token) });
    const post = (path: string, token: string, payload: object = {}) =>
      app.inject({ method: "POST", url: path, headers: as(token), payload });
    const rows = async (sql: string, ...params: unknown[]) =>
      (await db.query(sql, params)).rows;

    const org = (await schoolAdmin(schools, "create-org", {
      kind: "school",
      name: "Larkspur Fixture School",
      timezone: "America/New_York",
      agreement: {
        version: "fixture-1",
        signerName: "Fixture Signer",
        signerTitle: "Head of School",
      },
    })) as { id: string };
    await schoolAdmin(schools, "issue-license", {
      orgId: org.id,
      seats: 10,
      endsAt: new Date(Date.now() + 200 * 86_400_000).toISOString(),
    });
    const klass = (await schools.createClass(org.id, {
      name: "Period 2",
    })) as { id: string };
    const student = await schools.provisionStudent(org.id, {
      givenName: "Ivo",
      gradeLevel: 2,
      classId: klass.id,
    });
    const { token } = await schools.issueStudentSession({
      personId: student.personId,
      mode: "shared",
    });
    const teacherAccount = `amp|teacher-${randomUUID()}`;
    await db.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
       VALUES($1,'Wren Fixture',$2,true,now(),now())`,
      [teacherAccount.slice(4), `${teacherAccount.slice(4)}@help.example`],
    );
    await schools.addStaff({
      orgId: org.id,
      role: "teacher",
      givenName: "Wren",
      accountId: teacherAccount,
      classId: klass.id,
    });
    const learnerPath = `/api/v1/learners/${student.learnerId}`;
    const served = await post(`${learnerPath}/batches`, token, {
      templateId: "add-within-20",
      count: 1,
      figureCapabilities: ["scenes-v1"],
    });
    assert.equal(served.statusCode, 200, served.body);
    const problem = served.json().problems[0] as { id: string; skillId: string };
    const beat = (body: object) =>
      post("/api/v1/school/student/activity", token, body);
    const age = (seconds: number) =>
      db.query(
        "UPDATE amp_student_sessions SET last_seen_at=now()-make_interval(secs=>$2) WHERE person_id=$1",
        [student.personId, seconds],
      );
    const today = (
      await rows(
        "SELECT to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-DD') AS d",
      )
    )[0].d as string;
    const week = monday(today);
    const otherSkill = skillOf("count-objects");

    await t.test(
      "events ride on the heartbeat: skill from the problem, else the lesson",
      async () => {
        await age(30);
        const response = await beat({
          deltas: [
            { surface: "hint", problemId: problem.id, activeMs: 10_000 },
            { surface: "video", skillId: otherSkill, activeMs: 8_000 },
            { surface: "example", skillId: "no-such-skill", activeMs: 2_000 },
          ],
          events: [
            {
              kind: "hint",
              source: "practice",
              ref: "add-within-20",
              problemId: problem.id,
              step: 1,
              ageMs: 5_000,
            },
            {
              kind: "lesson",
              source: "pathways",
              ref: "count-objects",
              ageMs: 1_000,
            },
            {
              kind: "video",
              source: "practice",
              ref: "add-within-20",
              problemId: problem.id,
              ageMs: 0,
            },
            {
              kind: "example",
              source: "practice",
              ref: "add-within-20",
              problemId: randomUUID(),
              // Older than any queue holds: dated six hours ago at most.
              ageMs: 80_000_000,
            },
          ],
        });
        assert.equal(response.statusCode, 204, response.body);
        const events = await rows(
          `SELECT kind::text,source::text,skill_id,ref,problem_id,step,
             extract(epoch FROM now()-"at")::float8 AS age,day::text
           FROM amp_help_events WHERE learner_id=$1 ORDER BY kind`,
          student.learnerId,
        );
        assert.deepEqual(
          events.map(({ age: _a, day: _d, ...rest }) => rest),
          [
            // Someone else's problem: the ref still names the skill.
            {
              kind: "example",
              source: "practice",
              skill_id: problem.skillId,
              ref: "add-within-20",
              problem_id: null,
              step: null,
            },
            {
              kind: "hint",
              source: "practice",
              skill_id: problem.skillId,
              ref: "add-within-20",
              problem_id: problem.id,
              step: 1,
            },
            {
              kind: "lesson",
              source: "pathways",
              skill_id: otherSkill,
              ref: "count-objects",
              problem_id: null,
              step: null,
            },
            {
              kind: "video",
              source: "practice",
              skill_id: problem.skillId,
              ref: "add-within-20",
              problem_id: problem.id,
              step: null,
            },
          ],
        );
        const ages = Object.fromEntries(
          events.map((row) => [row.kind, row.age as number]),
        );
        assert.ok(ages.hint! >= 4.9 && ages.hint! < 7, String(ages.hint));
        assert.ok(ages.example! >= 6 * 3600 - 1 && ages.example! < 6 * 3600 + 5);
        // Time on each help surface, under the same cap as all active time.
        const active = await rows(
          "SELECT surface,skill_id,active_ms::int AS ms FROM amp_active_days WHERE learner_id=$1 ORDER BY surface",
          student.learnerId,
        );
        assert.deepEqual(
          active.map(({ ms: _ms, ...rest }) => rest),
          [
            { surface: "example", skill_id: "" },
            { surface: "hint", skill_id: problem.skillId },
            { surface: "video", skill_id: otherSkill },
          ],
        );
        assert.equal(
          active.reduce((sum, row) => sum + row.ms, 0),
          20_000,
          "within 30 s since last seen plus slack",
        );
        // The day and week rollups match the rows.
        const days = await rows(
          "SELECT kind::text,skill_id,opened FROM amp_help_days WHERE learner_id=$1 ORDER BY kind,skill_id",
          student.learnerId,
        );
        assert.equal(days.length, 4);
        assert.ok(days.every((row) => row.opened === 1));
        const [weekRow] = await rows(
          `SELECT lessons,hints,videos,examples,prints,lesson_ms::int,hint_ms::int,video_ms::int,example_ms::int
           FROM amp_learner_weeks WHERE learner_id=$1 AND week=$2`,
          student.learnerId,
          week,
        );
        assert.deepEqual(weekRow, {
          lessons: 1,
          hints: 1,
          videos: 1,
          examples: 1,
          prints: 0,
          lesson_ms: 0,
          hint_ms: 10_000,
          video_ms: 8_000,
          example_ms: 2_000,
        });
      },
    );

    await t.test("a heartbeat refuses a print claim and an overfull batch", async () => {
      await age(30);
      const claim = await beat({
        deltas: [],
        events: [{ kind: "print", source: "lessons", ageMs: 0 }],
      });
      assert.equal(claim.statusCode, 400);
      const overfull = await beat({
        deltas: [],
        events: Array.from({ length: 21 }, () => ({
          kind: "lesson",
          source: "lessons",
          ref: "count-objects",
          ageMs: 0,
        })),
      });
      assert.equal(overfull.statusCode, 400);
      // Twenty is a full heartbeat, inside the body limit, and one statement.
      const full = await beat({
        deltas: Array.from({ length: 10 }, () => ({
          surface: "lesson",
          problemId: problem.id,
          activeMs: 1_000,
        })),
        events: Array.from({ length: 20 }, () => ({
          kind: "lesson",
          source: "lessons",
          ref: "count-objects",
          problemId: problem.id,
          ageMs: 12_345,
        })),
      });
      assert.equal(full.statusCode, 204, full.body);
      const [weekRow] = await rows(
        "SELECT lessons,lesson_ms::int FROM amp_learner_weeks WHERE learner_id=$1 AND week=$2",
        student.learnerId,
        week,
      );
      assert.equal(weekRow.lessons, 21);
      assert.ok(weekRow.lesson_ms > 0 && weekRow.lesson_ms <= 10_000);
    });

    await t.test(
      "an answer names the help it had; assisted stays the engine's flag",
      async () => {
        const answered = await post(`${learnerPath}/attempts`, token, {
          problemId: problem.id,
          requestId: randomUUID(),
          response: "1",
          hintViewed: true,
          help: ["video"],
        });
        assert.equal(answered.statusCode, 200, answered.body);
        assert.deepEqual(answered.json().help, ["hint", "video"]);
        assert.equal(answered.json().assisted, true);
        const [day] = await rows(
          "SELECT assisted,with_hint,with_lesson,with_video,with_example,with_person FROM amp_skill_days WHERE learner_id=$1",
          student.learnerId,
        );
        assert.deepEqual(day, {
          assisted: 1,
          with_hint: 1,
          with_lesson: 0,
          with_video: 1,
          with_example: 0,
          with_person: 0,
        });
        // A claimed lesson counts as assistance, as the server's own does.
        const next = (
          await post(`${learnerPath}/batches`, token, {
            templateId: "add-within-20",
            count: 1,
            figureCapabilities: ["scenes-v1"],
          })
        ).json().problems[0];
        const lessoned = await post(`${learnerPath}/attempts`, token, {
          problemId: next.id,
          requestId: randomUUID(),
          response: "1",
          help: ["lesson"],
        });
        assert.deepEqual(lessoned.json().help, ["lesson"]);
        assert.equal(lessoned.json().assisted, true);
        const [weekRow] = await rows(
          "SELECT attempts,assisted,with_hint,with_lesson,with_video FROM amp_learner_weeks WHERE learner_id=$1 AND week=$2",
          student.learnerId,
          week,
        );
        assert.deepEqual(weekRow, {
          attempts: 2,
          assisted: 2,
          with_hint: 1,
          with_lesson: 1,
          with_video: 1,
        });
        // An answer without help stores no `help` at all.
        const plain = (
          await post(`${learnerPath}/batches`, token, {
            templateId: "add-within-20",
            count: 1,
            figureCapabilities: ["scenes-v1"],
          })
        ).json().problems[0];
        const alone = await post(`${learnerPath}/attempts`, token, {
          problemId: plain.id,
          requestId: randomUUID(),
          response: "1",
        });
        assert.equal(alone.json().help, undefined);
        assert.equal(alone.json().assisted, false);
      },
    );

    await t.test(
      "a bulk writer's summed weeks equal the triggers' weeks",
      async () => {
        const read = () =>
          rows(
            "SELECT * FROM amp_learner_weeks WHERE learner_id=$1 ORDER BY week",
            student.learnerId,
          );
        const before = await read();
        await db.query(
          `UPDATE amp_learner_weeks SET lessons=0,hints=0,videos=0,examples=0,hint_ms=0,video_ms=0,
             example_ms=0,lesson_ms=0,with_hint=0,with_lesson=0,with_video=0 WHERE learner_id=$1`,
          [student.learnerId],
        );
        await sumWeeks(db, "SELECT $1::text", [student.learnerId]);
        assert.deepEqual(await read(), before);
      },
    );

    await t.test("the class Time tab and the student page read the weeks", async () => {
      const time = await get(
        `/api/v1/school/classes/${klass.id}/time?period=week`,
        teacherAccount,
      );
      assert.equal(time.statusCode, 200, time.body);
      const [thisWeek] = time.json().help;
      assert.equal(thisWeek.week, week);
      assert.deepEqual(thisWeek.lessons, { count: 21, minutes: thisWeek.lessons.minutes });
      assert.equal(thisWeek.hints.count, 1);
      assert.equal(thisWeek.hints.minutes, 0.2);
      assert.equal(thisWeek.videos.count, 1);
      assert.equal(thisWeek.examples.count, 1);
      assert.equal(thisWeek.answers, 3);
      assert.equal(thisWeek.assisted, 2);
      assert.deepEqual(thisWeek.answersWith, {
        hint: 1,
        lesson: 1,
        video: 1,
        example: 0,
        person: 0,
      });
      const record = await get(
        `/api/v1/school/students/${student.personId}/record`,
        teacherAccount,
      );
      assert.equal(record.statusCode, 200, record.body);
      const help = record.json().help as { week: string; hints: { count: number } }[];
      assert.equal(help.length, 12);
      assert.equal(help.at(-1)!.week, week);
      assert.equal(help.at(-1)!.hints.count, 1);
      // A student outside the read's span reads nothing.
      const none = await helpWeeks(
        db,
        [{ learnerId: student.learnerId, from: "2020-01-06", to: "2020-01-12" }],
        [week],
      );
      assert.equal(none[0]!.hints.count, 0);
    });

    let adultId = "";
    await t.test("an adult's heartbeat and prints record theirs", async () => {
      const started = await post("/api/v1/me/practice", teacherAccount, {
        start: "algebra-1",
        timezone: "America/Chicago",
      });
      assert.equal(started.statusCode, 201, started.body);
      adultId = started.json().learnerId;
      await db.query(
        "UPDATE amp_adult_activity SET seen_at=now()-interval '20 seconds' WHERE learner_id=$1",
        [adultId],
      );
      const response = await post("/api/v1/me/practice/activity", teacherAccount, {
        deltas: [{ surface: "lesson", skillId: otherSkill, activeMs: 9_000 }],
        events: [
          { kind: "lesson", source: "lessons", ref: "count-objects", ageMs: 0 },
        ],
      });
      assert.equal(response.statusCode, 204, response.body);
      await learning.recordPrint(adultId, "counting", "workbook");
      const events = await rows(
        "SELECT kind::text,skill_id,ref FROM amp_help_events WHERE learner_id=$1 ORDER BY kind",
        adultId,
      );
      assert.deepEqual(events, [
        { kind: "lesson", skill_id: otherSkill, ref: "count-objects" },
        { kind: "print", skill_id: events[1]!.skill_id, ref: "counting:workbook" },
      ]);
      // A learner on no roster and not an adult (an anonymous trial's) has
      // no rollups, so nor does it get a print.
      const loose = randomUUID();
      await db.query(
        "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Trial',2017)",
        [loose, `trial:${randomUUID()}`],
      );
      await learning.recordPrint(loose, "counting", "workbook");
      assert.equal(
        (await rows("SELECT 1 FROM amp_help_events WHERE learner_id=$1", loose))
          .length,
        0,
      );
    });

    await t.test("export carries help; deletion and retention remove it", async () => {
      // The family export: the adult's own events and day counts.
      const lines: { type: string }[] = [];
      for await (const line of families.export(teacherAccount))
        lines.push(JSON.parse(line));
      assert.equal(lines.filter((l) => l.type === "help-event").length, 2);
      assert.equal(lines.filter((l) => l.type === "help-day").length, 2);
      // The school export: the student's events and days, one row each.
      const [orgRow] = await rows("SELECT path FROM amp_orgs WHERE id=$1", org.id);
      const chunks: Buffer[] = [];
      for await (const chunk of schoolExport(db, {
        orgId: org.id,
        path: orgRow.path,
      }))
        chunks.push(chunk as Buffer);
      const files = unzipSync(new Uint8Array(Buffer.concat(chunks)));
      const events = strFromU8(files["help_events.csv"]!).trim().split("\r\n");
      assert.match(events[0]!, /person_id,day,at,kind,source,skill_id,ref,problem_id,step/);
      assert.equal(events.length, 1 + 24);
      assert.match(events.join("\n"), new RegExp(`${student.personId},${today},.*,hint,practice,`));
      const days = strFromU8(files["help_days.csv"]!).trim().split("\r\n");
      assert.ok(days.length > 1);

      // Retention: individual events go after their period; counts stay.
      await db.query(
        `INSERT INTO amp_help_events(learner_id,"at",day,kind,source,skill_id,ref)
         VALUES($1,now()-make_interval(days=>$2+1),current_date-($2+1),'hint','practice','old','old')`,
        [student.learnerId, RETENTION.helpEventDays],
      );
      const purged = await purgeHelpEvents(db);
      assert.equal(purged.expiredHelpEvents, 1);
      assert.equal(
        (await rows("SELECT 1 FROM amp_help_days WHERE learner_id=$1 AND skill_id='old'", student.learnerId))
          .length,
        1,
      );

      // A parent's deletion takes the adult's help, even when a tombstone
      // stays for the license it held.
      await families.deleteLearning(teacherAccount, adultId);
      for (const table of ["amp_help_events", "amp_help_days"])
        assert.equal(
          (await rows(`SELECT 1 FROM ${table} WHERE learner_id=$1`, adultId)).length,
          0,
          table,
        );
      // A learner deleted outright takes everything with it.
      await db.query("DELETE FROM amp_learners WHERE id=$1", [student.learnerId]);
      for (const table of ["amp_help_events", "amp_help_days", "amp_learner_weeks"])
        assert.equal(
          (await rows(`SELECT 1 FROM ${table} WHERE learner_id=$1`, student.learnerId))
            .length,
          0,
          table,
        );
    });
  },
);
