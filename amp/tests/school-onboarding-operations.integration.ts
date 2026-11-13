import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { z } from "zod";
import { migrate } from "../scripts/migrate.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import {
  startSchoolClass,
  activateClassPilot,
  classPilotState,
  requestSchoolPurchase,
  extendTeacherPilot,
} from "../src/schools/pilots.js";
import { deleteAccount } from "../src/account/delete-account.js";
import {
  connectCleverInstitution,
  registerCleverOnboarding,
} from "../src/schools/clever-onboarding.js";
import { runDueCleverSync } from "../src/schools/clever/worker.js";
import {
  schoolOperations,
  refreshConnectionReviews,
} from "../src/schools/operations.js";
import type { Snapshot } from "../src/schools/clever/model.js";
import { establishProviderPrincipal } from "../src/identity/provider-principals.js";

const D = "100000000000000000000001",
  U = "200000000000000000000001";
const start = (names = ["Student Example"]) => ({
  requestId: randomUUID(),
  schoolName: "Fixture school",
  className: "First class",
  timezone: "UTC",
  signerName: "Teacher Example",
  signerTitle: "Teacher",
  agreementVersion: AGREEMENT_VERSION,
  authorized: true,
  names,
});
async function fixture(
  run: (db: Pool, repo: SchoolRepository) => Promise<void>,
) {
  const url = process.env.AMP_TEST_DATABASE_URL!,
    schema = `onboard_ops_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url }),
    scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = new Pool({ connectionString: scoped.href, max: 8 });
  try {
    await migrate(scoped.href);
    await run(db, new SchoolRepository(db));
  } finally {
    await db.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };

test(
  "teacher pilot deletion removes sole classroom; shared consent is anonymous; administrator cannot consume teacher pilot",
  enabled,
  async () =>
    fixture(async (db, repo) => {
      const one = await startSchoolClass(repo, "teacher-one", start());
      await activateClassPilot(repo, "teacher-one", one.classId);
      await requestSchoolPurchase(repo, "teacher-one", {
        orgId: one.orgId,
        classIds: [one.classId],
        seats: 1,
      });
      const learner = (
        await db.query(
          "SELECT learner_id FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
          [one.orgId],
        )
      ).rows[0].learner_id;
      await deleteAccount(db, {
        accountId: "teacher-one",
        via: "operator",
        commit: true,
      });
      assert.equal(
        (await db.query("SELECT 1 FROM amp_orgs WHERE id=$1", [one.orgId]))
          .rowCount,
        0,
      );
      assert.equal(
        (
          await db.query(
            "SELECT 1 FROM amp_learners WHERE id=$1 AND deleted_at IS NULL",
            [learner],
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (await db.query("SELECT 1 FROM amp_school_purchase_requests")).rowCount,
        0,
      );
      assert.equal(
        (
          await db.query(
            "SELECT 1 FROM amp_teacher_pilots WHERE account_id='teacher-one'",
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (await db.query("SELECT 1 FROM amp_pilot_eligibility")).rowCount,
        1,
      );
      const shared = await startSchoolClass(repo, "teacher-two", start());
      await repo.addStaff({
        orgId: shared.orgId,
        givenName: "Other",
        role: "teacher",
        accountId: "teacher-three",
        classId: shared.classId,
      });
      await repo.addStaff({
        orgId: shared.orgId,
        givenName: "Administrator",
        role: "admin",
        accountId: "admin",
      });
      await assert.rejects(
        activateClassPilot(repo, "admin", shared.classId),
        /pilot_teacher_required/,
      );
      await deleteAccount(db, {
        accountId: "teacher-two",
        via: "operator",
        commit: true,
      });
      assert.equal(
        (await db.query("SELECT 1 FROM amp_orgs WHERE id=$1", [shared.orgId]))
          .rowCount,
        1,
      );
      assert.equal(
        (
          await db.query(
            "SELECT 1 FROM amp_class_authorizations WHERE account_id='teacher-two' OR signer_name='Teacher Example'",
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (await activateClassPilot(repo, "teacher-three", shared.classId))
          .status,
        "active",
      );
    }),
);

test(
  "paid seats move across class scopes, scheduled licenses activate, and purchase retries retain learner IDs",
  enabled,
  async () =>
    fixture(async (db, repo) => {
      const first = await startSchoolClass(repo, "teacher", start());
      const second = await startSchoolClass(repo, "teacher", {
        ...start(["Second Student"]),
        orgId: first.orgId,
        className: "Second class",
      });
      const student = (
        await db.query(
          "SELECT person_id FROM amp_enrollments WHERE class_id=$1 AND role='student'",
          [first.classId],
        )
      ).rows[0].person_id;
      await repo.issueLicense({
        orgId: first.orgId,
        classIds: [first.classId],
        seats: 1,
        endsAt: new Date(Date.now() + 86400000).toISOString(),
      });
      await repo.transaction(async (c) => {
        await c.query(
          "UPDATE amp_enrollments SET end_on=current_date WHERE person_id=$1 AND class_id=$2",
          [student, first.classId],
        );
        await repo.enroll(c, second.classId, student, "student", "2020-01-01");
      });
      const purchase = await requestSchoolPurchase(repo, "teacher", {
        orgId: first.orgId,
        classIds: [second.classId],
        seats: 2,
      });
      const input = {
        id: purchase.id,
        seats: 2,
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        reference: "Fixture PO",
      };
      const results = await Promise.all([
        schoolOperations(repo, "activate-purchase", input),
        schoolOperations(repo, "activate-purchase", input),
      ]);
      assert.equal(
        (results[0] as any).licenseId,
        (results[1] as any).licenseId,
      );
      assert.equal(
        (await classPilotState(db, second.classId)).coverage.paid,
        2,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM amp_seats WHERE person_id=$1 AND released_at IS NULL",
            [student],
          )
        ).rows[0].n,
        1,
      );
      await db.query(
        "UPDATE amp_enrollments SET end_on=current_date WHERE class_id=$1 AND role='student'",
        [second.classId],
      );
      await repo.reconcileSeats(first.orgId);
      assert.equal(
        (await db.query("SELECT 1 FROM amp_seats WHERE released_at IS NULL"))
          .rowCount,
        0,
      );
      const future = await repo.issueLicense({
        orgId: first.orgId,
        seats: 2,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 86400000 * 10).toISOString(),
      });
      assert.equal(future.assigned, 0);
      await db.query(
        "UPDATE amp_school_licenses SET starts_at=now()-interval '1 second' WHERE id=$1",
        [future.licenseId],
      );
      await repo.reconcileSeats(first.orgId);
      assert.equal(
        (
          await db.query(
            "SELECT 1 FROM amp_seats WHERE license_id=$1 AND released_at IS NULL",
            [future.licenseId],
          )
        ).rowCount,
        2,
      );
    }),
);

test(
  "Clever bootstrap verifies current provider authority; staged import, durable claims and CSRF",
  enabled,
  async () =>
    fixture(async (db, repo) => {
      const source: Snapshot = {
        district: { id: D, name: "Provider District" },
        schools: [],
        users: [
          {
            id: U,
            district: D,
            name: { first: "Administrator" },
            roles: { district_admin: {} },
          },
        ],
        sections: [],
        terms: [],
        courses: [],
      };
      let snapshots = 0;
      const client = {
        districtToken: async () => "fixture-only",
        get: async <T>(path: string, _token: string, schema: z.ZodType<T>) =>
          schema.parse(
            path.includes("/districts/") ? source.district : source.users[0],
          ),
        snapshot: async () => {
          snapshots++;
          await new Promise((r) => setTimeout(r, 20));
          return source;
        },
        events: async () => [],
        latestEvent: async () => null,
      };
      const identity = {
        environment: "sandbox" as const,
        districtId: D,
        userId: U,
        accountId: "",
        roles: ["district_admin"],
      };
      identity.accountId = (
        await establishProviderPrincipal(db, { ...identity, schools: [] }, null)
      ).accountId;
      const input = {
        signerName: "Administrator",
        signerTitle: "Head",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
        timezone: "UTC",
        importNow: false,
      };
      source.users[0].roles = { teacher: {} };
      await assert.rejects(
        connectCleverInstitution(repo, identity, input, client),
        /district_admin_required/,
      );
      assert.equal((await db.query("SELECT 1 FROM amp_orgs")).rowCount, 0);
      source.users[0].roles = { district_admin: {} };
      const [connected, repeated] = await Promise.all([
        connectCleverInstitution(repo, identity, input, client),
        connectCleverInstitution(repo, identity, input, client),
      ]);
      assert.equal(connected.connectionId, repeated.connectionId);
      assert.equal(connected.status, "ready_to_import");
      await runDueCleverSync(db, connected.connectionId, client);
      assert.equal(snapshots, 0);
      await db.query(
        "UPDATE amp_clever_connections SET sync_paused=false,sync_requested_at=now() WHERE id=$1",
        [connected.connectionId],
      );
      await Promise.all([
        runDueCleverSync(db, connected.connectionId, client),
        runDueCleverSync(db, connected.connectionId, client),
      ]);
      assert.equal(snapshots, 1);
      await runDueCleverSync(db, connected.connectionId, client);
      assert.equal(snapshots, 1);
      assert.equal(
        (
          await db.query(
            "SELECT 1 FROM amp_clever_sync_runs WHERE status='running'",
          )
        ).rowCount,
        0,
      );
      const app = Fastify();
      await registerCleverOnboarding(app, {
        pool: db,
        authenticate: async () => "admin",
        config: {
          ...identity,
          clientId: "fixture",
          clientSecret: "fixture",
          origin: "http://localhost:4410",
        },
        client,
        worker: false,
      });
      await app.ready();
      try {
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/api/v1/school/clever/sync",
              headers: {
                origin: "http://sibling.localhost:4410",
                cookie: "fixture=yes",
              },
            })
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/api/v1/school/clever/sync",
              headers: { cookie: "fixture=yes" },
            })
          ).statusCode,
          403,
        );
      } finally {
        await app.close();
      }
      await refreshConnectionReviews(db);
      assert.equal(
        (await db.query("SELECT 1 FROM amp_school_connection_tasks")).rowCount,
        0,
      );
    }),
);

test(
  "HTTP Clever connection reaches an imported teacher class with pilot learning access",
  enabled,
  async () =>
    fixture(async (db, repo) => {
      const { establishProviderPrincipal, withProviderSessions } =
        await import("../src/identity/provider-principals.js");
      const { resolveCleverPerson } =
        await import("../src/schools/clever/identity.js");
      const { registerSchoolRoutes } = await import("../src/schools/routes.js");
      const { SchoolSignIn } = await import("../src/schools/sign-in.js");
      const { schoolPilotAccess } =
        await import("../src/schools/pilot-access.js");
      const S = "500000000000000000000001",
        T = "200000000000000000000002",
        P = "200000000000000000000003",
        C = "600000000000000000000001";
      const source: Snapshot = {
        district: { id: D, name: "Connected District" },
        schools: [{ id: S, district: D, name: "Connected School" }],
        users: [
          {
            id: U,
            district: D,
            name: { first: "Administrator" },
            roles: { district_admin: {} },
          },
          {
            id: T,
            district: D,
            name: { first: "Teacher" },
            roles: { teacher: { school: S, schools: [S] } },
          },
          {
            id: P,
            district: D,
            name: { first: "Student" },
            roles: { student: { school: S, schools: [S], grade: "4" } },
          },
        ],
        sections: [
          {
            id: C,
            district: D,
            school: S,
            name: "Math",
            students: [P],
            teachers: [T],
          },
        ],
        courses: [],
        terms: [],
      };
      const client = {
        districtToken: async () => "fixture-only",
        get: async <V>(path: string, _token: string, schema: z.ZodType<V>) =>
          schema.parse(
            path.includes("/districts/")
              ? source.district
              : source.users.find((u) => path.endsWith(u.id)),
          ),
        snapshot: async () => source,
        events: async () => [],
        latestEvent: async () => null,
      };
      const admin = await establishProviderPrincipal(
        db,
        {
          environment: "sandbox",
          districtId: D,
          userId: U,
          roles: ["district_admin"],
          schools: [],
        },
        null,
      );
      const resolve = (claims: {
        environment: "sandbox" | "production";
        districtId: string;
        userId: string;
      }) => resolveCleverPerson(db, claims);
      const authenticate = withProviderSessions(
        db,
        async () => {
          throw Object.assign(new Error("sign_in_required"), {
            statusCode: 401,
          });
        },
        { resolvePerson: resolve },
      );
      const app = Fastify();
      await registerCleverOnboarding(app, {
        pool: db,
        authenticate,
        config: {
          origin: "http://localhost:4410",
          environment: "sandbox",
          clientId: "fixture",
          clientSecret: "fixture",
        },
        client,
        worker: false,
      });
      await registerSchoolRoutes(app, {
        pool: db,
        authenticate,
        services: {
          origin: "http://localhost:4410",
          secret: "fixture-private-key",
        },
      });
      await app.ready();
      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/school/clever/connect",
          headers: { authorization: `Bearer ${admin.token}` },
          payload: {
            signerName: "Administrator",
            signerTitle: "Head",
            agreementVersion: AGREEMENT_VERSION,
            authorized: true,
            timezone: "UTC",
          },
        });
        assert.equal(response.statusCode, 202, response.body);
        for (let i = 0; i < 100; i++) {
          if (
            (
              await db.query(
                "SELECT 1 FROM amp_clever_connections WHERE last_sync_at IS NOT NULL",
              )
            ).rowCount
          )
            break;
          await new Promise((r) => setTimeout(r, 20));
        }
        const status = await app.inject({
          url: "/api/v1/school/clever/status",
          headers: { authorization: `Bearer ${admin.token}` },
        });
        assert.equal(status.statusCode, 200, status.body);
        assert.ok(status.json().connection.lastSyncAt);
        const teacher = await establishProviderPrincipal(
          db,
          {
            environment: "sandbox",
            districtId: D,
            userId: T,
            roles: ["teacher"],
            schools: [S],
          },
          await resolve({ environment: "sandbox", districtId: D, userId: T }),
        );
        const klass = (
          await db.query(
            "SELECT local_id FROM amp_clever_bindings WHERE kind='section' AND clever_id=$1",
            [C],
          )
        ).rows[0].local_id;
        const activated = await app.inject({
          method: "POST",
          url: `/api/v1/school/classes/${klass}/pilot/activate`,
          headers: { authorization: `Bearer ${teacher.token}` },
        });
        assert.equal(activated.statusCode, 200, activated.body);
        assert.equal(activated.json().status, "active");
        const student = await resolve({
          environment: "sandbox",
          districtId: D,
          userId: P,
        });
        assert.ok(student?.learnerId);
        assert.equal(
          (await schoolPilotAccess(db, student!.learnerId!)).active,
          true,
        );
        const grant = await new SchoolSignIn(repo).signInPerson(
          student!.personId,
        );
        assert.ok(grant);
        const bad = await app.inject({
          url: "/api/v1/school/clever/status",
          headers: { authorization: `Bearer ${grant!.token}` },
        });
        assert.equal(bad.statusCode, 401);
      } finally {
        await app.close();
      }
    }),
);
