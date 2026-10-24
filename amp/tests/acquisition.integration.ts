import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { fixture, enabled } from "./helpers/advertising.js";
import {
  registerAcquisitionRoutes,
  acquisitionToken,
  ACQUISITION_COOKIE,
  linkPurchaseAcquisition,
  purgeAcquisition,
} from "../src/advertising/acquisition.js";
import { orderClickEvidence } from "../src/advertising/click-evidence.js";
import { changeAdvertisingPermission } from "../src/advertising/permission.js";
import { FamilyRepository } from "../src/family/repository.js";
import { registerFundingPurchaseRoutes } from "../src/funding-purchase/routes.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";
import { registerStripeRoutes } from "../src/billing/stripe/routes.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { config as stripeConfig } from "./stripe-fixtures.js";
const origin = "https://corpora.inc";
const payload = {
  clicks: [
    { provider: "google", identifiers: { gclid: "Synthetic_Google" } },
    { provider: "meta", identifiers: { fbclid: "Synthetic_Meta" } },
  ],
  labels: {
    campaign: "ar-efa-launch",
    source: "google",
    medium: "cpc",
    creative: "efa-math",
  },
};

for (const [campaign, creative, source = "google"] of [
  ["ar-efa-launch", "efa-math"],
  ["az-esa-launch", "efa-math"],
  ["ar-efa-launch", "ar-premium-efa-v1"],
  ["ar-efa-launch", "ar-premium-homeschool-v1"],
  ["az-esa-launch", "az-premium-esa-v1"],
  ["az-esa-launch", "az-premium-homeschool-v1"],
  ["ar-efa-launch", "ar-map-cedar-vertical-v5"],
  ["az-esa-launch", "az-map-marin-vertical-v5"],
  ["ar-efa-launch", "shared-practice-marin-vertical-v1"],
  ["az-esa-launch", "az-practice-marin-vertical-v1"],
  ["ar-efa-launch", "shared-map-zoom-modus-vertical-v1"],
  ["az-esa-launch", "shared-map-zoom-modus-vertical-v1"],
  ["ar-efa-launch", "ar-map-zoom-modus-vertical-v1"],
  ["az-esa-launch", "az-map-zoom-modus-vertical-v1"],
  ["az-esa-launch", "az-funded-better-math-portrait-v3"],
  ["az-esa-launch", "az-funded-better-math-feed-v3"],
  ["az-esa-launch", "az-funded-better-math-wide-v3"],
  ["ar-efa-launch", "ar-funded-whats-next-portrait-v3"],
  ["ar-efa-launch", "ar-funded-whats-next-feed-v3"],
  ["ar-efa-launch", "ar-funded-whats-next-wide-v3"],
  ["az-esa-launch", "az-funded-catch-up-portrait-v3"],
  ["az-esa-launch", "az-funded-catch-up-feed-v3"],
  ["az-esa-launch", "az-funded-catch-up-wide-v3"],
  ["ar-efa-launch", "ar-funded-get-ahead-portrait-v3"],
  ["ar-efa-launch", "ar-funded-get-ahead-feed-v3"],
  ["ar-efa-launch", "ar-funded-get-ahead-wide-v3"],
  ["az-esa-launch", "az-funded-less-planning-portrait-v3"],
  ["az-esa-launch", "az-funded-less-planning-feed-v3"],
  ["az-esa-launch", "az-funded-less-planning-wide-v3"],
  ["ar-efa-launch", "ar-funded-your-childs-math-portrait-v3"],
  ["ar-efa-launch", "ar-funded-your-childs-math-feed-v3"],
  ["ar-efa-launch", "ar-funded-your-childs-math-wide-v3"],
  ["az-esa-launch", "az-funded-right-fit-portrait-v3"],
  ["az-esa-launch", "az-funded-right-fit-feed-v3"],
  ["az-esa-launch", "az-funded-right-fit-wide-v3"],
  ["ar-efa-launch", "ar-funded-screen-paper-portrait-v3"],
  ["ar-efa-launch", "ar-funded-screen-paper-feed-v3"],
  ["ar-efa-launch", "ar-funded-screen-paper-wide-v3"],
  ["az-esa-launch", "az-funded-parent-relief-portrait-v3"],
  ["az-esa-launch", "az-funded-parent-relief-feed-v3"],
  ["az-esa-launch", "az-funded-parent-relief-wide-v3"],
  ["ar-efa-launch", "ar-funded-funded-choice-portrait-v3"],
  ["ar-efa-launch", "ar-funded-funded-choice-feed-v3"],
  ["ar-efa-launch", "ar-funded-funded-choice-wide-v3"],
  ["ar-efa-launch", "ar-funded-pmax-child-v1"],
  ["ar-efa-launch", "ar-funded-pmax-planning-v1"],
  ["az-esa-launch", "az-funded-pmax-child-v1"],
  ["az-esa-launch", "az-funded-pmax-planning-v1"],
  ["ar-efa-launch", "ar-awareness-whats-next-facebook-v1", "facebook"],
  ["ar-efa-launch", "ar-awareness-whats-next-instagram-v1", "instagram"],
  ["az-esa-launch", "az-awareness-better-math-facebook-v1", "facebook"],
  ["az-esa-launch", "az-awareness-better-math-instagram-v1", "instagram"],
  ["az-esa-launch", "az-funded-better-math-portrait-v5"],
  ["az-esa-launch", "az-funded-better-math-feed-v5"],
  ["az-esa-launch", "az-funded-better-math-square-v5"],
  ["az-esa-launch", "az-funded-better-math-wide-v5"],
  ["az-esa-launch", "az-funded-better-math-responsive-v5"],
  ["az-esa-launch", "az-funded-catch-up-portrait-v5"],
  ["az-esa-launch", "az-funded-catch-up-feed-v5"],
  ["az-esa-launch", "az-funded-catch-up-square-v5"],
  ["az-esa-launch", "az-funded-catch-up-wide-v5"],
  ["az-esa-launch", "az-funded-catch-up-responsive-v5"],
  ["az-esa-launch", "az-funded-less-planning-portrait-v5"],
  ["az-esa-launch", "az-funded-less-planning-feed-v5"],
  ["az-esa-launch", "az-funded-less-planning-square-v5"],
  ["az-esa-launch", "az-funded-less-planning-wide-v5"],
  ["az-esa-launch", "az-funded-less-planning-responsive-v5"],
  ["az-esa-launch", "az-funded-right-fit-portrait-v5"],
  ["az-esa-launch", "az-funded-right-fit-feed-v5"],
  ["az-esa-launch", "az-funded-right-fit-square-v5"],
  ["az-esa-launch", "az-funded-right-fit-wide-v5"],
  ["az-esa-launch", "az-funded-right-fit-responsive-v5"],
  ["az-esa-launch", "az-funded-parent-relief-portrait-v5"],
  ["az-esa-launch", "az-funded-parent-relief-feed-v5"],
  ["az-esa-launch", "az-funded-parent-relief-square-v5"],
  ["az-esa-launch", "az-funded-parent-relief-wide-v5"],
  ["az-esa-launch", "az-funded-parent-relief-responsive-v5"],
  ["ar-efa-launch", "ar-funded-whats-next-portrait-v5"],
  ["ar-efa-launch", "ar-funded-whats-next-feed-v5"],
  ["ar-efa-launch", "ar-funded-whats-next-square-v5"],
  ["ar-efa-launch", "ar-funded-whats-next-wide-v5"],
  ["ar-efa-launch", "ar-funded-whats-next-responsive-v5"],
  ["ar-efa-launch", "ar-funded-get-ahead-portrait-v5"],
  ["ar-efa-launch", "ar-funded-get-ahead-feed-v5"],
  ["ar-efa-launch", "ar-funded-get-ahead-square-v5"],
  ["ar-efa-launch", "ar-funded-get-ahead-wide-v5"],
  ["ar-efa-launch", "ar-funded-get-ahead-responsive-v5"],
  ["ar-efa-launch", "ar-funded-your-childs-math-portrait-v5"],
  ["ar-efa-launch", "ar-funded-your-childs-math-feed-v5"],
  ["ar-efa-launch", "ar-funded-your-childs-math-square-v5"],
  ["ar-efa-launch", "ar-funded-your-childs-math-wide-v5"],
  ["ar-efa-launch", "ar-funded-your-childs-math-responsive-v5"],
  ["ar-efa-launch", "ar-funded-screen-paper-portrait-v5"],
  ["ar-efa-launch", "ar-funded-screen-paper-feed-v5"],
  ["ar-efa-launch", "ar-funded-screen-paper-square-v5"],
  ["ar-efa-launch", "ar-funded-screen-paper-wide-v5"],
  ["ar-efa-launch", "ar-funded-screen-paper-responsive-v5"],
  ["ar-efa-launch", "ar-funded-funded-choice-portrait-v5"],
  ["ar-efa-launch", "ar-funded-funded-choice-feed-v5"],
  ["ar-efa-launch", "ar-funded-funded-choice-square-v5"],
  ["ar-efa-launch", "ar-funded-funded-choice-wide-v5"],
  ["ar-efa-launch", "ar-funded-funded-choice-responsive-v5"],
] as const)
  test(
    `landing capture ${campaign}/${creative} returns a secure cookie and binds through the funding route`,
    enabled,
    async () =>
      fixture(async (pool) => {
        const sourcePath =
          campaign === "ar-efa-launch"
            ? "/esa/arkansas-efa/"
            : "/esa/arizona-esa/";
        const capturePayload = {
          ...payload,
          sourcePath,
          labels: {
            ...payload.labels,
            campaign,
            creative,
            source,
            medium: source === "google" ? "cpc" : "paid-social",
          },
        };
        const app = Fastify();
        try {
          await registerAcquisitionRoutes(app, { pool, origin });
          await pool.query(
            "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|parent','fixture','verified','synthetic')",
          );
          await registerFundingPurchaseRoutes(app, {
            pool,
            authenticate: async () => "amp|parent",
            offers: [testFundingOffer],
          });
          const preflight = await app.inject({
            method: "OPTIONS",
            url: "/api/v1/advertising/acquisition",
            headers: { origin },
          });
          assert.equal(preflight.statusCode, 204);
          assert.equal(
            preflight.headers["access-control-allow-credentials"],
            "true",
          );
          const capture = await app.inject({
            method: "POST",
            url: "/api/v1/advertising/acquisition",
            headers: { origin },
            payload: capturePayload,
          });
          assert.equal(capture.statusCode, 204);
          assert.equal(capture.body, "");
          const setCookie = String(capture.headers["set-cookie"]);
          assert.match(setCookie, /; Secure; HttpOnly; SameSite=Lax; Max-Age=/);
          assert.ok(!setCookie.includes("Domain="));
          assert.ok(!setCookie.includes("Synthetic"));
          const cookie = setCookie.split(";")[0]!;
          const token = acquisitionToken({ cookie });
          assert.ok(token);
          const request = {
            offerId: testFundingOffer.id,
            offerRevision: testFundingOffer.revision,
            learnerId: "child",
            idempotencyKey: randomUUID(),
          };
          const created = await app.inject({
            method: "POST",
            url: "/api/v1/funding/requests",
            headers: { cookie },
            payload: request,
          });
          assert.equal(created.statusCode, 200, created.body);
          const rows = await pool.query(
            "SELECT id FROM amp_funding_requests WHERE account_id='amp|parent'",
          );
          assert.equal(rows.rowCount, 1);
          const target = {
            kind: "funding-request" as const,
            id: rows.rows[0].id,
          };
          const client = await pool.connect();
          try {
            assert.deepEqual(
              (await orderClickEvidence(client, "amp|parent", target, "google"))
                ?.identifiers,
              { gclid: "Synthetic_Google" },
            );
          } finally {
            client.release();
          }
          assert.ok(
            !created.body.includes("Synthetic_Google") &&
              !created.body.includes(token!),
          );
          const retry = await app.inject({
            method: "POST",
            url: "/api/v1/funding/requests",
            headers: { cookie },
            payload: request,
          });
          assert.equal(retry.statusCode, 200);
          assert.equal(
            (await pool.query("SELECT count(*) FROM amp_ad_order_attribution"))
              .rows[0].count,
            "2",
          );
          assert.deepEqual(
            (
              await pool.query(
                "SELECT DISTINCT source_url,campaign_labels AS labels FROM amp_ad_click_evidence",
              )
            ).rows,
            [
              {
                source_url: `https://corpora.inc${sourcePath}`,
                labels: capturePayload.labels,
              },
            ],
          );
          const exported = [];
          for await (const line of new FamilyRepository(pool).export(
            "amp|parent",
          ))
            exported.push(JSON.parse(line));
          const acquisition = exported.filter(
            (x) => x.type === "ad-acquisition",
          );
          assert.equal(acquisition.length, 2);
          assert.ok(
            acquisition.every(
              (entry) => entry.data.campaignLabels.creative === creative,
            ),
          );
          assert.ok(!JSON.stringify(acquisition).includes(token!));
          await changeAdvertisingPermission(
            pool,
            "amp|parent",
            { action: "withdraw" },
            false,
            "google",
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*) FROM amp_ad_click_evidence WHERE provider='google'",
              )
            ).rows[0].count,
            "0",
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*) FROM amp_ad_click_evidence WHERE provider='meta'",
              )
            ).rows[0].count,
            "1",
          );
          await new FamilyRepository(pool).withdraw("amp|parent");
          assert.equal(
            (await pool.query("SELECT count(*) FROM amp_ad_click_evidence"))
              .rows[0].count,
            "0",
          );
        } finally {
          await app.close();
        }
      }),
  );

