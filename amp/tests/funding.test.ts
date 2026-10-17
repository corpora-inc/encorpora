import assert from "node:assert/strict";
import test from "node:test";
import { auditFundingRegistry } from "../src/funding/audit.js";
import { fundingRegistry } from "../src/funding/registry.js";
import type { FundingRegistry } from "../src/funding/types.js";

const copy = (): FundingRegistry => structuredClone(fundingRegistry);

test("national inventory covers every jurisdiction without claiming completed research or approvals", () => {
  const result = auditFundingRegistry(fundingRegistry);
  assert.deepEqual(result.errors, []);
  assert.equal(result.counts.jurisdictions, 51);
  assert.equal(result.counts.programs, 86);
  assert.equal(result.counts.reviewedPrograms, result.counts.programs);
  assert.equal(result.counts.unresearchedJurisdictions, 0);
  assert.ok(
    fundingRegistry.jurisdictions.every(
      (state) => state.researchStatus === "partial",
    ),
  );
  for (const program of fundingRegistry.programs) {
    assert.equal(program.corpora.vendor.status, "not-applied");
    assert.equal(program.corpora.sku.status, "not-applied");
    assert.equal(program.corpora.listing.status, "not-applied");
    assert.equal(program.corpora.payment, "not-configured");
  }
});

test("missing jurisdictions, duplicated programs, and crossed state references fail", () => {
  const registry = copy();
  registry.jurisdictions = registry.jurisdictions.filter(
    (state) => state.code !== "AK",
  );
  registry.programs = [...registry.programs, registry.programs[0]!];
  registry.jurisdictions = registry.jurisdictions.map((state) =>
    state.code === "NC" ? { ...state, programIds: ["az-esa"] } : state,
  );
  const errors = auditFundingRegistry(registry).errors;
  assert.ok(errors.includes("Missing jurisdiction: AK"));
  assert.ok(errors.includes("Duplicate or empty program: az-esa"));
  assert.ok(errors.includes("Invalid program reference az-esa: NC"));
  assert.ok(errors.includes("Unindexed program: nc-esa-plus"));
});

test("unknown citations and platform-only official review fail", () => {
  const registry = copy();
  registry.programs = registry.programs.map((program) =>
    program.id === "az-esa"
      ? {
          ...program,
          facts: [
            {
              statement: "Unverified claim",
              sourceIds: ["missing", "odyssey"],
            },
          ],
        }
      : program,
  );
  const errors = auditFundingRegistry(registry).errors;
  assert.ok(errors.includes("Unknown source missing: az-esa"));
  assert.ok(
    errors.includes(
      "Official review requires authority or administrator evidence: az-esa",
    ),
  );
});

test("approval evidence is mandatory and one approval does not confer the other gates", () => {
  const registry = copy();
  registry.programs = registry.programs.map((program) =>
    program.id === "az-esa"
      ? {
          ...program,
          corpora: {
            ...program.corpora,
            vendor: {
              status: "approved",
              evidence: "",
              effectiveOn: "2026-10-16",
            },
          },
        }
      : program,
  );
  assert.ok(
    auditFundingRegistry(registry).errors.includes(
      "Unsupported approval vendor: az-esa",
    ),
  );
  assert.equal(
    registry.programs.find((program) => program.id === "az-esa")!.corpora.sku
      .status,
    "not-applied",
  );
});

test("future, impossible, unsafe and stale source evidence is surfaced", () => {
  const registry = copy();
  registry.sources = registry.sources.map((source, index) =>
    index === 0
      ? {
          ...source,
          checkedOn: "2026-02-30",
          url: "http://example.com",
        }
      : source,
  );
  assert.ok(
    auditFundingRegistry(registry).errors.includes(
      "Invalid or future source date: az",
    ),
  );
  assert.ok(
    auditFundingRegistry(registry).errors.includes("Unsafe source URL: az"),
  );
  assert.ok(
    auditFundingRegistry(fundingRegistry, "2026-10-15").errors.length > 0,
  );
  assert.ok(
    auditFundingRegistry(fundingRegistry, "2027-02-01").warnings.some(
      (warning) => warning.includes("older than 90 days"),
    ),
  );
});

test("closed channels and institutional/tax channels cannot masquerade as parent marketplaces", () => {
  const registry = copy();
  registry.programs = registry.programs.map((program) =>
    program.id === "oh-ace-closed"
      ? {
          ...program,
          priority: "first-wave",
          purchasingRoutes: ["marketplace"],
        }
      : program.id === "oh-home-credit"
        ? { ...program, purchasingRoutes: ["reimbursement"] }
        : program.id === "mt-special-needs-esa"
          ? { ...program, priority: "second-wave" }
          : program,
  );
  const errors = auditFundingRegistry(registry).errors;
  assert.ok(
    errors.includes("Closed program has purchasing routes: oh-ace-closed"),
  );
  assert.ok(
    errors.includes(
      "Unavailable or unconfirmed program promoted: oh-ace-closed",
    ),
  );
  assert.ok(
    errors.includes(
      "Unavailable or unconfirmed program promoted: mt-special-needs-esa",
    ),
  );
  assert.ok(
    errors.includes("Unsupported parent purchase route: oh-home-credit"),
  );
});

test("onboarding requirements must cite known evidence separately from category facts", () => {
  const registry = copy();
  registry.programs = registry.programs.map((program) =>
    program.id === "in-esa"
      ? {
          ...program,
          onboarding: { statement: "Application", sourceIds: ["missing"] },
        }
      : program,
  );
  assert.ok(
    auditFundingRegistry(registry).errors.includes(
      "Unknown onboarding source missing: in-esa",
    ),
  );
});
