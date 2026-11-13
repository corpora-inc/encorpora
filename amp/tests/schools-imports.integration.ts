import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { SchoolRepository } from "../src/schools/repository.js";
import {
  applyRoster,
  planRoster,
  type ImportScope,
} from "../src/schools/reconcile.js";
import {
  csvRows,
  guessMapping,
  readTable,
} from "../src/schools/sources/csv.js";
import type { RosterRow } from "../src/schools/sources/rows.js";

const csv = (text: string) => {
  const table = readTable(text);
  return csvRows(table, guessMapping(table)).rows;
};

test(
  "school imports preserve identity across files, retries and scoped teacher imports",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_imports_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 6 });
    const schools = new SchoolRepository(db);
    t.after(async () => {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const school = async (name: string) => {
      const org = await schools.createOrg(
        { kind: "school", name, timezone: "UTC" },
        {
          version: AGREEMENT_VERSION,
          signerName: "Fixture Admin",
          signerTitle: "Principal",
        },
      );
      await schools.issueLicense({
        orgId: org.id,
        seats: 30,
        endsAt: new Date(Date.now() + 86_400_000 * 30).toISOString(),
      });
      return org.id;
    };
    const keys = {
      secret: "fixture-secret-fixture-secret-fixture",
      origin: "https://amp.example",
    };
    const apply = async (
      org: string,
      rows: RosterRow[],
      resolutions?: Record<string, "same" | "new">,
      scope?: ImportScope,
    ) =>
      (
        await applyRoster(
          schools,
          keys,
          org,
          { source: "csv", rows, resolutions },
          null,
          scope,
        )
      ).results;
    const plan = (org: string, rows: RosterRow[], scope?: ImportScope) =>
      planRoster(schools, org, { source: "csv", rows }, scope);
    const count = async (org: string) =>
      (
        await db.query(
          "SELECT count(*)::int AS n FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
          [org],
        )
      ).rows[0].n;

    await t.test(
      "valid staff CSV key cannot claim a student's matching name",
      async () => {
        const org = await school("Role collision school");
        await apply(
          org,
          csv("ID,Name,Class\nnoor@example.com,Noor Haddad,Math\n"),
        );
        const staff = csv(
          "Name,Role,Email\nNoor Haddad,teacher,noor@example.com\n",
        );
        assert.equal((await plan(org, staff))[0]!.reason, "ambiguous_match");
        assert.equal((await apply(org, staff))[0]!.status, "held");
        assert.equal(await count(org), 1);
      },
    );
    await t.test(
      "valid distinct CSV identities cannot reuse a roster line",
      async () => {
        const org = await school("Duplicate lines school");
        const rows = csv(
          "ID,Name,Class\nA,Ana Ruiz,Math\nB,Noor Haddad,Math\n",
        );
        rows[1]!.line = rows[0]!.line;
        await assert.rejects(plan(org, rows), {
          code: "duplicate_roster_line",
        });
        await assert.rejects(apply(org, rows), {
          code: "duplicate_roster_line",
        });
        assert.equal(await count(org), 0);
      },
    );

    await t.test("grade and row order changes keep learner IDs", async () => {
      const org = await school("Stable school");
      const first = csv(
        "Name,Grade,Class\nAna Ruiz,3,Math\nNoor Haddad,3,Math\n",
      );
      assert.deepEqual(
        (await apply(org, first)).map(({ status }) => status),
        ["created", "created"],
      );
      const before = (
        await db.query(
          "SELECT id,learner_id FROM amp_people WHERE tenant_id=$1 ORDER BY id",
          [org],
        )
      ).rows;
      const moved = csv(
        "Name,Grade,Class\nNoor Haddad,4,Math\nAna Ruiz,4,Math\n",
      );
      assert.deepEqual(
        (await plan(org, moved)).map(({ status }) => status),
        ["changed", "changed"],
      );
      assert.deepEqual(
        (await apply(org, moved)).map(({ status }) => status),
        ["updated", "updated"],
      );
      assert.deepEqual(
        (await apply(org, moved)).map(({ status }) => status),
        ["unchanged", "unchanged"],
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT id,learner_id FROM amp_people WHERE tenant_id=$1 ORDER BY id",
            [org],
          )
        ).rows,
        before,
      );
    });

    await t.test(
      "same names in separate class files require a decision and different-student retries create once",
      async () => {
        const org = await school("Names school");
        await apply(org, csv("Name,Class\nSam Lee,Class A\n"));
        const other = csv("Name,Class\nSam Lee,Class B\n");
        assert.equal((await plan(org, other))[0]!.reason, "possible_match");
        assert.equal((await apply(org, other))[0]!.status, "held");
        assert.equal(await count(org), 1);
        const results = await Promise.all([
          apply(org, other, { "2": "new" }),
          apply(org, other, { "2": "new" }),
        ]);
        assert.deepEqual(
          results
            .flat()
            .map(({ status }) => status)
            .sort(),
          ["created", "unchanged"],
        );
        assert.equal(await count(org), 2);
        assert.equal(
          (await apply(org, other, { "2": "new" }))[0]!.status,
          "unchanged",
        );
        const enrollments = (
          await db.query(
            "SELECT c.name,count(e.person_id)::int AS n FROM amp_classes c JOIN amp_enrollments e ON e.class_id=c.id WHERE c.org_id=$1 GROUP BY c.name ORDER BY c.name",
            [org],
          )
        ).rows;
        assert.deepEqual(enrollments, [
          { name: "Class A", n: 1 },
          { name: "Class B", n: 1 },
        ]);
      },
    );

    await t.test(
      "legacy CSV refs are linked only by review and remain valid",
      async () => {
        const org = await school("Legacy school");
        const rows = csv("Name,Grade,Class\nAna Ruiz,3,Math\n");
        const legacy = [{ ...rows[0]!, sourcedId: "name:ana ruiz:3:1" }];
        await apply(org, rows);
        await db.query(
          "UPDATE amp_external_refs SET sourced_id=$2 WHERE tenant_id=$1 AND kind='person'",
          [org, `${org}/${legacy[0]!.sourcedId}`],
        );
        const original = (
          await db.query(
            "SELECT id,learner_id FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
            [org],
          )
        ).rows[0];
        assert.equal((await plan(org, rows))[0]!.reason, "possible_match");
        assert.equal(
          (await apply(org, rows, { "2": "same" }))[0]!.status,
          "updated",
        );
        assert.equal(await count(org), 1);
        await assert.rejects(apply(org, legacy), /csv_identity_invalid/);
        assert.equal((await apply(org, rows))[0]!.status, "unchanged");
        assert.deepEqual(
          (
            await db.query(
              "SELECT id,learner_id FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
              [org],
            )
          ).rows[0],
          original,
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int AS n FROM amp_external_refs WHERE tenant_id=$1 AND kind='person'",
              [org],
            )
          ).rows[0].n,
          2,
        );
      },
    );

    await t.test(
      "ambiguous existing names cannot be linked by an arbitrary same-student decision",
      async () => {
        const org = await school("Ambiguous school");
        await schools.provisionStudent(org, {
          givenName: "Sam",
          familyName: "Lee",
        });
        await schools.provisionStudent(org, {
          givenName: "Sam",
          familyName: "Lee",
        });
        const row = csv("Name,Class\nSam Lee,Math\n");
        assert.deepEqual((await plan(org, row))[0], {
          line: 2,
          status: "held",
          reason: "ambiguous_match",
        });
        assert.equal(
          (await apply(org, row, { "2": "same" }))[0]!.status,
          "held",
        );
        assert.equal(await count(org), 2);
        assert.equal(
          (await apply(org, row, { "2": "new" }))[0]!.status,
          "created",
        );
        assert.equal(await count(org), 3);
      },
    );

    await t.test(
      "reused IDs require review and concurrent new-student decisions preserve old learners",
      async () => {
        const org = await school("IDs school");
        await apply(org, csv("ID,Name,Class\n7,Ana Ruiz,Math\n"));
        const row = csv("ID,Name,Class\n7,Noor Haddad,Math\n");
        assert.equal((await plan(org, row))[0]!.reason, "name_changed");
        const results = await Promise.all([
          apply(org, row, { "2": "new" }),
          apply(org, row, { "2": "new" }),
        ]);
        assert.deepEqual(
          results
            .flat()
            .map(({ status }) => status)
            .sort(),
          ["created", "unchanged"],
        );
        assert.equal(await count(org), 2);
        assert.equal(
          (await apply(org, row, { "2": "new" }))[0]!.status,
          "unchanged",
        );
        const staff = [{ ...row[0]!, role: "teacher" as const }];
        await assert.rejects(plan(org, staff), /csv_identity_invalid/);
      },
    );

    await t.test(
      "class scope forces class membership, rejects staff and hides outside-class identities",
      async () => {
        const org = await school("Teacher school");
        const own = await schools.createClass(org, { name: "My class" });
        const scope = { classId: own.id };
        const row = csv("ID,Name,Class\nname:7,Ana Ruiz,Injected class\n");
        assert.equal(
          (await apply(org, row, undefined, scope))[0]!.status,
          "created",
        );
        assert.equal((await plan(org, row, scope))[0]!.status, "unchanged");
        assert.equal(
          (await apply(org, row, undefined, scope))[0]!.status,
          "unchanged",
        );
        assert.deepEqual(
          (
            await db.query("SELECT name FROM amp_classes WHERE org_id=$1", [
              org,
            ])
          ).rows,
          [{ name: "My class" }],
        );
        await apply(org, csv("ID,Name,Class\n8,Private Student,Other class\n"));
        const outside = csv(
          "ID,Name,Class\n8,Private Student,Injected class\n",
        );
        assert.deepEqual((await plan(org, outside, scope))[0], {
          line: 2,
          status: "held",
          reason: "outside_class",
        });
        assert.equal(
          (await apply(org, outside, { "2": "new" }, scope))[0]!.status,
          "held",
        );
        const staff = csv(
          "Name,Role,Email\nTeacher,teacher,teacher@example.com\n",
        );
        await assert.rejects(apply(org, staff, undefined, scope), {
          code: "class_import_students_only",
        });
        await assert.rejects(
          apply(org, row, undefined, { classId: randomUUID() }),
          { code: "class_not_found" },
        );
        const duplicate = [row[0]!, { ...row[0]!, line: 3 }];
        await assert.rejects(apply(org, duplicate, undefined, scope), {
          code: "duplicate_roster_identity",
        });
        await assert.rejects(
          apply(
            org,
            [row[0]!, { ...row[0]!, sourcedId: "another" }],
            undefined,
            scope,
          ),
          {
            code: "csv_identity_invalid",
          },
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int AS n FROM amp_enrollments WHERE class_id=$1",
              [own.id],
            )
          ).rows[0].n,
          1,
        );
      },
    );
  },
);
