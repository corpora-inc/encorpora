import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { oneRosterRows } from "../src/schools/sources/oneroster.js";
import { oneRosterFixture } from "./fixtures/oneroster.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { applyRoster, planRoster } from "../src/schools/reconcile.js";
import { activeToday } from "../src/schools/principal.js";

test(
  "OneRoster imports preserve scoped dated memberships and all calendars across schools and retries",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!,
      schema = `oneroster_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const db = new Pool({ connectionString: scoped.href });
    try {
      await migrate(scoped.href);
      const repo = new SchoolRepository(db);
      const district = await repo.createOrg(
        { kind: "district", name: "Fixture district", timezone: "UTC" },
        {
          version: "fixture",
          signerName: "Fixture admin",
          signerTitle: "Admin",
        },
      );
      const a = await repo.createOrg({
        kind: "school",
        name: "Fixture A",
        parentId: district.id,
        timezone: "UTC",
      });
      const b = await repo.createOrg({
        kind: "school",
        name: "Fixture B",
        parentId: district.id,
        timezone: "UTC",
      });
      const keys = {
        secret: "fixture-secret-fixture-secret",
        origin: "https://amp.example.test",
      };
      const files = oneRosterFixture();
      const rows = oneRosterRows(files, { schoolSourcedId: "a" }).rows;
      const input = { source: "oneroster", rows };
      assert.deepEqual(
        (await applyRoster(repo, keys, a.id, input, null)).results.map(
          (r) => r.status,
        ),
        ["created", "created"],
      );
      const original = (
        await db.query("SELECT id,learner_id FROM amp_people ORDER BY id")
      ).rows;
      const teacher = (
        await db.query(
          "SELECT local_id FROM amp_external_refs WHERE kind='person' AND sourced_id='t'",
        )
      ).rows[0].local_id;
      assert.deepEqual(
        (
          await db.query(
            `SELECT x.sourced_id,e.role,e.begin_on::text,e.end_on::text FROM amp_enrollments e JOIN amp_external_refs x ON x.local_id=e.class_id AND x.kind='class' WHERE e.person_id=$1 ORDER BY x.sourced_id`,
            [teacher],
          )
        ).rows,
        [
          {
            sourced_id: "k1",
            role: "teacher",
            begin_on: "2020-01-01",
            end_on: "2099-01-01",
          },
          {
            sourced_id: "k2",
            role: "aide",
            begin_on: "2020-01-01",
            end_on: "2099-01-01",
          },
        ],
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_org_roles WHERE role='admin'",
          )
        ).rows[0].n,
        0,
      );
      const future = (
        await db.query(
          "SELECT local_id FROM amp_external_refs WHERE kind='person' AND sourced_id='u'",
        )
      ).rows[0].local_id;
      assert.equal(
        (
          await db.query(
            `SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id WHERE person_id=$1 AND ${activeToday("r", "o")}`,
            [future],
          )
        ).rowCount,
        0,
      );
      const klass = (
        await db.query(
          "SELECT c.id,c.session_id FROM amp_classes c JOIN amp_external_refs x ON x.local_id=c.id AND x.kind='class' WHERE x.sourced_id='k1'",
        )
      ).rows[0];
      assert.equal(
        (
          await db.query("SELECT kind FROM amp_academic_sessions WHERE id=$1", [
            klass.session_id,
          ])
        ).rows[0].kind,
        "year",
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_academic_sessions WHERE org_id=$1",
            [a.id],
          )
        ).rows[0].n,
        3,
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT metadata->'termSourcedIds' AS ids FROM amp_external_refs WHERE kind='class' AND sourced_id='k1'",
          )
        ).rows[0].ids,
        ["s1", "s2"],
      );
      assert.deepEqual(
        (await planRoster(repo, a.id, input)).map((r) => r.status),
        ["unchanged", "unchanged"],
      );
      assert.deepEqual(
        (await applyRoster(repo, keys, a.id, input, null)).results.map(
          (r) => r.status,
        ),
        ["unchanged", "unchanged"],
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM amp_enrollments"))
          .rows[0].n,
        3,
      );
      const second = {
        source: "oneroster",
        rows: oneRosterRows(files, { schoolSourcedId: "b" }).rows,
      };
      assert.equal(
        (await applyRoster(repo, keys, b.id, second, null)).results[0]!.status,
        "updated",
      );
      assert.deepEqual(
        (await db.query("SELECT id,learner_id FROM amp_people ORDER BY id"))
          .rows,
        original,
      );
      const meta = (
        await db.query(
          "SELECT metadata FROM amp_external_refs WHERE kind='person' AND sourced_id='t'",
        )
      ).rows[0].metadata;
      assert.ok(meta.schoolImports[a.id]);
      assert.ok(meta.schoolImports[b.id]);
      assert.ok(!JSON.stringify(meta).includes("Tessa"));
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_academic_sessions WHERE org_id=$1",
            [b.id],
          )
        ).rows[0].n,
        3,
      );
      // Membership-only changes appear in preview and change the source-owned
      // interval, leaving identity, other-school roles and other-class dates alone.
      files.enrollments = files.enrollments!.replace(
        "et,t,k1,a,teacher,2020-01-01,2099-01-01",
        "et,t,k1,a,teacher,2020-01-01,2030-01-01",
      );
      const changed = {
        source: "oneroster",
        rows: oneRosterRows(files, { schoolSourcedId: "a" }).rows,
      };
      assert.equal(
        (await planRoster(repo, a.id, changed))[0]!.status,
        "changed",
      );
      assert.equal(
        (await applyRoster(repo, keys, a.id, changed, null)).results[0]!.status,
        "updated",
      );
      assert.equal(
        (
          await db.query(
            "SELECT end_on::text FROM amp_enrollments WHERE person_id=$1 AND class_id=$2",
            [teacher, klass.id],
          )
        ).rows[0].end_on,
        "2030-01-01",
      );
      // Every class/term edit is visible in the preview, even when the person's
      // source identity and dated memberships have not changed.
      const calendarEdit = structuredClone(changed);
      calendarEdit.rows[0]!.classes[0]!.sessions![0]!.name = "Revised term";
      assert.equal(
        (await planRoster(repo, a.id, calendarEdit))[0]!.status,
        "changed",
      );
      // Two open class memberships need one union of school teaching dates;
      // preserving the two source begin dates must not hit the open-role index.
      const c = await repo.createOrg({
        kind: "school",
        name: "Fixture C",
        parentId: district.id,
        timezone: "UTC",
      });
      const derived = oneRosterFixture();
      derived.classes += "k4,Derived first,c,c,s1\nk5,Derived second,c,c,s2\n";
      derived.enrollments +=
        "e4,t,k4,c,teacher,2021-01-01,\ne5,t,k5,c,teacher,2022-01-01,\n";
      const derivedInput = {
        source: "oneroster",
        rows: oneRosterRows(derived, { schoolSourcedId: "c" }).rows,
      };
      assert.equal(derivedInput.rows.length, 1);
      assert.equal(
        (await applyRoster(repo, keys, c.id, derivedInput, null)).results[0]!
          .status,
        "updated",
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT role,begin_on::text,end_on::text FROM amp_org_roles WHERE person_id=$1 AND org_id=$2",
            [teacher, c.id],
          )
        ).rows,
        [{ role: "teacher", begin_on: "2021-01-01", end_on: null }],
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT e.begin_on::text,e.end_on::text FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id WHERE e.person_id=$1 AND c.org_id=$2 ORDER BY e.begin_on",
            [teacher, c.id],
          )
        ).rows,
        [
          { begin_on: "2021-01-01", end_on: null },
          { begin_on: "2022-01-01", end_on: null },
        ],
      );
      assert.equal(
        (await applyRoster(repo, keys, c.id, derivedInput, null)).results[0]!
          .status,
        "unchanged",
      );
      const target = await repo.createClass(a.id, {
        name: "Teacher target",
        gradingKind: "year",
      });
      await assert.rejects(
        applyRoster(repo, keys, a.id, input, null, { classId: target.id }),
        /class_import_students_only/,
      );
      const student = { source: "oneroster", rows: [rows[1]!] };
      assert.equal(
        (await planRoster(repo, a.id, student, { classId: target.id }))[0]!
          .status,
        "held",
      );
      assert.equal(
        (
          await applyRoster(repo, keys, a.id, student, null, {
            classId: target.id,
          })
        ).results[0]!.status,
        "held",
      );
      assert.equal(
        (
          await db.query("SELECT 1 FROM amp_enrollments WHERE class_id=$1", [
            target.id,
          ])
        ).rowCount,
        0,
      );
      const classroomRow = structuredClone(rows[1]!);
      classroomRow.sourcedId = "classroom-student";
      classroomRow.givenName = "Classroom";
      classroomRow.familyName = "Only";
      const classroomInput = { source: "oneroster", rows: [classroomRow] };
      assert.equal(
        (
          await applyRoster(repo, keys, a.id, classroomInput, null, {
            classId: target.id,
          })
        ).results[0]!.status,
        "created",
      );
      let classroomBinding = (
        await db.query(
          "SELECT local_id,metadata FROM amp_external_refs WHERE kind='person' AND sourced_id='classroom-student'",
        )
      ).rows[0];
      assert.ok(classroomBinding.metadata.classImports[target.id]);
      assert.equal(classroomBinding.metadata.schoolImports, undefined);
      assert.equal(
        (
          await db.query(
            "SELECT 1 FROM amp_enrollments WHERE person_id=$1 AND class_id=$2",
            [classroomBinding.local_id, klass.id],
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (await planRoster(repo, a.id, classroomInput))[0]!.status,
        "changed",
      );
      assert.equal(
        (await applyRoster(repo, keys, a.id, classroomInput, null)).results[0]!
          .status,
        "updated",
      );
      classroomBinding = (
        await db.query(
          "SELECT local_id,metadata FROM amp_external_refs WHERE kind='person' AND sourced_id='classroom-student'",
        )
      ).rows[0];
      assert.ok(classroomBinding.metadata.classImports[target.id]);
      assert.ok(classroomBinding.metadata.schoolImports[a.id]);
      assert.equal(
        (
          await db.query(
            "SELECT 1 FROM amp_enrollments WHERE person_id=$1 AND class_id=$2 AND begin_on='2999-01-01'",
            [classroomBinding.local_id, klass.id],
          )
        ).rowCount,
        1,
      );
      const forged = structuredClone(student);
      forged.rows[0]!.sourceEvidence!.enrollments[0]!.role = "teacher";
      await assert.rejects(
        planRoster(repo, a.id, forged, { classId: target.id }),
        /source_identity_role_conflict/,
      );
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