test(
  "untrusted origins, extra fields, privacy signals and duplicate cookies cannot capture",
  enabled,
  async () =>
    fixture(async (pool) => {
      const app = Fastify();
      try {
        await registerAcquisitionRoutes(app, { pool, origin });
        for (const headers of [
          {},
          { origin: "https://other.example" },
          { origin: "https://corpora.inc.attacker.example" },
        ])
          assert.equal(
            (
              await app.inject({
                method: "POST",
                url: "/api/v1/advertising/acquisition",
                headers,
                payload,
              })
            ).statusCode,
            403,
          );
        for (const invalid of [
          { ...payload, sourcePath: "/try/practice" },
          { ...payload, sourcePath: "/amp/?email=private@example.invalid" },
          { ...payload, sourcePath: "https://attacker.example/" },
          { ...payload, account: "amp|parent" },
          { ...payload, learner: "child" },
          { ...payload, clicks: [payload.clicks[0], payload.clicks[0]] },
          {
            ...payload,
            labels: {
              campaign: "ar-efa-launch",
              source: "parent@example.invalid",
              medium: "cpc",
            },
          },
        ])
          assert.equal(
            (
              await app.inject({
                method: "POST",
                url: "/api/v1/advertising/acquisition",
                headers: { origin },
                payload: invalid,
              })
            ).statusCode,
            400,
          );
        for (const privacy of [{ "sec-gpc": "1" }, { dnt: "1" }]) {
          const result = await app.inject({
            method: "POST",
            url: "/api/v1/advertising/acquisition",
            headers: { origin, ...privacy },
            payload,
          });
          assert.equal(result.statusCode, 204);
          assert.match(String(result.headers["set-cookie"]), /Max-Age=0$/);
        }
        assert.equal(
          (await pool.query("SELECT count(*) FROM amp_ad_click_journeys"))
            .rows[0].count,
          "0",
        );
        assert.equal(
          acquisitionToken({
            cookie: `${ACQUISITION_COOKIE}=${"a".repeat(64)}; ${ACQUISITION_COOKIE}=${"b".repeat(64)}`,
          }),
          undefined,
        );
        assert.equal(
          acquisitionToken({ cookie: `${ACQUISITION_COOKIE}=invalid` }),
          undefined,
        );
      } finally {
        await app.close();
      }
    }),
);

