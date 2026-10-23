import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import {
  registerClassWalletPayByRoutes,
  reconcileClassWalletApprovals,
  type ClassWalletPayByConfig,
} from "../src/funding-purchase/classwallet-payby.js";
import { FundingPurchaseError } from "../src/funding-purchase/contracts.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";

test(
  "fake ClassWallet checkout authenticates, binds invoice, confirms approval and activates once without settlement",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!,
      schema = `amp_payby_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 }),
      scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href });
    const app = Fastify();
    const offer = testFundingOffer,
      settledOffer = {
        ...offer,
        id: "settlement-fixture",
        activationPolicy: "after-settlement" as const,
      };
    const offers = [offer, settledOffer];
    const config: ClassWalletPayByConfig = {
      enabled: true,
      vendorId: "a".repeat(24),
      publicOrigin: "https://example.test",
      setupReference: "synthetic-setup",
      offerIds: offers.map((o) => o.id),
      basicUser: "fixture",
      basicPassword: "synthetic-private-password",
    };
    const auth = {
      authorization: `Basic ${Buffer.from(`${config.basicUser}:${config.basicPassword}`).toString("base64")}`,
    };
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('child','owner','Fixture'),('other-child','other','Fixture'),('settled-child','owner','Fixture'),('retry-child','owner','Fixture')",
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('owner','fixture','verified','private'),('other','fixture','verified','private')",
      );
      const repo = new FundingPurchaseRepository(pool, offers);
      const create = (account: string, learnerId: string, offerId = offer.id) =>
        repo.create(account, {
          offerId,
          offerRevision: offer.revision,
          learnerId,
          idempotencyKey: randomUUID(),
        });
      await registerClassWalletPayByRoutes(app, {
        pool,
        offers,
        config,
        authenticate: async (request) => {
          const value = request.headers.authorization;
          if (value === "Bearer owner") return "owner";
          if (value === "Bearer other") return "other";
          throw new FundingPurchaseError(401, "sign_in_required");
        },
      });
      assert.equal(
        (await app.inject({ url: "/api/v1/funding/classwallet/capabilities" }))
          .statusCode,
        401,
      );
      assert.deepEqual(
        (
          await app.inject({
            url: "/api/v1/funding/classwallet/capabilities",
            headers: { authorization: "Bearer owner" },
          })
        ).json(),
        { offerIds: offers.map((o) => o.id) },
      );
      const invoice = await create("owner", "child");
      const checkoutPath = `/api/v1/funding/requests/${invoice.id}/classwallet-checkout`;
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: checkoutPath,
            headers: { authorization: "Bearer other" },
            payload: {},
          })
        ).statusCode,
        404,
      );
      const begin = await app.inject({
        method: "POST",
        url: checkoutPath,
        headers: { authorization: "Bearer owner" },
        payload: {},
      });
      assert.equal(begin.statusCode, 200);
      const checkout = new URL(begin.json().checkoutUrl);
      assert.equal(checkout.origin, "https://app.classwallet.com");
      const callback = new URL(checkout.searchParams.get("callback")!).pathname;
      assert.equal((await app.inject({ url: callback })).statusCode, 401);
      assert.equal(
        (
          await app.inject({
            method: "PUT",
            url: callback,
            headers: auth,
            payload: { PurchaseOrderId: 101, status: "complete" },
          })
        ).statusCode,
        409,
      );
      const providerGet = await app.inject({ url: callback, headers: auth });
      assert.equal(providerGet.statusCode, 200);
      assert.deepEqual(providerGet.json(), {
        orderId: invoice.id,
        details: {
          items: [
            {
              itemId: offer.sku,
              description: offer.productTitle,
              quantity: 1,
              price: 123,
            },
          ],
          shipping: 0,
          tax: 0,
        },
      });
      assert.ok(!providerGet.body.includes("owner"));
      const approve = () =>
        app.inject({
          method: "PUT",
          url: callback,
          headers: auth,
          payload: { PurchaseOrderId: 101, status: "complete" },
        });
      const results = await Promise.all([approve(), approve()]);
      assert.deepEqual(
        results.map((r) => r.statusCode),
        [200, 200],
      );
      assert.equal((await approve()).statusCode, 200);
      assert.equal(
        (await app.inject({ url: callback, headers: auth })).statusCode,
        200,
      );
      const foreignInvoice = await create("other", "other-child");
      await app.inject({
        method: "POST",
        url: `/api/v1/funding/requests/${foreignInvoice.id}/classwallet-checkout`,
        headers: { authorization: "Bearer other" },
        payload: {},
      });
      const foreignPath = `/api/v1/classwallet/orders/${foreignInvoice.id}`;
      await app.inject({ url: foreignPath, headers: auth });
      assert.equal(
        (
          await app.inject({
            method: "PUT",
            url: foreignPath,
            headers: auth,
            payload: { PurchaseOrderId: 101, status: "complete" },
          })
        ).statusCode,
        409,
      );
      assert.equal((await repo.read("other", foreignInvoice.id)).orderId, null);
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0].n,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_commerce_events WHERE payload->>'type'='order.settled'",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await app.inject({
            method: "PUT",
            url: callback,
            headers: auth,
            payload: { PurchaseOrderId: 102, status: "complete" },
          })
        ).statusCode,
        409,
      );
      assert.equal(
        (
          await app.inject({
            method: "PUT",
            url: callback,
            headers: auth,
            payload: { PurchaseOrderId: 101, status: "cancelled" },
          })
        ).statusCode,
        409,
      );
      // A trusted approval cannot invent cash settlement or unlock a settlement-only offer.
      const pending = await create("owner", "settled-child", settledOffer.id);
      await app.inject({
        method: "POST",
        url: `/api/v1/funding/requests/${pending.id}/classwallet-checkout`,
        headers: { authorization: "Bearer owner" },
        payload: {},
      });
      const pendingPath = `/api/v1/classwallet/orders/${pending.id}`;
      await app.inject({ url: pendingPath, headers: auth });
      assert.equal(
        (
          await app.inject({
            method: "PUT",
            url: pendingPath,
            headers: auth,
            payload: { PurchaseOrderId: 103, status: "complete" },
          })
        ).statusCode,
        200,
      );
      assert.equal((await repo.read("owner", pending.id)).orderId, null);
      // Crash/rejection after callback persistence recovers from the durable exact bundle.
      const retry = await create("owner", "retry-child");
      await app.inject({
        method: "POST",
        url: `/api/v1/funding/requests/${retry.id}/classwallet-checkout`,
        headers: { authorization: "Bearer owner" },
        payload: {},
      });
      const retryPath = `/api/v1/classwallet/orders/${retry.id}`;
      await app.inject({ url: retryPath, headers: auth });
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id='owner'",
      );
      assert.equal(
        (
          await app.inject({
            method: "PUT",
            url: retryPath,
            headers: auth,
            payload: { PurchaseOrderId: 104, status: "complete" },
          })
        ).statusCode,
        403,
      );
      assert.equal((await repo.read("owner", retry.id)).orderId, null);
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=NULL WHERE account_id='owner'",
      );
      assert.deepEqual(await reconcileClassWalletApprovals(pool, offers), {
        provisioned: 1,
        deferred: 0,
        stopped: 2,
      });
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0].n,
        2,
      );
      // Recovery reads the approved bundle; a conflicting callback wins before
      // it can acquire the account lock to provision. Never grant stale approval.
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('race-child','owner','Fixture')",
      );
      const race = await create("owner", "race-child");
      await app.inject({
        method: "POST",
        url: `/api/v1/funding/requests/${race.id}/classwallet-checkout`,
        headers: { authorization: "Bearer owner" },
        payload: {},
      });
      const racePath = `/api/v1/classwallet/orders/${race.id}`;
      await app.inject({ url: racePath, headers: auth });
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id='owner'",
      );
      assert.equal(
        (
          await app.inject({
            method: "PUT",
            url: racePath,
            headers: auth,
            payload: { PurchaseOrderId: 105, status: "complete" },
          })
        ).statusCode,
        403,
      );
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=NULL WHERE account_id='owner'",
      );
      let release!: () => void, selected!: () => void;
      const selection = new Promise<void>((resolve) => {
        selected = resolve;
      });
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const racingPool = new Proxy(pool, {
        get(target, property) {
          if (property === "query")
            return async (...args: any[]) => {
              const result = await (target.query as any)(...args);
              if (
                typeof args[0] === "string" &&
                args[0].startsWith("SELECT c.request_id,c.provisioning_payload")
              ) {
                selected();
                await barrier;
              }
              return result;
            };
          const value = Reflect.get(target, property);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const recovering = reconcileClassWalletApprovals(racingPool, offers);
      await selection;
      try {
        assert.equal(
          (
            await app.inject({
              method: "PUT",
              url: racePath,
              headers: auth,
              payload: { PurchaseOrderId: 105, status: "cancelled" },
            })
          ).statusCode,
          409,
        );
      } finally {
        release();
      }
      assert.equal((await recovering).provisioned, 0);
      assert.equal((await repo.read("owner", race.id)).orderId, null);
      const stopped = (
        await pool.query(
          "SELECT stopped_at,exception_code FROM amp_classwallet_checkouts WHERE request_id=$1",
          [race.id],
        )
      ).rows[0];
      assert.ok(stopped.stopped_at);
      assert.equal(stopped.exception_code, "callback-conflict");
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0].n,
        2,
      );
      const start = await app.inject({
        method: "POST",
        url: "/api/v1/classwallet/start",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload:
          "request=" +
          encodeURIComponent(
            JSON.stringify({
              email: "victim@example.test",
              authKey: Buffer.from(config.vendorId).toString("base64"),
            }),
          ),
      });
      assert.equal(start.statusCode, 303);
      assert.equal(start.headers.location, "https://example.test/");
      assert.equal(start.headers["set-cookie"], undefined);
    } finally {
      await app.close();
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
