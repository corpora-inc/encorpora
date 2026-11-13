import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { z } from "zod";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { establishProviderPrincipal } from "../src/identity/provider-principals.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { schoolAdoptionAuthority } from "../src/schools/adoption.js";
import { can, loadActor } from "../src/schools/authz.js";
import { connectCleverInstitution } from "../src/schools/clever-onboarding.js";
import { resolveCleverPerson } from "../src/schools/clever/identity.js";
import type { Snapshot } from "../src/schools/clever/model.js";
import { runDueCleverSync } from "../src/schools/clever/worker.js";
import { SchoolRepository } from "../src/schools/repository.js";

const districtId = "100000000000000000000001";
const adminIds = ["200000000000000000000001", "200000000000000000000002"];
const input = {
  signerName: "Administrator Example",
  signerTitle: "District administrator",
  agreementVersion: AGREEMENT_VERSION,
  authorized: true,
  timezone: "UTC",
  importNow: false,
};
const claims = (userId: string, roles = ["district_admin"]) => ({
  environment: "sandbox" as const,
  districtId,
  userId,
  roles,
  schools: [],
});
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };

async function fixture(run: (db: Pool) => Promise<void>) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  assertTestDatabaseTarget(url);
  const schema = `bootstrap_authority_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url });
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

async function staging(db: Pool) {
  const repo = new SchoolRepository(db);
  const source: Snapshot = {
    district: { id: districtId, name: "Fixture district" },
    schools: [],
    users: adminIds.map((id) => ({
      id,
      district: districtId,
      name: { first: "Administrator" },
      roles: { district_admin: {} },
    })),
    sections: [],
    terms: [],
    courses: [],
  };
  let snapshots = 0,
    failSnapshot = false;
  const client = {
    districtToken: async () => "fixture-only",
    get: async <T>(path: string, _token: string, schema: z.ZodType<T>) =>
      schema.parse(
        path.includes("/districts/")
          ? source.district
          : source.users.find((user) => path.endsWith(user.id)),
      ),
    snapshot: async () => {
      snapshots++;
      if (failSnapshot) throw new Error("fixture_provider_unavailable");
      return source;
    },
    latestEvent: async () => null,
    events: async () => [],
  };
  const accounts: string[] = [];
  let connected!: Awaited<ReturnType<typeof connectCleverInstitution>>;
  for (const userId of adminIds) {
    const session = await establishProviderPrincipal(db, claims(userId), null);
    accounts.push(session.accountId);
    connected = await connectCleverInstitution(
      repo,
      { ...claims(userId), accountId: session.accountId },
      input,
      client,
    );
  }
  const allowed = async (accountId: string) =>
    can(await loadActor(db, accountId), "students.read", {
      kind: "org",
      orgId: connected.orgId,
      path: [connected.orgId],
    });
  const expire = async (accountId: string) =>
    db.query(
      `UPDATE amp_clever_memberships m SET bootstrap_valid_until=now()-interval '1 minute'
       FROM amp_org_roles r,amp_people p WHERE m.local_id=r.id AND m.kind='org_role'
       AND r.person_id=p.id AND p.account_id=$1 AND m.connection_id=$2`,
      [accountId, connected.connectionId],
    );
  const deadline = async (accountId: string): Promise<Date | null> =>
    (
      await db.query(
        `SELECT m.bootstrap_valid_until FROM amp_clever_memberships m
         JOIN amp_org_roles r ON r.id=m.local_id JOIN amp_people p ON p.id=r.person_id
         WHERE m.kind='org_role' AND r.role='admin' AND p.account_id=$1 AND m.connection_id=$2`,
        [accountId, connected.connectionId],
      )
    ).rows[0].bootstrap_valid_until;
  return {
    db,
    repo,
    source,
    client,
    accounts,
    connected,
    allowed,
    expire,
    deadline,
    snapshotCount: () => snapshots,
    failSnapshot: (value: boolean) => {
      failSnapshot = value;
    },
  };
}

test(
  "bootstrap administrator authority expires independently and survives neither unpause nor failed import",
  enabled,
  async () =>
    fixture(async (db) => {
      const f = await staging(db);
      const [first, second] = f.accounts;
      assert.equal(await f.allowed(first), true);
      assert.equal(await f.allowed(second), true);
      await f.expire(first);
      const expired = await f.deadline(first);
      assert.equal(await f.allowed(first), false);
      assert.equal(await f.allowed(second), true);

      await connectCleverInstitution(
        f.repo,
        { ...claims(adminIds[1]), accountId: second },
        input,
        f.client,
      );
      assert.deepEqual(
        await f.deadline(first),
        expired,
        "another administrator cannot renew this role",
      );
      assert.equal(await f.allowed(first), false);
      await runDueCleverSync(db, f.connected.connectionId, f.client);
      assert.equal(
        f.snapshotCount(),
        1,
        "paused worker stages source without importing",
      );

      await db.query(
        "UPDATE amp_clever_connections SET sync_paused=false,sync_requested_at=now() WHERE id=$1",
        [f.connected.connectionId],
      );
      assert.equal(
        await f.allowed(first),
        false,
        "requesting an import grants no authority",
      );
      f.failSnapshot(true);
      await assert.rejects(
        runDueCleverSync(db, f.connected.connectionId, f.client),
        /clever_sync_failed/,
      );
      assert.equal(f.snapshotCount(), 2);
      assert.equal(await f.allowed(first), false);
      assert.deepEqual(await f.deadline(first), expired);

      f.source.users[1].roles = { teacher: {} };
      const person = await resolveCleverPerson(db, claims(adminIds[1]));
      assert.ok(person);
      await establishProviderPrincipal(
        db,
        claims(adminIds[1], ["teacher"]),
        person,
      );
      assert.equal(
        await f.allowed(second),
        false,
        "fresh teacher OAuth invalidates cached administrator authority immediately",
      );

      f.failSnapshot(false);
      await db.query(
        "UPDATE amp_clever_connections SET next_attempt_at=NULL WHERE id=$1",
        [f.connected.connectionId],
      );
      await runDueCleverSync(db, f.connected.connectionId, f.client);
      assert.equal(
        await f.deadline(first),
        null,
        "a validated imported role replaces its bootstrap deadline",
      );
      assert.equal(await f.allowed(first), true);
      assert.equal(
        await f.allowed(second),
        false,
        "a demoted provider user cannot recover administrator access through sync",
      );
      assert.equal(
        (
          await db.query(
            "SELECT last_sync_at IS NOT NULL AS synced FROM amp_clever_connections WHERE id=$1",
            [f.connected.connectionId],
          )
        ).rows[0].synced,
        true,
      );
    }),
);

test(
  "fresh adoption proof renews only the proved administrator's finite bootstrap authority",
  enabled,
  async () =>
    fixture(async (db) => {
      const f = await staging(db);
      const [first, second] = f.accounts;
      await f.expire(first);
      await f.expire(second);
      const otherDeadline = await f.deadline(second);
      assert.equal(await f.allowed(first), false);
      assert.equal(await f.allowed(second), false);

      await schoolAdoptionAuthority(
        db,
        first,
        { districtId: f.connected.orgId },
        async (connectionId, userId) => {
          assert.equal(connectionId, f.connected.connectionId);
          return f.source.users.find((u) => u.id === userId)!;
        },
      );
      const renewed = await f.deadline(first);
      assert.ok(renewed && renewed.getTime() > Date.now());
      assert.ok(
        renewed.getTime() <= Date.now() + 15 * 60_000,
        "adoption retains a finite verification window",
      );
      assert.equal(await f.allowed(first), true);
      assert.equal(await f.allowed(second), false);
      assert.deepEqual(await f.deadline(second), otherDeadline);

      f.source.users[0].roles = { teacher: {} };
      await assert.rejects(
        schoolAdoptionAuthority(
          db,
          first,
          { districtId: f.connected.orgId },
          async (_connection, userId) =>
            f.source.users.find((u) => u.id === userId)!,
        ),
        /adoption_current_authority_required/,
      );
      const revoked = await f.deadline(first);
      assert.ok(
        revoked && revoked.getTime() <= Date.now(),
        "a successful snapshot showing demotion expires the proved role immediately",
      );
      assert.equal(await f.allowed(first), false);
      assert.deepEqual(await f.deadline(second), otherDeadline);

      f.source.users[0].roles = { district_admin: {} };
      await schoolAdoptionAuthority(
        db,
        first,
        { districtId: f.connected.orgId },
        async (_connection, userId) =>
          f.source.users.find((u) => u.id === userId)!,
      );
      const beforeOutage = await f.deadline(first);
      assert.equal(await f.allowed(first), true);
      await assert.rejects(
        schoolAdoptionAuthority(
          db,
          first,
          { districtId: f.connected.orgId },
          async () => {
            throw new Error("fixture_provider_unavailable");
          },
        ),
        /fixture_provider_unavailable/,
      );
      assert.deepEqual(
        await f.deadline(first),
        beforeOutage,
        "a provider outage neither renews nor expires existing verified authority",
      );
      assert.equal(await f.allowed(first), true);
      assert.deepEqual(await f.deadline(second), otherDeadline);
    }),
);
