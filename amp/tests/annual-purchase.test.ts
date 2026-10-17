import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { annualOffer } from "../src/billing/stripe/purchase.js";
import { registerUnavailableBilling } from "../src/billing/stripe/routes.js";
import { config } from "./stripe-fixtures.js";
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
  } finally {
    await app.close();
  }
});
