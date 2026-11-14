import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { applyRoster, planRoster } from "../src/schools/reconcile.js";
import { removeStudent } from "../src/schools/roster.js";
import { endStaff } from "../src/schools/staff.js";
import {
  csvRows,
  guessMapping,
  readTable,
} from "../src/schools/sources/csv.js";
const csv = (text: string) => {
  const table = readTable(text);
  return csvRows(table, guessMapping(table)).rows;
};
const keys = {
  secret: "fixture-secret-fixture-secret-fixture",
  origin: "https://amp.example",
};

for (const role of ["student", "teacher", "teacher without classes"] as const) {
  test(
    `R1: returning ${role} can be CSV imported after removal`,
    { skip: !process.env.AMP_TEST_DATABASE_URL },
    async (t) => {
      const url = process.env.AMP_TEST_DATABASE_URL!;
      assertTestDatabaseTarget(url);
      const schema = `repro_${randomUUID().replaceAll("-", "")}`;
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
      const school = await repo.createOrg(
        { kind: "school", name: "A", timezone: "UTC" },
        { version: AGREEMENT_VERSION, signerName: "A", signerTitle: "S" },
      );

      const rows = csv(
        role === "student"
          ? "Name,Student ID,Class\nAna Ruiz,S-1,Math\n"
          : role === "teacher"
            ? "Name,Role,Email,Class\nTeo Teach,teacher,teo@a.example,Math\n"
            : "Name,Role,Email\nTeo Teach,teacher,teo@a.example\n",
      );
      const input = { source: "csv", rows };
      assert.equal(
        (await applyRoster(repo, keys, school.id, input, null)).results[0]!
          .status,
        "created",
      );
      const old = (
        await db.query(
          "SELECT id,learner_id FROM amp_people WHERE tenant_id=$1",
          [school.id],
        )
      ).rows[0];
      if (role === "student")
        await removeStudent(repo, school.id, old.id, null);
      else await endStaff(repo, school.id, old.id, null);
      const plan = await planRoster(repo, school.id, input);
      assert.notEqual(plan[0]!.reason, "outside_school");
      if (role === "student") assert.equal(plan[0]!.status, "new");
      const back = await applyRoster(
        repo,
        keys,
        school.id,
        {
          ...input,
          resolutions: {
            [String(rows[0]!.line)]: role === "student" ? "new" : "same",
          },
        },
        null,
      );
      assert.equal(
        back.results[0]!.status,
        role === "student" ? "created" : "updated",
      );
      const active = (
        await db.query(
          `SELECT p.id,p.learner_id FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id
      WHERE r.org_id=$1 AND r.end_on IS NULL AND p.deleted_at IS NULL`,
          [school.id],
        )
      ).rows;
      assert.equal(active.length, 1);
      if (role === "student") {
        assert.notEqual(active[0].id, old.id);
        assert.notEqual(active[0].learner_id, old.learner_id);
      } else assert.equal(active[0].id, old.id);
      assert.equal(
        (await applyRoster(repo, keys, school.id, input, null)).results[0]!
          .status,
        "unchanged",
      );
    },
  );
}
