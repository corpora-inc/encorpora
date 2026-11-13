// Regression: a school-B roster import can attach people to school A's class.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { applyRoster, planRoster } from "../src/schools/reconcile.js";
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

test(
  "crafted CSV class key crosses schools",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
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
      await admin.end();
    });
    const district = await repo.createOrg(
      { kind: "district", name: "D", timezone: "UTC" },
      { version: AGREEMENT_VERSION, signerName: "A", signerTitle: "S" },
    );
    const a = await repo.createOrg({
      kind: "school",
      name: "A",
      timezone: "UTC",
      parentId: district.id,
    });
    const b = await repo.createOrg({
      kind: "school",
      name: "B",
      timezone: "UTC",
      parentId: district.id,
    });
    // School A imports its roster with a Math class.
    await applyRoster(
      repo,
      keys,
      a.id,
      { source: "csv", rows: csv("Name,Class\nAna Ruiz,Math\n") },
      null,
    );
    const aMath = (
      await db.query("SELECT id FROM amp_classes WHERE org_id=$1", [a.id])
    ).rows[0].id;
    // School B imports its own teacher, then re-sends the row naming A's class key.
    const own = csv(
      "Name,Role,Email,Class\nBea Admin,teacher,bea@b.example,Science\n",
    );
    await applyRoster(repo, keys, b.id, { source: "csv", rows: own }, null);
    const crafted = own.map((row) => ({
      ...row,
      classes: [
        { sourcedId: `${a.id}/name:math`, name: "Math", courseBands: [] },
      ],
    }));
    await assert.rejects(
      applyRoster(repo, keys, b.id, { source: "csv", rows: crafted }, null),
      /csv_identity_invalid/,
    );
    const source = csv(
      "Name,Student ID,Class\nPrivate Student,private-1,Math\n",
    );
    await applyRoster(repo, keys, a.id, { source: "csv", rows: source }, null);
    const foreign = csv(
      "Name,Student ID,Class\nGuessed Name,private-1,Science\n",
    );
    assert.deepEqual(
      await planRoster(repo, b.id, { source: "csv", rows: foreign }),
      [{ line: 2, status: "held", reason: "outside_school" }],
    );
    for (const decision of ["same", "new"])
      assert.equal(
        (
          await applyRoster(
            repo,
            keys,
            b.id,
            { source: "csv", rows: foreign, resolutions: { "2": decision } },
            null,
          )
        ).results[0]!.status,
        "held",
      );

    const one = await repo.createClass(b.id, { name: "Same Name" }),
      two = await repo.createClass(b.id, { name: "Same Name" });
    const names = csv("Name\nCommon Name\n");
    for (const classId of [one.id, two.id]) {
      const scoped = { classId };
      assert.equal(
        (
          await applyRoster(
            repo,
            keys,
            b.id,
            { source: "csv", rows: names },
            null,
            scoped,
          )
        ).results[0]!.status,
        "created",
      );
      assert.equal(
        (
          await applyRoster(
            repo,
            keys,
            b.id,
            { source: "csv", rows: names },
            null,
            scoped,
          )
        ).results[0]!.status,
        "unchanged",
      );
    }
    assert.equal(
      (
        await db.query(
          "SELECT count(DISTINCT person_id)::int n FROM amp_enrollments WHERE class_id=ANY($1::uuid[]) AND role='student'",
          [[one.id, two.id]],
        )
      ).rows[0].n,
      2,
    );

    const teaches = (
      await db.query(
        `SELECT p.email,c.org_id=$2 AS in_school_a FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
     JOIN amp_classes c ON c.id=e.class_id WHERE e.class_id=$1 AND e.role='teacher' AND e.end_on IS NULL`,
        [aMath, a.id],
      )
    ).rows;
    assert.equal(
      teaches.length,
      0,
      "a school-B import must not enroll staff in school A's class",
    );
  },
);
