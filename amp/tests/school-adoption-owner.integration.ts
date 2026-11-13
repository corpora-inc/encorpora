// Starting a class must not let an invited teacher transfer its entire school.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { startSchoolClass } from "../src/schools/pilots.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import {
  issueSchoolAdoption,
  acceptSchoolAdoption,
} from "../src/schools/adoption.js";
import { loadActor, can } from "../src/schools/authz.js";

test(
  "H1: invited teacher cannot transfer an administrator-run school",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `repro_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new Pool({ connectionString: scoped.href, max: 3 });
    try {
      await migrate(scoped.href);
      const repo = new SchoolRepository(db);
      const agreement = {
        version: "fixture",
        signerName: "A",
        signerTitle: "Principal",
      };
      const school = await repo.createOrg(
        { kind: "school", name: "Real School", timezone: "America/New_York" },
        agreement,
      );
      const adminAccount = `amp|${randomUUID()}`,
        teacherAccount = `amp|${randomUUID()}`,
        districtAccount = `amp|${randomUUID()}`;
      await repo.addStaff({
        orgId: school.id,
        role: "admin",
        givenName: "Principal",
        accountId: adminAccount,
      });
      await repo.addStaff({
        orgId: school.id,
        role: "teacher",
        givenName: "Teacher",
        accountId: teacherAccount,
      });
      // The administrator's roster: students not yet in any class.
      await repo.provisionStudent(school.id, {
        givenName: "Unclassed",
        gradeLevel: 3,
      });
      await db.query(
        "INSERT INTO amp_provider_principals(account_id) VALUES($1)",
        [teacherAccount],
      );
      await startSchoolClass(repo, teacherAccount, {
        requestId: randomUUID(),
        schoolName: "ignored",
        orgId: school.id,
        className: "Teacher Class",
        timezone: "America/New_York",
        signerName: "Teacher",
        signerTitle: "Teacher",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
        names: ["Kid One"],
      });
      const district = await repo.createOrg(
        {
          kind: "district",
          name: "Other District",
          timezone: "America/New_York",
        },
        agreement,
      );
      await repo.addStaff({
        orgId: district.id,
        role: "admin",
        givenName: "D",
        accountId: districtAccount,
      });

      await assert.rejects(
        issueSchoolAdoption(db, teacherAccount, {
          schoolId: school.id,
          districtId: district.id,
        }),
        /adoption_source_authority_required/,
      );
      const issued = await issueSchoolAdoption(db, adminAccount, {
        schoolId: school.id,
        districtId: district.id,
      });
      assert.ok(issued.token);

      const solo = await startSchoolClass(repo, "solo-owner", {
        requestId: randomUUID(),
        schoolName: "Solo School",
        className: "Solo Class",
        timezone: "UTC",
        signerName: "Solo Teacher",
        signerTitle: "Teacher",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
        names: ["Solo Student"],
      });
      const approve = () =>
        issueSchoolAdoption(db, "solo-owner", {
          schoolId: solo.orgId,
          districtId: district.id,
        });
      assert.ok((await approve()).token);
      await repo.recordDataAgreement(solo.orgId, agreement);
      const unclassed = await repo.provisionStudent(solo.orgId, {
        givenName: "Unclassed",
        gradeLevel: 3,
      });
      await assert.rejects(approve(), /adoption_source_authority_required/);
      await db.query("UPDATE amp_people SET deleted_at=now() WHERE id=$1", [
        unclassed.personId,
      ]);
      await repo.addStaff({
        orgId: solo.orgId,
        role: "viewer",
        givenName: "Other Staff",
        accountId: "other-staff",
      });
      await assert.rejects(approve(), /adoption_source_authority_required/);
    } finally {
      await db.end();
      await admin.end(); // schema left for the scratch-database drop script
    }
  },
);
