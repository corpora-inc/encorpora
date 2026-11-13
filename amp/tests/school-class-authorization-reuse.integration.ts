import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { SchoolRepository } from "../src/schools/repository.js";
import {
  startSchoolClass,
  revokeClassAuthorization,
  acceptClassAuthorization,
} from "../src/schools/pilots.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";

test(
  "class signer reuse is personal, school-scoped, current and explicitly reconfirmed",
  {
    skip: !process.env.AMP_TEST_DATABASE_URL,
  },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `signer_reuse_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    const app = Fastify();
    t.after(async () => {
      await app.close();
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    await migrate(scoped.href);
    const repo = new SchoolRepository(db);
    const input = {
      requestId: randomUUID(),
      schoolName: "School A",
      className: "Math",
      timezone: "UTC",
      signerName: "Alex Teacher",
      signerTitle: "Math teacher",
      agreementVersion: AGREEMENT_VERSION,
      authorized: true,
      names: [],
    };
    const a = await startSchoolClass(repo, "fixture-teacher", input);
    const b = await startSchoolClass(repo, "fixture-teacher", {
      ...input,
      requestId: randomUUID(),
      newSchool: true,
      schoolName: "School B",
      signerName: "Alex at School B",
      signerTitle: "Science teacher",
    });
    await repo.addStaff({
      orgId: a.orgId,
      role: "teacher",
      givenName: "Co teacher",
      accountId: "fixture-co",
      classId: a.classId,
    });
    await repo.addStaff({
      orgId: a.orgId,
      role: "aide",
      givenName: "Aide",
      accountId: "fixture-aide",
      classId: a.classId,
    });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate: async (request) =>
        request.headers.authorization?.slice(7) ?? "fixture-outsider",
      services: {
        secret: "fixture-school-token-secret-long-enough",
        origin: "https://amp.example",
        mail: async () => {},
      },
    });
    const get = (accountId: string, orgId = a.orgId) =>
      app.inject({
        method: "GET",
        url: `/api/v1/school/orgs/${orgId}/class-authorization`,
        headers: { authorization: `Bearer ${accountId}` },
      });
    const first = await get("fixture-teacher");
    assert.equal(first.statusCode, 200);
    assert.deepEqual(first.json().authorization, {
      signerName: input.signerName,
      signerTitle: input.signerTitle,
      version: AGREEMENT_VERSION,
      acceptedAt: (
        await db.query(
          "SELECT accepted_at FROM amp_class_authorizations WHERE class_id=$1",
          [a.classId],
        )
      ).rows[0].accepted_at.toISOString(),
    });
    assert.equal(
      (await get("fixture-teacher", b.orgId)).json().authorization.signerName,
      "Alex at School B",
    );
    assert.deepEqual((await get("fixture-co")).json(), { authorization: null });
    assert.equal((await get("fixture-outsider")).statusCode, 404);
    assert.equal((await get("fixture-aide")).statusCode, 404);
    assert.equal((await get("fixture-co", b.orgId)).statusCode, 404);

    // Prefilling details does not authorize a new classroom or accept new terms.
    for (const changes of [
      { authorized: false },
      { agreementVersion: "obsolete" },
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/school/start",
        headers: { authorization: "Bearer fixture-teacher" },
        payload: {
          ...input,
          orgId: a.orgId,
          requestId: randomUUID(),
          ...changes,
        },
      });
      assert.ok(response.statusCode >= 400 && response.statusCode < 500);
    }
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM amp_classes WHERE org_id=$1",
          [a.orgId],
        )
      ).rows[0].n,
      1,
    );
    await db.query(
      "UPDATE amp_class_authorizations SET version='obsolete' WHERE class_id=$1",
      [a.classId],
    );
    assert.deepEqual((await get("fixture-teacher")).json(), {
      authorization: null,
    });
    await db.query(
      "UPDATE amp_class_authorizations SET version=$2 WHERE class_id=$1",
      [a.classId, AGREEMENT_VERSION],
    );
    await revokeClassAuthorization(repo, "fixture-teacher", a.classId);
    assert.deepEqual((await get("fixture-teacher")).json(), {
      authorization: null,
    });
    await acceptClassAuthorization(repo, "fixture-co", a.classId, {
      version: AGREEMENT_VERSION,
      signerName: "Other Teacher",
      signerTitle: "Teacher",
      authorized: true,
    });
    assert.deepEqual((await get("fixture-teacher")).json(), {
      authorization: null,
    });
    assert.equal(
      (await get("fixture-co")).json().authorization.signerName,
      "Other Teacher",
    );
    await db.query("UPDATE amp_classes SET archived_at=now() WHERE id=$1", [
      a.classId,
    ]);
    assert.deepEqual((await get("fixture-co")).json(), { authorization: null });
    await db.query("UPDATE amp_classes SET archived_at=NULL WHERE id=$1", [
      a.classId,
    ]);
    await db.query(
      "UPDATE amp_org_roles SET end_on=current_date WHERE person_id IN (SELECT id FROM amp_people WHERE account_id='fixture-co')",
    );
    assert.equal((await get("fixture-co")).statusCode, 404);
  },
);
