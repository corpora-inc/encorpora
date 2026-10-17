import assert from "node:assert/strict";
import test from "node:test";
import {
  nationalProgramReviews,
  nationalReviewCheckedOn,
} from "../src/funding/national-review.js";

test("national research records retain distinct purchasing and operating constraints", () => {
  const records = new Map(
    nationalProgramReviews.map((record) => [record.id, record]),
  );
  assert.equal(records.size, nationalProgramReviews.length);
  assert.equal(
    records.get("ia-students-first")?.purchaseModel,
    "tuition-first",
  );
  assert.equal(records.get("nc-opportunity")?.purchaseModel, "school-tuition");
  assert.equal(
    records.get("oh-home-credit")?.purchaseModel,
    "family-tax-benefit",
  );
  assert.equal(
    records.get("ny-materials-loans")?.purchaseModel,
    "institutional",
  );
  assert.equal(records.get("oh-autism")?.purchaseModel, "approved-specialist");
  assert.equal(
    records.get("fl-new-worlds")?.operatingStatus,
    "existing-balances-only",
  );
  assert.equal(
    records.get("mt-special-needs-esa")?.operatingStatus,
    "current-year-unconfirmed",
  );
  assert.equal(records.get("ne-opportunity-closed")?.operatingStatus, "closed");
  assert.equal(records.get("oh-ace-closed")?.operatingStatus, "closed");
});

test("each researched route has dated evidence, an onboarding path and unresolved product questions", () => {
  assert.equal(nationalReviewCheckedOn, "2026-10-17");
  for (const record of nationalProgramReviews) {
    assert.ok(record.name.trim(), record.id);
    assert.match(record.jurisdiction, /^[A-Z]{2}$/);
    assert.ok(record.evidence.length > 0, record.id);
    for (const source of record.evidence) {
      assert.equal(new URL(source.url).protocol, "https:");
      assert.ok(source.statement.trim(), record.id);
    }
    assert.equal(new URL(record.onboarding.url).protocol, "https:");
    assert.ok(record.onboarding.requirements.trim(), record.id);
    assert.ok(
      record.unknowns.every((unknown) => unknown.trim().length > 0),
      record.id,
    );
    assert.ok(record.unknowns.length > 0, record.id);
  }
});

test("all six platform-only leads have program-specific reviewed evidence", () => {
  for (const id of [
    "ia-students-first",
    "ga-promise",
    "la-gator",
    "mo-moscholars",
    "wy-esa",
    "ut-fits-all",
  ]) {
    const record = nationalProgramReviews.find(
      (candidate) => candidate.id === id,
    );
    assert.ok(record, id);
    assert.ok(
      record.evidence.every(
        (source) => !source.url.includes("withodyssey.com"),
      ),
      id,
    );
  }
});

test("federal advance elections are a dated future lead, not purchasing approval", async () => {
  const { federalScholarshipTaxCredit: federal } =
    await import("../src/funding/national-review.js");
  assert.equal(federal.readiness, "future-sgo-channel-unverified");
  assert.ok(federal.startsOn > nationalReviewCheckedOn);
  assert.equal(new Set(federal.advanceElectionStates).size, 30);
  assert.ok(!federal.advanceElectionStates.includes("CA"));
  assert.ok(federal.electionListAsOf <= federal.checkedOn);
});