test(
  "withdrawn provider cannot be rebound; expired journeys are removed by the worker",
  enabled,
  async () =>
    fixture(async (pool) => {
      const app = Fastify();
      try {
        await registerAcquisitionRoutes(app, { pool, origin });
        await changeAdvertisingPermission(
          pool,
          "amp|parent",
          { action: "withdraw" },
          false,
          "google",
        );
        await pool.query(
          "UPDATE amp_advertising_permissions SET withdrawn_at=clock_timestamp()-interval '91 days'",
        );
        const { purgeAdvertisingPermissions } =
          await import("../src/advertising/permission.js");
        await purgeAdvertisingPermissions(pool);
        const result = await app.inject({
          method: "POST",
          url: "/api/v1/advertising/acquisition",
          headers: { origin },
          payload,
        });
        const token = acquisitionToken({
          cookie: String(result.headers["set-cookie"]).split(";")[0],
        });
        assert.ok(token);
        const id = randomUUID();
        await pool.query(
          "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id,closed,created_at) VALUES($1,'acct_fixture:live','amp|parent','child',$2,true,clock_timestamp())",
          [id, randomUUID()],
        );
        assert.equal(
          await linkPurchaseAcquisition(pool, "amp|other", token, {
            kind: "stripe-checkout",
            id,
          }),
          false,
        );
        assert.equal(
          await linkPurchaseAcquisition(pool, "amp|parent", token, {
            kind: "stripe-checkout",
            id,
          }),
          true,
        );
        assert.deepEqual(
          (
            await pool.query("SELECT provider FROM amp_ad_order_attribution")
          ).rows.map((x) => x.provider),
          ["meta"],
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*) FROM amp_ad_click_evidence WHERE provider='google'",
            )
          ).rows[0].count,
          "0",
        );
        await pool.query(
          "UPDATE amp_ad_click_journeys SET created_at=statement_timestamp()-interval '91 days',expires_at=statement_timestamp()-interval '1 day'",
        );
        assert.equal(await purgeAcquisition(pool), 1);
        assert.equal(
          (await pool.query("SELECT count(*) FROM amp_ad_click_evidence"))
            .rows[0].count,
          "0",
        );
        assert.equal(
          (await pool.query("SELECT click_id FROM amp_ad_order_attribution"))
            .rows[0].click_id,
          null,
        );
      } finally {
        await app.close();
      }
    }),
);

