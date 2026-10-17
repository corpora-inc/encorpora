import test from "node:test";
import assert from "node:assert/strict";
import { auditDossiers } from "../src/funding/dossier.js";
import { providerDossiers } from "../src/funding/provider-dossiers.js";
import { inNhScDossiers } from "../src/funding/in-nh-sc-dossiers.js";
import { fundingRegistry } from "../src/funding/registry.js";
const ids = fundingRegistry.programs.map((p) => p.id);
test("current state evidence joins the inventory without enabling applications or offers", () => {
  assert.deepEqual(auditDossiers(providerDossiers, "2026-10-17", ids), []);
  assert.deepEqual(
    inNhScDossiers.dossiers.map((d) => d.programId),
    ["in-esa", "nh-efa", "sc-estf"],
  );
  for (const d of inNhScDossiers.dossiers) {
    assert.equal(d.applicationStatus, "unsent");
    assert.equal(d.offerEnabled, false);
  }
  const missing = structuredClone(providerDossiers);
  missing.sources = missing.sources.filter((s) => s.id !== "in-handbook");
  assert.ok(
    auditDossiers(missing, "2026-10-17", ids).some((e) =>
      e.includes("Missing evidence"),
    ),
  );
});
test("a stale source or missing term question cannot pass evidence validation", () => {
  const stale = structuredClone(providerDossiers);
  stale.sources.find((s) => s.id === "sc-provider-guide")!.checkedOn =
    "2026-07-18";
  assert.ok(
    auditDossiers(stale, "2026-10-17", ids).some((e) => e.includes("Stale")),
  );
  const missing = structuredClone(providerDossiers);
  const nh = missing.dossiers.find((d) => d.programId === "nh-efa")!;
  nh.requirements = nh.requirements.filter((r) => r.dimension !== "term");
  assert.ok(
    auditDossiers(missing, "2026-10-17", ids).some((e) =>
      e.includes("Missing or duplicate term"),
    ),
  );
});
