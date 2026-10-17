import test from "node:test";
import assert from "node:assert/strict";
import { auditDossiers } from "../src/funding/dossier.js";
import { providerDossiers } from "../src/funding/provider-dossiers.js";
import { moMsTnDossiers } from "../src/funding/mo-ms-tn-dossiers.js";
import { fundingRegistry } from "../src/funding/registry.js";
const ids = fundingRegistry.programs.map((p) => p.id);
test("materials qualification stays separate from operational approval", () => {
  assert.deepEqual(auditDossiers(providerDossiers, "2026-10-17", ids), []);
  for (const d of moMsTnDossiers.dossiers) {
    assert.equal(d.offerEnabled, false);
    assert.equal(d.applicationStatus, "unsent");
    assert.equal(
      d.requirements.find((r) => r.dimension === "term")!.finding,
      "unresolved",
    );
  }
  const promoted = structuredClone(providerDossiers);
  Object.assign(
    promoted.dossiers.find((d) => d.programId === "mo-moscholars")!,
    { offerEnabled: true },
  );
  assert.ok(
    auditDossiers(promoted, "2026-10-17", ids).some((e) =>
      e.includes("Research cannot enable"),
    ),
  );
});
test("unavailable documents cannot silently become complete qualification", () => {
  for (const id of ["ms-esa", "tn-iea", "tn-esa"]) {
    const d = moMsTnDossiers.dossiers.find((d) => d.programId === id)!;
    assert.ok(
      d.requirements.every(
        (r) => r.finding === "unresolved" && r.unresolvedQuestion,
      ),
    );
  }
  const missing = structuredClone(providerDossiers);
  missing.sources = missing.sources.filter((s) => s.id !== "mo-parent-2026");
  assert.ok(
    auditDossiers(missing, "2026-10-17", ids).some((e) =>
      e.includes("Missing evidence"),
    ),
  );
  const stale = structuredClone(providerDossiers);
  stale.sources.find((s) => s.id === "tn-efs-faq")!.checkedOn = "2026-07-01";
  assert.ok(
    auditDossiers(stale, "2026-10-17", ids).some((e) =>
      e.includes("Stale source"),
    ),
  );
});