test(
  "the actual Stripe checkout route binds the cookie before returning its payment URL",
  enabled,
  async () =>
    fixture(async (pool) => {
      const app = Fastify();
      try {
        await registerAcquisitionRoutes(app, { pool, origin });
        const gateway = new StripeGateway(stripeConfig);
        gateway.verifyCatalog = async () => {};
        gateway.createCustomer = async () => "cus_acquisition_fixture";
        gateway.createCheckout = async () => ({
          id: "cs_acquisition_fixture",
          url: "https://checkout.stripe.test/acquisition",
        });
        gateway.checkoutStatus = async () => ({
          status: "open",
          url: "https://checkout.stripe.test/acquisition",
        });
        await registerStripeRoutes(app, {
          pool,
          authenticate: async () => "amp|parent",
          config: stripeConfig,
          gateway,
        });
        await pool.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|parent',$1,'fixture','synthetic')",
          [stripeConfig.consentPolicyVersion],
        );
        const capture = await app.inject({
          method: "POST",
          url: "/api/v1/advertising/acquisition",
          headers: { origin },
          payload,
        });
        const cookie = String(capture.headers["set-cookie"]).split(";")[0]!;
        const request = {
          learnerId: "child",
          requestId: randomUUID(),
          interval: "year",
        };
        const paid = await app.inject({
          method: "POST",
          url: "/api/v1/billing/checkout",
          headers: { cookie },
          payload: request,
        });
        assert.equal(paid.statusCode, 200, paid.body);
        assert.deepEqual(paid.json(), {
          url: "https://checkout.stripe.test/acquisition",
        });
        assert.equal(
          (
            await pool.query(
              "SELECT count(*) FROM amp_ad_order_attribution WHERE stripe_checkout_id IS NOT NULL",
            )
          ).rows[0].count,
          "2",
        );
        const retry = await app.inject({
          method: "POST",
          url: "/api/v1/billing/checkout",
          headers: { cookie },
          payload: request,
        });
        assert.equal(retry.statusCode, 200);
        assert.equal(
          (await pool.query("SELECT count(*) FROM amp_ad_order_attribution"))
            .rows[0].count,
          "2",
        );
      } finally {
        await app.close();
      }
    }),
);

