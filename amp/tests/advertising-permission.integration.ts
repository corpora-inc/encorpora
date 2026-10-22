import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import {
  changeAdvertisingPermission,
  purchaseMeasurementView,
  purgeAdvertisingPermissions,
  withAdvertisingPrivacySignals,
} from "../src/advertising/permission.js";
import { PURCHASE_MEASUREMENT_NOTICE as notice } from "../src/advertising/permission-contracts.js";
import { registerAdvertisingPermissionRoutes } from "../src/advertising/permission-routes.js";
import { FamilyRepository } from "../src/family/repository.js";
import { accountSummary } from "../src/account/repository.js";
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
async function fixture(run: (pool: Pool) => Promise<void>) {
  const schema = `amp_ad_permission_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(process.env.AMP_TEST_DATABASE_URL!);
  const admin = new Pool({ connectionString: url.href, max: 1 });
  url.searchParams.set(
    "options",
    `-c search_path=${schema} -c timezone=Pacific/Honolulu`,
  );
  const pool = new Pool({ connectionString: url.href, max: 8 });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(url.href);
    await pool.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('parent','Parent fixture','parent@example.invalid',true),('other','Other fixture','other@example.invalid',true),('unconfirmed','Unconfirmed fixture','unconfirmed@example.invalid',false)`,
    );
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
const allow = (revision: string | null = null) => ({
  action: "allow",
  revision,
  noticeVersion: notice.version,
  adultAttestation: true,
});
async function view(pool: Pool, account = "amp|parent") {
  const client = await pool.connect();
  try {
    return await purchaseMeasurementView(client, account);
  } finally {
    client.release();
  }
}
test(
  "permission requires actual confirmed adult address, rejects injected fields and does not grant learning access",
  enabled,
  () =>
    fixture(async (pool) => {
      assert.equal((await view(pool)).status, "off");
      for (const account of [
        "amp|unconfirmed",
        "amp|missing",
        "oidc|parent",
        "development-household",
        "trial:fixture",
      ])
        await assert.rejects(
          changeAdvertisingPermission(pool, account, allow()),
          /purchase_measurement_email_required/,
        );
      for (const extra of [
        { adultAttestation: false },
        { noticeVersion: "old" },
        { email: "child@example.invalid" },
        { accountId: "amp|other" },
        { learnerId: "child" },
        { adPersonalization: true },
      ])
        await assert.rejects(
          changeAdvertisingPermission(pool, "amp|parent", {
            ...allow(),
            ...extra,
          }),
        );
      const granted = await changeAdvertisingPermission(
        pool,
        "amp|parent",
        allow(),
      );
      assert.equal(granted.status, "active");
      assert.equal(
        Date.parse(granted.expiresAt!) - Date.parse(granted.grantedAt!),
        365 * 86400000,
      );
      const repeated = await changeAdvertisingPermission(
        pool,
        "amp|parent",
        allow(granted.revision),
      );
      assert.deepEqual(repeated, granted);
      assert.equal((await view(pool, "amp|other")).status, "off");
      const me = await accountSummary(
        pool,
        new FamilyRepository(pool),
        "amp|parent",
      );
      assert.equal(me.family.purchaseMeasurement?.status, "active");
      assert.equal(me.consent.status, "none");
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_parent_consents"))
          .rows[0].n,
        0,
      );
      await pool.query(
        "ALTER TABLE amp_auth_users RENAME TO fixture_auth_users",
      );
      assert.equal((await view(pool)).status, "review-required");
      await assert.rejects(
        changeAdvertisingPermission(
          pool,
          "amp|parent",
          allow(granted.revision),
        ),
        /purchase_measurement_email_required/,
      );
    }),
);
test(
  "withdrawal, expiry, email changes and notice changes require a fresh explicit grant",
  enabled,
  () =>
    fixture(async (pool) => {
      const first = await changeAdvertisingPermission(
        pool,
        "amp|parent",
        allow(),
      );
      const off = await changeAdvertisingPermission(pool, "amp|parent", {
        action: "withdraw",
      });
      assert.equal(off.status, "off");
      assert.notEqual(off.revision, first.revision);
      assert.equal(
        (
          await pool.query(
            "SELECT email_digest FROM amp_advertising_permissions",
          )
        ).rows[0].email_digest,
        null,
      );
      assert.deepEqual(
        await changeAdvertisingPermission(pool, "amp|parent", {
          action: "withdraw",
        }),
        off,
      );
      await assert.rejects(
        changeAdvertisingPermission(pool, "amp|parent", allow(first.revision)),
        /purchase_measurement_changed/,
      );
      const second = await changeAdvertisingPermission(
        pool,
        "amp|parent",
        allow(off.revision),
      );
      await pool.query(
        "UPDATE amp_auth_users SET email='changed@example.invalid' WHERE id='parent'",
      );
      assert.equal((await view(pool)).status, "review-required");
      const changed = await changeAdvertisingPermission(
        pool,
        "amp|parent",
        allow(second.revision),
      );
      assert.notEqual(changed.revision, second.revision);
      await pool.query(
        "UPDATE amp_advertising_permissions SET notice_version='retired-notice'",
      );
      assert.equal((await view(pool)).status, "review-required");
      const revised = await changeAdvertisingPermission(
        pool,
        "amp|parent",
        allow(changed.revision),
      );
      await pool.query(
        "UPDATE amp_advertising_permissions SET granted_at=now()-interval '400 days',expires_at=now()-interval '35 days'",
      );
      assert.equal((await view(pool)).status, "expired");
      const renewed = await changeAdvertisingPermission(
        pool,
        "amp|parent",
        allow(revised.revision),
      );
      assert.equal(renewed.status, "active");
      assert.notEqual(renewed.revision, revised.revision);
    }),
);
test(
  "any authenticated GPC/DNT request persists withdrawal and cannot be undone by a stale initial form",
  enabled,
  () =>
    fixture(async (pool) => {
      const app = Fastify();
      const authenticate = withAdvertisingPrivacySignals(
        pool,
        async (request) => {
          if (request.headers.authorization !== "Bearer synthetic-parent")
            throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
          return "amp|parent";
        },
      );
      await registerAdvertisingPermissionRoutes(app, { pool, authenticate });
      app.get("/probe", async (request) => {
        await authenticate(request);
        return { ok: true };
      });
      try {
        const headers = { authorization: "Bearer synthetic-parent" };
        const url = "/api/v1/family/purchase-measurement";
        assert.equal(
          (await app.inject({ method: "POST", url, payload: allow() }))
            .statusCode,
          401,
        );
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: "/probe",
              headers: { ...headers, "sec-gpc": "1" },
            })
          ).statusCode,
          200,
        );
        const stopped = await view(pool);
        assert.equal(stopped.status, "off");
        assert.ok(stopped.revision);
        assert.equal(
          (await app.inject({ method: "POST", url, headers, payload: allow() }))
            .statusCode,
          409,
        );
        const granted = await app.inject({
          method: "POST",
          url,
          headers,
          payload: allow(stopped.revision),
        });
        assert.equal(granted.statusCode, 200);
        assert.equal(granted.json().status, "active");
        assert.equal(granted.headers["cache-control"], "no-store");
        await app.inject({
          method: "GET",
          url: "/probe",
          headers: { ...headers, dnt: "1" },
        });
        assert.equal((await view(pool)).status, "off");
        await app.inject({ method: "GET", url: "/probe", headers });
        assert.equal((await view(pool)).status, "off");
        const blocked = await app.inject({
          method: "POST",
          url,
          headers: { ...headers, dnt: "1" },
          payload: allow((await view(pool)).revision),
        });
        assert.equal(blocked.json().status, "off");
        const injected = await app.inject({
          method: "POST",
          url,
          headers,
          payload: { ...allow(), accountId: "amp|other" },
        });
        assert.equal(injected.statusCode, 400);
        assert.ok(!injected.body.includes("amp|other"));
        assert.equal((await view(pool, "amp|other")).status, "off");
      } finally {
        await app.close();
      }
    }),
);
test(
  "family export includes the preference; withdrawal and deletion revoke it without leaking the email binding",
  enabled,
  () =>
    fixture(async (pool) => {
      const family = new FamilyRepository(pool);
      const granted = await changeAdvertisingPermission(
        pool,
        "amp|parent",
        allow(),
      );
      const rows: string[] = [];
      for await (const row of family.export("amp|parent")) rows.push(row);
      const exported = rows.join("");
      assert.ok(exported.includes('"type":"purchase-measurement-permission"'));
      assert.ok(exported.includes(granted.revision!));
      assert.ok(!exported.includes("email_digest"));
      assert.ok(!exported.includes("parent@example.invalid"));
      await family.withdraw("amp|parent");
      assert.equal((await view(pool)).status, "off");
      await changeAdvertisingPermission(
        pool,
        "amp|parent",
        allow((await view(pool)).revision),
      );
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('synthetic-child','amp|parent','Sample learner')",
      );
      await assert.rejects(
        family.deleteLearning("amp|other", "synthetic-child"),
        /learner_not_found/,
      );
      assert.equal((await view(pool)).status, "active");
      await family.deleteLearning("amp|parent", "synthetic-child");
      assert.equal((await view(pool)).status, "off");
      await changeAdvertisingPermission(
        pool,
        "amp|parent",
        allow((await view(pool)).revision),
      );
      await family.deleteLearning("amp|parent");
      assert.equal((await view(pool)).status, "off");
    }),
);
test(
  "concurrent initial grants serialize; retention deletes only preferences past the evidence period",
  enabled,
  () =>
    fixture(async (pool) => {
      const attempts = await Promise.allSettled([
        changeAdvertisingPermission(pool, "amp|parent", allow()),
        changeAdvertisingPermission(pool, "amp|parent", allow()),
      ]);
      assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(
        attempts.filter(
          (x) =>
            x.status === "rejected" &&
            /purchase_measurement_changed/.test(String(x.reason)),
        ).length,
        1,
      );
      await changeAdvertisingPermission(pool, "amp|other", allow());
      assert.equal(await purgeAdvertisingPermissions(pool), 0);
      await pool.query(
        "UPDATE amp_advertising_permissions SET granted_at=now()-interval '500 days',expires_at=now()-interval '135 days' WHERE account_id='amp|parent'",
      );
      assert.equal(await purgeAdvertisingPermissions(pool), 1);
      assert.equal((await view(pool, "amp|other")).status, "active");
      await changeAdvertisingPermission(pool, "amp|other", {
        action: "withdraw",
      });
      await pool.query(
        "UPDATE amp_advertising_permissions SET withdrawn_at=now()-interval '89 days' WHERE account_id='amp|other'",
      );
      assert.equal(await purgeAdvertisingPermissions(pool), 0);
      await pool.query(
        "UPDATE amp_advertising_permissions SET withdrawn_at=now()-interval '91 days' WHERE account_id='amp|other'",
      );
      assert.equal(await purgeAdvertisingPermissions(pool), 1);
    }),
);

