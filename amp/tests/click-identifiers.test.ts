import test from "node:test";
import assert from "node:assert/strict";
import {
  clickEvidenceSchema,
  providerClickIdentifiers,
} from "../src/advertising/click-identifiers.js";
const observed = new Date("2026-10-22T12:00:00.000Z");
test("Google identifiers retain exact case and opaque characters", () => {
  const identifiers = {
    gclid: "AbCd-ef_01=",
    gbraid: "GB123",
    wbraid: "WB123",
  };
  assert.deepEqual(
    providerClickIdentifiers({ provider: "google", identifiers }, observed),
    identifiers,
  );
});
test("Meta fbc uses the original observed click time and never invents fbp", () => {
  const input = {
    provider: "meta" as const,
    identifiers: { fbclid: "Actual_Click_ID" },
  };
  assert.deepEqual(providerClickIdentifiers(input, observed), {
    fbc: `fb.1.${+observed}.Actual_Click_ID`,
  });
  const fbc = `fb.1.${+observed - 1000}.Actual_Click_ID`;
  const laterCookie = `fb.1.${+observed + 1000}.Actual_Click_ID`;
  assert.deepEqual(
    providerClickIdentifiers(
      {
        provider: "meta",
        identifiers: { ...input.identifiers, fbc: laterCookie },
      },
      observed,
      new Date(+observed + 2000),
    ),
    { fbc: laterCookie },
  );
  assert.deepEqual(
    providerClickIdentifiers(
      { provider: "meta", identifiers: { ...input.identifiers, fbc } },
      observed,
    ),
    { fbc },
  );
  assert.deepEqual(
    providerClickIdentifiers(
      {
        provider: "meta",
        identifiers: {
          ...input.identifiers,
          fbc: `fb.1.${+observed - 1000}.Different_Click`,
        },
      },
      observed,
    ),
    { fbc: `fb.1.${+observed}.Actual_Click_ID` },
  );
});
test("Missing, mixed-provider, oversized and unrelated data is rejected", () => {
  for (const identifiers of [
    {},
    { fbclid: "other-provider" },
    { gclid: "private@example.test" },
    { gclid: "x".repeat(2049) },
    { gclid: "line\nbreak" },
    { gclid: "ok", learner: "child" },
  ]) {
    assert.equal(
      clickEvidenceSchema.safeParse({ provider: "google", identifiers })
        .success,
      false,
    );
  }
  assert.throws(
    () =>
      providerClickIdentifiers(
        {
          provider: "meta",
          identifiers: { fbc: `fb.1.${+observed + 1}.Future` },
        },
        observed,
      ),
    /invalid_click_evidence/,
  );
  assert.throws(
    () =>
      providerClickIdentifiers(
        { provider: "google", identifiers: { gclid: "valid" } },
        new Date(NaN),
      ),
    /invalid_click_evidence/,
  );
});
