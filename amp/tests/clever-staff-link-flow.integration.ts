import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import Fastify, { type FastifyRequest } from "fastify";
import { Pool } from "pg";
import { z } from "zod";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import {
  establishProviderPrincipal,
  resolveProviderSession,
  withProviderSessions,
  type CleverClaims,
} from "../src/identity/provider-principals.js";
import { ApiError } from "../src/server/repository.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { registerCleverOnboarding } from "../src/schools/clever-onboarding.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { resolveCleverPerson } from "../src/schools/clever/identity.js";
import type { Snapshot } from "../src/schools/clever/model.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import { runDueCleverSync } from "../src/schools/clever/worker.js";
import { SchoolRepository } from "../src/schools/repository.js";

const id = () => randomBytes(12).toString("hex");
const request = (token: string) =>
  ({ headers: { authorization: `Bearer ${token}` } }) as FastifyRequest;
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };

async function fixture(run: (db: Pool) => Promise<void>) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  assertTestDatabaseTarget(url);
  const schema = `staff_link_flow_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = new Pool({ connectionString: scoped.href, max: 8 });
  try {
    await migrate(scoped.href);
    await run(db);
  } finally {
    await db.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}

function source(db: Pool) {
  const districtId = id(),
    schoolId = id(),
    first = id(),
    second = id(),
    student = id(),
    section = id();
  const claims = (userId: string): CleverClaims => ({
    environment: "sandbox",
    districtId,
    userId,
    roles: ["district_admin", "teacher"],
    schools: [schoolId],
  });
  const snapshot: Snapshot = {
    district: { id: districtId, name: "Fixture district" },
    schools: [{ id: schoolId, district: districtId, name: "Fixture school" }],
    users: [first, second].map((userId) => ({
      id: userId,
      district: districtId,
      name: { first: "Fixture staff" },
      roles: { district_admin: {}, teacher: { school: schoolId } },
    })),
    sections: [
      {
        id: section,
        district: districtId,
        school: schoolId,
        name: "Fixture class",
        teachers: [first, second],
        students: [student],
      },
    ],
    courses: [],
    terms: [],
  };
  snapshot.users.push({
    id: student,
    district: districtId,
    name: { first: "Fixture student" },
    roles: { student: { school: schoolId, grade: "4" } },
  });
  let snapshots = 0;
  const client = {
    districtToken: async () => "fixture-only",
    get: async <T>(path: string, _token: string, schema: z.ZodType<T>) =>
      schema.parse(
        path.includes("/districts/")
          ? snapshot.district
          : snapshot.users.find((user) => path.endsWith(user.id)),
      ),
    snapshot: async () => {
      snapshots++;
      return snapshot;
    },
    latestEvent: async () => null,
    events: async () => [],
  };
  const resolver = (
    input: Pick<CleverClaims, "environment" | "districtId" | "userId">,
  ) => resolveCleverPerson(db, input);
  const principal = async (userId: string, account: string | null = null) =>
    establishProviderPrincipal(
      db,
      claims(userId),
      await resolver(claims(userId)),
      account,
    );
  const existingConnection = async () => {
    const repo = new SchoolRepository(db);
    const district = await repo.createOrg(
      { kind: "district", name: "Fixture district", timezone: "UTC" },
      {
        version: AGREEMENT_VERSION,
        signerName: "Fixture",
        signerTitle: "Administrator",
      },
    );
    return registerCleverConnection(db, {
      environment: "sandbox",
      districtId,
      tenantId: district.id,
    });
  };
  const rosterIds = async (connectionId: string) => {
    const rows = (
      await db.query(
        "SELECT kind,clever_id,local_id FROM amp_clever_bindings WHERE connection_id=$1",
        [connectionId],
      )
    ).rows;
    const local = (kind: string, key: string) =>
      rows.find((r) => r.kind === kind && r.clever_id === key)
        ?.local_id as string;
    const studentId = local("user", student);
    return {
      first: local("user", first),
      second: local("user", second),
      classId: local("section", section),
      studentId,
      learnerId: (
        await db.query("SELECT learner_id FROM amp_people WHERE id=$1", [
          studentId,
        ])
      ).rows[0]?.learner_id as string,
    };
  };
  return {
    districtId,
    first,
    second,
    claims,
    snapshot,
    client,
    resolver,
    principal,
    existingConnection,
    rosterIds,
    snapshotCount: () => snapshots,
  };
}

test(
  "two proved administrator identities connect a staged district and import one canonical staff person",
  enabled,
  async () =>
    fixture(async (db) => {
      const f = source(db);
      const first = await f.principal(f.first),
        second = await f.principal(f.second, first.accountId);
      assert.equal(second.accountId, first.accountId);
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM amp_auth_users"))
          .rows[0].n,
        0,
        "provider-only linking requires no mailbox account",
      );
      const app = Fastify();
      await registerCleverOnboarding(app, {
        pool: db,
        worker: false,
        authenticate: withProviderSessions(
          db,
          async () => {
            throw new ApiError(401, "Sign in");
          },
          { resolvePerson: f.resolver },
        ),
        config: {
          environment: "sandbox",
          clientId: "fixture",
          clientSecret: "fixture",
        },
        client: f.client,
      });
      let connectionId = "",
        orgId = "";
      try {
        for (const session of [first, second]) {
          const response = await app.inject({
            method: "POST",
            url: "/api/v1/school/clever/connect",
            headers: { authorization: `Bearer ${session.token}` },
            payload: {
              signerName: "Fixture administrator",
              signerTitle: "District administrator",
              agreementVersion: AGREEMENT_VERSION,
              authorized: true,
              timezone: "UTC",
              importNow: false,
            },
          });
          assert.equal(response.statusCode, 202, response.body);
          assert.equal(response.json().status, "ready_to_import");
          if (connectionId)
            assert.equal(response.json().connectionId, connectionId);
          connectionId = response.json().connectionId;
          orgId = response.json().orgId;
        }
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int AS n FROM amp_people WHERE tenant_id=$1 AND account_id=$2 AND deleted_at IS NULL",
              [orgId, first.accountId],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(DISTINCT local_id)::int AS n FROM amp_clever_bindings WHERE connection_id=$1 AND kind='user'",
              [connectionId],
            )
          ).rows[0].n,
          1,
        );
        await runDueCleverSync(db, connectionId, f.client);
        assert.equal(
          f.snapshotCount(),
          1,
          "worker stages the source for adoption",
        );
        assert.equal(
          (await db.query("SELECT count(*)::int n FROM amp_classes")).rows[0].n,
          0,
        );
        const imported = await app.inject({
          method: "POST",
          url: "/api/v1/school/clever/sync",
          headers: { authorization: `Bearer ${second.token}` },
        });
        assert.equal(imported.statusCode, 202, imported.body);
      } finally {
        await app.close();
      }
      await runDueCleverSync(db, connectionId, f.client);
      assert.equal(f.snapshotCount(), 2);
      assert.ok(
        (
          await db.query(
            "SELECT last_sync_at FROM amp_clever_connections WHERE id=$1",
            [connectionId],
          )
        ).rows[0].last_sync_at,
      );
      const ids = await f.rosterIds(connectionId);
      assert.equal(ids.first, ids.second);
      assert.ok(ids.classId && ids.learnerId);
      for (const session of [first, second]) {
        const resolved = await resolveProviderSession(
          db,
          request(session.token),
          f.resolver,
        );
        assert.equal(resolved?.personId, ids.first);
        assert.equal(resolved?.accountId, first.accountId);
      }
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_org_roles WHERE person_id=$1 AND org_id=$2 AND role='admin' AND end_on IS NULL",
            [ids.first, orgId],
          )
        ).rows[0].n,
        1,
      );
    }),
);

test(
  "linking a second rostered staff identity preserves the class, learner and enrollment history",
  enabled,
  async () =>
    fixture(async (db) => {
      const f = source(db),
        connection = await f.existingConnection();
      await syncCleverConnection(db, connection.id, f.client);
      const before = await f.rosterIds(connection.id);
      assert.notEqual(before.first, before.second);
      const historical = (
        await db.query(
          "SELECT id FROM amp_enrollments WHERE class_id=$1 ORDER BY id",
          [before.classId],
        )
      ).rows.map((r) => r.id);
      const first = await f.principal(f.first),
        second = await f.principal(f.second, first.accountId);
      assert.equal(second.accountId, first.accountId);
      const resolved = await resolveProviderSession(
        db,
        request(second.token),
        f.resolver,
      );
      assert.equal(resolved?.personId, before.first);
      const after = await f.rosterIds(connection.id);
      assert.deepEqual(after, { ...before, second: before.first });
      assert.deepEqual(
        (
          await db.query(
            "SELECT id FROM amp_enrollments WHERE class_id=$1 ORDER BY id",
            [before.classId],
          )
        ).rows.map((r) => r.id),
        historical,
      );
      assert.ok(
        (
          await db.query("SELECT deleted_at FROM amp_people WHERE id=$1", [
            before.second,
          ])
        ).rows[0].deleted_at,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_enrollments WHERE class_id=$1 AND role='teacher' AND end_on IS NULL",
            [before.classId],
          )
        ).rows[0].n,
        1,
      );
      await syncCleverConnection(db, connection.id, f.client);
      assert.deepEqual(await f.rosterIds(connection.id), after);
      f.snapshot.users = f.snapshot.users.filter((u) => u.id !== f.first);
      f.snapshot.sections[0]!.teachers = [f.second];
      await syncCleverConnection(db, connection.id, f.client);
      assert.equal(
        (await resolveProviderSession(db, request(second.token), f.resolver))
          ?.personId,
        before.first,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_enrollments WHERE class_id=$1 AND person_id=$2 AND end_on IS NULL",
            [before.classId, before.first],
          )
        ).rows[0].n,
        1,
      );
    }),
);

test(
  "sessions issued before roster import consolidate proved staff aliases on their first school request",
  enabled,
  async () =>
    fixture(async (db) => {
      const f = source(db),
        first = await f.principal(f.first),
        second = await f.principal(f.second, first.accountId);
      const connection = await f.existingConnection();
      await syncCleverConnection(db, connection.id, f.client);
      const before = await f.rosterIds(connection.id);
      assert.notEqual(before.first, before.second);
      const a = await resolveProviderSession(
        db,
        request(first.token),
        f.resolver,
      );
      const b = await resolveProviderSession(
        db,
        request(second.token),
        f.resolver,
      );
      assert.equal(a?.personId, before.first);
      assert.equal(b?.personId, before.first);
      assert.equal(a?.accountId, first.accountId);
      assert.equal(b?.accountId, first.accountId);
      assert.deepEqual(await f.rosterIds(connection.id), {
        ...before,
        second: before.first,
      });
      await syncCleverConnection(db, connection.id, f.client);
      assert.equal(
        (await resolveProviderSession(db, request(second.token), f.resolver))
          ?.personId,
        before.first,
      );
    }),
);
