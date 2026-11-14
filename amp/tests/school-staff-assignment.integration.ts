import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { ApiError } from "../src/server/repository.js";
import { applyRoster, planRoster } from "../src/schools/reconcile.js";
import { oneRosterRows } from "../src/schools/sources/oneroster.js";
import { oneRosterFixture } from "./fixtures/oneroster.js";

test(
  "district staff invitation authorizes an existing teacher in another school before roster import",
  {
    skip: !process.env.AMP_TEST_DATABASE_URL,
  },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `staff_assignment_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new Pool({ connectionString: scoped.href });
    const app = Fastify();
    try {
      await migrate(scoped.href);
      const repo = new SchoolRepository(db);
      const district = await repo.createOrg(
        { kind: "district", name: "District", timezone: "UTC" },
        {
          version: "fixture",
          signerName: "District admin",
          signerTitle: "Admin",
        },
      );
      const schools = await Promise.all(
        ["School A", "School B"].map((name) =>
          repo.createOrg({
            kind: "school",
            name,
            timezone: "UTC",
            parentId: district.id,
          }),
        ),
      );
      const [a, b] = schools;
      const administrator = `amp|${randomUUID()}`,
        teacherAccount = `amp|${randomUUID()}`;
      await repo.addStaff({
        orgId: district.id,
        role: "admin",
        givenName: "Administrator",
        accountId: administrator,
      });
      const keys = {
        secret: "fixture-secret-fixture-secret-fixture-secret",
        origin: "https://amp.example.test",
      };
      const files = oneRosterFixture();
      files.users = files
        .users!.replace(
          "primaryOrgSourcedId,grades",
          "email,primaryOrgSourcedId,grades",
        )
        .replace("Tessa,Fixture,a,", "Tessa,Fixture,teacher@example.test,a,")
        .replace("Student,Fixture,,,a,4", "Student,Fixture,,,,a,4");
      const first = {
        source: "oneroster",
        rows: oneRosterRows(files, { schoolSourcedId: "a" }).rows,
      };
      await applyRoster(repo, keys, a!.id, first, null);
      const teacher = (
        await db.query(
          "SELECT id FROM amp_people WHERE email='teacher@example.test'",
        )
      ).rows[0].id;
      // Simulate the existing teacher having accepted their first school's invite.
      await db.query("UPDATE amp_people SET account_id=$2 WHERE id=$1", [
        teacher,
        teacherAccount,
      ]);
      const second = {
        source: "oneroster",
        rows: oneRosterRows(files, { schoolSourcedId: "b" }).rows,
      };
      const held = await planRoster(repo, b!.id, second);
      assert.equal(held[0]!.status, "held");
      assert.equal(held[0]!.reason, "outside_school");
      await registerSchoolRoutes(app, {
        pool: db,
        services: keys,
        authenticate: async (request) => {
          const value = request.headers.authorization?.replace(/^Bearer /, "");
          if (!value) throw new ApiError(401, "sign_in_required");
          return value;
        },
      });
      const invite = (account: string) =>
        app.inject({
          method: "POST",
          url: `/api/v1/school/orgs/${b!.id}/staff/invites`,
          headers: { authorization: `Bearer ${account}` },
          payload: { email: "teacher@example.test", role: "teacher" },
        });
      assert.equal((await invite(teacherAccount)).statusCode, 404);
      const invited = await invite(administrator);
      assert.equal(invited.statusCode, 201, invited.body);
      assert.equal(invited.json().personId, teacher);
      assert.equal(invited.json().linked, true);
      assert.equal(invited.json().mailed, false);
      assert.equal(
        (await applyRoster(repo, keys, b!.id, second, null)).results[0]!.status,
        "updated",
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_people WHERE email='teacher@example.test'",
          )
        ).rows[0].n,
        1,
      );
      const repeated = await invite(administrator);
      assert.equal(repeated.statusCode, 201, repeated.body);
      assert.equal(repeated.json().personId, teacher);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_org_roles WHERE person_id=$1 AND org_id=$2 AND role='teacher' AND end_on IS NULL",
            [teacher, b!.id],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      await app.close();
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
