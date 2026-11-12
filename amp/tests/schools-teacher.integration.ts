import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

const YEAR_AHEAD = new Date(Date.now() + 365 * 86_400_000).toISOString();
const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};
const DAY = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) =>
  new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

/** Reads a stored ZIP's files without a library, so the test checks the bytes. */
function unzip(buffer: Buffer): Record<string, string> {
  const files: Record<string, string> = {};
  let at = 0;
  while (buffer.readUInt32LE(at) === 0x04034b50) {
    const size = buffer.readUInt32LE(at + 22);
    const nameLength = buffer.readUInt16LE(at + 26);
    const extra = buffer.readUInt16LE(at + 28);
    const name = buffer.toString("utf8", at + 30, at + 30 + nameLength);
    const start = at + 30 + nameLength + extra;
    files[name] = buffer.toString("utf8", start, start + size);
    at = start + size;
  }
  return files;
}
/** A CSV into rows, quotes and all, independently of the code that wrote it. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

test(
  "AMP for Schools teacher: gradebook, finals, closing a term, exports, access",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_teacher_${randomUUID().replaceAll("-", "")}`;
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
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();

    const as = (token: string) => ({ authorization: `Bearer ${token}` });
    const get = (path: string, token: string) =>
      app.inject({ method: "GET", url: path, headers: as(token) });
    const post = (path: string, token: string, payload: object = {}) =>
      app.inject({ method: "POST", url: path, headers: as(token), payload });

    async function school(name: string) {
      const org = (await schoolAdmin(schools, "create-org", {
        kind: "school",
        name,
        timezone: "UTC",
        agreement,
      })) as { id: string };
      await schoolAdmin(schools, "issue-license", {
        orgId: org.id,
        seats: 100,
        endsAt: YEAR_AHEAD,
      });
      return org.id;
    }
    /** A year around today, split into two terms that meet at `boundary`. */
    async function calendar(orgId: string) {
      const year = randomUUID(),
        first = randomUUID(),
        second = randomUUID();
      const insert = (
        id: string,
        parent: string | null,
        kind: string,
        name: string,
        from: string,
        to: string,
      ) =>
        db.query(
          `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [id, orgId, parent, kind, name, from, to],
        );
      await insert(
        year,
        null,
        "year",
        "This year",
        daysAgo(120),
        daysAgo(-180),
      );
      await insert(
        first,
        year,
        "semester",
        "Semester 1",
        daysAgo(120),
        daysAgo(-30),
      );
      await insert(
        second,
        year,
        "semester",
        "Semester 2",
        daysAgo(-29),
        daysAgo(-180),
      );
      return { year, first, second };
    }
    const staff = async (
      orgId: string,
      role: "teacher" | "admin" | "viewer" | "aide",
      classId?: string,
    ) => {
      const account = `amp|${role}-${randomUUID()}`;
      await schools.addStaff({
        orgId,
        role,
        givenName: "Fixture",
        familyName: role,
        accountId: account,
        ...(classId ? { classId } : {}),
      });
      return account;
    };
    /** Enrolled from `from`: the seat and learner are real; the date is set back. */
    async function student(
      orgId: string,
      classId: string,
      givenName: string,
      options: { from?: string; identifier?: string; grade?: number } = {},
    ) {
      const made = await schools.provisionStudent(orgId, {
        givenName,
        familyName: "Fixture",
        gradeLevel: options.grade ?? 5,
        classId,
        ...(options.identifier ? { identifier: options.identifier } : {}),
      });
      const from = options.from ?? daysAgo(100);
      await db.query(
        "UPDATE amp_enrollments SET begin_on=$2 WHERE person_id=$1 AND class_id=$3",
        [made.personId, from, classId],
      );
      await db.query(
        "UPDATE amp_org_roles SET begin_on=$2 WHERE person_id=$1",
        [made.personId, from],
      );
      return made;
    }
    type Answer = {
      skill: string;
      at: string;
      correct: boolean;
      assisted?: boolean;
      reason?: string;
      template?: string;
    };
    /** An answer in the facts table, as the app stores one; the trigger rolls it up. */
    async function answer(learnerId: string, a: Answer) {
      const id = randomUUID();
      await db.query(
        "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3)",
        [
          id,
          learnerId,
          {
            public: {
              id,
              skillId: a.skill,
              prompt: "What is 2/3 + 1/6?",
              response: { kind: "fraction", label: "Your answer" },
            },
            answer: "5/6",
            selection: { reason: a.reason },
          },
        ],
      );
      await db.query(
        "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome) VALUES($1,$2,$3,$3,$4)",
        [
          randomUUID(),
          learnerId,
          id,
          {
            id,
            problemId: id,
            requestId: id,
            skillId: a.skill,
            templateId: a.template ?? "fixture-template",
            correct: a.correct,
            assisted: a.assisted ?? false,
            response: a.correct ? "5/6" : "3/9",
            answer: "5/6",
            createdAt: a.at,
          },
        ],
      );
    }
    const levelDay = (learnerId: string, day: string, level: number) =>
      db.query(
        `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'fixture')
         ON CONFLICT(learner_id,day) DO UPDATE SET frontier=EXCLUDED.frontier`,
        [
          learnerId,
          day,
          {
            overall: { level, sd: 0.3, answered: 200, independent: 150 },
            strands: {
              fractions: { level, sd: 0.4, answered: 90, independent: 60 },
              number: { level, sd: 0.4, answered: 110, independent: 90 },
            },
          },
        ],
      );
    const activeDay = (learnerId: string, day: string, minutes: number) =>
      db.query(
        `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms) VALUES($1,$2,'practice','',$3)
         ON CONFLICT(learner_id,day,surface,skill_id) DO UPDATE SET active_ms=EXCLUDED.active_ms`,
        [learnerId, day, minutes * 60_000],
      );
    /** A steady term: time most weeks, review answers, a level that rises. */
    async function steady(learnerId: string, from: number, gain = 0.4) {
      await levelDay(learnerId, daysAgo(from), 4.6);
      await levelDay(learnerId, daysAgo(2), 4.6 + gain);
      for (let n = from; n > 2; n -= 3)
        await activeDay(learnerId, daysAgo(n), 25);
      for (let n = 0; n < 8; n++)
        await answer(learnerId, {
          skill: "fraction-addition",
          at: new Date(Date.now() - (from - n) * DAY).toISOString(),
          correct: n % 4 !== 3,
          reason: "review",
        });
    }

    t.after(async () => {
      await app.close();
      await learning.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    const home = await school("Alder Street School");
    const sessions = await calendar(home);
    const klass = (await schools.createClass(home, {
      name: "Grade 5 Math",
      courseBands: ["5"],
      gradingKind: "semester",
      sessionId: sessions.year,
    })) as { id: string; joinCode: string };
    const other = (await schools.createClass(home, {
      name: "Period 2",
      courseBands: ["5"],
      gradingKind: "semester",
      sessionId: sessions.year,
    })) as { id: string };
    const teacher = await staff(home, "teacher", klass.id);
    const teacherOfOther = await staff(home, "teacher", other.id);
    const viewer = await staff(home, "viewer");
    const aide = await staff(home, "aide", klass.id);
    const headOfSchool = await staff(home, "admin");
    const CLASS = `/api/v1/school/classes/${klass.id}`;

    const amara = await student(home, klass.id, "Amara", {
      identifier: "SIS-100",
    });
    const diego = await student(home, klass.id, "Diego", {
      identifier: "=HYPERLINK(1)",
    });
    const late = await student(home, klass.id, "Lena", {
      from: daysAgo(30),
      identifier: "SIS-300",
    });
    const quiet = await student(home, klass.id, "Noor");
    await steady(amara.learnerId, 100);
    await steady(diego.learnerId, 100, 0.8);
    await steady(late.learnerId, 30);

    await t.test(
      "the gradebook suggests a range, and says when it can't",
      async () => {
        const response = await get(`${CLASS}/gradebook`, teacher);
        assert.equal(response.statusCode, 200, response.body);
        const book = response.json();
        assert.equal(book.term.name, "Semester 1");
        assert.equal(book.term.state, "open");
        assert.deepEqual(
          book.terms.map((term: { name: string }) => term.name),
          ["Semester 1", "Semester 2"],
        );
        assert.equal(book.terms[1].state, "upcoming");
        assert.equal(book.canEdit, true);
        assert.equal(book.class.course.label, "Grade 5");
        const names = book.students.map((row: { name: string }) => row.name);
        assert.deepEqual(names, [
          "Amara Fixture",
          "Diego Fixture",
          "Lena Fixture",
          "Noor Fixture",
        ]);
        const row = (name: string) =>
          book.students.find(
            (entry: { first: string }) => entry.first === name,
          );
        assert.equal(row("Amara").suggestion.status, "ready");
        assert.equal(typeof row("Amara").suggestion.low, "number");
        assert.match(row("Amara").suggestion.letters, /^[A-F]/);
        assert.equal(row("Noor").suggestion.status, "not-enough-work");
        assert.equal(row("Noor").suggestion.low, null);
        // Everything about a grade is roster-bound and carries no inputs here.
        assert.equal("inputs" in row("Amara").suggestion, false);
      },
    );

    await t.test(
      "non-review attempts and accuracy don't move a suggestion",
      async () => {
        const read = async () =>
          (await get(`${CLASS}/gradebook`, teacher))
            .json()
            .students.find((row: { first: string }) => row.first === "Amara")
            .suggestion;
        const before = await read();
        // A day that already has measured time, on a skill already demonstrated:
        // forty more answers, most of them wrong, none of them review.
        const measured = new Date(Date.now() - 4 * DAY).toISOString();
        for (let n = 0; n < 40; n++)
          await answer(amara.learnerId, {
            skill: "fraction-addition",
            at: measured,
            correct: n % 5 === 0,
          });
        assert.deepEqual(await read(), before);
      },
    );

    await t.test(
      "objectives need direct, independent success, in the term",
      async () => {
        const skill = "decimal-place-value";
        const at = (n: number) => new Date(Date.now() - n * DAY).toISOString();
        await answer(quiet.learnerId, {
          skill,
          at: at(9),
          correct: true,
          assisted: true,
        });
        await answer(quiet.learnerId, { skill, at: at(8), correct: false });
        await answer(quiet.learnerId, { skill, at: at(7), correct: true });
        await answer(quiet.learnerId, { skill, at: at(5), correct: true });
        const evidence = (
          await get(
            `${CLASS}/students/${quiet.personId}/evidence?term=${sessions.first}`,
            teacher,
          )
        ).json();
        assert.deepEqual(
          evidence.objectives.map((o: { skillId: string; day: string }) => [
            o.skillId,
            o.day,
          ]),
          [[skill, daysAgo(5)]],
        );
      },
    );

    await t.test(
      "the evidence sheet shows why, from immutable problems",
      async () => {
        const response = await get(
          `${CLASS}/students/${amara.personId}/evidence?term=${sessions.first}`,
          teacher,
        );
        assert.equal(response.statusCode, 200, response.body);
        const evidence = response.json();
        assert.match(evidence.question, /^Why /);
        assert.deepEqual(
          evidence.lines.map((line: { label: string }) => line.label),
          ["Course progress", "Growth", "Practice", "Retention"],
        );
        for (const line of evidence.lines) assert.ok(line.sentence.length > 10);
        assert.equal(evidence.work.length, 12);
        assert.equal(evidence.nextOffset, 12);
        const work = evidence.work[0];
        assert.equal(work.prompt, "What is 2/3 + 1/6?");
        assert.equal(work.answer, "5/6");
        assert.ok(["independent", "missed"].includes(work.result));
        assert.equal(typeof work.review, "boolean");
        const next = (
          await get(
            `${CLASS}/students/${amara.personId}/evidence?term=${sessions.first}&offset=12`,
            teacher,
          )
        ).json();
        assert.notEqual(next.work[0].id, work.id);
        // A student who isn't in this class isn't here, by any route.
        const stranger = await student(home, other.id, "Otto");
        assert.equal(
          (
            await get(
              `${CLASS}/students/${stranger.personId}/evidence?term=${sessions.first}`,
              teacher,
            )
          ).statusCode,
          404,
        );
      },
    );

    await t.test("a final grade saves in any form, and is logged", async () => {
      const final = (
        person: string,
        value: string,
        account = teacher,
        term = sessions.first,
      ) => post(`${CLASS}/students/${person}/final`, account, { term, value });
      for (const value of ["B+", "87", "3", "Pass"]) {
        const saved = await final(amara.personId, value);
        assert.equal(saved.statusCode, 200, saved.body);
        assert.equal(saved.json().final, value);
      }
      assert.equal((await final(diego.personId, "A−")).statusCode, 200);
      // Saving the same value isn't a change, so it isn't logged twice.
      await final(diego.personId, "A−");
      const events = (
        await db.query(
          `SELECT detail,actor_person_id FROM amp_school_events
           WHERE action='grade.final-set' AND target_id=$1 ORDER BY "at",id`,
          [diego.personId],
        )
      ).rows;
      assert.equal(events.length, 1);
      assert.deepEqual(events[0].detail.before, { value: null });
      assert.equal(events[0].detail.after.value, "A−");
      assert.ok(events[0].actor_person_id, "attributed to the teacher");
      // It reads back everywhere.
      const book = (await get(`${CLASS}/gradebook`, teacher)).json();
      assert.equal(
        book.students.find((row: { first: string }) => row.first === "Amara")
          .final,
        "Pass",
      );
      // Clearing it.
      await final(quiet.personId, "C");
      assert.equal((await final(quiet.personId, "")).json().final, null);
      // Refused: control characters, too long, someone outside the class.
      assert.equal((await final(amara.personId, "A\u0007")).statusCode, 400);
      assert.equal(
        (await final(amara.personId, "x".repeat(25))).statusCode,
        400,
      );
      const outside = await student(home, other.id, "Pia");
      assert.equal((await final(outside.personId, "A")).statusCode, 404);
      assert.equal(
        (await final(amara.personId, "A", teacher, sessions.second)).statusCode,
        404,
        "a term that hasn't started has no finals",
      );
      await final(amara.personId, "B+");
    });

    await t.test(
      "access: a teacher can't read another class, a viewer can't write",
      async () => {
        const reads = [
          `${CLASS}/today`,
          `${CLASS}/map`,
          `${CLASS}/gradebook`,
          `${CLASS}/time`,
          `${CLASS}/report-cards?term=${sessions.first}`,
          `${CLASS}/students/${amara.personId}/evidence?term=${sessions.first}`,
          `${CLASS}/students/${amara.personId}/time`,
          `${CLASS}/exports/gradebook.csv?term=${sessions.first}`,
          `${CLASS}/exports/time.csv`,
          `${CLASS}/exports/oneroster.zip?term=${sessions.first}`,
          `/api/v1/school/students/${amara.personId}/record`,
        ];
        for (const path of reads) {
          assert.equal((await get(path, teacher)).statusCode, 200, path);
          assert.equal((await get(path, headOfSchool)).statusCode, 200, path);
          assert.equal((await get(path, viewer)).statusCode, 200, path);
          assert.equal((await get(path, aide)).statusCode, 200, path);
          const denied = await get(path, teacherOfOther);
          assert.equal(denied.statusCode, 404, path);
          assert.deepEqual(denied.json(), { error: "not_found" });
        }
        const writes: [string, object][] = [
          [
            `${CLASS}/students/${amara.personId}/final`,
            { term: sessions.first, value: "F" },
          ],
          [`${CLASS}/target`, { minutes: 90 }],
          [`${CLASS}/gradebook/close`, { term: sessions.first }],
        ];
        for (const [path, body] of writes)
          for (const account of [viewer, aide, teacherOfOther]) {
            const denied = await post(path, account, body);
            assert.equal(denied.statusCode, 404, `${path} ${account}`);
          }
        // Who can edit is on the read, so a screen never offers what can't work.
        assert.equal(
          (await get(`${CLASS}/gradebook`, viewer)).json().canEdit,
          false,
        );
        assert.equal(
          (await get(`${CLASS}/gradebook`, headOfSchool)).json().canEdit,
          true,
        );
      },
    );

    await t.test(
      "the weekly target saves, moves practice, and respects a lock",
      async () => {
        const practice = async () =>
          (await get(`${CLASS}/gradebook`, teacher))
            .json()
            .students.find((row: { first: string }) => row.first === "Amara")
            .suggestion.components[2].score as number;
        // With nothing set, a school class counts against AMP's default.
        const before = (await get(`${CLASS}/gradebook`, teacher)).json();
        assert.equal(before.weeklyTargetMinutes, 60);
        assert.equal(before.targetOwn, false);
        assert.equal(before.inheritedTargetMinutes, 60);
        const usual = await practice();
        const set = (minutes: number | null) =>
          post(`${CLASS}/target`, teacher, { minutes });
        assert.deepEqual((await set(600)).json(), {
          minutes: 600,
          locked: false,
          own: true,
          inherited: 60,
        });
        const book = (await get(`${CLASS}/gradebook`, teacher)).json();
        assert.equal(book.weeklyTargetMinutes, 600);
        assert.ok((await practice()) < usual);
        assert.equal((await set(null)).statusCode, 200);
        // Cleared, the class follows its school again.
        assert.equal(
          (await get(`${CLASS}/gradebook`, teacher)).json().weeklyTargetMinutes,
          60,
        );
        assert.equal(await practice(), usual);
        const logged = (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_school_events WHERE action='settings.changed' AND target_id=$1",
            [klass.id],
          )
        ).rows[0].n;
        assert.equal(logged, 2);
        await db.query(
          `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values",locked)
         VALUES('org',$1,'{"weeklyTargetMinutes":45}','{weeklyTargetMinutes}')`,
          [home],
        );
        const locked = await set(120);
        assert.equal(locked.statusCode, 409);
        assert.deepEqual(locked.json(), { error: "setting_locked" });
        const read = (await get(`${CLASS}/gradebook`, teacher)).json();
        assert.equal(read.weeklyTargetMinutes, 45);
        assert.equal(read.targetLocked, true);
        await db.query(
          "DELETE FROM amp_scope_settings WHERE scope_kind='org' AND scope_id=$1",
          [home],
        );
      },
    );

    await t.test("Today runs on the class's real evidence", async () => {
      const skill = "multidigit-quotients";
      const at = (n: number) => new Date(Date.now() - n * DAY).toISOString();
      for (const learner of [amara, diego, late])
        for (const n of [4, 3, 2])
          await answer(learner.learnerId, {
            skill,
            at: at(n),
            correct: false,
            template: "fixture-template",
          });
      const response = await get(`${CLASS}/today`, teacher);
      assert.equal(response.statusCode, 200, response.body);
      const body = response.json();
      assert.equal(body.teacherName, "Fixture teacher");
      assert.ok(body.today);
      const gap = body.todos.find(
        (todo: { kind: string }) => todo.kind === "shared-gap",
      );
      assert.ok(gap, JSON.stringify(body.todos));
      assert.match(
        gap.title,
        /3 students keep missing dividing by a two-digit number/,
      );
      assert.deepEqual(
        new Set(gap.students.map((entry: { id: string }) => entry.id)),
        new Set([amara.personId, diego.personId, late.personId]),
      );
      assert.equal(body.week.students, 4);
      // An empty class gets a next step instead of an empty screen.
      const empty = (await schools.createClass(home, {
        name: "Math Club",
      })) as { id: string };
      const blank = (
        await get(`/api/v1/school/classes/${empty.id}/today`, headOfSchool)
      ).json();
      assert.equal(blank.todos[0].title, "Add your students");
    });

    await t.test(
      "the map and time report read the class's roster",
      async () => {
        const map = (await get(`${CLASS}/map`, teacher)).json();
        assert.equal(map.students.length, 4);
        assert.deepEqual(
          map.strands.map((strand: { id: string }) => strand.id).sort(),
          ["fractions", "number"],
        );
        const row = map.students.find(
          (entry: { first: string }) => entry.first === "Noor",
        );
        assert.equal(row.level, null);
        assert.deepEqual(row.reference, { from: 4.5, to: 5.5 });
        const time = (await get(`${CLASS}/time?period=term`, teacher)).json();
        assert.equal(time.students.length, 4);
        const amaraTime = time.students.find(
          (entry: { first: string }) => entry.first === "Amara",
        );
        assert.ok(amaraTime.minutes > 100, String(amaraTime.minutes));
        assert.ok(amaraTime.days.length > 10);
        assert.equal(time.weeks[0] <= time.range.from, true);
        const mine = (
          await get(
            `${CLASS}/students/${amara.personId}/time?period=term`,
            teacher,
          )
        ).json();
        assert.ok(mine.days.length > 10);
        assert.equal(mine.skills[0].title.length > 0, true);
        // Days before a student was enrolled don't count against the class.
        const lena = time.students.find(
          (entry: { first: string }) => entry.first === "Lena",
        );
        assert.ok(
          lena.days.every((d: { day: string }) => d.day >= daysAgo(30)),
        );
      },
    );

    await t.test(
      "a whole class's gradebook is well under a second",
      async () => {
        const big = (await schools.createClass(home, {
          name: "Thirty Students",
          courseBands: ["5"],
          gradingKind: "semester",
          sessionId: sessions.year,
        })) as { id: string };
        for (let n = 0; n < 30; n++) {
          const made = await student(home, big.id, `Student${n}`);
          await levelDay(made.learnerId, daysAgo(100), 4.5);
          await levelDay(made.learnerId, daysAgo(1), 5);
          await db.query(
            `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent)
           SELECT $1,d::date,s,8,6,5,1,2,1
           FROM generate_series($2::date,$3::date,interval '2 days') d,unnest($4::text[]) s`,
            [
              made.learnerId,
              daysAgo(100),
              daysAgo(1),
              ["fraction-addition", "decimal-place-value", "powers-of-ten"],
            ],
          );
          await db.query(
            `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
           SELECT $1,d::date,'practice','',1500000
           FROM generate_series($2::date,$3::date,interval '2 days') d`,
            [made.learnerId, daysAgo(100), daysAgo(1)],
          );
        }
        const path = `/api/v1/school/classes/${big.id}/gradebook`;
        await get(path, headOfSchool);
        const started = performance.now();
        const response = await get(path, headOfSchool);
        const elapsed = performance.now() - started;
        assert.equal(response.statusCode, 200);
        assert.equal(response.json().students.length, 30);
        console.log(`Gradebook for 30 students: ${elapsed.toFixed(0)} ms`);
        assert.ok(elapsed < 1000, `${elapsed} ms`);
      },
    );

    await t.test(
      "exports: configurable CSV, time CSV, OneRoster ZIP",
      async () => {
        const csv = await get(
          `${CLASS}/exports/gradebook.csv?term=${sessions.first}`,
          teacher,
        );
        assert.equal(csv.statusCode, 200);
        assert.match(csv.headers["content-type"] as string, /text\/csv/);
        assert.match(
          csv.headers["content-disposition"] as string,
          /attachment; filename="grade-5-math-semester-1\.csv"/,
        );
        const rows = parseCsv(csv.body);
        assert.deepEqual(rows[0], [
          "SIS ID",
          "Student",
          "Final",
          "Suggested low",
          "Suggested high",
          "Course progress",
          "Growth",
          "Practice",
          "Retention",
          "Active minutes",
        ]);
        const amaraRow = rows.find((row) => row[1] === "Amara Fixture")!;
        assert.equal(amaraRow[0], "SIS-100");
        assert.equal(amaraRow[2], "B+");
        assert.ok(Number(amaraRow[3]) > 0);
        assert.ok(Number(amaraRow[4]) >= Number(amaraRow[3]));
        assert.ok(Number(amaraRow[9]) > 100);
        assert.equal(rows.length, 5, "the class's roster, and no one else");
        assert.equal(
          rows.some((row) => row[1]?.startsWith("Otto")),
          false,
        );
        // A value that looks like a formula stays text.
        const diegoRow = rows.find((row) => row[1] === "Diego Fixture")!;
        assert.equal(diegoRow[0], "'=HYPERLINK(1)");
        const chosen = parseCsv(
          (
            await get(
              `${CLASS}/exports/gradebook.csv?term=${sessions.first}&columns=name,final,minutes`,
              teacher,
            )
          ).body,
        );
        assert.deepEqual(chosen[0], ["Student", "Final", "Active minutes"]);
        assert.equal(chosen[1]!.length, 3);
        assert.equal(
          (
            await get(
              `${CLASS}/exports/gradebook.csv?term=${sessions.first}&columns=name,password`,
              teacher,
            )
          ).statusCode,
          400,
        );
        const time = parseCsv(
          (await get(`${CLASS}/exports/time.csv?period=term`, teacher)).body,
        );
        assert.deepEqual(time[0], [
          "SIS ID",
          "Student",
          "Date",
          "Active minutes",
          "Problems",
        ]);
        assert.ok(time.some((row) => row[1] === "Amara Fixture"));
        const zip = await get(
          `${CLASS}/exports/oneroster.zip?term=${sessions.first}`,
          teacher,
        );
        assert.equal(zip.statusCode, 200);
        assert.equal(zip.headers["content-type"], "application/zip");
        const files = unzip(zip.rawPayload);
        assert.deepEqual(Object.keys(files).sort(), [
          "categories.csv",
          "lineItems.csv",
          "manifest.csv",
          "results.csv",
        ]);
        // Whatever a line item names is in the file, so an import can resolve it.
        assert.equal(
          parseCsv(files["categories.csv"]!)[1]![0],
          parseCsv(files["lineItems.csv"]!)[1]![8],
        );
        const items = parseCsv(files["lineItems.csv"]!);
        assert.deepEqual(items[0]!.slice(0, 4), [
          "sourcedId",
          "status",
          "dateLastModified",
          "title",
        ]);
        assert.equal(items.length, 2);
        assert.equal(items[1]![9], sessions.first);
        assert.equal(items[1]![7], klass.id);
        const results = parseCsv(files["results.csv"]!);
        const header = results[0]!;
        const field = (row: string[], name: string) =>
          row[header.indexOf(name)];
        const amaraResult = results.find(
          (row) => field(row, "studentSourcedId") === "SIS-100",
        )!;
        assert.equal(field(amaraResult, "textScore"), "B+");
        assert.equal(field(amaraResult, "score"), "");
        assert.equal(field(amaraResult, "scoreStatus"), "fully graded");
        assert.equal(field(amaraResult, "lineItemSourcedId"), items[1]![0]);
        assert.equal(results.length, 3, "only finals entered are sent");
        assert.match(files["manifest.csv"]!, /oneroster\.version,1\.2/);
        assert.match(files["manifest.csv"]!, /file\.results,bulk/);
        assert.match(files["manifest.csv"]!, /file\.lineItems,bulk/);
        assert.match(files["manifest.csv"]!, /file\.users,absent/);
      },
    );

    await t.test(
      "a closed term is frozen against new answers and new edits",
      async () => {
        const close = () =>
          post(`${CLASS}/gradebook/close`, teacher, { term: sessions.first });
        const book = async () =>
          (
            await get(`${CLASS}/gradebook?term=${sessions.first}`, teacher)
          ).json();
        const open = await book();
        const closed = await close();
        assert.equal(closed.statusCode, 200, closed.body);
        assert.equal(closed.json().frozen, 4);
        const frozen = await book();
        assert.equal(frozen.term.state, "closed");
        assert.deepEqual(frozen.students, open.students);
        // New answers, new levels and new minutes change nothing.
        await levelDay(amara.learnerId, daysAgo(0), 9);
        await activeDay(amara.learnerId, daysAgo(0), 500);
        for (let n = 0; n < 5; n++)
          await answer(amara.learnerId, {
            skill: "powers-of-ten",
            at: new Date().toISOString(),
            correct: true,
            reason: "review",
          });
        await post(`${CLASS}/target`, teacher, { minutes: 900 });
        assert.deepEqual((await book()).students, open.students);
        const stored = (
          await db.query(
            "SELECT suggested,frozen_at FROM amp_term_grades WHERE class_id=$1 AND session_id=$2 AND person_id=$3",
            [klass.id, sessions.first, amara.personId],
          )
        ).rows[0];
        assert.ok(stored.frozen_at);
        assert.equal(stored.suggested.policyVersion, "school-grades-v4");
        assert.ok(stored.suggested.inputs.enrolled.from);
        assert.ok(stored.suggested.inputs.activeMinutes > 100);
        // A closed term can't be edited or closed again.
        const late = await post(
          `${CLASS}/students/${amara.personId}/final`,
          teacher,
          { term: sessions.first, value: "A" },
        );
        assert.equal(late.statusCode, 409);
        assert.deepEqual(late.json(), { error: "term_closed" });
        assert.equal((await close()).statusCode, 409);
        // It reads through evidence, report cards and exports the same way.
        const evidence = (
          await get(
            `${CLASS}/students/${amara.personId}/evidence?term=${sessions.first}`,
            teacher,
          )
        ).json();
        assert.equal(evidence.term.state, "closed");
        assert.equal(evidence.canEdit, false);
        assert.deepEqual(
          evidence.suggestion,
          open.students.find((row: { first: string }) => row.first === "Amara")
            .suggestion,
        );
        const cards = (
          await get(`${CLASS}/report-cards?term=${sessions.first}`, teacher)
        ).json();
        assert.equal(cards.school, "Alder Street School");
        assert.equal(cards.class.course, "Grade 5");
        assert.deepEqual(cards.teachers, ["Fixture teacher"]);
        const card = cards.students.find(
          (row: { name: string }) => row.name === "Amara Fixture",
        );
        assert.equal(card.final, "B+");
        assert.ok(card.minutes > 100);
        assert.ok(card.levelTo > card.levelFrom);
        const logged = (
          await db.query(
            "SELECT detail FROM amp_school_events WHERE action='term.closed' AND target_id=$1",
            [klass.id],
          )
        ).rows;
        assert.equal(logged.length, 1);
        assert.equal(logged[0].detail.after.students, 4);
        await post(`${CLASS}/target`, teacher, { minutes: null });
      },
    );

    await t.test(
      "the student record brings it together for those who may see it",
      async () => {
        const path = `/api/v1/school/students/${amara.personId}/record`;
        const response = await get(path, teacher);
        assert.equal(response.statusCode, 200, response.body);
        const record = response.json();
        assert.equal(record.student.name, "Amara Fixture");
        assert.equal(record.classes[0].name, "Grade 5 Math");
        assert.ok(record.level.overall.level > 4);
        assert.deepEqual(record.reference, { from: 4.5, to: 5.5 });
        assert.equal(record.grades[0].termName, "Semester 1");
        assert.equal(record.grades[0].state, "closed");
        assert.equal(record.grades[0].final, "B+");
        assert.ok(
          record.weeks.some((week: { minutes: number }) => week.minutes > 0),
        );
        assert.ok(record.work.length > 0);
        assert.equal(record.signIn.activeSessions, 0);
        assert.equal(record.signIn.picturesSet, false);
        assert.equal((await get(path, teacherOfOther)).statusCode, 404);
      },
    );

    await t.test(
      "an unknown or malformed term is just not found or invalid",
      async () => {
        assert.equal(
          (await get(`${CLASS}/gradebook?term=${randomUUID()}`, teacher))
            .statusCode,
          404,
        );
        assert.equal(
          (await get(`${CLASS}/gradebook?term=nope`, teacher)).statusCode,
          400,
        );
        assert.equal(
          (await post(`${CLASS}/gradebook/close`, teacher, { term: "nope" }))
            .statusCode,
          400,
        );
      },
    );
  },
);
