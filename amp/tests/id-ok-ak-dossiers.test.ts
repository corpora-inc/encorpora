import test from "node:test";
import assert from "node:assert/strict";
import { auditDossiers } from "../src/funding/dossier.js";
import { idOkAkDossiers } from "../src/funding/id-ok-ak-dossiers.js";
import { providerDossiers } from "../src/funding/provider-dossiers.js";
import { fundingRegistry } from "../src/funding/registry.js";
const ids = fundingRegistry.programs.map((p) => p.id);

test("tax and district qualification requires evidence without enabling offers", () => {
  assert.deepEqual(auditDossiers(providerDossiers, "2026-10-17", ids), []);
  for (const dossier of idOkAkDossiers.dossiers) {
    assert.equal(dossier.offerEnabled, false);
    for (const dimension of [
      "term",
      "refund",
      "bundle",
      "printable-download",
    ]) {
      const row = dossier.requirements.find((r) => r.dimension === dimension)!;
      assert.equal(row.finding, "unresolved");
      assert.ok(row.unresolvedQuestion);
    }
  }
  const promoted = structuredClone(idOkAkDossiers);
  Object.assign(promoted.dossiers[0], { offerEnabled: true });
  assert.ok(
    auditDossiers(promoted, "2026-10-17", ids).some((e) =>
      e.includes("Research cannot enable"),
    ),
  );
});

test("missing district authority or stale tax rules fails the evidence gate", () => {
  const missing = structuredClone(idOkAkDossiers);
  missing.sources = missing.sources.filter(
    (s) => s.id !== "ak-district-directory",
  );
  assert.ok(
    auditDossiers(missing, "2026-10-17", ids).some((e) =>
      e.includes("Missing evidence"),
    ),
  );
  const stale = structuredClone(idOkAkDossiers);
  stale.sources.find((s) => s.id === "ok-homeschool-rules")!.checkedOn =
    "2026-07-01";
  assert.ok(
    auditDossiers(stale, "2026-10-17", ids).some((e) =>
      e.includes("Stale source"),
    ),
  );
  const unanswered = structuredClone(idOkAkDossiers);
  delete unanswered.dossiers[0].requirements.find(
    (r) => r.dimension === "term",
  )!.unresolvedQuestion;
  assert.ok(
    auditDossiers(unanswered, "2026-10-17", ids).some((e) =>
      e.includes("Missing resolution question"),
    ),
  );
});
