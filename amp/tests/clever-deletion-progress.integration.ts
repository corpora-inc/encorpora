// Throwaway repro: one per-student privacy deletion halts the whole district's Clever sync.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import { removeStudent } from "../src/schools/roster.js";

const D = "100000000000000000000001",
  S = "200000000000000000000001",
  A = "300000000000000000000001",
  B = "300000000000000000000002",
  NEW = "300000000000000000000003",
  T = "300000000000000000000009",
  C = "400000000000000000000001";
const user = (id: string, first: string) => ({
  id,
  district: D,
  name: { first, last: "Kid" },
  roles: { student: { school: S, schools: [S], grade: "4" } },
});
const source = () => ({
  district: { id: D, name: "District" },
  schools: [{ id: S, district: D, name: "School" }],
  users: [
    user(A, "Alice"),
    user(B, "Bob"),
    {
      id: T,
      district: D,
      name: { first: "Teach" },
      roles: { teacher: { school: S, schools: [S] } },
    },
  ],
  sections: [
    {
      id: C,
      district: D,
      school: S,
      name: "Math",
      students: [A, B],
      teachers: [T],
    },
  ],
  courses: [],
  terms: [],
});

test(
  "H2: deletion does not stop departures and new students",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `repro_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new Pool({ connectionString: scoped.href, max: 3 });
    try {
      await migrate(scoped.href);
      const repo = new SchoolRepository(db);
      const org = await repo.createOrg({
        kind: "district",
        name: "F",
        timezone: "UTC",
      });
      await repo.recordDataAgreement(org.id, {
        version: "f",
        signerName: "A",
        signerTitle: "B",
      });
      const connection = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: D,
        tenantId: org.id,
      });
      let snapshot = source();
      const client = {
        districtToken: async () => "x",
        latestEvent: async () => null,
        snapshot: async () => snapshot,
        events: async () => [],
      };
      const sync = () =>
        syncCleverConnection(db, connection.id, client, { mode: "full" });
      await sync();
      const local = async (id: string) =>
        (
          await db.query(
            "SELECT local_id FROM amp_clever_bindings WHERE connection_id=$1 AND kind='user' AND clever_id=$2",
            [connection.id, id],
          )
        ).rows[0]?.local_id as string | undefined;
      const alice = (await local(A))!,
        bob = (await local(B))!;
      const schoolId = (
        await db.query("SELECT id FROM amp_orgs WHERE parent_id=$1", [org.id])
      ).rows[0].id;

      // The school deletes Alice's data from its privacy center; Clever still shares her.
      await removeStudent(repo, schoolId, alice, null);

      // Next day at the source: Bob leaves the district, a new student arrives.
      snapshot = source();
      snapshot.users = snapshot.users.filter((u) => u.id !== B);
      snapshot.users.push(user(NEW, "Nora"));
      snapshot.sections[0]!.students = [A, NEW];

      const outcome = await sync().then(
        () => "ok",
        (e) => String(e.code ?? e.message),
      );
      const bobActive = (
        await db.query(
          "SELECT count(*)::int n FROM amp_enrollments WHERE person_id=$1 AND end_on IS NULL",
          [bob],
        )
      ).rows[0].n;
      const again = await sync().then(
        () => "ok",
        (e) => String(e.code ?? e.message),
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM amp_school_connection_tasks WHERE connection_id=$1 AND kind='deleted_people' AND status='open'",
            [connection.id],
          )
        ).rows[0].n,
        1,
      );
      const teacher = await local(T);
      await db.query("UPDATE amp_people SET deleted_at=now() WHERE id=$1", [
        teacher,
      ]);
      await sync();
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM amp_enrollments WHERE person_id=$1 AND end_on IS NULL",
            [teacher],
          )
        ).rows[0].n,
        0,
      );
      const tombstone = (
        await db.query(
          "SELECT record,archived_at FROM amp_clever_bindings WHERE connection_id=$1 AND kind='user' AND clever_id=$2",
          [connection.id, A],
        )
      ).rows[0];
      assert.deepEqual(tombstone.record.name, {});
      assert.ok(tombstone.archived_at);
      assert.equal(bobActive, 0);
      assert.ok(await local(NEW));
      assert.equal(again, "ok");
      assert.equal(
        outcome,
        "ok",
        "district sync should not be blocked by one deleted student",
      );
    } finally {
      await db.end();
      await admin.end();
    }
  },
);
