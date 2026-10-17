import test from "node:test";
import assert from "node:assert/strict";
import { auditDossiers } from "../src/funding/dossier.js";
import { providerDossiers } from "../src/funding/provider-dossiers.js";
import { odysseyStateDossiers } from "../src/funding/odyssey-state-dossiers.js";
import { fundingRegistry } from "../src/funding/registry.js";
const ids = fundingRegistry.programs.map((p) => p.id);
test("state-specific dossiers resolve shared evidence without duplicate identity", () => {
  assert.deepEqual(auditDossiers(providerDossiers, "2026-10-17", ids), []);
  assert.deepEqual(
    odysseyStateDossiers.dossiers.map((d) => d.programId).sort(),
    ["ga-promise", "ia-students-first", "la-gator"],
  );
  const broken = structuredClone(providerDossiers);
  broken.sources = broken.sources.filter((s) => s.id !== "odyssey-payment");
  assert.ok(
    auditDossiers(broken, "2026-10-17", ids).some((e) =>
      e.includes("Missing evidence"),
    ),
  );
});
test("an application source cannot replace exact SKU term evidence", () => {
  const x = structuredClone(providerDossiers);
  const d = x.dossiers.find((d) => d.programId === "ia-students-first")!;
  d.requirements = d.requirements.filter((r) => r.dimension !== "term");
  assert.ok(
    auditDossiers(x, "2026-10-17", ids).some((e) =>
      e.includes("Missing or duplicate term"),
    ),
  );
  const y = structuredClone(providerDossiers);
  y.sources.find((s) => s.id === "la-eligibility")!.checkedOn = "2026-10-18";
  assert.ok(
    auditDossiers(y, "2026-10-17", ids).some((e) =>
      e.includes("Invalid source date"),
    ),
  );
});