test(
  "mixed-provider replay preserves both original click times in either order",
  enabled,
  async () => {
    for (const reverse of [false, true])
      await fixture(async (pool) => {
        const app = Fastify();
        try {
          await registerAcquisitionRoutes(app, { pool, origin });
          const clicks = reverse
            ? [...payload.clicks].reverse()
            : payload.clicks;
          const capture = async (cookie?: string) =>
            app.inject({
              method: "POST",
              url: "/api/v1/advertising/acquisition",
              headers: { origin, ...(cookie ? { cookie } : {}) },
              payload: { clicks },
            });
          const first = await capture();
          assert.equal(first.statusCode, 204);
          const before = (
            await pool.query(
              "SELECT provider,first_observed_at FROM amp_ad_click_evidence ORDER BY provider",
            )
          ).rows;
          await pool.query(
            "UPDATE amp_ad_click_journeys SET account_id='amp|parent'",
          );
          const replay = await capture(
            String(first.headers["set-cookie"]).split(";")[0],
          );
          assert.equal(replay.statusCode, 204);
          const after = (
            await pool.query(
              "SELECT c.provider,c.first_observed_at FROM amp_ad_click_evidence c JOIN amp_ad_click_journeys j ON j.id=c.journey_id WHERE j.account_id IS NULL ORDER BY provider",
            )
          ).rows;
          assert.deepEqual(after, before);
        } finally {
          await app.close();
        }
      });
  },
);

