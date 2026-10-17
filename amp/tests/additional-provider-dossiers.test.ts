import test from "node:test";
import assert from "node:assert/strict";
import { auditDossiers } from "../src/funding/dossier.js";
import { providerDossiers } from "../src/funding/provider-dossiers.js";
import { additionalProviderDossiers } from "../src/funding/additional-provider-dossiers.js";
import { firstWaveDossiers } from "../src/funding/first-wave-dossiers.js";
import { odysseyStateDossiers } from "../src/funding/odyssey-state-dossiers.js";
import { fundingRegistry } from "../src/funding/registry.js";
import { arUtWyDossiers } from "../src/funding/ar-ut-wy-dossiers.js";
import { inNhScDossiers } from "../src/funding/in-nh-sc-dossiers.js";
import { moMsTnDossiers } from "../src/funding/mo-ms-tn-dossiers.js";
const ids = fundingRegistry.programs.map((p) => p.id);
test("combined evidence preserves all route sets without promoting offers", () => {
  assert.deepEqual(auditDossiers(providerDossiers, "2026-10-17", ids), []);
  assert.deepEqual(providerDossiers.dossiers, [
    ...firstWaveDossiers.dossiers,
    ...additionalProviderDossiers.dossiers,
    ...odysseyStateDossiers.dossiers,
    ...arUtWyDossiers.dossiers,
    ...inNhScDossiers.dossiers,
    ...moMsTnDossiers.dossiers,
  ]);
  assert.deepEqual(
    additionalProviderDossiers.dossiers.map((d) => d.programId).sort(),
    ["al-choose", "nc-esa-plus", "wv-hope"],
  );
  for (const d of providerDossiers.dossiers) {
    assert.equal(d.offerEnabled, false);
    assert.equal(d.applicationStatus, "unsent");
  }
});
test("combined audit does not hide collisions or stale tranche evidence", () => {
  const duplicate = structuredClone(providerDossiers);
  duplicate.sources.push({ ...duplicate.sources[0] });
  assert.ok(
    auditDossiers(duplicate, "2026-10-17", ids).some((e) =>
      e.includes("Duplicate source"),
    ),
  );
  const stale = structuredClone(providerDossiers);
  stale.sources.find((s) => s.id === "wv-handbook")!.checkedOn = "2026-07-18";
  assert.ok(
    auditDossiers(stale, "2026-10-17", ids).some((e) => e.includes("Stale")),
  );
});
