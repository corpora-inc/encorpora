import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { activateClassPilot, startSchoolClass } from "../src/schools/pilots.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/*
 * SPEC R14 on the server: a class's code, its printed cards and a new code
 * reach staff (and through them students) only while its students can
 * practice. Before Start and after practice ends, every staff read leaves
 * the code out and every way of making one refuses, for the teacher, an
 * administrator, a viewer and an aide alike. Records stay readable, and a
 * licensed school's class is never gated.
 */
test(
  "a class's code and cards reach staff only while its practice runs",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `sign_in_gate_${randomUUID().replaceAll("-", "")}`;
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
      if (header?.startsWith("Bearer ")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const call = (
      method: "GET" | "POST",
      account: string,
      path: string,
      payload?: object,
    ) =>
      app.inject({
        method,
        url: `/api/v1/school/${path}`,
        headers: { authorization: `Bearer ${account}` },
        ...(method === "POST" ? { payload: payload ?? {} } : {}),
      });

    // A teacher's own class, by the self-serve start, with two students.
    const teacher = "fixture-gate-teacher";
    const started = await startSchoolClass(schools, teacher, {
      requestId: randomUUID(),
      schoolName: "Birchwood Elementary",
      className: "Grade 4 Math",
      timezone: "UTC",
      signerName: "Rosa Lindqvist",
      signerTitle: "Teacher",
      agreementVersion: AGREEMENT_VERSION,
      authorized: true,
      names: ["Ana Brook", "Ben Cole"],
    });
    const { orgId, classId } = started;
    const staff = { teacher } as Record<string, string>;
    for (const role of ["admin", "viewer", "aide"] as const) {
      staff[role] = `fixture-gate-${role}`;
      await schools.addStaff({
        orgId,
        role,
        givenName: role,
        accountId: staff[role],
        ...(role === "aide" ? { classId } : {}),
      });
    }
    const code = (
      await db.query("SELECT join_code FROM amp_classes WHERE id=$1", [classId])
    ).rows[0].join_code as string;

    async function expectClosed(state: "waiting" | "ended") {
      for (const [role, account] of Object.entries(staff)) {
        for (const leaf of ["presence", "roster"]) {
          const read = await call("GET", account, `classes/${classId}/${leaf}`);
          assert.equal(read.statusCode, 200, `${role} ${leaf}`);
          const body = read.json() as {
            class: { joinCode: string | null; practice?: string };
            students: unknown[];
          };
          assert.equal(body.class.joinCode, null, `${role} ${leaf} ${state}`);
          assert.equal(body.class.practice, state, `${role} ${leaf}`);
          // The records stay readable: the students are still listed.
          assert.equal(body.students.length, 2, `${role} ${leaf} students`);
          assert.ok(!read.body.includes(code), `${role} ${leaf} has no code`);
        }
        const list = await call("GET", account, `orgs/${orgId}/classes`);
        assert.equal(list.statusCode, 200, `${role} classes`);
        assert.ok(!list.body.includes(code), `${role} classes: no code`);
        const year = await call("GET", account, `classes/${classId}/year`);
        assert.equal(year.json().practice, state, `${role} year`);
      }
      // Nothing that makes or carries a code: refused, for the teacher too.
      for (const [path, payload] of [
        ["rotate-code", {}],
        ["cards", {}],
        [
          "cards.pdf",
          {
            format: "Letter",
            cards: [{ personId: randomUUID(), token: "x".repeat(43) }],
          },
        ],
      ] as const) {
        const made = await call(
          "POST",
          teacher,
          `classes/${classId}/${path}`,
          payload,
        );
        assert.equal(made.statusCode, 409, `${path} ${state}`);
        assert.equal(made.json().error, "practice_closed", path);
      }
      assert.equal(
        (
          await db.query("SELECT join_code FROM amp_classes WHERE id=$1", [
            classId,
          ])
        ).rows[0].join_code,
        code,
        "the code itself is unchanged",
      );
    }

    // Before Start.
    await expectClosed("waiting");
    // Started: the code, cards and a new code are the class's tools again.
    await activateClassPilot(schools, teacher, classId);
    for (const account of Object.values(staff)) {
      const read = await call("GET", account, `classes/${classId}/presence`);
      assert.equal(read.json().class.joinCode, code);
      assert.equal(read.json().class.practice, "open");
    }
    const cards = await call("POST", teacher, `classes/${classId}/cards`, {});
    assert.equal(cards.statusCode, 200);
    assert.equal(cards.json().cards.length, 2);
    const rotated = await call(
      "POST",
      teacher,
      `classes/${classId}/rotate-code`,
      {},
    );
    assert.equal(rotated.statusCode, 200);
    // After practice ends.
    await db.query(
      "UPDATE amp_teacher_pilots SET started_at=now()-interval '40 days',ends_at=now()-interval '10 days',grace_ends_at=now()-interval '3 days'",
    );
    const newer = (
      await db.query("SELECT join_code FROM amp_classes WHERE id=$1", [classId])
    ).rows[0].join_code as string;
    assert.notEqual(newer, code, "the new code replaced the old");
    const current = newer;
    for (const account of Object.values(staff)) {
      const read = await call("GET", account, `classes/${classId}/presence`);
      assert.equal(read.json().class.joinCode, null);
      assert.ok(!read.body.includes(current));
    }
    for (const path of ["cards", "rotate-code"]) {
      const made = await call(
        "POST",
        teacher,
        `classes/${classId}/${path}`,
        {},
      );
      assert.equal(made.statusCode, 409, `${path} after practice`);
    }

    // A licensed school's class has its code from the first day.
    const licensed = await schools.createOrg(
      { kind: "school", name: "Lakeside Middle", timezone: "UTC" },
      {
        version: AGREEMENT_VERSION,
        signerName: "Marta Okafor",
        signerTitle: "Principal",
      },
    );
    await schools.issueLicense({
      orgId: licensed.id,
      seats: 10,
      endsAt: new Date(Date.now() + 300 * 86_400_000).toISOString(),
    });
    const six = await schools.createClass(licensed.id, { name: "Grade 6" });
    await schools.addStaff({
      orgId: licensed.id,
      role: "teacher",
      givenName: "Lake",
      accountId: "fixture-gate-lake",
      classId: six.id,
    });
    const open = await call(
      "GET",
      "fixture-gate-lake",
      `classes/${six.id}/presence`,
    );
    assert.equal(open.json().class.joinCode, six.joinCode);
    assert.equal(open.json().class.practice, "open");
  },
);