test(
  "operator withdrawal and consent-evidence retention revoke the matching current permission",
  enabled,
  () =>
    fixture(async (pool) => {
      const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const { purgeConsentRecords } =
        await import("../src/parent-consent/lifecycle.js");
      const temporary = await mkdtemp(join(tmpdir(), "amp-ad-permission-"));
      try {
        await changeAdvertisingPermission(pool, "amp|parent", allow());
        const file = join(temporary, "consent.json");
        await writeFile(
          file,
          JSON.stringify({
            accountId: "amp|parent",
            policyVersion: "fixture",
            verificationMethod: "operator-verified",
            evidenceReference: "synthetic",
            withdraw: true,
          }),
          { mode: 0o600 },
        );
        const result = await promisify(execFile)(
          process.execPath,
          [
            "--import",
            "tsx",
            new URL("../scripts/parent-consent.ts", import.meta.url).pathname,
            file,
          ],
          {
            cwd: new URL("../", import.meta.url).pathname,
            env: {
              ...process.env,
              AMP_DATABASE_URL: pool.options.connectionString,
            },
          },
        );
        assert.match(result.stdout, /Parent consent record updated/);
        assert.equal((await view(pool)).status, "off");
        for (const method of [
          "internal-email-plus-v1",
          "monetary-transaction",
        ]) {
          for (const matches of [false, true]) {
            const evidence = randomUUID();
            await changeAdvertisingPermission(
              pool,
              "amp|parent",
              allow((await view(pool)).revision),
            );
            await pool.query(
              "UPDATE amp_parent_consents SET verification_method=$1,evidence_reference=$2,withdrawn_at=NULL WHERE account_id='amp|parent'",
              [method, matches ? evidence : randomUUID()],
            );
            if (method === "internal-email-plus-v1") {
              await pool.query(
                `INSERT INTO amp_consent_requests(id,account_id,idempotency_key,policy_generation,policy_digest,notice_digest,notice,email_hash,nonce,phase,expires_at,completed_at,purge_after)
            VALUES($1,'amp|parent',$2,$3,'fixture','fixture','{"withdrawnEvidenceDays":90,"pendingContactDays":7}','synthetic','synthetic','withdrawn',now()-interval '2 days',now()-interval '3 days',now()-interval '1 day')`,
                [evidence, randomUUID(), randomUUID()],
              );
            } else {
              await pool.query(
                "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id,closed) VALUES($1,'synthetic','amp|parent',NULL,$2,true)",
                [evidence, randomUUID()],
              );
              await pool.query(
                `INSERT INTO amp_purchase_consents(checkout_id,account_id,policy_generation,policy_digest,notice_digest,notice,consent_at,revoked_at,purge_after)
            VALUES($1,'amp|parent',$2,'fixture','fixture','{"withdrawnEvidenceDays":90,"pendingContactDays":7}',now()-interval '3 days',now()-interval '2 days',now()-interval '1 day')`,
                [evidence, randomUUID()],
              );
            }
            await purgeConsentRecords(pool);
            assert.equal(
              (await view(pool)).status,
              matches ? "off" : "active",
              `${method} matching current evidence=${matches}`,
            );
          }
        }
      } finally {
        await rm(temporary, { recursive: true });
      }
    }),
);

