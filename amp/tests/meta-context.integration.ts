import {
  metaPurchaseRequest,
  metaAdultEmailHash,
} from "../src/advertising/meta-conversions.js";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import type { Pool } from "pg";
import {
  fixture,
  enabled,
  stripe,
  sources,
  observation,
  refund,
  day,
} from "./helpers/advertising.js";
import {
  changeAdvertisingPermission,
  withAdvertisingPrivacySignals,
} from "../src/advertising/permission.js";
import { META_PURCHASE_MEASUREMENT_NOTICE as notice } from "../src/advertising/permission-contracts.js";
import {
  recordMetaPurchaseContext,
  registerMetaPurchaseContextRoutes,
  purgeMetaPurchaseContexts,
} from "../src/advertising/meta-context.js";
import { META_ENROLLMENT_CONFIRMATION_URL as url } from "../src/advertising/meta-context-contracts.js";
import { FamilyRepository } from "../src/family/repository.js";
const account = "amp|parent";
async function grant(pool: Pool, revision: string | null = null) {
  const view = await changeAdvertisingPermission(
    pool,
    account,
    {
      action: "allow",
      revision,
      noticeVersion: notice.version,
      adultAttestation: true,
    },
    false,
    "meta",
  );
  await pool.query(
    "UPDATE amp_meta_advertising_permissions SET granted_at=clock_timestamp()-interval '2 days' WHERE account_id=$1",
    [account],
  );
  return view;
}
async function payment(pool: Pool, options: Parameters<typeof stripe>[1] = {}) {
  const p = await stripe(pool, options);
  const checkout = (
    await pool.query(
      "SELECT checkout_id FROM amp_payment_records WHERE id=$1",
      [p.reference.id],
    )
  ).rows[0].checkout_id as string;
  await pool.query(
    "UPDATE amp_stripe_checkouts SET learner_id=NULL WHERE id=$1",
    [checkout],
  );
  return { ...p, checkout };
}
const headers = (checkout: string) => ({
  referer: `${url}?billing=processing&purchase=${checkout}`,
  "user-agent": "Synthetic adult browser/1.0",
});
const capture = (
  pool: Pool,
  checkout: string,
  custom: Record<string, unknown> = headers(checkout),
  owner = account,
  namespace: string | null = sources.stripeNamespace,
) =>
  recordMetaPurchaseContext(
    pool,
    owner,
    namespace,
    { checkoutId: checkout },
    custom,
  );
const rows = async (pool: Pool) =>
  (await pool.query("SELECT * FROM amp_meta_purchase_contexts")).rows;

test(
  "confirmed adult Meta permission plus verified first payment records one immutable confirmation context",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await payment(pool);
      const results = await Promise.all(
        Array.from({ length: 6 }, () => capture(pool, p.checkout)),
      );
      assert.ok(results.every((r) => r.recorded));
      const saved = await rows(pool);
      assert.equal(saved.length, 1);
      assert.equal(saved[0].event_source_url, url);
      assert.equal(saved[0].occurred_at.toISOString(), p.occurredAt);
      assert.equal(saved[0].permission_notice, notice.version);
      const permission = (
        await pool.query(
          "SELECT granted_at,expires_at FROM amp_meta_advertising_permissions WHERE account_id=$1",
          [account],
        )
      ).rows[0];
      const preview = metaPurchaseRequest(
        {
          eventId: `amp_meta_${"b".repeat(64)}`,
          occurredAt: p.occurredAt,
          amountMinor: 49900,
          currency: "USD",
          adultEmailSha256: metaAdultEmailHash("parent@example.invalid"),
          source: {
            actionSource: "website",
            eventSourceUrl: saved[0].event_source_url,
            clientUserAgent: saved[0].client_user_agent,
          },
          permission: {
            noticeVersion: notice.version,
            adultAttested: true,
            purpose: "measurement-and-ad-delivery",
            grantedAt: permission.granted_at.toISOString(),
            expiresAt: permission.expires_at.toISOString(),
          },
        },
        { kind: "preview" },
      );
      assert.equal(preview.data[0]?.event_source_url, url);
      assert.equal(
        preview.data[0]?.user_data.client_user_agent,
        headers(p.checkout)["user-agent"],
      );

      assert.equal(
        saved[0].expires_at.getTime() - saved[0].occurred_at.getTime(),
        7 * day,
      );
      assert.equal(
        JSON.stringify(saved).includes("parent@example.invalid"),
        false,
      );
      assert.equal(JSON.stringify(saved).includes("Do not export"), false);
      assert.ok(
        !Object.keys(saved[0]).some((k) =>
          /email|learner|ip_address|click/.test(k),
        ),
      );
      await capture(pool, p.checkout, {
        ...headers(p.checkout),
        "user-agent": "Different browser",
      });
      assert.deepEqual(await rows(pool), saved);
    }),
);

