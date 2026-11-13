import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { z } from "zod";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import {
  deleteAccount,
  previewAccountDeletion,
} from "../src/account/delete-account.js";
import { establishProviderPrincipal } from "../src/identity/provider-principals.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import {
  issueSchoolAdoption,
  acceptSchoolAdoption,
} from "../src/schools/adoption.js";
import { can, loadActor } from "../src/schools/authz.js";
import { connectCleverInstitution } from "../src/schools/clever-onboarding.js";
import type { Snapshot } from "../src/schools/clever/model.js";
import { activateClassPilot, startSchoolClass } from "../src/schools/pilots.js";
import { SchoolRepository } from "../src/schools/repository.js";

test(
  "deleting the sole Clever administrator retains an adopted school's students and pilot",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `clever_delete_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new Pool({ connectionString: scoped.href, max: 8 });
    try {
      await migrate(scoped.href);
      const repo = new SchoolRepository(db);
      for (const authority of ["expired", "demoted", "current"])
        await t.test(
          `${authority} administrator authority is not personal district ownership`,
          async () => {
            const districtId = randomUUID().replaceAll("-", "").slice(0, 24);
            const administratorId = randomUUID()
              .replaceAll("-", "")
              .slice(0, 24);
            const teacherId = randomUUID().replaceAll("-", "").slice(0, 24);
            const claims = (userId: string, roles: string[]) => ({
              environment: "sandbox" as const,
              districtId,
              userId,
              roles,
              schools: [],
            });
            const leader = await establishProviderPrincipal(
              db,
              claims(administratorId, ["district_admin"]),
              null,
            );
            const teacher = await establishProviderPrincipal(
              db,
              claims(teacherId, ["teacher"]),
              null,
            );
            const source: Snapshot = {
              district: { id: districtId, name: "Fixture district" },
              schools: [],
              users: [
                {
                  id: administratorId,
                  district: districtId,
                  name: { first: "Administrator" },
                  roles: { district_admin: {} },
                },
              ],
              sections: [],
              terms: [],
              courses: [],
            };
            const client = {
              districtToken: async () => "fixture-only",
              get: async <T>(
                path: string,
                _token: string,
                schema: z.ZodType<T>,
              ) =>
                schema.parse(
                  path.includes("/districts/")
                    ? source.district
                    : source.users[0],
                ),
              snapshot: async () => source,
              latestEvent: async () => null,
              events: async () => [],
            };
            const connected = await connectCleverInstitution(
              repo,
              {
                ...claims(administratorId, ["district_admin"]),
                accountId: leader.accountId,
              },
              {
                signerName: "Administrator Example",
                signerTitle: "District administrator",
                agreementVersion: AGREEMENT_VERSION,
                authorized: true,
                timezone: "UTC",
                importNow: false,
              },
              client,
            );
            const school = await startSchoolClass(repo, teacher.accountId, {
              requestId: randomUUID(),
              schoolName: "Teacher's existing school",
              className: "Existing class",
              timezone: "UTC",
              signerName: "Teacher Example",
              signerTitle: "Teacher",
              agreementVersion: AGREEMENT_VERSION,
              authorized: true,
              names: ["Student Example"],
            });
            await activateClassPilot(repo, teacher.accountId, school.classId);
            const student = (
              await db.query(
                "SELECT id,learner_id FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
                [school.orgId],
              )
            ).rows[0];
            const grant = await issueSchoolAdoption(db, teacher.accountId, {
              schoolId: school.orgId,
              districtId: connected.orgId,
            });
            await acceptSchoolAdoption(
              db,
              leader.accountId,
              grant.token,
              {},
              { authoritySnapshots: [source] },
            );
            if (authority === "expired")
              await db.query(
                "UPDATE amp_clever_memberships SET bootstrap_valid_until=now()-interval '1 minute' WHERE connection_id=$1 AND kind='org_role'",
                [connected.connectionId],
              );
            if (authority === "demoted")
              await establishProviderPrincipal(
                db,
                claims(administratorId, ["teacher"]),
                null,
              );
            assert.equal(
              can(await loadActor(db, leader.accountId), "students.read", {
                kind: "org",
                orgId: school.orgId,
                path: [connected.orgId, school.orgId],
              }),
              authority === "current",
            );

            const preview = await previewAccountDeletion(db, leader.accountId);
            assert.equal(
              preview.removed.some((place) => place.id === connected.orgId),
              false,
              "an institutional district is not personally owned by its sole administrator",
            );
            assert.equal(
              preview.left.some((place) => place.id === connected.orgId),
              true,
            );
            const result = await deleteAccount(db, {
              accountId: leader.accountId,
              via: "self",
              commit: true,
            });
            assert.equal(result.committed, true);
            assert.equal(
              result.removed.some((place) => place.id === connected.orgId),
              false,
            );
            assert.equal(
              (
                await db.query(
                  "SELECT 1 FROM amp_orgs WHERE id=ANY($1::uuid[])",
                  [[connected.orgId, school.orgId]],
                )
              ).rowCount,
              2,
            );
            assert.deepEqual(
              (
                await db.query(
                  "SELECT id,learner_id FROM amp_people WHERE id=$1 AND deleted_at IS NULL",
                  [student.id],
                )
              ).rows[0],
              student,
            );
            assert.equal(
              (
                await db.query(
                  "SELECT 1 FROM amp_classes WHERE id=$1 AND archived_at IS NULL",
                  [school.classId],
                )
              ).rowCount,
              1,
            );
            assert.equal(
              (
                await db.query(
                  "SELECT amp_school_pilot_until($1)>now() AS active",
                  [student.learner_id],
                )
              ).rows[0].active,
              true,
            );
            assert.equal(
              can(await loadActor(db, teacher.accountId), "students.read", {
                kind: "class",
                classId: school.classId,
                orgId: school.orgId,
                path: [connected.orgId, school.orgId],
              }),
              true,
            );
            assert.equal(
              (
                await db.query(
                  "SELECT 1 FROM amp_provider_principals WHERE account_id=$1",
                  [leader.accountId],
                )
              ).rowCount,
              0,
            );
            assert.equal(
              (
                await db.query("SELECT 1 FROM amp_people WHERE account_id=$1", [
                  leader.accountId,
                ])
              ).rowCount,
              0,
            );
          },
        );
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
