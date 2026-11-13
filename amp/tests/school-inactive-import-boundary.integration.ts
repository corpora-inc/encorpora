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
import {
  schoolAccountId,
  schoolConsentActive,
} from "../src/schools/principal.js";
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
  "inactive school records cannot be discovered or reclaimed by another school's import",
  {
    skip: !process.env.AMP_TEST_DATABASE_URL,
  },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `inactive_boundary_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    t.after(async () => {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    await migrate(scoped.href);
    const repo = new SchoolRepository(db);
    const district = await repo.createOrg(
      { kind: "district", name: "District", timezone: "UTC" },
      { version: AGREEMENT_VERSION, signerName: "Admin", signerTitle: "Admin" },
    );
    const schools = await Promise.all(
      ["A", "B"].map((name) =>
        repo.createOrg({
          kind: "school",
          name,
          timezone: "UTC",
          parentId: district.id,
        }),
      ),
    );
    const [a, b] = schools;
    for (const role of ["student", "teacher"] as const) {
      for (const bound of [true, false]) {
        await t.test(
          `${role}, ${bound ? "CSV identity" : "unclaimed identity"}`,
          async () => {
            const id = `${role}-${bound ? "bound" : "loose"}`;
            const original = csv(
              role === "student"
                ? `Name,Student ID,Class\nPrivate Learner,${id},Private Class\n`
                : `Name,Role,Email\nPrivate Teacher,teacher,${id}@example.com\n`,
            );
            const body = { source: "csv", rows: original };
            assert.equal(
              (await applyRoster(repo, keys, a!.id, body, null)).results[0]!
                .status,
              "created",
            );
            const person = (
              await db.query(
                "SELECT p.* FROM amp_people p JOIN amp_external_refs x ON x.local_id=p.id AND x.kind='person' WHERE x.tenant_id=$1 AND x.source='csv' AND x.sourced_id=$2",
                [district.id, original[0]!.sourcedId],
              )
            ).rows[0];
            // An ended roster preserves the student's record and learning history.
            await db.query(
              "UPDATE amp_org_roles SET end_on=current_date WHERE person_id=$1",
              [person.id],
            );
            await db.query(
              "UPDATE amp_enrollments SET end_on=current_date WHERE person_id=$1",
              [person.id],
            );
            if (!bound)
              await db.query(
                "DELETE FROM amp_external_refs WHERE local_id=$1 AND kind='person'",
                [person.id],
              );
            const foreign = csv(
              role === "student"
                ? `Name,Student ID,Class\nGuessed Name,${id},Other Class\n`
                : `Name,Role,Email\nGuessed Name,teacher,${id}@example.com\n`,
            );
            const attempt = { source: "csv", rows: foreign };
            assert.deepEqual(
              await planRoster(repo, b!.id, attempt),
              [
                {
                  line: foreign[0]!.line,
                  status: "held",
                  reason: "outside_school",
                },
              ],
              "preview must not reveal an inactive person's name or ID",
            );
            for (const decision of ["same", "new"]) {
              assert.equal(
                (
                  await applyRoster(
                    repo,
                    keys,
                    b!.id,
                    {
                      ...attempt,
                      resolutions: { [String(foreign[0]!.line)]: decision },
                    },
                    null,
                  )
                ).results[0]!.status,
                "held",
              );
            }
            assert.deepEqual(
              (
                await db.query("SELECT * FROM amp_people WHERE id=$1", [
                  person.id,
                ])
              ).rows[0],
              person,
            );
            assert.equal(
              (
                await db.query(
                  "SELECT 1 FROM amp_org_roles WHERE person_id=$1 AND org_id=$2 UNION ALL SELECT 1 FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id WHERE e.person_id=$1 AND c.org_id=$2",
                  [person.id, b!.id],
                )
              ).rowCount,
              0,
            );
            // The original school can restore its own historical identity.
            assert.equal(
              (await planRoster(repo, a!.id, body))[0]!.status,
              "changed",
            );
            assert.equal(
              (await applyRoster(repo, keys, a!.id, body, null)).results[0]!
                .status,
              "updated",
            );
            assert.equal(
              (await applyRoster(repo, keys, a!.id, body, null)).results[0]!
                .status,
              "unchanged",
            );
            if (role === "student") {
              assert.equal(
                await schoolConsentActive(db, schoolAccountId(person.id)),
                true,
              );
              assert.equal(
                (
                  await db.query(
                    "SELECT learner_id FROM amp_people WHERE id=$1",
                    [person.id],
                  )
                ).rows[0].learner_id,
                person.learner_id,
              );
            }
          },
        );
      }
    }
    await t.test(
      "a returning live student without classes regains sign-in eligibility",
      async () => {
        const body = {
          source: "csv",
          rows: csv("Name,Student ID\nReturning Student,returning-live\n"),
        };
        assert.equal(
          (await applyRoster(repo, keys, a!.id, body, null)).results[0]!.status,
          "created",
        );
        const person = (
          await db.query(
            "SELECT id,learner_id FROM amp_people WHERE tenant_id=$1 AND identifier='returning-live'",
            [district.id],
          )
        ).rows[0];
        await db.query(
          "UPDATE amp_org_roles SET end_on=current_date WHERE person_id=$1",
          [person.id],
        );
        assert.equal(
          await schoolConsentActive(db, schoolAccountId(person.id)),
          false,
        );
        assert.deepEqual(await planRoster(repo, a!.id, body), [
          {
            line: body.rows[0]!.line,
            status: "changed",
            changes: ["school membership"],
          },
        ]);
        assert.equal(
          (await applyRoster(repo, keys, a!.id, body, null)).results[0]!.status,
          "updated",
        );
        assert.equal(
          await schoolConsentActive(db, schoolAccountId(person.id)),
          true,
        );
        assert.equal(
          (await applyRoster(repo, keys, a!.id, body, null)).results[0]!.status,
          "unchanged",
        );
        assert.equal(
          (
            await db.query("SELECT learner_id FROM amp_people WHERE id=$1", [
              person.id,
            ])
          ).rows[0].learner_id,
          person.learner_id,
        );
      },
    );

    await t.test(
      "a removed student can return through the same class import without restoring deleted records",
      async () => {
        const klass = await repo.createClass(a!.id, {
          name: "Returning class",
        });
        const body = {
          source: "csv",
          rows: csv(
            "Name,Student ID\nReturning Student,returning-class-student\n",
          ),
        };
        const scope = { classId: klass.id };
        assert.equal(
          (await applyRoster(repo, keys, a!.id, body, null, scope)).results[0]!
            .status,
          "created",
        );
        const old = (
          await db.query(
            "SELECT id,learner_id FROM amp_people WHERE tenant_id=$1 AND identifier=$2",
            [district.id, "returning-class-student"],
          )
        ).rows[0];
        await removeStudent(repo, a!.id, old.id, null);
        assert.deepEqual(await planRoster(repo, a!.id, body, scope), [
          { line: body.rows[0]!.line, status: "new" },
        ]);
        assert.equal(
          (await applyRoster(repo, keys, a!.id, body, null, scope)).results[0]!
            .status,
          "created",
        );
        assert.equal(
          (await applyRoster(repo, keys, a!.id, body, null, scope)).results[0]!
            .status,
          "unchanged",
        );
        const current = (
          await db.query(
            "SELECT id,learner_id FROM amp_people WHERE tenant_id=$1 AND identifier=$2 AND deleted_at IS NULL",
            [district.id, "returning-class-student"],
          )
        ).rows[0];
        assert.notEqual(current.id, old.id);
        assert.notEqual(current.learner_id, old.learner_id);
        assert.equal(
          (
            await db.query(
              "SELECT given_name,deleted_at IS NOT NULL AS deleted FROM amp_people WHERE id=$1",
              [old.id],
            )
          ).rows[0].deleted,
          true,
        );
      },
    );
  },
);