test("retention drains more than one batch", enabled, async () =>
  fixture(async (pool) => {
    await pool.query(
      "INSERT INTO amp_ad_click_journeys(id,token_digest,created_at,expires_at) SELECT gen_random_uuid(),lpad(to_hex(n),64,'0'),clock_timestamp()-interval '91 days',clock_timestamp()-interval '2 days' FROM generate_series(1,201) n",
    );
    assert.equal(await purgeAcquisition(pool), 201);
    assert.equal(
      (await pool.query("SELECT count(*)::int AS n FROM amp_ad_click_journeys"))
        .rows[0].n,
      0,
    );
  }),
);

test(
  "permission evidence expiry cannot erase a collection withdrawal",
  enabled,
  async () =>
    fixture(async (pool) => {
      const { purgeAdvertisingPermissions } =
        await import("../src/advertising/permission.js");
      await changeAdvertisingPermission(
        pool,
        "amp|parent",
        { action: "withdraw" },
        false,
        "google",
      );
      await pool.query(
        "UPDATE amp_advertising_permissions SET withdrawn_at=clock_timestamp()-interval '91 days'",
      );
      await purgeAdvertisingPermissions(pool);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_advertising_permissions WHERE account_id='amp|parent'",
          )
        ).rows[0].n,
        0,
      );
      assert.deepEqual(
        (
          await pool.query(
            "SELECT provider FROM amp_ad_collection_withdrawals WHERE account_id='amp|parent'",
          )
        ).rows,
        [{ provider: "google" }],
      );
    }),
);
