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
import { registerFamilyRoutes } from "../src/family/routes.js";
import { purgeIdleDemos } from "../src/schools/demo/remove.js";
import { sharedDay, zonedInstant } from "../src/schools/demo/roster.js";
import {
  currentSchool,
  ensureSchool,
  GRACE_MS,
  retireSchools,
  warmDemoSchools,
} from "../src/schools/demo/shared.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { workbookWorker } from "../src/workbook/off-thread.js";

/** Joining the zone's warm shared school is a few rows: under a second. The
 * school itself is written once a night, ahead of its day. */
const JOIN_MS = Number(process.env.AMP_DEMO_JOIN_MS ?? 1_000);
const DAY = 86_400_000;
const ZONE = "America/New_York";

test(
  "The shared demo school: joined in under a second, visitors invisible to each other, rebuilt each night, never counted",
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
    // The school clock, which the test moves to the next week's night.
    let clock = Date.now();
    const app = buildApp({ repository: learning, authenticate });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: {
        secret: "fixture-secret",
        origin: "",
        learning,
        now: () => new Date(clock),
      },
    });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await app.ready();
    t.after(async () => {
      await app.close();
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    // As production does at boot and every ten minutes: the version's term
    // for today's weekday, then today's school in the zone.
    await workbookWorker().warm();
    const warmed = performance.now();
    await warmDemoSchools(db, { timezones: [ZONE], ahead: 0, learning });
    console.log(
      `  term computed and school written in ${Math.round(performance.now() - warmed)} ms`,
    );
    const today = (await currentSchool(db, ZONE))!;
    assert.ok(today, "the zone has a school");

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

    // Two visitors with made-up names, and a third with no demo.
    const visitors = {
      teacher: {
        account: "amp|visitor-avery",
        name: "Avery Quillfeather",
        email: "avery.quillfeather@example.test",
      },
      head: {
        account: "amp|visitor-blake",
        name: "Blake Marrowstone",
        email: "blake.marrowstone@example.test",
      },
    };
    for (const visitor of Object.values(visitors)) {
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES($1,$2,$3,true)`,
        [visitor.account.slice(4), visitor.name, visitor.email],
      );
      // Each practices on their own account, so each could be a teacher's
      // line on the class's map and boards.
      await db.query(
        "INSERT INTO amp_learners(id,account_id,name,adult) VALUES($1,$2,$3,true)",
        [randomUUID(), visitor.account, visitor.name],
      );
    }
    const stranger = "amp|someone-else";

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
      endsAt: new Date(Date.now() + 200 * DAY).toISOString(),
    });
    const realStudent = await schools.provisionStudent(real.id, {
      givenName: "Rowan",
      familyName: "Real",
      gradeLevel: 5,
    });
    // The teacher visitor also teaches at a real school.
    const staff = randomUUID();
    await db.query(
      "INSERT INTO amp_people(id,tenant_id,given_name,handle,account_id,timezone) VALUES($1,$2,'Avery','CalmOwl1000',$3,'UTC')",
      [staff, real.id, visitors.teacher.account],
    );
    await db.query(
      "INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'teacher','2020-01-01')",
      [randomUUID(), staff, real.id],
    );
    const window = {
      from: new Date(Date.now() - 200 * DAY),
      to: new Date(Date.now() + 2 * DAY),
    };
    const before = await insightsReport(db, window);
    const realState = async () =>
      (
        await db.query(
          `SELECT (SELECT count(*)::int FROM amp_problem_flags) AS flags,
             (SELECT json_agg(l ORDER BY l.id) FROM amp_school_licenses l WHERE l.org_id=$1) AS licenses,
             (SELECT json_agg(g ORDER BY g.id) FROM amp_grants g WHERE g.learner_id=$2) AS grants,
             (SELECT json_agg(s ORDER BY s.id) FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id WHERE l.org_id=$1) AS seats`,
          [real.id, realStudent.learnerId],
        )
      ).rows[0];
    const untouched = await realState();

    type Demo = { kind: string; orgId: string; classId: string; path: string };
    let teacherDemo: Demo;
    let headDemo: Demo;
    await t.test("joining a warm shared school takes under a second", async () => {
      for (const [kind, visitor] of [
        ["class", visitors.teacher],
        ["school", visitors.head],
      ] as const) {
        const started = performance.now();
        const joined = await call("POST", "/api/v1/school/demo", visitor.account, {
          kind,
          timezone: ZONE,
        });
        const elapsed = performance.now() - started;
        assert.equal(joined.statusCode, 201, joined.body);
        console.log(`  a ${kind} visitor joined in ${Math.round(elapsed)} ms`);
        assert.ok(elapsed <= JOIN_MS, `joined in ${Math.round(elapsed)} ms`);
        const demo = joined.json().demo as Demo;
        assert.deepEqual(
          { orgId: demo.orgId, classId: demo.classId },
          { orgId: today.orgId, classId: today.heroClassId },
        );
        assert.equal(
          demo.path,
          `school/${today.orgId}/classes/${today.heroClassId}/today`,
        );
        if (kind === "class") teacherDemo = demo;
        else headDemo = demo;
      }
      // Coming back is the same place.
      const again = await call(
        "POST",
        "/api/v1/school/demo",
        visitors.teacher.account,
        { kind: "class", timezone: ZONE },
      );
      assert.equal(again.statusCode, 200);
      assert.deepEqual(again.json().demo, teacherDemo);
      // The head is its admin; the teacher teaches the hero class.
      const orgOf = async (account: string) =>
        (await call("GET", `/api/v1/school/orgs/${today.orgId}`, account)).json()
          .org;
      const head = await orgOf(visitors.head.account);
      const teacher = await orgOf(visitors.teacher.account);
      assert.equal(head.demo, true);
      assert.ok(head.roles.includes("admin"));
      assert.equal(head.solo, false, "a school visitor sees the school");
      assert.deepEqual(teacher.roles, ["teacher"]);
      assert.equal(teacher.solo, true, "a class visitor sees their class");
      assert.deepEqual(teacher.teaches, [today.heroClassId]);
    });

    await t.test("a second request waits for the first and returns the same membership", async () => {
      const account = "amp|double-click";
      // Another request holds the account's lock past 5 s.
      const holder = await db.connect();
      await holder.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [
        `school-demo:${account}`,
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
          call("POST", "/api/v1/school/demo", account, { kind: "class" }),
        ),
      );
      assert.deepEqual([a!.statusCode, b!.statusCode], [200, 200]);
      assert.equal(a!.json().demo.orgId, first.json().demo.orgId);
      assert.equal(
        await count(
          "SELECT count(*) AS n FROM amp_people WHERE account_id=$1 AND deleted_at IS NULL",
          [account],
        ),
        1,
      );
      // Asking for the school next makes the same person its admin.
      const [c, d] = await Promise.all(
        [0, 1].map(() =>
          call("POST", "/api/v1/school/demo", account, { kind: "school" }),
        ),
      );
      assert.equal(c!.json().demo.orgId, d!.json().demo.orgId);
      assert.equal(
        await count(
          `SELECT count(*) AS n FROM amp_org_roles r JOIN amp_people p ON p.id=r.person_id
           WHERE p.account_id=$1 AND r.role='admin'`,
          [account],
        ),
        1,
      );
      assert.equal(
        (await call("DELETE", "/api/v1/school/demo", account)).json().removed,
        1,
      );
      assert.equal(
        (await call("GET", `/api/v1/school/orgs/${today.orgId}`, account))
          .statusCode,
        404,
      );
    });

    await t.test("Today, the map, the gradebook, time and workbooks are alive", async () => {
      const token = visitors.teacher.account;
      const base = `/api/v1/school/classes/${today.heroClassId}`;
      const day = (await call("GET", `${base}/today`, token)).json();
      assert.equal(day.week.students, 24);
      assert.ok(day.todos.length >= 3, JSON.stringify(day.todos));
      const map = (await call("GET", `${base}/map`, token)).json();
      const placed = map.students.filter((s: { level: unknown }) => s.level);
      assert.ok(placed.length >= 22 && map.strands.length >= 3);
      const book = (await call("GET", `${base}/gradebook`, token)).json();
      const ranged = book.students.filter(
        (s: { suggestion: { status: string; letters: string | null } }) =>
          s.suggestion.status === "ready" && s.suggestion.letters,
      );
      assert.ok(ranged.length >= 18, `ranges: ${ranged.length}`);
      assert.equal((await call("GET", `${base}/time`, token)).statusCode, 200);
      const stack = (await call("GET", `${base}/workbooks`, token)).json();
      const set = stack.recent[0];
      assert.ok(
        set && set.students === 24 && set.marked > 12 && set.marked < 24,
        JSON.stringify(set),
      );
      // The hero class is here today: presence moves with the clock.
      const presence = (await call("GET", `${base}/presence`, token)).json();
      assert.ok(JSON.stringify(presence).length > 2);
      const school = (
        await call(
          "GET",
          `/api/v1/school/orgs/${today.orgId}/classes`,
          visitors.head.account,
        )
      ).json();
      assert.equal(school.classes.length, 6);
      const overview = await call(
        "GET",
        `/api/v1/school/orgs/${today.orgId}/overview`,
        visitors.head.account,
      );
      assert.equal(overview.statusCode, 200);
    });

    await t.test("visitors play, but never reach a real student or a stranger", async () => {
      const today_ = await call(
        "GET",
        `/api/v1/school/classes/${today.heroClassId}/today`,
        stranger,
      );
      assert.equal(today_.statusCode, 404);
      const person = (
        await db.query(
          "SELECT p.id,p.learner_id FROM amp_people p WHERE p.tenant_id=$1 AND p.given_name='Priya'",
          [today.orgId],
        )
      ).rows[0];
      const path = `/api/v1/school/demo/students/${person.id}/session`;
      assert.equal((await call("POST", path, stranger)).statusCode, 404);
      assert.equal(
        (
          await call(
            "POST",
            `/api/v1/school/demo/students/${realStudent.personId}/session`,
            visitors.teacher.account,
          )
        ).statusCode,
        404,
      );
      // Nothing adds a real child to a demo, or invites anyone.
      const add = await call(
        "POST",
        `/api/v1/school/orgs/${today.orgId}/students`,
        visitors.head.account,
        { givenName: "Real", familyName: "Child", classId: today.heroClassId },
      );
      assert.equal(add.statusCode, 404);
      const invite = await call(
        "POST",
        `/api/v1/school/orgs/${today.orgId}/staff/invites`,
        visitors.head.account,
        { email: "someone@example.test", role: "teacher" },
      );
      assert.equal(invite.statusCode, 404);
      const can = (
        await call("GET", `/api/v1/school/orgs/${today.orgId}`, visitors.head.account)
      ).json().org.can as string[];
      for (const action of ["students.add", "staff.manage", "roster.import"])
        assert.ok(!can.includes(action), `${action} is not offered`);
      // Practice as Priya: her session, her learner, real problems.
      const session = await call("POST", path, visitors.teacher.account);
      assert.equal(session.statusCode, 201);
      const { token } = session.json();
      const batch = await app.inject({
        method: "POST",
        url: `/api/v1/learners/${person.learner_id}/batches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { count: 3 },
      });
      assert.equal(batch.statusCode, 200, batch.body);
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
        await count("SELECT free_online_used AS n FROM amp_learners WHERE id=$1", [
          person.learner_id,
        ]),
        0,
      );
      // The session reaches only her learner.
      const other = await app.inject({
        method: "POST",
        url: `/api/v1/learners/${realStudent.learnerId}/batches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { count: 1 },
      });
      assert.notEqual(other.statusCode, 200);
      // A demo never makes a visitor's own practice free; the real school
      // still counts.
      const { adultPracticeEnd } = await import("../src/account/adult-access.js");
      assert.equal(
        await adultPracticeEnd(db, visitors.teacher.account).then((end) => !!end),
        true,
      );
      assert.equal(await adultPracticeEnd(db, visitors.head.account), null);
      // Both act, so the activity log has something of each.
      for (const visitor of Object.values(visitors))
        assert.equal(
          (
            await call(
              "POST",
              `/api/v1/school/classes/${today.heroClassId}/rotate-code`,
              visitor.account,
              {},
            )
          ).statusCode,
          200,
        );
    });

    await t.test("two visitors never appear in each other's responses", async () => {
      const personOf = async (account: string) =>
        (
          await db.query(
            "SELECT id FROM amp_people WHERE account_id=$1 AND tenant_id=$2 AND deleted_at IS NULL",
            [account, today.orgId],
          )
        ).rows[0].id as string;
      const org = `/api/v1/school/orgs/${today.orgId}`;
      const klass = `/api/v1/school/classes/${today.heroClassId}`;
      const reads = [
        "/api/v1/me",
        "/api/v1/school/orgs",
        org,
        `${org}/staff`,
        `${org}/classes`,
        `${org}/overview`,
        `${org}/practice`,
        `${org}/standing`,
        `${org}/activity`,
        `${org}/license`,
        `${klass}/today`,
        `${klass}/map`,
        `${klass}/gradebook`,
        `${klass}/time`,
        `${klass}/standing`,
        `${klass}/presence`,
        `${klass}/roster`,
        `${klass}/workbooks`,
        `${klass}/experience`,
        `${klass}/experience/me`,
      ];
      const pairs = [
        [visitors.teacher, visitors.head],
        [visitors.head, visitors.teacher],
      ] as const;
      for (const [viewer, other] of pairs) {
        const secrets = [
          other.name,
          other.name.split(" ")[1]!,
          other.email,
          other.account,
          await personOf(other.account),
        ];
        let seen = 0;
        const check = (label: string, body: string) => {
          for (const secret of secrets)
            assert.ok(
              !body.includes(secret),
              `${viewer.name} sees ${secret} in ${label}`,
            );
        };
        for (const path of reads) {
          const response = await call("GET", path, viewer.account);
          if (response.statusCode === 200) seen++;
          check(path, response.body);
        }
        const search = await call("POST", `${org}/activity/people`, viewer.account, {
          q: other.name.split(" ")[1]!.slice(0, 5),
        });
        check("activity search", search.body);
        // Each still sees themself where they are listed.
        if (viewer === visitors.head) {
          const staff = await call("GET", `${org}/staff`, viewer.account);
          // The made-up teachers and themself: nobody else.
          assert.deepEqual(
            staff
              .json()
              .staff.map((row: { name: string }) => row.name)
              .sort(),
            [viewer.name, "Ms. Kowalski", "Ms. Rivera", "Ms. Tanaka"].sort(),
          );
          const activity = await call("GET", `${org}/activity`, viewer.account);
          assert.ok(activity.body.includes(viewer.name.split(" ")[0]!), "their own action shows");
        }
        assert.ok(seen >= 12, `${viewer.name} read ${seen} views`);
      }
    });

    await t.test("demo grants and students never reach the reports", async () => {
      assert.ok(
        (await count("SELECT count(*) AS n FROM amp_grants WHERE channel='demo'")) >=
          100,
      );
      const after = await insightsReport(db, window);
      assert.equal(after.totals.served, before.totals.served);
      assert.equal(after.totals.learners, before.totals.learners);
      assert.equal(after.totals.flags, before.totals.flags);
      for (const visitor of Object.values(visitors)) {
        const flags = (
          await db.query(
            `SELECT ${grantedAccessSql("$1")} AS granted,${purchaseEvidenceSql("$1")} AS paid`,
            [visitor.account],
          )
        ).rows[0];
        assert.deepEqual(flags, { granted: false, paid: false });
      }
    });

    await t.test("the same school every day, its dates moved by whole weeks", async () => {
      // A week on is the same weekday, so the same term moved seven days.
      const next = sharedDay(clock + 7 * DAY, ZONE);
      const written = performance.now();
      await ensureSchool(db, next, learning);
      console.log(
        `  next school written in ${Math.round(performance.now() - written)} ms`,
      );
      const nextOrg = (
        await db.query(
          "SELECT org_id FROM amp_demo_schools WHERE timezone=$1 AND day=$2::date",
          [ZONE, next.day],
        )
      ).rows[0].org_id as string;
      // Students, classes, answers and levels, with each date as the
      // school's own wall clock, so the two differ only by the seven days.
      const story = async (orgId: string, days: number) =>
        (
          await db.query(
            `SELECT c.name AS class,p.given_name||' '||p.family_name AS student,
               (SELECT json_agg(json_build_object(
                  'at',(a.created_at AT TIME ZONE $2)-make_interval(days=>$3),
                  'outcome',a.outcome-'id'-'problemId'-'requestId'-'createdAt',
                  'problem',i.content#-'{public,id}') ORDER BY a.created_at,a.id)
                FROM amp_attempts a JOIN amp_instances i ON i.id=a.problem_id
                WHERE a.learner_id=p.learner_id) AS answers,
               (SELECT json_agg(json_build_object('day',d.day-$3,'frontier',d.frontier) ORDER BY d.day)
                FROM amp_level_days d WHERE d.learner_id=p.learner_id) AS levels
             FROM amp_people p
             JOIN amp_enrollments e ON e.person_id=p.id AND e.role='student'
             JOIN amp_classes c ON c.id=e.class_id
             WHERE p.tenant_id=$1 AND p.learner_id IS NOT NULL
             ORDER BY c.name,student`,
            [orgId, ZONE, days],
          )
        ).rows;
      const [now_, later] = await Promise.all([
        story(today.orgId, 0),
        story(nextOrg, 7),
      ]);
      assert.equal(now_.length, 139);
      // As written: paper marks come from the day's printed workbooks, and
      // Priya practiced in this test, so her term is compared by count.
      const written_ = (rows: typeof now_) =>
        rows.map((row) => ({
          ...row,
          levels: row.student.startsWith("Priya ") ? null : row.levels,
          answers:
            row.student.startsWith("Priya ")
              ? null
              : (row.answers ?? []).filter(
                  (answer: { problem: { selection?: { reason?: string } } }) =>
                    answer.problem.selection?.reason !== "paper",
                ),
        }));
      assert.deepEqual(written_(now_), written_(later));
      assert.ok(
        later.reduce((sum, row) => sum + (row.answers?.length ?? 0), 0) > 10_000,
      );
    });

    await t.test("after the nightly switch a visitor lands in the new school; the old one goes after the grace period", async () => {
      const next = sharedDay(clock + 7 * DAY, ZONE);
      const old = today;
      // The new day has begun.
      clock = zonedInstant(next.day, 10, ZONE);
      const moved = (await currentSchool(db, ZONE, clock))!;
      assert.equal(moved.day, next.day);
      // The teacher's next navigation: their old link opens the new school.
      const stale = await call(
        "GET",
        `/api/v1/school/classes/${old.heroClassId}/today`,
        visitors.teacher.account,
      );
      assert.equal(stale.statusCode, 409, stale.body);
      assert.deepEqual(stale.json(), {
        error: "demo_moved",
        path: `school/${moved.orgId}/classes/${moved.heroClassId}/today`,
      });
      const fresh = await call(
        "GET",
        `/api/v1/school/classes/${moved.heroClassId}/today`,
        visitors.teacher.account,
      );
      assert.equal(fresh.statusCode, 200);
      const places = (
        await call("GET", "/api/v1/school/orgs", visitors.teacher.account)
      ).json().orgs.map((org: { id: string }) => org.id);
      assert.ok(places.includes(moved.orgId) && !places.includes(old.orgId));
      // Joining again lands in the new one too, still the hero's teacher.
      const again = await call("POST", "/api/v1/school/demo", visitors.teacher.account, {
        kind: "class",
        timezone: ZONE,
      });
      assert.equal(again.json().demo.orgId, moved.orgId);

      // Within the grace period the old school stays; after it, it goes
      // through the tree removal.
      const switched = zonedInstant(next.day, 0, ZONE);
      assert.deepEqual(
        await retireSchools(db, { now: switched + GRACE_MS - 60_000, timezones: [ZONE] }),
        { removed: 0 },
      );
      const removing = performance.now();
      assert.deepEqual(
        await retireSchools(db, { now: switched + GRACE_MS + 60_000, timezones: [ZONE] }),
        { removed: 1 },
      );
      console.log(
        `  old school removed in ${Math.round(performance.now() - removing)} ms`,
      );
      for (const [table, column] of [
        ["amp_orgs", "id"],
        ["amp_people", "tenant_id"],
        ["amp_classes", "org_id"],
        ["amp_school_events", "org_id"],
      ] as const)
        assert.equal(
          await count(`SELECT count(*) AS n FROM ${table} WHERE ${column}=$1`, [
            old.orgId,
          ]),
          0,
          table,
        );
      // The head comes back after it is gone: their place has moved, and an
      // old link still opens the new school.
      const late = await call(
        "GET",
        `/api/v1/school/orgs/${old.orgId}/overview`,
        visitors.head.account,
      );
      assert.equal(late.statusCode, 409, late.body);
      assert.equal(late.json().path, `school/${moved.orgId}/classes/${moved.heroClassId}/today`);
      const head = (
        await call("GET", `/api/v1/school/orgs/${moved.orgId}`, visitors.head.account)
      ).json().org;
      assert.ok(head.roles.includes("admin"), "still the school's admin");
      // A stranger's guess at the old school is just not found.
      assert.equal(
        (await call("GET", `/api/v1/school/orgs/${old.orgId}/overview`, stranger))
          .statusCode,
        404,
      );
    });

    await t.test("retention: old per-visitor demos and idle visitors go", async () => {
      // A demo made for one visitor before there was a shared school.
      const legacy = randomUUID();
      await db.query(
        `INSERT INTO amp_orgs(id,kind,path,name,timezone,solo,setup_pending,created_by,demo,demo_kind,demo_seen_at)
         VALUES($1,'school',ARRAY[$1]::uuid[],'Grade 5 Math','UTC',true,false,'amp|legacy',true,'class',now())`,
        [legacy],
      );
      await db.query(
        "UPDATE amp_demo_visitors SET seen_at=now()-interval '31 days' WHERE account_id=$1",
        [visitors.head.account],
      );
      assert.deepEqual(await purgeIdleDemos(db), {
        expiredDemoPlaces: 1,
        expiredDemoVisitors: 1,
      });
      assert.equal(
        await count("SELECT count(*) AS n FROM amp_orgs WHERE id=$1", [legacy]),
        0,
      );
      // The shared school is not the retention job's.
      assert.equal(
        await count("SELECT count(*) AS n FROM amp_orgs WHERE demo"),
        1,
      );
      // Nothing real moved.
      assert.deepEqual(await realState(), untouched);
    });
  },
);
