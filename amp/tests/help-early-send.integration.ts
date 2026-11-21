import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { FamilyRepository } from "../src/family/repository.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* L6: help is sent early (about 1.5 s after it opens) as the same heartbeat.
   The server's room for credit is the time since the learner's clock last
   moved, plus five seconds. Early sends carry the time counted so far, so
   the clock and the claim move together. Every name is made up. */
test(
  "early help sends: the same credit as heartbeats alone; no help lost or doubled",
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
    const beat = (body: object) =>
      post("/api/v1/school/student/activity", token, body);
    const age = (seconds: number) =>
      db.query(
        "UPDATE amp_student_sessions SET last_seen_at=now()-make_interval(secs=>$2) WHERE person_id=$1",
        [student.personId, seconds],
      );
    const credited = async () =>
      Number(
        (
          await rows(
            "SELECT COALESCE(sum(active_ms),0)::bigint AS ms FROM amp_active_days WHERE learner_id=$1",
            student.learnerId,
          )
        )[0].ms,
      );
    const helpCount = async () =>
      Number(
        (
          await rows(
            "SELECT count(*)::int AS n FROM amp_help_events WHERE learner_id=$1",
            student.learnerId,
          )
        )[0].n,
      );
    const lesson = (ref: string) => ({
      kind: "lesson",
      source: "lessons",
      ref,
      ageMs: 0,
    });
    const active = (ms: number) => ({ surface: "other", activeMs: ms });

    await t.test(
      "30 s of honest time credits the same split into early sends or sent whole",
      async () => {
        await age(30);
        assert.equal(
          (await beat({ deltas: [active(30_000)] })).statusCode,
          204,
        );
        const whole = await credited();
        assert.ok(whole > 0 && whole <= 30_000, `credited ${whole}`);
        // The same 30 s, as the client sends it: a help event 1.5 s in, one
        // more 1.5 s later, the rest with the heartbeat. The clock moves with
        // each send, so the total is the same.
        await db.query("DELETE FROM amp_active_days WHERE learner_id=$1", [
          student.learnerId,
        ]);
        await age(0);
        for (const [ms, ref] of [
          [1_500, "x1"],
          [1_500, "x2"],
          [27_000, "x3"],
        ] as const) {
          // The time each piece counts has passed by the time it is sent.
          await age(ms / 1000);
          assert.equal(
            (await beat({ deltas: [active(ms)], events: [lesson(ref)] }))
              .statusCode,
            204,
          );
        }
        const split = await credited();
        assert.equal(split, 30_000);
        assert.ok(whole <= 30_000 && whole >= 29_000, `whole ${whole}`);
        assert.equal(await helpCount(), 3);
      },
    );

    await t.test(
      "a burst of early sends is bounded by the server's room, never by how often it is sent",
      async () => {
        await db.query("DELETE FROM amp_active_days WHERE learner_id=$1", [
          student.learnerId,
        ]);
        // Thirty sends of 1.5 s each, back to back, claiming 45 s in all
        // though almost no time has passed: each is credited only the room
        // its own clock gave it (the time since the last send, plus 5 s).
        await age(1);
        let claimed = 0;
        for (let i = 0; i < 30; i++) {
          await beat({ deltas: [active(1_500)], events: [lesson(`r${i}`)] });
          claimed += 1_500;
        }
        const got = await credited();
        // The client claims only time its clock counted (the first test), so
        // this is the server's own bound on a client that claims more.
        assert.ok(got <= 1_000 + 5_000 * 30, `credited ${got}`);
        assert.ok(got <= claimed);
      },
    );

    await t.test(
      "help sent twice is counted twice only if the client sent it twice",
      async () => {
        const before = await helpCount();
        await beat({ deltas: [], events: [lesson("once"), lesson("once-b")] });
        assert.equal((await helpCount()) - before, 2);
        await beat({ deltas: [], events: [] });
        assert.equal((await helpCount()) - before, 2);
      },
    );
  },
);