test(
  "Google-only, late, withdrawn, changed-email, unconfirmed-email and expired Meta permissions cannot collect context",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await payment(pool);
      assert.equal(
        (await capture(pool, p.checkout)).recorded,
        false,
        "Google is not Meta permission",
      );
      const view = await grant(pool);
      await pool.query(
        "UPDATE amp_meta_advertising_permissions SET granted_at=clock_timestamp() WHERE account_id=$1",
        [account],
      );
      assert.equal((await capture(pool, p.checkout)).recorded, false);
      await pool.query(
        "UPDATE amp_meta_advertising_permissions SET granted_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 hour' WHERE account_id=$1",
        [account],
      );
      assert.equal((await capture(pool, p.checkout)).recorded, false);
      await grant(pool, view.revision);
      await pool.query(
        `UPDATE amp_auth_users SET email='changed@example.invalid' WHERE id='parent'`,
      );
      assert.equal((await capture(pool, p.checkout)).recorded, false);
      await pool.query(
        `UPDATE amp_auth_users SET email='parent@example.invalid',"emailVerified"=false WHERE id='parent'`,
      );
      assert.equal((await capture(pool, p.checkout)).recorded, false);
      await pool.query(
        `UPDATE amp_auth_users SET "emailVerified"=true WHERE id='parent'`,
      );
      await changeAdvertisingPermission(
        pool,
        account,
        { action: "withdraw" },
        false,
        "meta",
      );
      assert.equal((await capture(pool, p.checkout)).recorded, false);
      assert.equal((await rows(pool)).length, 0);
    }),
);

test(
  "test, renewal, held, old, future, foreign and refunded payments cannot collect context",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      for (const options of [
        { namespace: "acct_fixture:test", live: false },
        { live: false },
        { reason: "subscription_cycle" },
        { status: "review" },
        { paidMinor: 0 },
        { paidAt: Math.floor((Date.now() - 8 * day) / 1000) },
        { paidAt: Math.floor(Date.now() / 1000) + 3600 },
        { account: "amp|other" },
      ]) {
        const p = await payment(pool, options);
        assert.equal(
          (await capture(pool, p.checkout)).recorded,
          false,
          JSON.stringify(options),
        );
      }
      let p = await payment(pool);
      await pool.query(
        "INSERT INTO amp_payment_holds(namespace,invoice_id,credit_note_id,source_event_id) VALUES($1,$2,'cn_context','event_context')",
        [sources.stripeNamespace, p.invoiceId],
      );
      assert.equal((await capture(pool, p.checkout)).recorded, false);
      p = await payment(pool);
      await observation(pool, p.reference.id, [refund(p.chargeId, 49900)]);
      assert.equal((await capture(pool, p.checkout)).recorded, false);
      await observation(pool, p.reference.id, [
        refund(p.chargeId, 100, "pending"),
      ]);
      assert.equal((await capture(pool, p.checkout)).recorded, false);
      await observation(pool, p.reference.id, []);
      await pool.query(
        "UPDATE amp_stripe_checkouts SET learner_id='child' WHERE id=$1",
        [p.checkout],
      );
      assert.equal(
        (await capture(pool, p.checkout)).recorded,
        false,
        "existing-learner checkout uses another return path",
      );
      assert.equal((await rows(pool)).length, 0);
    }),
);

test(
  "context requires a matching actual parent confirmation referrer and bounded browser user agent",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await payment(pool);
      const good = headers(p.checkout);
      for (const overrides of [
        { referer: undefined },
        { referer: url },
        { referer: good.referer.replace("processing", "canceled") },
        { referer: good.referer.replace(p.checkout, randomUUID()) },
        { referer: good.referer + "&purchase=" + p.checkout },
        { referer: good.referer.replace("/start/purchase", "/practice") },
        { referer: good.referer.replace("amp.corpora.inc", "evil.example") },
        { referer: good.referer + "#learner" },
        { "user-agent": "" },
        { "user-agent": "a".repeat(513) },
        { "user-agent": "bad\nagent" },
        { "sec-gpc": "1" },
        { dnt: "1" },
      ]) {
        assert.equal(
          (await capture(pool, p.checkout, { ...good, ...overrides })).recorded,
          false,
          JSON.stringify(overrides),
        );
      }
      assert.equal(
        (await capture(pool, p.checkout, good, account, null)).recorded,
        false,
      );
      assert.equal(
        (await capture(pool, p.checkout, good, account, "acct_fixture:test"))
          .recorded,
        false,
      );
      await assert.rejects(
        recordMetaPurchaseContext(
          pool,
          account,
          sources.stripeNamespace,
          { checkoutId: p.checkout, email: "injected@example.invalid" },
          good,
        ),
      );
      assert.equal((await rows(pool)).length, 0);
      assert.equal(
        (
          await capture(pool, p.checkout, {
            ...good,
            referer: good.referer + "&tracking=discard-me",
          })
        ).recorded,
        true,
      );
      assert.ok(!JSON.stringify(await rows(pool)).includes("discard-me"));
    }),
);

