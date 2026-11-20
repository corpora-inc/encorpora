import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import type { Snapshot } from "../src/schools/clever/model.js";
import { lmsResponse } from "../src/schools/lms-contracts.js";
import { gradebookResponse } from "../src/schools/teacher-contracts.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

const D = "100000000000000000000001",
  S = "200000000000000000000001",
  T = "300000000000000000000009",
  A = "300000000000000000000001",
  X = "400000000000000000000001",
  TERM = "600000000000000000000001";
const NOW = new Date("2026-11-20T18:00:00Z");
const snapshot: Snapshot = {
  district: { id: D, name: "Fixture District" },
  schools: [{ id: S, district: D, name: "Fixture School" }],
  users: [
    {
      id: T,
      district: D,
      name: { first: "Teacher" },
      roles: { teacher: { school: S } },
    },
    {
      id: A,
      district: D,
      name: { first: "Student" },
      roles: { student: { school: S, grade: "4" } },
    },
  ],
  sections: [
    {
      id: X,
      district: D,
      school: S,
      name: "Math 4",
      students: [A],
      teacher: T,
      teachers: [T],
      term_id: TERM,
    },
  ],
  courses: [],
  terms: [
    {
      id: TERM,
      district: D,
      name: "Fall",
      start_date: "2026-08-15",
      end_date: "2026-12-20",
    },
  ],
};