test(
  "verified Better Auth account endpoints honor signals without caller-selected identity",
  enabled,
  () =>
    fixture(async (pool) => {
      const { createAccounts, accountsAuth, registerAccountRoutes } =
        await import("../src/server/accounts.js");
      const app = Fastify();
      const accounts = await createAccounts(pool, {
        baseURL: "http://127.0.0.1:4310",
        secret: "synthetic-secret-for-account-fixture".repeat(2),
        production: false,
        passwords: true,
        trustedOrigins: [],
      });
      const authenticate = withAdvertisingPrivacySignals(
        pool,
        accountsAuth(accounts),
      );
      await registerAccountRoutes(app, accounts, authenticate);
      try {
        await pool.query(
          `INSERT INTO amp_auth_sessions(id,"expiresAt",token,"updatedAt","userId") VALUES('fixture-session',now()+interval '1 day','synthetic-existing-token',now(),'parent')`,
        );
        const granted = await changeAdvertisingPermission(
          pool,
          "amp|parent",
          allow(),
        );
        await changeAdvertisingPermission(pool, "amp|other", allow());
        const anonymous = await app.inject({
          method: "GET",
          url: "/api/auth/get-session?accountId=amp%7Cother",
          headers: { "sec-gpc": "1" },
        });
        assert.equal(anonymous.statusCode, 200);
        assert.equal((await view(pool, "amp|other")).status, "active");
        const response = await app.inject({
          method: "GET",
          url: "/api/auth/get-session?accountId=amp%7Cother",
          headers: {
            authorization: "Bearer synthetic-existing-token",
            "sec-gpc": "1",
          },
        });
        assert.equal(response.statusCode, 200);
        assert.equal(response.json().user.id, "parent");
        assert.equal((await view(pool)).status, "off");
        assert.notEqual((await view(pool)).revision, granted.revision);
        assert.equal((await view(pool, "amp|other")).status, "active");
      } finally {
        await app.close();
      }
    }),
);
