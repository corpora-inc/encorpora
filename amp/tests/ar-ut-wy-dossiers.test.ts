import test from "node:test";
import assert from "node:assert/strict";
import { auditDossiers } from "../src/funding/dossier.js";
import { providerDossiers } from "../src/funding/provider-dossiers.js";
import { arUtWyDossiers } from "../src/funding/ar-ut-wy-dossiers.js";
import { fundingRegistry } from "../src/funding/registry.js";
const ids = fundingRegistry.programs.map((p) => p.id);
test("state dossiers resolve shared administrator evidence without promoting approvals", () => {
  assert.deepEqual(auditDossiers(providerDossiers, "2026-10-17", ids), []);
  assert.deepEqual(
    arUtWyDossiers.dossiers.map((d) => d.programId),
    ["ar-efa", "ut-fits-all", "wy-esa"],
  );
  for (const d of arUtWyDossiers.dossiers) {
    assert.equal(d.offerEnabled, false);
    assert.equal(d.applicationStatus, "unsent");
  }
  const missing = structuredClone(providerDossiers);
  missing.sources = missing.sources.filter((s) => s.id !== "ut-spending");
  assert.ok(
    auditDossiers(missing, "2026-10-17", ids).some((e) =>
      e.includes("Missing evidence"),
    ),
  );
});
test("state review evidence cannot silently expire or omit a required product dimension", () => {
  const stale = structuredClone(providerDossiers);
  stale.sources.find((s) => s.id === "wy-current")!.checkedOn = "2026-07-18";
  assert.ok(
    auditDossiers(stale, "2026-10-17", ids).some((e) => e.includes("Stale")),
  );
  const omitted = structuredClone(providerDossiers);
  const ar = omitted.dossiers.find((d) => d.programId === "ar-efa")!;
  ar.requirements = ar.requirements.filter(
    (r) => r.dimension !== "printable-download",
  );
  assert.ok(
    auditDossiers(omitted, "2026-10-17", ids).some((e) =>
      e.includes("Missing or duplicate printable-download"),
    ),
  );
});
