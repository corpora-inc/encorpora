import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { PostgresRepository } from "../src/server/repository.js";
import {
  startSchoolClass,
  activateClassPilot,
  classPilotState,
  requestSchoolPurchase as purchase,
  buyerHandoff,
  extendTeacherPilot,
} from "../src/schools/pilots.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { schoolPilotAccess } from "../src/schools/pilot-access.js";
import {
  schoolConsentActive,
  schoolAccountId,
} from "../src/schools/principal.js";
import { loadActor, can } from "../src/schools/authz.js";
import { finishSetup } from "../src/schools/setup.js";

test(
  "school self-service: scoped authority, durable teacher pilot and paid continuation",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!,
      schema = `pilots_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool,
      repo = new SchoolRepository(db);
    try {
      await migrate(scoped.href);
      const teacher = "fixture-teacher",
        other = "fixture-other";
      const input = {
        requestId: randomUUID(),
        schoolName: "Small school",
        className: "Room 1",
        timezone: "America/New_York",
        signerName: "Teacher Example",
        signerTitle: "Teacher",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
        names: ["Ada Example", "Bea Example"],
        gradeLevel: 4,
      };
      const [created, retried] = await Promise.all([
        startSchoolClass(repo, teacher, input),
        startSchoolClass(repo, teacher, input),
      ]);
      assert.deepEqual(retried, created);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_people WHERE learner_id IS NOT NULL",
          )
        ).rows[0].n,
        2,
      );
      const org = await repo.org(db as never, created.orgId);
      const actor = await loadActor(db, teacher);
      assert.equal(
        can(actor, "staff.manage", {
          kind: "org",
          orgId: org.id,
          path: org.path,
        }),
        false,
      );
      assert.equal(
        can(actor, "students.add", {
          kind: "class",
          orgId: org.id,
          path: org.path,
          classId: created.classId,
        }),
        true,
      );
      assert.equal(
        (await classPilotState(db, created.classId)).status,
        "ready",
      );
      await assert.rejects(
        activateClassPilot(repo, other, created.classId),
        /not_found/,
      );
      const students = (
        await db.query(
          "SELECT id,learner_id FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL ORDER BY id",
          [org.id],
        )
      ).rows;
      const first = students[0]!;
      assert.equal(
        await schoolConsentActive(db, schoolAccountId(first.id)),
        true,
      );
      assert.equal(
        (await schoolPilotAccess(db, first.learner_id)).active,
        false,
      );
      await learning.transaction(
        schoolAccountId(first.id),
        first.learner_id,
        async (tx) => {
          assert.equal(await tx.hasAccess(), false);
          assert.equal((await tx.freeAllowance()).problems.remaining, 0);
          assert.equal((await tx.freeAllowance()).workbooks.available, 0);
        },
      );
      const activation = await activateClassPilot(
        repo,
        teacher,
        created.classId,
      );
      assert.equal(activation.status, "active");
      assert.deepEqual(
        await activateClassPilot(repo, teacher, created.classId),
        activation,
      );
      assert.equal(
        Date.parse(activation.endsAt!) - Date.parse(activation.startedAt!),
        30 * 86400000,
      );
      assert.equal(
        Date.parse(activation.graceEndsAt!) - Date.parse(activation.endsAt!),
        7 * 86400000,
      );
      assert.equal(
        (await schoolPilotAccess(db, first.learner_id)).active,
        true,
      );
      await learning.transaction(
        schoolAccountId(first.id),
        first.learner_id,
        async (tx) => assert.equal(await tx.hasAccess(), true),
      );
      // Classroom authority does not authorize another class at the same school.
      const unapproved = await repo.createClass(org.id, {
        name: "Unapproved",
        gradingKind: "year",
      });
      await assert.rejects(
        repo.provisionStudent(org.id, {
          givenName: "No authority",
          classId: unapproved.id,
        }),
        /agreement_required/,
      );
      const second = await startSchoolClass(repo, teacher, {
        ...input,
        requestId: randomUUID(),
        orgId: org.id,
        className: "Room 2",
        names: ["Cora Example"],
      });
      assert.deepEqual(
        (await activateClassPilot(repo, teacher, second.classId)).endsAt,
        activation.endsAt,
      );
      const co = await repo.addStaff({
        orgId: org.id,
        givenName: "Co teacher",
        accountId: other,
        role: "teacher",
        classId: created.classId,
      });
      assert.ok(co.personId);
      assert.deepEqual(
        await activateClassPilot(repo, other, created.classId),
        activation,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM amp_teacher_pilots"))
          .rows[0].n,
        1,
      );
      await db.query(
        "UPDATE amp_teacher_pilots SET started_at=now()-interval '31 days',ends_at=now()-interval '1 day',grace_ends_at=now()+interval '6 days'",
      );
      assert.equal(
        (await classPilotState(db, created.classId)).status,
        "grace",
      );
      assert.equal(
        (await schoolPilotAccess(db, first.learner_id)).active,
        true,
      );
      await db.query(
        "UPDATE amp_teacher_pilots SET started_at=now()-interval '38 days',ends_at=now()-interval '8 days',grace_ends_at=now()-interval '1 day'",
      );
      assert.equal(
        (await classPilotState(db, created.classId)).status,
        "expired",
      );
      assert.equal(
        (await schoolPilotAccess(db, first.learner_id)).active,
        false,
      );
      assert.equal(
        await schoolConsentActive(db, schoolAccountId(first.id)),
        true,
      );
      // A quote and its share link confer no access or administrator role.
      const purchase = await requestSchoolPurchase(repo, teacher, {
        orgId: org.id,
        classIds: [created.classId, second.classId],
        seats: 3,
      });
      const handoff = await buyerHandoff(db, purchase.token);
      assert.equal(handoff.students, 3);
      assert.equal(handoff.classCount, 2);
      assert.ok(!JSON.stringify(handoff).includes("Ada"));
      assert.equal(
        (await schoolPilotAccess(db, first.learner_id)).active,
        false,
      );
      await assert.rejects(
        requestSchoolPurchase(repo, "outsider", {
          orgId: org.id,
          classIds: [created.classId],
          seats: 2,
        }),
        /not_found/,
      );
      // Paid selection counts each learner once, including a learner in two classes.
      await repo.transaction(async (client) =>
        repo.enroll(client, second.classId, first.id, "student", "2020-01-01"),
      );
      const paid = await repo.issueLicense({
        orgId: org.id,
        classIds: [created.classId],
        seats: 2,
        endsAt: new Date(Date.now() + 86400000 * 365).toISOString(),
        reference: "Fixture purchase",
      });
      assert.equal(paid.assigned, 2);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_seats WHERE released_at IS NULL",
          )
        ).rows[0].n,
        2,
      );
      await learning.transaction(
        schoolAccountId(first.id),
        first.learner_id,
        async (tx) => assert.equal(await tx.hasAccess(), true),
      );
      const third = (
        await db.query(
          "SELECT learner_id FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL AND id<>ALL($2::uuid[])",
          [org.id, students.map((s) => s.id)],
        )
      ).rows[0];
      assert.equal(
        (await schoolPilotAccess(db, third.learner_id)).active,
        false,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_grants WHERE learner_id=$1",
            [third.learner_id],
          )
        ).rows[0].n,
        0,
      );
      const pilot = (
        await db.query(
          "SELECT id FROM amp_teacher_pilots WHERE account_id=$1",
          [teacher],
        )
      ).rows[0];
      await extendTeacherPilot(repo, {
        pilotId: pilot.id,
        until: new Date(Date.now() + 86400000).toISOString(),
        reason: "Purchase order processing",
        operatorReference: "Fixture operator",
      });
      assert.equal(
        (await schoolPilotAccess(db, third.learner_id)).active,
        true,
      );
      // A later institution withdrawal supersedes classroom authorization.
      await repo.recordDataAgreement(org.id, {
        version: "fixture",
        signerName: "Administrator",
        signerTitle: "Head",
      });
      await db.query(
        "UPDATE amp_data_agreements SET ended_at=now() WHERE org_id=$1",
        [org.id],
      );
      assert.equal(
        await schoolConsentActive(db, schoolAccountId(first.id)),
        false,
      );
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);

test(
  "setup finalization retries never duplicate its roster",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const schema = `setup_retry_${randomUUID().replaceAll("-", "")}`,
      url = process.env.AMP_TEST_DATABASE_URL!;
    const admin = new Pool({ connectionString: url, max: 1 }),
      scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new Pool({ connectionString: scoped.href }),
      repo = new SchoolRepository(db);
    try {
      await migrate(scoped.href);
      const org = await repo.createOrg(
        { kind: "school", name: "Setup school", timezone: "UTC" },
        { version: "fixture", signerName: "Admin", signerTitle: "Head" },
      );
      await db.query(
        "UPDATE amp_orgs SET solo=true,setup_pending=true WHERE id=$1",
        [org.id],
      );
      const input = {
        className: "First class",
        names: ["One Example", "Two Example"],
      };
      const results = await Promise.all([
        finishSetup(repo, org.id, input, null),
        finishSetup(repo, org.id, input, null),
      ]);
      assert.deepEqual(results[0], results[1]);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_people WHERE learner_id IS NOT NULL",
          )
        ).rows[0].n,
        2,
      );
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);

function requestSchoolPurchase(
  ...args: Parameters<typeof purchase> extends [
    infer R,
    infer A,
    infer B,
    string,
  ]
    ? [R, A, B]
    : never
) {
  return purchase(...args, "fixture-school-token-secret-long-enough");
}