test(
  "a teacher's LMS routes queue work, stay hidden while LMS Connect is off, and refuse strangers",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `lms_routes_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const learning = new PostgresRepository(scoped.href);
    const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
    try {
      await migrate(scoped.href);
      const db = learning.pool;
      const org = await new SchoolRepository(db).createOrg(
        { kind: "district", name: "Fixture district", timezone: "UTC" },
        { version: "fixture", signerName: "Fixture", signerTitle: "Admin" },
      );
      const { id: connectionId } = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: D,
        tenantId: org.id,
      });
      await syncCleverConnection(
        db,
        connectionId,
        {
          districtToken: async () => "fixture",
          snapshot: async () => snapshot,
          latestEvent: async () => null,
          events: async () => [],
        },
        { mode: "full", now: new Date("2026-11-01T12:00:00Z") },
      );
      const bound = (
        await db.query(
          "SELECT kind,clever_id,local_id FROM amp_clever_bindings WHERE connection_id=$1 AND kind IN ('section','user')",
          [connectionId],
        )
      ).rows;
      const classId = bound.find((row) => row.kind === "section").local_id;
      const teacher = bound.find((row) => row.clever_id === T).local_id;
      await db.query(
        "UPDATE amp_people SET account_id='amp|teacher' WHERE id=$1",
        [teacher],
      );
      const school = (
        await db.query("SELECT org_id FROM amp_classes WHERE id=$1", [classId])
      ).rows[0].org_id as string;
      const staff = new SchoolRepository(db);
      await staff.addStaff({
        orgId: school,
        role: "aide",
        givenName: "Aide",
        familyName: "Fixture",
        accountId: "amp|aide",
        classId,
      });
      await staff.addStaff({
        orgId: school,
        role: "viewer",
        givenName: "Viewer",
        familyName: "Fixture",
        accountId: "amp|viewer",
      });

      const authenticate = refuseStudentTokens(async (request) => {
        const header = request.headers.authorization;
        if (header?.startsWith("Bearer amp|")) return header.slice(7);
        throw new ApiError(401, "Sign in to continue");
      });
      const app = async (lms: boolean) => {
        const built = buildApp({ repository: learning, authenticate });
        await registerSchoolRoutes(built, {
          pool: db,
          authenticate,
          services: {
            secret: "fixture-secret",
            origin: "https://amp.example",
            now: () => NOW,
            ...(lms ? { lms: { environment: "sandbox" as const } } : {}),
          },
        });
        await built.ready();
        apps.push(built);
        return built;
      };
      const on = await app(true);
      const off = await app(false);
      const lmsReported = () =>
        db.query(
          "INSERT INTO amp_clever_lms(connection_id,lms_state,lms_type,checked_at) VALUES($1,'success','canvas',now())",
          [connectionId],
        );
      const call = (
        target: typeof on,
        method: "GET" | "POST",
        path: string,
        token = "amp|teacher",
        payload?: object,
      ) =>
        target.inject({
          method,
          url: `/api/v1/school/classes/${classId}${path}`,
          headers: { authorization: `Bearer ${token}` },
          ...(method === "POST" ? { payload: payload ?? {} } : {}),
        });

      // Until Clever names the district's LMS there is no button at all.
      assert.equal(
        gradebookResponse.parse((await call(on, "GET", "/gradebook")).json())
          .lms,
        null,
      );
      assert.equal((await call(on, "GET", "/lms")).statusCode, 404);
      await lmsReported();
      // The gradebook carries the class's LMS, so its button never arrives late.
      const book = await call(on, "GET", "/gradebook");
      assert.equal(book.statusCode, 200, book.body);
      assert.deepEqual(gradebookResponse.parse(book.json()).lms, {
        type: "canvas",
        state: "success",
        failureCode: null,
      });
      const hidden = await call(off, "GET", "/gradebook");
      assert.equal(gradebookResponse.parse(hidden.json()).lms, null);
      assert.equal((await call(off, "GET", "/lms")).statusCode, 404);
      assert.equal(
        (
          await call(off, "POST", "/lms/assignments", "amp|teacher", {
            kind: "practice",
          })
        ).statusCode,
        404,
      );

      const empty = lmsResponse.parse((await call(on, "GET", "/lms")).json());
      assert.equal(empty.canEdit, true);
      assert.equal(empty.today, "2026-11-20");
      assert.deepEqual(empty.assignments, []);
      assert.ok(empty.terms.length >= 1);

      const practice = {
        kind: "practice",
        title: "Practice this week",
        pointsPossible: 100,
        targetMinutes: 60,
        opensOn: "2026-11-20",
        dueOn: "2026-11-26",
      };
      const created = await call(
        on,
        "POST",
        "/lms/assignments",
        "amp|teacher",
        practice,
      );
      assert.equal(created.statusCode, 201, created.body);
      const id = created.json().id as string;
      assert.equal(
        (
          await call(on, "POST", "/lms/assignments", "amp|teacher", {
            ...practice,
            dueOn: "2026-11-19",
            opensOn: "2026-11-10",
          })
        ).json().error,
        "lms_due_date_past",
      );
      assert.equal(
        (
          await call(on, "POST", "/lms/assignments", "amp|teacher", {
            ...practice,
            targetMinutes: "lots",
          })
        ).json().error,
        "invalid_school_request",
      );
      let view = lmsResponse.parse((await call(on, "GET", "/lms")).json());
      assert.deepEqual(
        view.assignments.map((row) => [
          row.id,
          row.status,
          row.title,
          row.dueOn,
        ]),
        [[id, "pending", "Practice this week", "2026-11-26"]],
      );

      assert.equal(
        (await call(on, "POST", `/lms/assignments/${id}/sync`)).statusCode,
        202,
      );
      assert.equal(
        (
          await call(on, "POST", `/lms/assignments/${id}`, "amp|teacher", {
            ...practice,
            title: "Renamed",
          })
        ).statusCode,
        200,
      );
      view = lmsResponse.parse((await call(on, "GET", "/lms")).json());
      assert.equal(view.assignments[0]!.title, "Renamed");
      assert.equal(view.assignments[0]!.syncRequested, true);
      assert.equal(
        (await call(on, "POST", `/lms/assignments/${id}/republish`)).json()
          .error,
        "lms_assignment_not_unknown",
      );

      // An aide and a viewer read the class's LMS but change nothing.
      for (const reader of ["amp|aide", "amp|viewer"]) {
        const read = await call(on, "GET", "/lms", reader);
        assert.equal(read.statusCode, 200, `${reader} ${read.body}`);
        assert.equal(lmsResponse.parse(read.json()).canEdit, false);
        for (const path of [
          "/lms/assignments",
          `/lms/assignments/${id}`,
          `/lms/assignments/${id}/delete`,
          `/lms/assignments/${id}/sync`,
        ])
          assert.equal(
            (await call(on, "POST", path, reader, practice)).statusCode,
            404,
            `${reader} ${path}`,
          );
      }
      // A column deleted in the LMS can be cleared from the list.
      const gone = (
        await call(on, "POST", "/lms/assignments", "amp|teacher", {
          ...practice,
          title: "Gone",
        })
      ).json().id as string;
      await db.query(
        "UPDATE amp_lms_assignments SET status='missing',clever_assignment_id=$2 WHERE id=$1",
        [gone, randomUUID()],
      );
      assert.equal(
        (await call(on, "POST", `/lms/assignments/${gone}/delete`)).statusCode,
        200,
      );

      // Someone outside the class learns nothing, not even that it exists.
      assert.equal(
        (await call(on, "GET", "/lms", "amp|stranger")).statusCode,
        404,
      );
      assert.equal(
        (
          await call(
            on,
            "POST",
            `/lms/assignments/${id}/delete`,
            "amp|stranger",
          )
        ).statusCode,
        404,
      );
      assert.equal(
        (await call(on, "POST", `/lms/assignments/${randomUUID()}/delete`))
          .statusCode,
        404,
      );

      assert.equal(
        (await call(on, "POST", `/lms/assignments/${id}/delete`)).statusCode,
        200,
      );
      view = lmsResponse.parse((await call(on, "GET", "/lms")).json());
      assert.deepEqual(view.assignments, []);
      assert.deepEqual(
        (
          await db.query(
            "SELECT action FROM amp_school_events WHERE target_kind='lms_assignment' AND target_id=$1 ORDER BY action",
            [id],
          )
        ).rows
          .map((row) => row.action)
          .sort(),
        [
          "lms.assignment.create",
          "lms.assignment.delete",
          "lms.assignment.sync",
          "lms.assignment.update",
        ],
      );
    } finally {
      for (const built of apps) await built.close();
      await learning.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
