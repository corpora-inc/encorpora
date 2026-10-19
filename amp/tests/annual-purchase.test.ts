import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { annualOffer } from "../src/billing/stripe/purchase.js";
import { registerUnavailableBilling } from "../src/billing/stripe/routes.js";
import { config } from "./stripe-fixtures.js";
import { enrollmentViewSchema } from "../src/billing/stripe/enrollment-contracts.js";
test("annual display is exact USD, configuration-bound, and exposes no provider secrets", () => {
  const offer = annualOffer({ ...config, amountMinor: 12345 });
  assert.equal(offer.formattedAmount, "$123.45");
  assert.equal(offer.mode, "test");
  assert.equal(offer.interval, "year");
  assert.equal(offer.learnerCount, 1);
  for (const sensitive of [
    config.secretKey,
    config.webhookSecret,
    config.accountId,
    config.priceId,
  ])
    assert.ok(!JSON.stringify(offer).includes(sensitive));
  assert.notEqual(offer.id, annualOffer(config).id);
  assert.notEqual(
    offer.id,
    annualOffer({ ...config, amountMinor: 12345, livemode: true }).id,
  );
  for (const currency of ["jpy", "isk", "eur"])
    assert.throws(
      () => annualOffer({ ...config, currency }),
      /offer_currency_unsupported/,
    );
});
test("disabled billing is an authenticated explicit state with no advertised price", async () => {
  const app = Fastify();
  await registerUnavailableBilling(app, async (request) => {
    if (request.headers.authorization !== "Bearer fixture")
      throw Object.assign(new Error("sign_in_required"), { statusCode: 401 });
    return "parent";
  });
  try {
    assert.equal(
      (await app.inject({ url: "/api/v1/billing/offer" })).statusCode,
      401,
    );
    const response = await app.inject({
      url: "/api/v1/billing/offer",
      headers: { authorization: "Bearer fixture" },
    });
    assert.deepEqual(response.json(), { available: false });
    assert.equal(response.headers["cache-control"], "no-store");
    // The free-trial paywall can ask without an account; nothing is priced.
    assert.deepEqual(
      (await app.inject({ url: "/api/v1/billing/prices" })).json(),
      { available: false, offers: [] },
    );
    // First-run enrollment reports a designed unavailable state, not a 404.
    assert.equal(
      (await app.inject({ url: "/api/v1/billing/enrollment" })).statusCode,
      401,
    );
    const enrollment = await app.inject({
      url: "/api/v1/billing/enrollment",
      headers: { authorization: "Bearer fixture" },
    });
    assert.equal(
      enrollmentViewSchema.parse(enrollment.json()).available,
      false,
    );
    assert.deepEqual(enrollment.json(), {
      available: false,
      notice: null,
      noticeDigest: null,
      purchase: null,
    });
    assert.equal(enrollment.headers["cache-control"], "no-store");
  } finally {
    await app.close();
  }
});
