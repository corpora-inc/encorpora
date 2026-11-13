import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import {
  buyerHandoff,
  startSchoolClass,
  activateClassPilot,
  classPurchaseRequest,
  revokeClassAuthorization,
  classPilotState,
  requestSchoolPurchase as purchase,
} from "../src/schools/pilots.js";
import Fastify from "fastify";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
const input = () => ({
  requestId: randomUUID(),
  schoolName: "Fixture School",
  className: "Math",
  timezone: "UTC",
  signerName: "Fixture Teacher",
  signerTitle: "Teacher",
  agreementVersion: AGREEMENT_VERSION,
  authorized: true,
  names: ["Fixture Student"],
});
async function fixture(
  run: (db: Pool, repo: SchoolRepository) => Promise<void>,
) {
  const url = new URL(process.env.AMP_TEST_DATABASE_URL!);
  assertTestDatabaseTarget(url.href);
  const admin = new Pool({ connectionString: url.href });
  const schema = `reuse_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  url.searchParams.set("options", `-c search_path=${schema}`);
  await migrate(url.href);
  const db = new Pool({ connectionString: url.href });
  try {
    await run(db, new SchoolRepository(db));
  } finally {
    await db.end();
    await admin.end();
  }
}
test(
  "B2: repeated class starts reuse the account's school and the request",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const first = await startSchoolClass(repo, "fixture-teacher", input());
      const next = { ...input(), className: "Science" };
      const [second, retry] = await Promise.all([
        startSchoolClass(repo, "fixture-teacher", next),
        startSchoolClass(repo, "fixture-teacher", next),
      ]);
      assert.equal(second.orgId, first.orgId);
      assert.deepEqual(second, retry);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_orgs WHERE kind='school'",
          )
        ).rows[0].n,
        1,
      );
    }),
);
test(
  "M1: Gmail aliases share lifetime pilot dates across accounts",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const accounts = [`amp|${randomUUID()}`, `amp|${randomUUID()}`];
      for (const [i, account] of accounts.entries())
        await db.query(
          'INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,now(),now())',
          [
            account.slice(4),
            "Fixture",
            ["F.ixture+one@gmail.com", "fixture+two@googlemail.com"][i],
          ],
        );
      const first = await startSchoolClass(repo, accounts[0]!, input());
      await activateClassPilot(repo, accounts[0]!, first.classId);
      await db.query(
        "UPDATE amp_teacher_pilots SET started_at=now()-interval '50 days',ends_at=now()-interval '20 days',grace_ends_at=now()-interval '13 days'",
      );
      const second = await startSchoolClass(repo, accounts[1]!, input());
      assert.equal(
        (await activateClassPilot(repo, accounts[1]!, second.classId)).status,
        "expired",
      );
      assert.equal(
        (await db.query("SELECT count(*)::int n FROM amp_teacher_pilots"))
          .rows[0].n,
        1,
      );
    }),
);
test(
  "M1: a family organization cannot start or activate a school pilot",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const c = await startSchoolClass(repo, "fixture-parent", input());
      await db.query("UPDATE amp_orgs SET kind='family' WHERE id=$1", [
        c.orgId,
      ]);
      await assert.rejects(
        startSchoolClass(repo, "fixture-parent", {
          ...input(),
          orgId: c.orgId,
        }),
      );
      await assert.rejects(
        activateClassPilot(repo, "fixture-parent", c.classId),
      );
    }),
);
test(
  "UI H4: concurrent purchase requests return the same active buyer link",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const c = await startSchoolClass(repo, "fixture-teacher", input());
      const raw = { orgId: c.orgId, classIds: [c.classId], seats: 12 };
      const [a, b] = await Promise.all([
        requestSchoolPurchase(repo, "fixture-teacher", raw),
        requestSchoolPurchase(repo, "fixture-teacher", raw),
      ]);
      assert.equal(a.id, b.id);
      assert.equal(a.token, b.token);
      const saved = await classPurchaseRequest(
        repo,
        "fixture-teacher",
        c.classId,
        "fixture-school-token-secret-long-enough",
      );
      assert.equal(saved?.token, a.token);
      assert.equal(saved?.id, a.id);
      assert.equal(saved?.seats, 12);
      await assert.rejects(
        classPurchaseRequest(
          repo,
          "outsider",
          c.classId,
          "fixture-school-token-secret-long-enough",
        ),
      );
      await db.query(
        "UPDATE amp_school_purchase_requests SET token_expires_at=now()-interval '1 second' WHERE id=$1",
        [a.id],
      );
      assert.equal(
        await classPurchaseRequest(
          repo,
          "fixture-teacher",
          c.classId,
          "fixture-school-token-secret-long-enough",
        ),
        null,
      );
      const replacement = await requestSchoolPurchase(
        repo,
        "fixture-teacher",
        raw,
      );
      assert.notEqual(replacement.id, a.id);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM amp_school_purchase_requests",
          )
        ).rows[0].n,
        2,
      );
    }),
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

test(
  "L3: classroom authority can be withdrawn without deleting learning records",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const c = await startSchoolClass(repo, "fixture-teacher", input());
      await assert.rejects(
        revokeClassAuthorization(repo, "outsider", c.classId),
      );
      await revokeClassAuthorization(repo, "fixture-teacher", c.classId);
      assert.equal((await classPilotState(db, c.classId)).authorized, false);
      await assert.rejects(
        activateClassPilot(repo, "fixture-teacher", c.classId),
        /agreement_required/,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int n FROM amp_learners")).rows[0].n,
        1,
      );
    }),
);

test(
  "L-c: same teacher replaces overlapping buyer requests and closes old links",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const a = await startSchoolClass(repo, "fixture-teacher", input());
      const b = await startSchoolClass(repo, "fixture-teacher", {
        ...input(),
        className: "Science",
      });
      const first = await requestSchoolPurchase(repo, "fixture-teacher", {
        orgId: a.orgId,
        classIds: [a.classId],
        seats: 12,
      });
      const next = await requestSchoolPurchase(repo, "fixture-teacher", {
        orgId: a.orgId,
        classIds: [a.classId, b.classId],
        seats: 24,
        note: "Both classes",
      });
      assert.notEqual(next.id, first.id);
      assert.equal(
        (
          await db.query(
            "SELECT status FROM amp_school_purchase_requests WHERE id=$1",
            [first.id],
          )
        ).rows[0].status,
        "closed",
      );
      await assert.rejects(buyerHandoff(db, first.token), {
        code: "not_found",
      });
      assert.equal((await buyerHandoff(db, next.token)).seats, 24);
      const changed = await requestSchoolPurchase(repo, "fixture-teacher", {
        orgId: a.orgId,
        classIds: [a.classId, b.classId],
        seats: 25,
        note: "Updated",
      });
      assert.notEqual(changed.id, next.id);
      await assert.rejects(buyerHandoff(db, next.token), { code: "not_found" });
      assert.equal((await buyerHandoff(db, changed.token)).seats, 25);
    }),
);

test(
  "L-c: co-teacher GET reads a multi-class request through the class they teach",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const a = await startSchoolClass(repo, "fixture-teacher", input());
      const b = await startSchoolClass(repo, "fixture-teacher", {
        ...input(),
        className: "Science",
      });
      await repo.addStaff({
        orgId: a.orgId,
        givenName: "Co teacher",
        accountId: "fixture-co",
        role: "teacher",
        classId: a.classId,
      });
      const requested = await requestSchoolPurchase(repo, "fixture-teacher", {
        orgId: a.orgId,
        classIds: [a.classId, b.classId],
        seats: 24,
      });
      const app = Fastify();
      await registerSchoolRoutes(app, {
        pool: db,
        authenticate: async () => "fixture-co",
        services: {
          secret: "fixture-school-token-secret-long-enough",
          origin: "https://amp.example",
          mail: async () => {},
        },
      });
      try {
        const response = await app.inject(
          `/api/v1/school/classes/${a.classId}/purchase-request`,
        );
        assert.equal(response.statusCode, 200);
        assert.equal(response.json().request.id, requested.id);
        assert.deepEqual(
          response.json().request.classIds.sort(),
          [a.classId, b.classId].sort(),
        );
        assert.equal(
          (
            await app.inject(
              `/api/v1/school/classes/${b.classId}/purchase-request`,
            )
          ).statusCode,
          404,
        );
      } finally {
        await app.close();
      }
    }),
);

test(
  "L-c: another teacher's overlap returns actionable conflict without closing either request",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const a = await startSchoolClass(repo, "fixture-teacher", input());
      const b = await startSchoolClass(repo, "fixture-teacher", {
        ...input(),
        className: "Science",
      });
      await repo.addStaff({
        orgId: a.orgId,
        givenName: "Casey",
        familyName: "Teacher",
        accountId: "fixture-co",
        role: "teacher",
        classId: b.classId,
      });
      const own = await requestSchoolPurchase(repo, "fixture-teacher", {
        orgId: a.orgId,
        classIds: [a.classId],
        seats: 12,
      });
      const other = await requestSchoolPurchase(repo, "fixture-co", {
        orgId: a.orgId,
        classIds: [b.classId],
        seats: 12,
      });
      const app = Fastify();
      await registerSchoolRoutes(app, {
        pool: db,
        authenticate: async () => "fixture-teacher",
        services: {
          secret: "fixture-school-token-secret-long-enough",
          origin: "https://amp.example",
          mail: async () => {},
        },
      });
      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/school/purchase-requests",
          payload: {
            orgId: a.orgId,
            classIds: [a.classId, b.classId],
            seats: 24,
          },
        });
        assert.equal(response.statusCode, 409);
        assert.deepEqual(response.json(), {
          error: "purchase_scope_conflict",
          conflicts: [
            {
              requestId: other.id,
              holderName: "Casey Teacher",
              classIds: [b.classId],
            },
          ],
        });
        assert.equal((await buyerHandoff(db, own.token)).id, own.id);
        assert.equal((await buyerHandoff(db, other.token)).id, other.id);
        await assert.rejects(
          requestSchoolPurchase(repo, "fixture-teacher", {
            orgId: a.orgId,
            classIds: [b.classId],
            seats: 12,
          }),
          { code: "purchase_scope_conflict" },
        );
      } finally {
        await app.close();
      }
    }),
);