test(
  "provider withdrawal and global privacy signals erase context; later grants cannot revive earlier payments",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await payment(pool);
      await capture(pool, p.checkout);
      await changeAdvertisingPermission(
        pool,
        account,
        { action: "withdraw" },
        false,
        "google",
      );
      assert.equal(
        (await rows(pool)).length,
        1,
        "independent Google withdrawal",
      );
      await changeAdvertisingPermission(
        pool,
        account,
        { action: "withdraw" },
        false,
        "meta",
      );
      assert.equal((await rows(pool)).length, 0);
      const revision = (
        await pool.query(
          "SELECT revision FROM amp_meta_advertising_permissions WHERE account_id=$1",
          [account],
        )
      ).rows[0].revision;
      await changeAdvertisingPermission(
        pool,
        account,
        {
          action: "allow",
          revision,
          noticeVersion: notice.version,
          adultAttestation: true,
        },
        false,
        "meta",
      );
      assert.equal((await capture(pool, p.checkout)).recorded, false);
      await pool.query(
        "UPDATE amp_meta_advertising_permissions SET granted_at=clock_timestamp()-interval '2 days' WHERE account_id=$1",
        [account],
      );
      await capture(pool, p.checkout);
      const app = Fastify();
      await registerMetaPurchaseContextRoutes(app, {
        pool,
        stripeNamespace: sources.stripeNamespace,
        authenticate: withAdvertisingPrivacySignals(pool, async (req) => {
          if (req.headers.authorization === "Bearer synthetic-parent")
            return account;
          throw Object.assign(new Error("no"), { statusCode: 401 });
        }),
      });
      try {
        const unauth = await app.inject({
          method: "POST",
          url: "/api/v1/advertising/meta/purchase-context",
          payload: { checkoutId: p.checkout },
          headers: headers(p.checkout),
        });
        assert.equal(unauth.statusCode, 401);
        assert.equal(unauth.headers["cache-control"], "no-store");
        const invalid = await app.inject({
          method: "POST",
          url: "/api/v1/advertising/meta/purchase-context",
          payload: { checkoutId: p.checkout, amountMinor: 49900 },
          headers: {
            ...headers(p.checkout),
            authorization: "Bearer synthetic-parent",
          },
        });
        assert.equal(invalid.statusCode, 400);
        const gpc = await app.inject({
          method: "POST",
          url: "/api/v1/advertising/meta/purchase-context",
          payload: { checkoutId: p.checkout },
          headers: {
            ...headers(p.checkout),
            authorization: "Bearer synthetic-parent",
            "sec-gpc": "1",
          },
        });
        assert.equal(gpc.statusCode, 200);
        assert.deepEqual(gpc.json(), { recorded: false });
        assert.equal((await rows(pool)).length, 0);
      } finally {
        await app.close();
      }
    }),
);

test(
  "withdrawal racing concurrent confirmations leaves no context",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await payment(pool);
      await Promise.all([
        capture(pool, p.checkout),
        capture(pool, p.checkout),
        changeAdvertisingPermission(
          pool,
          account,
          { action: "withdraw" },
          false,
          "meta",
        ),
      ]);
      assert.equal((await rows(pool)).length, 0);
    }),
);

test(
  "family export includes retained browser context without internal routing IDs; expiry removes it",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await payment(pool);
      await capture(pool, p.checkout);
      const chunks = [];
      for await (const line of new FamilyRepository(pool).export(account))
        chunks.push(line);
      const found = chunks
        .join("")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .find((row) => row.type === "meta-purchase-context");
      assert.ok(found);
      assert.ok(JSON.stringify(found).includes(url));
      assert.ok(!JSON.stringify(found).includes(p.reference.id));
      assert.ok(!JSON.stringify(found).includes(p.checkout));
      assert.ok(!JSON.stringify(found).includes(sources.stripeNamespace));
      await pool.query(
        "UPDATE amp_meta_purchase_contexts SET observed_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute'",
      );
      assert.equal(await purgeMetaPurchaseContexts(pool), 1);
      assert.equal((await rows(pool)).length, 0);
    }),
);

test(
  "learning withdrawal and learner deletion erase Meta confirmation context",
  enabled,
  async () => {
    for (const mode of ["withdraw", "delete"]) {
      await fixture(async (pool) => {
        await grant(pool);
        const p = await payment(pool);
        await capture(pool, p.checkout);
        const family = new FamilyRepository(pool);
        if (mode === "withdraw") await family.withdraw(account);
        else await family.deleteLearning(account, "child");
        assert.equal((await rows(pool)).length, 0);
        assert.equal((await capture(pool, p.checkout)).recorded, false);
      });
    }
  },
);
