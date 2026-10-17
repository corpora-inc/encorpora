import test from "node:test";
import assert from "node:assert/strict";
import {
  availableOffers,
  createFundingRequestSchema,
  fundingOfferSchema,
  presentOffer,
  presentRequest,
  type FundingRequest,
} from "../src/funding-purchase/contracts.js";
import { renderFundingQuote } from "../src/funding-purchase/quote.js";
import { annualTermEnd } from "../src/funding-purchase/provision.js";
import { testFundingOffer as offer } from "./funding-purchase.fixture.js";
const request: FundingRequest = {
  id: "quote-id",
  accountId: "private-account",
  learnerId: "opaque-student",
  idempotencyKey: "private-key",
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2026-01-31T00:00:00.000Z",
  status: "prepared",
  offer,
  orderId: null,
};
test("operational offers require explicit evidence, safe routes, validity and exact server prices", () => {
  assert.equal(availableOffers([offer], new Date("2026-01-01")).length, 1);
  const {
    activationPolicy: _policy,
    creditAgreementReference: _credit,
    ...defaultOffer
  } = offer;
  assert.equal(
    fundingOfferSchema.parse(defaultOffer).activationPolicy,
    "after-settlement",
  );
  assert.throws(
    () =>
      fundingOfferSchema.parse({
        ...defaultOffer,
        activationPolicy: "after-approval",
      }),
    /credit agreement/,
  );
  for (const at of [offer.validUntil, "2019-01-01T00:00:00.000Z"])
    assert.equal(availableOffers([offer], new Date(at)).length, 0);
  assert.equal(
    availableOffers([{ ...offer, enabled: false }], new Date()).length,
    0,
  );
  for (const patch of [
    { approvals: {} },
    { subtotalMinor: 12.5 },
    { destinationUrl: "javascript:alert(1)" },
    { destinationUrl: "https://name:secret@example.com" },
    { documentPolicy: "unconfirmed" },
  ])
    assert.throws(() => fundingOfferSchema.parse({ ...offer, ...patch }));
  assert.throws(() => availableOffers([offer, offer], new Date()));
  assert.throws(() =>
    createFundingRequestSchema.parse({
      offerId: offer.id,
      offerRevision: offer.revision,
      learnerId: "child",
      idempotencyKey: crypto.randomUUID(),
      subtotalMinor: 1,
    }),
  );
});
test("parent projections exclude evidence, account and idempotency secrets and never imply unverified access", () => {
  assert.equal(presentOffer(offer).totalMinor, 12300);
  const safe = presentRequest(request);
  assert.equal(safe.accessStatus, "not-granted");
  assert.equal(safe.paymentStatus, "not-verified");
  assert.ok(!JSON.stringify(safe).includes("private-"));
});
test("unpaid quote escapes all authored content and states exact amount without approval claims", () => {
  const html = renderFundingQuote({
    ...request,
    offer: {
      ...offer,
      productTitle: '<script>alert("x")</script>',
      instructions: "<img src=x onerror=alert(1)>",
    },
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /\$123\.00/);
  assert.match(html, /UNPAID/);
  assert.match(html, /not an invoice, receipt, funding approval/);
  assert.ok(!html.includes("private-"));
});
test("annual license terms use calendar years including leap-day clamping", () => {
  assert.equal(
    annualTermEnd("2024-02-29T09:12:13.456Z"),
    "2025-02-28T09:12:13.456Z",
  );
  assert.equal(
    annualTermEnd("2026-10-17T00:00:00.000Z"),
    "2027-10-17T00:00:00.000Z",
  );
});

test("PDF quotes preserve Latin characters and reject unsupported glyphs before offers open", async () => {
  const { validateQuoteFonts, renderFundingQuotePdf } =
    await import("../src/funding-purchase/quote-pdf.js");
  const { PDFDocument } = await import("pdf-lib");
  await validateQuoteFonts([{ ...offer, productTitle: "¡AHA! — Matemáticas" }]);
  await assert.rejects(
    validateQuoteFonts([{ ...offer, productTitle: "数学" }]),
    /unsupported/,
  );
  const bytes = await renderFundingQuotePdf(request);
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 1);
  for (const page of document.getPages())
    assert.deepEqual(page.getSize(), { width: 612, height: 792 });
});
