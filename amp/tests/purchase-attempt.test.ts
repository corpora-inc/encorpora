import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  purchaseStage,
  purchaseAttemptSchema,
} from "../src/analytics/purchase-attempt.js";
import { eventBatchSchema } from "../src/analytics/events.js";
test("purchase categories exclude status polling, learner requests and private values", () => {
  assert.equal(purchaseStage("/funding/invoices", "POST"), "funded_invoice");
  assert.equal(purchaseStage("/funding/requests", "POST"), "funded_request");
  assert.equal(
    purchaseStage("/funding/requests/private-id/classwallet-checkout", "POST"),
    "funded_checkout",
  );
  assert.equal(
    purchaseStage("/funding/requests/private-id/status", "POST"),
    "funded_status",
  );
  assert.equal(purchaseStage("/billing/checkout", "POST"), "card_checkout");
  assert.equal(
    purchaseStage("/funding/invoices/private-id/claim?secret=private", "POST"),
    "funded_claim",
  );
  assert.equal(
    purchaseStage("/billing/enrollment/checkout", "POST"),
    "card_checkout",
  );
  assert.equal(
    purchaseStage("/billing/enrollment/claim", "POST"),
    "card_claim",
  );
  for (const path of [
    "/funding/invoices",
    "/billing/enrollment/checkout",
    "/billing/enrollment",
  ])
    assert.equal(purchaseStage(path, "GET"), undefined);
  assert.equal(purchaseStage("/learners/private-id/answer", "POST"), undefined);
});
test("purchase failures accept only closed categories and remain client events", () => {
  const props = {
    attemptId: randomUUID(),
    stage: "card_checkout",
    outcome: "failed",
    failure: "network",
  };
  assert.equal(
    eventBatchSchema.safeParse({
      visitorId: randomUUID(),
      events: [{ event: "purchase_attempt", props, at: 1 }],
    }).success,
    true,
  );
  for (const bad of [
    { ...props, message: "private" },
    { ...props, failure: "private" },
    { ...props, outcome: "succeeded" },
    { ...props, failure: undefined },
  ])
    assert.equal(purchaseAttemptSchema.safeParse(bad).success, false);
});
