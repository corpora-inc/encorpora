import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { loadActor } from "../src/schools/authz.js";
import { readPlaces } from "../src/schools/places.js";
import { SchoolRepository } from "../src/schools/repository.js";

/** The place switcher's one read (docs/architecture/spaces.md): every place
 * an account works, with its role, bounded, and nothing it can't open. */
test(
  "places: roles, taught and aided classes, a district's schools, bounded",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `places_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    const repo = new SchoolRepository(db);
    t.after(async () => {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const tz = "America/New_York";
    const district = await repo.createOrg({
      kind: "district",
      name: "Lake District",
      timezone: tz,
    });
    const cedar = await repo.createOrg({
      kind: "school",
      name: "Cedar Elementary",
      parentId: district.id,
    });
    const alder = await repo.createOrg({
      kind: "school",
      name: "Alder Grove",
      timezone: tz,
    });
    const elsewhere = await repo.createOrg({
      kind: "school",
      name: "Elsewhere",
      timezone: tz,
    });
    const math4 = await repo.createClass(alder.id, { name: "Grade 4 Math" });
    const math5 = await repo.createClass(alder.id, { name: "Grade 5 Math" });
    const math6 = await repo.createClass(alder.id, { name: "Grade 6 Math" });
    await repo.createClass(elsewhere.id, { name: "Not theirs" });
    const account = "amp|places-power";
    await repo.addStaff({
      orgId: alder.id,
      role: "teacher",
      givenName: "Jo",
      accountId: account,
      classId: math4.id,
    });
    await repo.addStaff({
      orgId: alder.id,
      role: "aide",
      givenName: "Jo",
      accountId: account,
      classId: math5.id,
    });
    await repo.addStaff({
      orgId: district.id,
      role: "viewer",
      givenName: "Jo",
      accountId: account,
    });

    const places = await readPlaces(repo, await loadActor(db, account));
    assert.deepEqual(
      places.orgs.map((org) => [org.name, org.roles]),
      [
        ["Alder Grove", ["aide", "teacher"]],
        ["Lake District", ["viewer"]],
      ],
    );
    assert.deepEqual(
      places.classes.map((klass) => [klass.name, klass.role]),
      [
        ["Grade 4 Math", "teacher"],
        ["Grade 5 Math", "aide"],
      ],
    );
    // Grade 6 is Alder Grove's, but not theirs to list as a place.
    assert.ok(!places.classes.some((klass) => klass.id === math6.id));
    // A viewer of the district reads its schools.
    assert.deepEqual(
      places.schools.map((school) => [school.name, school.parentId]),
      [["Cedar Elementary", district.id]],
    );
    assert.ok(!places.schools.some((school) => school.id === cedar.parentId));
    assert.equal(places.more, false);

    // Bounded: a limit cuts each list and says so.
    const cut = await readPlaces(repo, await loadActor(db, account), 1);
    assert.equal(cut.orgs.length, 1);
    assert.equal(cut.classes.length, 1);
    assert.equal(cut.more, true);

    // A role that ended is gone on the next read.
    await db.query("UPDATE amp_org_roles SET end_on=begin_on WHERE org_id=$1", [
      district.id,
    ]);
    const after = await readPlaces(repo, await loadActor(db, account));
    assert.deepEqual(
      after.orgs.map((org) => org.name),
      ["Alder Grove"],
    );
    assert.deepEqual(after.schools, []);

    // A provider-owned admin role whose connection ended: `can` refuses it,
    // so the switcher never lists it.
    await repo.addStaff({
      orgId: elsewhere.id,
      role: "admin",
      givenName: "Jo",
      accountId: account,
    });
    assert.ok(
      (await readPlaces(repo, await loadActor(db, account))).orgs.some(
        (org) => org.id === elsewhere.id,
      ),
    );
    const connection = randomUUID();
    const run = randomUUID();
    await db.query(
      `INSERT INTO amp_clever_connections(id,environment,district_id,tenant_id,status)
       VALUES($1,'sandbox','0123456789abcdef01234567',$2,'disconnected')`,
      [connection, elsewhere.id],
    );
    await db.query(
      `INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status) VALUES($1,$2,'full','succeeded')`,
      [run, connection],
    );
    const role = (
      await db.query(
        "SELECT id FROM amp_org_roles WHERE org_id=$1 AND role='admin'",
        [elsewhere.id],
      )
    ).rows[0].id;
    await db.query(
      `INSERT INTO amp_clever_memberships(connection_id,kind,source_key,local_id,owned,last_seen_run_id)
       VALUES($1,'org_role','admin-1',$2,true,$3)`,
      [connection, role, run],
    );
    const revoked = await readPlaces(repo, await loadActor(db, account));
    assert.ok(!revoked.orgs.some((org) => org.id === elsewhere.id));

    // Nobody's places: an account with no role reads none.
    assert.deepEqual(
      await readPlaces(repo, await loadActor(db, "amp|stranger")),
      { orgs: [], schools: [], classes: [], more: false },
    );
  },
);
