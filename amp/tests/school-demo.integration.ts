import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import {
  grantedAccessSql,
  purchaseEvidenceSql,
} from "../src/acquisition/evidence.js";
import { insightsReport } from "../src/analytics/insights.js";
import { purgeIdleDemos, removeDemoOrg } from "../src/schools/demo/remove.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { workbookWorker } from "../src/workbook/off-thread.js";

test(
  "Demo places: alive in seconds, the owner's only, never counted, gone on removal",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_demo_${randomUUID().replaceAll("-", "")}`;
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
      services: { secret: "fixture-secret", origin: "", learning },
    });
    await app.ready();
    // As the production server does at boot (runtime-health).
    await workbookWorker().warm();
    t.after(async () => {
      await app.close();
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const owner = "amp|demo-owner";
    const stranger = "amp|someone-else";
    const call = (
      method: "GET" | "POST" | "DELETE",
      path: string,
      token: string,
      payload?: object,
    ) =>
      app.inject({
        method,
        url: path,
        headers: { authorization: `Bearer ${token}` },
        ...(payload ? { payload } : {}),
      });
    const count = async (sql: string, params: unknown[] = []) =>
      Number((await db.query(sql, params)).rows[0].n);

    // Real practice and a real school beside the demo, for the reports and
    // the isolation checks.
    const real = (await schoolAdmin(schools, "create-org", {
      kind: "school",
      name: "Real School",
      timezone: "UTC",
      agreement: {
        version: "fixture-1",
        signerName: "A Head",
        signerTitle: "Head",
      },
    })) as { id: string };
    await schoolAdmin(schools, "issue-license", {
      orgId: real.id,
      seats: 10,
      endsAt: new Date(Date.now() + 200 * 86_400_000).toISOString(),
    });
    const realStudent = await schools.provisionStudent(real.id, {
      givenName: "Rowan",
      familyName: "Real",
      gradeLevel: 5,
    });
    // The owner also teaches at a real school.
    const staff = randomUUID();
    await db.query(
      "INSERT INTO amp_people(id,tenant_id,given_name,handle,account_id,timezone) VALUES($1,$2,'Owner','CalmOwl1000',$3,'UTC')",
      [staff, real.id, owner],
    );
    await db.query(
      "INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'teacher','2020-01-01')",
      [randomUUID(), staff, real.id],
    );
    const window = {
      from: new Date(Date.now() - 200 * 86_400_000),
      to: new Date(Date.now() + 86_400_000),
    };
    const before = await insightsReport(db, window);
    /** What no demo may change: report flags, real evidence, and the real
     * school's license, grants and seats. */
    const realState = async () =>
      (
        await db.query(
          `SELECT (SELECT count(*)::int FROM amp_problem_flags) AS flags,
             (SELECT count(*)::int FROM amp_skill_evidence) AS evidence,
             (SELECT json_agg(l ORDER BY l.id) FROM amp_school_licenses l WHERE l.org_id=$1) AS licenses,
             (SELECT json_agg(g ORDER BY g.id) FROM amp_grants g WHERE g.learner_id=$2) AS grants,
             (SELECT json_agg(s ORDER BY s.id) FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id WHERE l.org_id=$1) AS seats`,
          [real.id, realStudent.learnerId],
        )
      ).rows[0];
    const untouched = await realState();

    let demo: { orgId: string; classId: string; path: string };
    await t.test("a demo class is built in seconds, once", async () => {
      const started = performance.now();
      const made = await call("POST", "/api/v1/school/demo", owner, {
        kind: "class",
        timezone: "America/Chicago",
      });
      const elapsed = performance.now() - started;
      assert.equal(made.statusCode, 201, made.body);
      demo = made.json().demo;
      assert.ok(elapsed < 5_000, `built in ${Math.round(elapsed)} ms`);
      console.log(`  demo class built in ${Math.round(elapsed)} ms`);
      const again = await call("POST", "/api/v1/school/demo", owner, {
        kind: "class",
      });
      assert.equal(again.statusCode, 200);
      assert.deepEqual(again.json().demo, demo);
      assert.equal(
        await count(
          "SELECT count(*) AS n FROM amp_orgs WHERE demo AND created_by=$1",
          [owner],
        ),
        1,
      );
      const orgs = await call("GET", "/api/v1/school/orgs", owner);
      assert.equal(
        orgs.json().orgs.find((org: { id: string }) => org.id === demo.orgId)
          .demo,
        true,
      );
    });

    await t.test(
      "Today, the map, the gradebook, time and workbooks are alive",
      async () => {
        const base = `/api/v1/school/classes/${demo.classId}`;
        const today = (await call("GET", `${base}/today`, owner)).json();
        assert.equal(today.week.students, 24);
        assert.ok(
          today.week.problems > 50,
          `problems this week: ${today.week.problems}`,
        );
        const kinds = today.todos.map((todo: { kind: string }) => todo.kind);
        assert.ok(today.todos.length >= 3, JSON.stringify(kinds));
        assert.ok(
          today.todos.some((todo: { students: { name: string }[] }) =>
            todo.students.some((student) => student.name.startsWith("Noor")),
          ),
          "the shared gap is named",
        );
        const named = (first: string) =>
          today.todos.some((todo: { students: { name: string }[] }) =>
            todo.students.some((student) => student.name.startsWith(first)),
          );
        assert.ok(named("Kai"), "the stuck student is named");
        assert.ok(named("Priya") && named("Sam"), "ready for more");
        const map = (await call("GET", `${base}/map`, owner)).json();
        const placed = map.students.filter((s: { level: unknown }) => s.level);
        assert.ok(placed.length >= 22 && map.strands.length >= 3);
        const book = (await call("GET", `${base}/gradebook`, owner)).json();
        const ranged = book.students.filter(
          (s: { suggestion: { status: string; letters: string | null } }) =>
            s.suggestion.status === "ready" && s.suggestion.letters,
        );
        assert.ok(ranged.length >= 18, `ranges: ${ranged.length}`);
        const time = await call("GET", `${base}/time`, owner);
        assert.equal(time.statusCode, 200);
        const stack = (await call("GET", `${base}/workbooks`, owner)).json();
        const set = stack.recent[0];
        assert.ok(
          set && set.students === 24 && set.marked > 12 && set.marked < 24,
          JSON.stringify(set),
        );
      },
    );

    await t.test(
      "only its owner sees or opens it; a real student is never reached",
      async () => {
        const today = await call(
          "GET",
          `/api/v1/school/classes/${demo.classId}/today`,
          stranger,
        );
        assert.equal(today.statusCode, 404);
        const person = (
          await db.query(
            "SELECT p.id,p.learner_id FROM amp_people p WHERE p.tenant_id=$1 AND p.given_name='Priya'",
            [demo.orgId],
          )
        ).rows[0];
        const path = `/api/v1/school/demo/students/${person.id}/session`;
        assert.equal((await call("POST", path, stranger)).statusCode, 404);
        // A real student, even of a school the owner runs, is never a demo's.
        assert.equal(
          (
            await call(
              "POST",
              `/api/v1/school/demo/students/${realStudent.personId}/session`,
              owner,
            )
          ).statusCode,
          404,
        );
        // Nothing adds a real child to a demo.
        const add = await call(
          "POST",
          `/api/v1/school/orgs/${demo.orgId}/students`,
          owner,
          {
            givenName: "Real",
            familyName: "Child",
            classId: demo.classId,
          },
        );
        assert.equal(add.statusCode, 404);
        // Practice as Priya: her session, her learner, real problems.
        const session = await call("POST", path, owner);
        assert.equal(session.statusCode, 201);
        const { token } = session.json();
        const batch = await app.inject({
          method: "POST",
          url: `/api/v1/learners/${person.learner_id}/batches`,
          headers: { authorization: `Bearer ${token}` },
          payload: { count: 3 },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        assert.ok(batch.json().problems.length > 0);
        // A demo grant covers her: answering spends no free allowance.
        const problem = batch.json().problems[0];
        const stored = (
          await db.query("SELECT content FROM amp_instances WHERE id=$1", [
            problem.id,
          ])
        ).rows[0].content;
        const answered = await app.inject({
          method: "POST",
          url: `/api/v1/learners/${person.learner_id}/attempts`,
          headers: { authorization: `Bearer ${token}` },
          payload: {
            problemId: problem.id,
            requestId: randomUUID(),
            response: stored.answer,
          },
        });
        assert.equal(answered.statusCode, 200, answered.body);
        assert.equal(
          await count(
            "SELECT free_online_used AS n FROM amp_learners WHERE id=$1",
            [person.learner_id],
          ),
          0,
        );
        // Her report of a problem is a demo's: no report counts it.
        const flagged = await app.inject({
          method: "POST",
          url: `/api/v1/learners/${person.learner_id}/problem-flags`,
          headers: { authorization: `Bearer ${token}` },
          payload: {
            problemId: problem.id,
            requestId: randomUUID(),
            reasons: ["other"],
            client: { kind: "web", viewport: { width: 390, height: 844 } },
          },
        });
        assert.equal(flagged.statusCode, 201, flagged.body);
        const reported = await insightsReport(db, window);
        assert.equal(reported.totals.flags, before.totals.flags);
        // Students practicing keep a demo, even with its owner away.
        await db.query(
          "UPDATE amp_orgs SET demo_seen_at=now()-interval '2 days' WHERE id=$1",
          [demo.orgId],
        );
        const later = await app.inject({
          method: "POST",
          url: `/api/v1/learners/${person.learner_id}/batches`,
          headers: { authorization: `Bearer ${token}` },
          payload: { count: 1 },
        });
        assert.equal(later.statusCode, 200, later.body);
        assert.equal(
          await count(
            "SELECT count(*) AS n FROM amp_orgs WHERE id=$1 AND demo_seen_at>now()-interval '1 minute'",
            [demo.orgId],
          ),
          1,
          "a student's practice is a visit",
        );
        // The session reaches only her learner.
        const other = await app.inject({
          method: "POST",
          url: `/api/v1/learners/${realStudent.learnerId}/batches`,
          headers: { authorization: `Bearer ${token}` },
          payload: { count: 1 },
        });
        assert.notEqual(other.statusCode, 200);
        // The owner's demo license never makes their own practice free.
        const { adultPracticeEnd } =
          await import("../src/account/adult-access.js");
        assert.equal(
          await adultPracticeEnd(db, owner).then((end) => !!end),
          true,
          "the real school still counts",
        );
        assert.equal(await adultPracticeEnd(db, stranger), null);
        // An account whose only place is a demo practices on no license.
        const lone = "amp|demo-only";
        assert.equal(
          (await call("POST", "/api/v1/school/demo", lone, { kind: "class" }))
            .statusCode,
          201,
        );
        assert.equal(await adultPracticeEnd(db, lone), null);
        assert.equal(
          (await call("DELETE", "/api/v1/school/demo", lone)).json().removed,
          1,
        );
      },
    );

    await t.test(
      "a second request waits for the first and returns the same demo",
      async () => {
        const account = "amp|double-click";
        // Another request holds the account's demo lock past 5 s.
        const holder = await db.connect();
        await holder.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [
          `school-demo:${account}:class`,
        ]);
        const waiting = call("POST", "/api/v1/school/demo", account, {
          kind: "class",
        });
        await new Promise((done) => setTimeout(done, 6_000));
        await holder.query("SELECT pg_advisory_unlock_all()");
        holder.release();
        const first = await waiting;
        assert.equal(first.statusCode, 201, first.body);
        const [a, b] = await Promise.all(
          [0, 1].map(() =>
            call("POST", "/api/v1/school/demo", account, { kind: "school" }),
          ),
        );
        assert.deepEqual(
          [a!.statusCode, b!.statusCode].sort(),
          [200, 201],
          `${a!.body} ${b!.body}`,
        );
        assert.equal(a!.json().demo.orgId, b!.json().demo.orgId);
        assert.equal(
          (await call("DELETE", "/api/v1/school/demo", account)).json().removed,
          2,
        );
      },
    );

    await t.test(
      "demo grants and students never reach the reports",
      async () => {
        assert.ok(
          (await count(
            "SELECT count(*) AS n FROM amp_grants WHERE channel='demo'",
          )) >= 24,
        );
        const after = await insightsReport(db, window);
        assert.equal(after.totals.served, before.totals.served);
        assert.equal(after.totals.learners, before.totals.learners);
        const flags = (
          await db.query(
            `SELECT ${grantedAccessSql("$1")} AS granted,${purchaseEvidenceSql("$1")} AS paid`,
            [owner],
          )
        ).rows[0];
        assert.deepEqual(flags, { granted: false, paid: false });
      },
    );

    await t.test(
      "a demo school: six classes, demo teachers, the owner admin",
      async () => {
        const started = performance.now();
        const made = await call("POST", "/api/v1/school/demo", owner, {
          kind: "school",
        });
        assert.equal(made.statusCode, 201, made.body);
        console.log(
          `  demo school built in ${Math.round(performance.now() - started)} ms`,
        );
        const school = made.json().demo;
        const classes = (
          await call(
            "GET",
            `/api/v1/school/orgs/${school.orgId}/classes`,
            owner,
          )
        ).json();
        assert.equal(classes.classes.length, 6);
        const overview = await call(
          "GET",
          `/api/v1/school/orgs/${school.orgId}/overview`,
          owner,
        );
        assert.equal(overview.statusCode, 200);
        assert.equal(
          await count(
            "SELECT count(*) AS n FROM amp_people WHERE tenant_id=$1 AND account_id IS NULL AND learner_id IS NULL",
            [school.orgId],
          ),
          3,
        );
        // Opened after the purge chose it: it stays.
        await db.query(
          "UPDATE amp_orgs SET demo_seen_at=now()-interval '31 days' WHERE id=$1",
          [school.orgId],
        );
        const chosenAt = new Date(Date.now() - 30 * 86_400_000);
        await db.query("UPDATE amp_orgs SET demo_seen_at=now() WHERE id=$1", [
          school.orgId,
        ]);
        assert.equal(await removeDemoOrg(db, school.orgId, chosenAt), false);
        assert.equal(
          await count("SELECT count(*) AS n FROM amp_orgs WHERE id=$1", [
            school.orgId,
          ]),
          1,
        );
        // An idle school goes with the retention job.
        await db.query(
          "UPDATE amp_orgs SET demo_seen_at=now()-interval '31 days' WHERE id=$1",
          [school.orgId],
        );
        assert.deepEqual(await purgeIdleDemos(db), { expiredDemoPlaces: 1 });
        assert.equal(
          await count("SELECT count(*) AS n FROM amp_orgs WHERE id=$1", [
            school.orgId,
          ]),
          0,
        );
      },
    );

    await t.test("removing it deletes everything in it", async () => {
      const learners = (
        await db.query(
          "SELECT learner_id FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
          [demo.orgId],
        )
      ).rows.map((row) => row.learner_id as string);
      assert.equal(learners.length, 24);
      assert.equal(
        (await call("DELETE", "/api/v1/school/demo", stranger)).json().removed,
        0,
      );
      assert.equal(
        (await call("DELETE", "/api/v1/school/demo", owner)).json().removed,
        1,
      );
      for (const table of [
        "amp_learners",
        "amp_attempts",
        "amp_instances",
        "amp_skill_days",
        "amp_level_days",
        "amp_workbooks",
        "amp_grants",
      ])
        assert.equal(
          await count(
            `SELECT count(*) AS n FROM ${table} WHERE ${table === "amp_learners" ? "id" : "learner_id"}=ANY($1::text[])`,
            [learners],
          ),
          0,
          table,
        );
      for (const [table, column] of [
        ["amp_orgs", "id"],
        ["amp_people", "tenant_id"],
        ["amp_school_events", "org_id"],
        ["amp_classes", "org_id"],
      ] as const)
        assert.equal(
          await count(`SELECT count(*) AS n FROM ${table} WHERE ${column}=$1`, [
            demo.orgId,
          ]),
          0,
          table,
        );
      // Nothing real moved: report flags, evidence, the real school's
      // license, grants and seats.
      assert.deepEqual(await realState(), untouched);
      // The real school is untouched.
      assert.equal(
        await count("SELECT count(*) AS n FROM amp_learners WHERE id=$1", [
          realStudent.learnerId,
        ]),
        1,
      );
    });
  },
);
