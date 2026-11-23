import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { practiceResponse } from "../scripts/ui-practice-answer.js";
import { FamilyRepository } from "../src/family/repository.js";
import { generateProblem } from "../src/math/engine.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { purgeClassEvents } from "../src/privacy/retention.js";
import {
  liveSnapshotResponse,
  sessionListResponse,
  sessionReportResponse,
  type LiveRow,
  type LiveSnapshot,
  type SessionReport,
} from "../src/schools/live/contracts.js";
import { readLiveRows } from "../src/schools/live/rows.js";
import { LIVE_RULES, liveStatus } from "../src/schools/live/status.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* Live class sessions (src/schools/live, migration 0149): start and stop, the
   per-student read inside the session's window, the frozen report, the lazy
   close, the outbox written only while a session runs, who may do what, a
   family's class, and deletion. Every name here is made up. */
test(
  "live class sessions: start, read, stop, report, close, authorize, delete",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_live_${randomUUID().replaceAll("-", "")}`;
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
    const ok = async (
      response: Promise<{ statusCode: number; body: string; json(): any }>,
      status = 200,
    ) => {
      const done = await response;
      assert.equal(done.statusCode, status, done.body);
      return status === 204 ? null : done.json();
    };
    const rows = async (sql: string, ...params: unknown[]) =>
      (await db.query(sql, params)).rows;
    const count = async (sql: string, ...params: unknown[]) =>
      Number((await rows(sql, ...params))[0].n);
    const user = async (name: string) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,$2,$3,true,now(),now())`,
        [id, name, `${id}@live.example`],
      );
      return `amp|${id}`;
    };

    const org = (await schoolAdmin(schools, "create-org", {
      kind: "school",
      name: "Juniper Fixture School",
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
    const classA = (await schools.createClass(org.id, { name: "Period 2" }))
      .id as string;
    const classB = (await schools.createClass(org.id, { name: "Period 3" }))
      .id as string;
    const student = (givenName: string) =>
      schools.provisionStudent(org.id, {
        givenName,
        gradeLevel: 2,
        classId: classA,
      });
    const ana = await student("Ana");
    const ben = await student("Ben");
    const cal = await student("Cal");
    // Ana is in both periods.
    await schools.transaction(async (client) =>
      schools.enroll(
        client,
        classB,
        ana.personId,
        "student",
        (
          await client.query(
            "SELECT to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-DD') AS d",
          )
        ).rows[0].d,
      ),
    );
    const teacher = await user("Wren Fixture");
    await schools.addStaff({
      orgId: org.id,
      role: "teacher",
      givenName: "Wren",
      accountId: teacher,
      classId: classA,
    });
    await schools.addStaff({
      orgId: org.id,
      role: "teacher",
      givenName: "Wren",
      accountId: teacher,
      classId: classB,
    });
    const aide = await user("Ash Fixture");
    await schools.addStaff({
      orgId: org.id,
      role: "aide",
      givenName: "Ash",
      accountId: aide,
      classId: classA,
    });
    const otherTeacher = await user("Oak Fixture");
    await schools.addStaff({
      orgId: org.id,
      role: "teacher",
      givenName: "Oak",
      accountId: otherTeacher,
      classId: classB,
    });
    const stranger = await user("Elm Fixture");

    const live = (classId: string, token = teacher) =>
      ok(get(`/api/v1/school/classes/${classId}/live`, token)).then(
        (body) => liveSnapshotResponse.parse(body) as LiveSnapshot,
      );
    const rowOf = (snapshot: LiveSnapshot, personId: string) =>
      snapshot.rows.find((row) => row.personId === personId) as LiveRow;
    const sessionPath = (classId: string) =>
      `/api/v1/school/classes/${classId}/sessions`;
    const start = async (classId: string, body: object = {}, token = teacher) =>
      (await ok(post(sessionPath(classId), token, body), 201)).session;
    const stop = async (classId: string, id: string, token = teacher) =>
      sessionReportResponse.parse(
        await ok(post(`${sessionPath(classId)}/${id}/stop`, token)),
      ) as SessionReport;
    const events = (classId?: string) =>
      rows(
        `SELECT class_id,person_id,kind FROM amp_class_events
         ${classId ? "WHERE class_id=$1" : ""} ORDER BY id`,
        ...(classId ? [classId] : []),
      );

    /** A student's device: their token, answers they choose right or wrong,
     * and heartbeats. */
    const device = async (
      person: { personId: string; learnerId: string },
      token?: string,
    ) => {
      const bearer =
        token ??
        (
          await schools.issueStudentSession({
            personId: person.personId,
            mode: "shared",
          })
        ).token;
      const learnerPath = `/api/v1/learners/${person.learnerId}`;
      return {
        token: bearer,
        answer: async (right: boolean, extra: object = {}) => {
          const served = await ok(
            post(`${learnerPath}/batches`, bearer, {
              templateId: "add-within-20",
              count: 1,
              figureCapabilities: ["scenes-v1"],
            }),
          );
          const problem = served.problems[0] as { id: string };
          const stored = (
            await rows(
              "SELECT content FROM amp_instances WHERE id=$1",
              problem.id,
            )
          )[0].content;
          const answered = await ok(
            post(`${learnerPath}/attempts`, bearer, {
              problemId: problem.id,
              requestId: randomUUID(),
              response: practiceResponse(stored, right),
              ...extra,
            }),
          );
          assert.equal(answered.correct, right);
          return answered as { skillId: string };
        },
        beat: (body: object, path = "/api/v1/school/student/activity") =>
          ok(post(path, bearer, body), 204),
      };
    };
    const helpEvent = (kind: string, ageMs = 0) => ({
      kind,
      source: "practice",
      ref: "add-within-20",
      ...(kind === "hint" ? { step: 1 } : {}),
      ageMs,
    });

    const anaDevice = await device(ana);

    await t.test("nothing is written while no session runs", async () => {
      await anaDevice.answer(true);
      await anaDevice.beat({
        deltas: [{ surface: "hint", activeMs: 5_000 }],
        events: [helpEvent("hint")],
      });
      assert.deepEqual(await events(), []);
      const snapshot = await live(classA);
      assert.equal(snapshot.session, null);
      assert.deepEqual(snapshot.rows, []);
      assert.equal(snapshot.totals.students, 0);
      assert.deepEqual(snapshot.can, { manage: true });
    });

    await t.test("who may read and who may run a class's session", async () => {
      const aideView = await live(classA, aide);
      assert.deepEqual(aideView.can, { manage: false });
      const refused = await post(sessionPath(classA), aide);
      assert.equal(refused.statusCode, 404, refused.body);
      for (const outsider of [stranger, otherTeacher]) {
        for (const response of [
          await get(`/api/v1/school/classes/${classA}/live`, outsider),
          await get(sessionPath(classA), outsider),
          await post(sessionPath(classA), outsider),
        ]) {
          assert.equal(response.statusCode, 404, response.body);
          assert.deepEqual(response.json(), { error: "not_found" });
        }
      }
      const signedOut = await app.inject({
        method: "GET",
        url: `/api/v1/school/classes/${classA}/live`,
      });
      assert.equal(signedOut.statusCode, 401);
      // A student's own token is never an adult's.
      const student = await get(
        `/api/v1/school/classes/${classA}/live`,
        anaDevice.token,
      );
      assert.notEqual(student.statusCode, 200);
      assert.deepEqual(await events(), [], "a refused start writes nothing");
    });

    let sessionA = "";
    await t.test(
      "start is idempotent: one open session per class",
      async () => {
        const [first, second] = await Promise.all([
          post(sessionPath(classA), teacher, { minutes: 45 }),
          post(sessionPath(classA), teacher, { minutes: 45 }),
        ]);
        assert.deepEqual(
          [first.statusCode, second.statusCode].sort(),
          [200, 201],
          `${first.body} ${second.body}`,
        );
        const session = first.json().session;
        assert.equal(second.json().session.id, session.id);
        sessionA = session.id;
        const again = await ok(
          post(sessionPath(classA), teacher, { minutes: 5 }),
        );
        assert.deepEqual(again.session, session, "the plan doesn't change");
        assert.equal(
          Date.parse(session.plannedEndAt) - Date.parse(session.startedAt),
          45 * 60_000,
        );
        assert.equal(session.endsAt, session.plannedEndAt);
        assert.equal(session.endedAt, null);
        assert.equal(session.rulesVersion, LIVE_RULES.version);
        const [{ id: wren }] = await rows(
          "SELECT p.id FROM amp_people p WHERE p.account_id=$1",
          teacher,
        );
        assert.equal(session.startedBy, wren);
        await assert.rejects(
          db.query(
            "INSERT INTO amp_class_sessions(id,class_id,rules_version) VALUES($1,$2,1)",
            [randomUUID(), classA],
          ),
          { code: "23505" },
        );
        assert.deepEqual(await events(), [
          { class_id: classA, person_id: null, kind: "session" },
        ]);
        const bad = await post(sessionPath(classA), teacher, { minutes: 241 });
        assert.equal(bad.statusCode, 400);
      },
    );

    let sessionB = "";
    await t.test(
      "answers, help and sign-in reach every class with a session running",
      async () => {
        sessionB = (await start(classB)).id;
        const before = (await events()).length;
        await anaDevice.answer(true);
        const answers = (await events())
          .slice(before)
          .filter((e) => e.kind === "answer");
        assert.deepEqual(
          answers.map((e) => [e.class_id, e.person_id]).sort(),
          [
            [classA, ana.personId],
            [classB, ana.personId],
          ].sort(),
          "a learner in two classes with sessions running: one each",
        );
        // Her device signed in before Start: its first heartbeat since is
        // her presence; help rides along.
        const mark = (await events()).length;
        await anaDevice.beat({
          deltas: [{ surface: "practice", activeMs: 5_000 }],
          events: [helpEvent("lesson")],
        });
        const beat = (await events()).slice(mark);
        assert.deepEqual(
          beat
            .map((e) => `${e.class_id === classA ? "A" : "B"}:${e.kind}`)
            .sort(),
          ["A:help", "A:presence", "B:help", "B:presence"],
        );
        const quiet = (await events()).length;
        await anaDevice.beat({
          deltas: [{ surface: "practice", activeMs: 5_000 }],
        });
        assert.equal(
          (await events()).length,
          quiet,
          "a heartbeat with no help, after the first, writes nothing",
        );
        // Ben signs in now: presence in his one class.
        const signIn = (await events()).length;
        await device(ben);
        assert.deepEqual((await events()).slice(signIn), [
          { class_id: classA, person_id: ben.personId, kind: "presence" },
        ]);
        // A paper mark is never live.
        const paper = (await events()).length;
        await learning.transaction(ana.accountId, ana.learnerId, async (tx) => {
          const problem = generateProblem("add-within-20", randomUUID());
          await tx.saveProblem(problem);
          await tx.saveAttempt({
            id: randomUUID(),
            requestId: randomUUID(),
            problemId: problem.public.id,
            skillId: problem.public.skillId,
            templateId: "add-within-20",
            response: problem.answer,
            correct: true,
            assisted: false,
            answer: problem.answer,
            explanation: problem.explanation,
            createdAt: new Date().toISOString(),
            evidenceSource: "paper",
          });
        });
        assert.equal((await events()).length, paper);
      },
    );

    let benDevice: Awaited<ReturnType<typeof device>>;
    await t.test(
      "the live read: every count inside the window, from the evidence",
      async () => {
        benDevice = await device(ben);
        // Before this session: Ana's first answer and hint (above) and a help
        // event dated ten minutes back don't count.
        await benDevice.answer(true);
        await benDevice.answer(true, { hintViewed: true });
        await benDevice.answer(false);
        await benDevice.answer(true);
        const last = await benDevice.answer(true);
        await benDevice.beat({
          deltas: [{ surface: "hint", activeMs: 5_000 }],
          events: [
            helpEvent("hint"),
            helpEvent("hint"),
            helpEvent("lesson"),
            helpEvent("example"),
            helpEvent("video"),
            helpEvent("video_play"),
            helpEvent("lesson", 10 * 60_000),
          ],
        });
        const snapshot = await live(classA);
        assert.equal(snapshot.session?.id, sessionA);
        assert.deepEqual(
          snapshot.rows.map((row) => row.name),
          ["Ana", "Ben", "Cal"],
        );
        const row = rowOf(snapshot, ben.personId);
        const [stored] = await rows(
          `SELECT count(*)::int AS problems,
             count(*) FILTER (WHERE (outcome->>'correct')::boolean)::int AS correct,
             max(created_at) AS last
           FROM amp_attempts a JOIN amp_class_sessions s ON s.id=$2
           WHERE a.learner_id=$1 AND a.created_at>=s.started_at`,
          ben.learnerId,
          sessionA,
        );
        assert.equal(row.problems, stored.problems);
        assert.equal(row.lastAnswerAt, stored.last.toISOString());
        assert.deepEqual(
          {
            problems: row.problems,
            correct: row.correct,
            independent: row.independent,
            assisted: row.assisted,
            hints: row.hints,
            lessons: row.lessons,
            examples: row.examples,
            videos: row.videos,
          },
          {
            problems: 5,
            correct: 4,
            independent: 3,
            assisted: 1,
            hints: 2,
            lessons: 1,
            examples: 1,
            videos: 1,
          },
        );
        assert.equal(stored.correct, 4);
        assert.deepEqual(row.recent, [
          { correct: true, assisted: false },
          { correct: true, assisted: true },
          { correct: false, assisted: false },
          { correct: true, assisted: false },
          { correct: true, assisted: false },
        ]);
        assert.equal(row.skill?.id, last.skillId);
        assert.ok(row.skill?.title);
        assert.ok(row.lastSeenAt, "his own sign-in was seen");
        assert.ok(row.firstSeenAt && row.firstAnswerAt && row.lastHelpAt);
        assert.ok(row.firstSeenAt <= row.firstAnswerAt);

        const anaRow = rowOf(snapshot, ana.personId);
        assert.equal(anaRow.problems, 1, "only her answer since Start");
        assert.equal(anaRow.lessons, 1);
        assert.equal(anaRow.hints, 0, "her hint came before Start");

        const calRow = rowOf(snapshot, cal.personId);
        assert.equal(calRow.lastSeenAt, null);
        assert.equal(calRow.firstSeenAt, null);
        assert.equal(calRow.problems, 0);
        assert.equal(
          liveStatus(calRow, {
            now: Date.parse(snapshot.serverNow),
            startedAt: snapshot.session!.startedAt,
          }),
          "not_signed_in",
        );
        assert.equal(
          liveStatus(row, {
            now: Date.parse(snapshot.serverNow),
            startedAt: snapshot.session!.startedAt,
          }),
          "working",
        );
        assert.deepEqual(
          {
            students: snapshot.totals.students,
            present: snapshot.totals.present,
            answering: snapshot.totals.answering,
            problems: snapshot.totals.problems,
          },
          { students: 3, present: 2, answering: 2, problems: 6 },
        );
        // The hub's read of one person is the same row.
        const [only] = await readLiveRows(
          db,
          {
            classId: classA,
            sessionId: sessionA,
            from: snapshot.session!.startedAt,
            to: snapshot.session!.endsAt,
          },
          [ben.personId],
          { skills: true },
        );
        const { learnerId: _l, skills, ...same } = only!;
        assert.deepEqual(same, row);
        assert.deepEqual(
          skills.map((s) => s.id),
          [last.skillId],
        );
      },
    );

    let report: SessionReport;
    await t.test(
      "stop freezes a report that later answers don't change",
      async () => {
        const before = await live(classA);
        report = await stop(classA, sessionA);
        assert.equal(report.session.endReason, "stopped");
        assert.ok(report.session.endedAt);
        assert.deepEqual(
          report.rows.map((row) => [row.name, row.status]),
          [
            ["Ana", "working"],
            ["Ben", "working"],
            ["Cal", "not_signed_in"],
          ],
        );
        const benRow = report.rows.find((r) => r.personId === ben.personId)!;
        const liveBen = rowOf(before, ben.personId);
        for (const key of [
          "problems",
          "correct",
          "independent",
          "assisted",
          "hints",
          "lessons",
          "examples",
          "videos",
          "firstAnswerAt",
          "lastAnswerAt",
          "skill",
          "level",
        ] as const)
          assert.deepEqual(benRow[key], liveBen[key], key);
        assert.deepEqual(benRow.skills, [liveBen.skill]);
        assert.deepEqual(report.totals, before.totals);
        // Stop again: the same report.
        assert.deepEqual(await stop(classA, sessionA), report);
        // Later work changes nothing stored, and writes no event for A.
        const mark = (await events(classA)).length;
        await benDevice.answer(true);
        assert.equal((await events(classA)).length, mark);
        assert.deepEqual(
          sessionReportResponse.parse(
            await ok(get(`${sessionPath(classA)}/${sessionA}`, teacher)),
          ),
          report,
        );
        assert.deepEqual(
          sessionReportResponse.parse(
            await ok(get(`${sessionPath(classA)}/${sessionA}`, aide)),
          ),
          report,
          "an aide reads the report",
        );
        const snapshot = await live(classA);
        assert.equal(snapshot.session, null);
        const list = sessionListResponse.parse(
          await ok(get(sessionPath(classA), teacher)),
        );
        assert.equal(list.sessions.length, 1);
        assert.deepEqual(list.sessions[0]!.totals, report.totals);
        // Another class's session, or none, is not found; a running one isn't
        // a report yet.
        for (const id of [sessionB, randomUUID(), "not-an-id"]) {
          const missing = await get(`${sessionPath(classA)}/${id}`, teacher);
          assert.equal(missing.statusCode, 404, id);
        }
        const running = await get(
          `${sessionPath(classB)}/${sessionB}`,
          teacher,
        );
        assert.equal(running.statusCode, 409);
        assert.deepEqual(running.json(), { error: "session_open" });
        // Two Stops at once store one set of rows.
        const next = (await start(classA)).id;
        const [one, two] = await Promise.all([
          stop(classA, next),
          stop(classA, next),
        ]);
        assert.deepEqual(one, two);
        assert.equal(
          await count(
            "SELECT count(*) AS n FROM amp_class_session_students WHERE session_id=$1",
            next,
          ),
          3,
        );
      },
    );

    await t.test("a session past its end closes on the next read", async () => {
      // Four hours with no plan: closed at the limit.
      await db.query(
        "UPDATE amp_class_sessions SET started_at=now()-interval '5 hours' WHERE id=$1",
        [sessionB],
      );
      const mark = (await events(classB)).length;
      await anaDevice.answer(true);
      assert.equal(
        (await events(classB)).length,
        mark,
        "nothing is written for a session past its end",
      );
      const snapshot = await live(classB);
      assert.equal(snapshot.session, null);
      const closed = sessionReportResponse.parse(
        await ok(get(`${sessionPath(classB)}/${sessionB}`, teacher)),
      );
      assert.equal(closed.session.endReason, "time_limit");
      assert.equal(closed.session.endedBy, null);
      assert.equal(
        Date.parse(closed.session.endedAt!) -
          Date.parse(closed.session.startedAt),
        4 * 3_600_000,
      );
      assert.deepEqual(
        closed.rows.map((row) => row.name),
        ["Ana"],
      );
      // A planned end: closed there, by whichever read comes first.
      const planned = await start(classB, { minutes: 10 });
      await db.query(
        `UPDATE amp_class_sessions SET started_at=now()-interval '30 minutes',
           planned_end_at=now()-interval '20 minutes' WHERE id=$1`,
        [planned.id],
      );
      const list = sessionListResponse.parse(
        await ok(get(sessionPath(classB), otherTeacher)),
      );
      const ended = list.sessions.find((s) => s.id === planned.id)!;
      assert.equal(ended.endReason, "planned_end");
      assert.equal(ended.endedAt, ended.plannedEndAt);
      assert.ok(ended.totals);
      // The retention run closes what no reader did, then prunes the outbox.
      const third = await start(classB);
      await db.query(
        "UPDATE amp_class_sessions SET started_at=now()-interval '6 hours' WHERE id=$1",
        [third.id],
      );
      await db.query(
        `INSERT INTO amp_class_signals(id,class_id,person_id,kind,created_at)
         VALUES($1,$2,$3,'hand',now()-interval '31 days')`,
        [randomUUID(), classB, ana.personId],
      );
      const purged = await purgeClassEvents(
        db,
        new Date(Date.now() + 25 * 3_600_000),
      );
      assert.equal(purged.closedClassSessions, 1);
      assert.equal(purged.expiredClassSignals, 1);
      assert.ok(purged.expiredClassEvents > 0);
      assert.equal(
        await count("SELECT count(*) AS n FROM amp_class_events"),
        0,
      );
      assert.equal(
        await count(
          "SELECT count(*) AS n FROM amp_class_sessions WHERE ended_at IS NULL",
        ),
        0,
      );
      const again = await purgeClassEvents(
        db,
        new Date(Date.now() + 25 * 3_600_000),
      );
      assert.deepEqual(again, {
        closedClassSessions: 0,
        expiredClassEvents: 0,
        expiredClassSignals: 0,
      });
    });

    await t.test(
      "open signals are read with or without a session",
      async () => {
        const hand = randomUUID();
        await db.query(
          "INSERT INTO amp_class_signals(id,class_id,person_id,kind) VALUES($1,$2,$3,'hand')",
          [hand, classA, cal.personId],
        );
        await db.query(
          `INSERT INTO amp_class_signals(id,class_id,person_id,kind,created_at)
         VALUES($1,$2,$3,'forgot_picture',now()-interval '31 minutes')`,
          [randomUUID(), classA, ben.personId],
        );
        await assert.rejects(
          db.query(
            "INSERT INTO amp_class_signals(id,class_id,person_id,kind) VALUES($1,$2,$3,'hand')",
            [randomUUID(), classA, cal.personId],
          ),
          { code: "23505" },
          "one open hand per student",
        );
        const snapshot = await live(classA);
        assert.equal(snapshot.session, null);
        assert.deepEqual(
          snapshot.signals.map(({ createdAt: _c, ...signal }) => signal),
          [{ id: hand, personId: cal.personId, name: "Cal", kind: "hand" }],
        );
      },
    );

    await t.test(
      "who is here: something of theirs in the session, or seen in the last ten minutes",
      async () => {
        const classC = (await schools.createClass(org.id, { name: "Period 5" }))
          .id as string;
        await schools.addStaff({
          orgId: org.id,
          role: "teacher",
          givenName: "Wren",
          accountId: teacher,
          classId: classC,
        });
        const join = (givenName: string) =>
          schools.provisionStudent(org.id, {
            givenName,
            gradeLevel: 2,
            classId: classC,
          });
        const dee = await join("Dee");
        const eli = await join("Eli");
        const fay = await join("Fay");
        const gus = await join("Gus");
        const hal = await join("Hal");
        const ivy = await join("Ivy");
        /** When a student's own device was last seen. */
        const seenAgo = (person: { personId: string }, ago: string) =>
          db.query(
            "UPDATE amp_student_sessions SET last_seen_at=now()-$2::interval WHERE person_id=$1",
            [person.personId, ago],
          );
        const status = (snapshot: LiveSnapshot, person: { personId: string }) =>
          liveStatus(rowOf(snapshot, person.personId), {
            now: Date.parse(snapshot.serverNow),
            startedAt: snapshot.session!.startedAt,
          });
        const present = (snapshot: LiveSnapshot) => ({
          students: snapshot.totals.students,
          present: snapshot.totals.present,
        });

        // Dee practiced this morning, on her own sign-in.
        await (await device(dee)).answer(true);
        await db.query(
          "UPDATE amp_attempts SET created_at=now()-interval '3 hours' WHERE learner_id=$1",
          [dee.learnerId],
        );
        await seenAgo(dee, "3 hours");
        await device(eli);
        await seenAgo(eli, "9 minutes");
        await device(fay);
        await seenAgo(fay, "11 minutes");
        const gusDevice = await device(gus);
        await seenAgo(gus, "3 hours");
        const halDevice = await device(hal);
        await seenAgo(hal, "20 minutes");

        const session = await start(classC);
        let snapshot = await live(classC);
        assert.equal(
          status(snapshot, dee),
          "not_signed_in",
          "practiced three hours ago, nothing since Start",
        );
        assert.equal(status(snapshot, eli), "working", "seen 9 minutes ago");
        assert.equal(
          status(snapshot, fay),
          "not_signed_in",
          "seen 11 minutes ago, nothing since Start",
        );
        assert.equal(status(snapshot, gus), "not_signed_in");
        assert.equal(status(snapshot, hal), "not_signed_in");
        assert.equal(status(snapshot, ivy), "not_signed_in");
        assert.deepEqual(present(snapshot), { students: 6, present: 1 });

        // Gus answers; Hal raises a hand. Each is theirs, in the session.
        await gusDevice.answer(true);
        // On his own sign-in, a lesson opened from the Lessons tab is his too.
        await gusDevice.beat({
          deltas: [{ surface: "lesson", activeMs: 3_000 }],
          events: [
            {
              kind: "lesson",
              source: "lessons",
              ref: "add-within-20",
              ageMs: 0,
            },
          ],
        });
        const raised = await ok(
          post("/api/v1/school/student/signals", halDevice.token, {
            kind: "hand",
          }),
        );
        assert.equal(raised.signals.length, 1);
        // The request touched Hal's sign-in; the hand alone must count.
        await seenAgo(hal, "20 minutes");
        snapshot = await live(classC);
        assert.equal(status(snapshot, gus), "working");
        assert.equal(rowOf(snapshot, gus.personId).lessons, 1);
        assert.equal(status(snapshot, hal), "working", "a raised hand");
        assert.ok(rowOf(snapshot, hal.personId).firstSeenAt);
        assert.deepEqual(present(snapshot), { students: 6, present: 3 });

        // Half an hour of silence. Whoever did something in the session is
        // still here (Quiet); Eli, only seen before it, no longer is.
        const people = [eli, gus, hal].map((person) => person.personId);
        for (const sql of [
          "UPDATE amp_class_sessions SET started_at=started_at-interval '30 minutes' WHERE id=$1",
          "UPDATE amp_class_events SET created_at=created_at-interval '30 minutes' WHERE session_id=$1",
        ])
          await db.query(sql, [session.id]);
        await db.query(
          "UPDATE amp_class_signals SET created_at=created_at-interval '30 minutes' WHERE class_id=$1",
          [classC],
        );
        await db.query(
          "UPDATE amp_attempts SET created_at=created_at-interval '30 minutes' WHERE learner_id=$1",
          [gus.learnerId],
        );
        await db.query(
          `UPDATE amp_help_events SET "at"="at"-interval '30 minutes' WHERE learner_id=$1`,
          [gus.learnerId],
        );
        await db.query(
          `UPDATE amp_student_sessions SET last_seen_at=last_seen_at-interval '30 minutes',
             created_at=created_at-interval '30 minutes' WHERE person_id=ANY($1::uuid[])`,
          [people],
        );
        snapshot = await live(classC);
        assert.equal(status(snapshot, gus), "idle", "answered, then silent");
        assert.equal(status(snapshot, hal), "idle");
        assert.equal(status(snapshot, eli), "not_signed_in");
        assert.deepEqual(present(snapshot), { students: 6, present: 2 });

        // The report is judged by the same rule, at the moment it stopped.
        const stopped = await stop(classC, session.id);
        assert.deepEqual(
          stopped.rows.map((row) => [row.name, row.status]),
          [
            ["Dee", "not_signed_in"],
            ["Eli", "not_signed_in"],
            ["Fay", "not_signed_in"],
            ["Gus", "idle"],
            ["Hal", "idle"],
            ["Ivy", "not_signed_in"],
          ],
        );
        assert.equal(stopped.totals.present, 2);
        assert.equal(stopped.totals.lessons, 1);

        // A session nobody stopped is judged at its end, whenever it is
        // closed: Ivy, who signed in after it, was not in it.
        const planned = await start(classC, { minutes: 10 });
        await db.query(
          `UPDATE amp_class_sessions SET started_at=now()-interval '30 minutes',
             planned_end_at=now()-interval '20 minutes' WHERE id=$1`,
          [planned.id],
        );
        await device(ivy);
        assert.equal((await live(classC)).session, null);
        const closed = sessionReportResponse.parse(
          await ok(get(`${sessionPath(classC)}/${planned.id}`, teacher)),
        );
        assert.equal(closed.session.endReason, "planned_end");
        assert.deepEqual(
          closed.rows.map((row) => row.status),
          Array(6).fill("not_signed_in"),
        );
        assert.equal(closed.totals.present, 0);
      },
    );

    await t.test(
      "a family: its parents run the class's session; a parent's own device is not the child",
      async () => {
        const parent = await user("Marisol Fixture");
        await db.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'policy','verified','fixture-proof')",
          [parent],
        );
        const maya = await ok(
          post("/api/v1/learners", parent, { name: "Maya", birthYear: 2016 }),
          201,
        );
        const [family] = await rows(
          "SELECT org_id,class_id FROM amp_families WHERE account_id=$1",
          parent,
        );
        const [mayaPerson] = await rows(
          "SELECT id FROM amp_people WHERE learner_id=$1",
          maya.id,
        );
        const nico = await ok(
          post("/api/v1/learners", parent, { name: "Nico", birthYear: 2017 }),
          201,
        );
        const [nicoPerson] = await rows(
          "SELECT id FROM amp_people WHERE learner_id=$1",
          nico.id,
        );
        const familyClass = family.class_id as string;
        const view = await live(familyClass, parent);
        assert.deepEqual(view.can, { manage: true });
        const session = await start(familyClass, {}, parent);
        const [holder] = await rows(
          "SELECT id FROM amp_people WHERE account_id=$1 AND tenant_id=$2",
          parent,
          family.org_id,
        );
        assert.equal(session.startedBy, holder.id);

        const status = (snapshot: LiveSnapshot, personId: string) =>
          liveStatus(rowOf(snapshot, personId), {
            now: Date.parse(snapshot.serverNow),
            startedAt: snapshot.session!.startedAt,
          });
        const familyEvents = async () =>
          (await events(familyClass)).map((e) => [e.person_id, e.kind]);

        // The parent, with Nico chosen, reads his Pathways and plays a video
        // there: the parent's own time on the parent's own sign-in. None of
        // it is Nico's presence, his help or when he was last active.
        await ok(
          post(`/api/v1/learners/${nico.id}/activity`, parent, {
            deltas: [
              { surface: "map", activeMs: 20_000 },
              { surface: "video", activeMs: 5_000 },
            ],
            events: [
              {
                kind: "video",
                source: "pathways",
                ref: "add-within-20",
                ageMs: 0,
              },
            ],
          }),
          204,
        );
        assert.deepEqual(await familyEvents(), [[null, "session"]]);
        let snapshot = await live(familyClass, parent);
        const nicoRow = rowOf(snapshot, nicoPerson.id);
        assert.equal(nicoRow.name, "Nico");
        assert.equal(
          status(snapshot, nicoPerson.id),
          "not_signed_in",
          "a parent's heartbeat with a child chosen is not the child",
        );
        assert.deepEqual(
          {
            firstSeenAt: nicoRow.firstSeenAt,
            lastSeenAt: nicoRow.lastSeenAt,
            lastHelpAt: nicoRow.lastHelpAt,
            lastAnswerAt: nicoRow.lastAnswerAt,
            videos: nicoRow.videos,
          },
          {
            firstSeenAt: null,
            lastSeenAt: null,
            lastHelpAt: null,
            lastAnswerAt: null,
            videos: 0,
          },
          "and he has no last-active",
        );
        assert.equal(snapshot.totals.present, 0);

        // A child in practice on the parent's sign-in: time on a problem of
        // her own shows her; her answer and her hint are hers. No student
        // session, events keyed by learner.
        const mayaOnParent = await device(
          { personId: mayaPerson.id, learnerId: maya.id },
          parent,
        );
        const served = await ok(
          post(`/api/v1/learners/${maya.id}/batches`, parent, {
            templateId: "add-within-20",
            count: 1,
            figureCapabilities: ["scenes-v1"],
          }),
        );
        // First the parent, with Maya chosen, reads her Pathways: not her,
        // and it doesn't use up her arrival.
        await mayaOnParent.beat(
          { deltas: [{ surface: "map", activeMs: 5_000 }] },
          `/api/v1/learners/${maya.id}/activity`,
        );
        assert.deepEqual(await familyEvents(), [[null, "session"]]);
        await mayaOnParent.beat(
          {
            deltas: [
              {
                surface: "practice",
                problemId: served.problems[0].id,
                activeMs: 5_000,
              },
            ],
          },
          `/api/v1/learners/${maya.id}/activity`,
        );
        assert.deepEqual(await familyEvents(), [
          [null, "session"],
          [mayaPerson.id, "presence"],
        ]);
        snapshot = await live(familyClass, parent);
        assert.equal(status(snapshot, mayaPerson.id), "working");
        assert.equal(rowOf(snapshot, mayaPerson.id).problems, 0);
        await mayaOnParent.answer(true);
        await mayaOnParent.beat(
          {
            deltas: [{ surface: "hint", activeMs: 2_000 }],
            events: [helpEvent("hint")],
          },
          `/api/v1/learners/${maya.id}/activity`,
        );
        assert.deepEqual((await familyEvents()).slice(2), [
          [mayaPerson.id, "answer"],
          [mayaPerson.id, "help"],
        ]);
        snapshot = await live(familyClass, parent);
        const row = rowOf(snapshot, mayaPerson.id);
        assert.equal(row.name, "Maya");
        assert.equal(row.problems, 1);
        assert.equal(row.hints, 1);
        assert.ok(row.lastHelpAt);
        assert.equal(row.lastSeenAt, null, "the parent's sign-in isn't hers");
        assert.equal(snapshot.totals.present, 1);

        // "Practice" on the family's Today hands the device to Nico: his own
        // sign-in, and his answer.
        const grant = await ok(
          post(`/api/v1/family/learners/${nico.id}/practice-here`, parent),
          201,
        );
        const nicoDevice = await device(
          { personId: nicoPerson.id, learnerId: nico.id },
          grant.token,
        );
        await nicoDevice.answer(true);
        assert.deepEqual((await familyEvents()).slice(4), [
          [nicoPerson.id, "presence"],
          [nicoPerson.id, "answer"],
        ]);
        snapshot = await live(familyClass, parent);
        assert.equal(status(snapshot, nicoPerson.id), "working");
        const handed = rowOf(snapshot, nicoPerson.id);
        assert.equal(handed.problems, 1);
        assert.ok(handed.lastAnswerAt && handed.lastSeenAt);
        assert.equal(snapshot.totals.present, 2);

        // The second parent is a teacher of the family's class: the same
        // family action set reaches her.
        const rowan = await user("Rowan Fixture");
        await schools.addStaff({
          orgId: family.org_id,
          role: "teacher",
          givenName: "Rowan",
          accountId: rowan,
          classId: familyClass,
        });
        const [rowanPerson] = await rows(
          "SELECT id FROM amp_people WHERE account_id=$1 AND tenant_id=$2",
          rowan,
          family.org_id,
        );
        await db.query(
          "UPDATE amp_families SET second_parent=$2 WHERE account_id=$1",
          [parent, rowanPerson.id],
        );
        assert.deepEqual((await live(familyClass, rowan)).can, {
          manage: true,
        });
        // Nobody else reaches the family's class.
        for (const outsider of [teacher, stranger]) {
          const refused = await get(
            `/api/v1/school/classes/${familyClass}/live`,
            outsider,
          );
          assert.equal(refused.statusCode, 404);
        }
        const stopped = await stop(familyClass, session.id, rowan);
        assert.equal(stopped.session.endedBy, rowanPerson.id);
        assert.deepEqual(
          stopped.rows.map((r) => [r.name, r.problems, r.status]),
          [
            ["Maya", 1, "working"],
            ["Nico", 1, "working"],
          ],
        );
        assert.equal(stopped.totals.present, 2);

        // The family's export carries the child's session rows...
        const lines: { type: string; data: Record<string, unknown> }[] = [];
        for await (const line of families.export(parent))
          lines.push(JSON.parse(line));
        const exported = lines.filter((l) => l.type === "class-session");
        assert.deepEqual(
          exported
            .map((line) => [line.data.learnerId, line.data.problems])
            .sort(),
          [maya.id, nico.id].sort().map((id) => [id, 1]),
        );

        // ...and deleting her learning takes them; the report stays readable.
        await families.deleteLearning(parent, maya.id);
        assert.equal(
          await count(
            "SELECT count(*) AS n FROM amp_class_session_students WHERE learner_id=$1",
            maya.id,
          ),
          0,
        );
        const after = sessionReportResponse.parse(
          await ok(get(`${sessionPath(familyClass)}/${session.id}`, parent)),
        );
        assert.deepEqual(
          after.rows.map((r) => r.name),
          ["Nico"],
        );
        assert.equal(after.totals.problems, 1);
      },
    );

    await t.test(
      "deleting a school learner takes their report rows",
      async () => {
        const before = await count(
          "SELECT count(*) AS n FROM amp_class_session_students WHERE learner_id=$1",
          cal.learnerId,
        );
        assert.ok(before > 0);
        await db.query("DELETE FROM amp_learners WHERE id=$1", [cal.learnerId]);
        assert.equal(
          await count(
            "SELECT count(*) AS n FROM amp_class_session_students WHERE learner_id=$1",
            cal.learnerId,
          ),
          0,
        );
        const stored = sessionReportResponse.parse(
          await ok(get(`${sessionPath(classA)}/${sessionA}`, teacher)),
        );
        assert.deepEqual(
          stored.rows.map((row) => row.name),
          ["Ana", "Ben"],
        );
      },
    );
  },
);
