import test from "node:test";
import assert from "node:assert/strict";
import { auditDossiers } from "../src/funding/dossier.js";
import { firstWaveDossiers } from "../src/funding/first-wave-dossiers.js";
import { fundingRegistry } from "../src/funding/registry.js";
const programs = fundingRegistry.programs.map((p) => p.id);
const audit = (x = structuredClone(firstWaveDossiers), date = "2026-10-17") =>
  auditDossiers(x, date, programs);
test("first-wave dossiers cover registry priorities without enabling offers", () => {
  assert.deepEqual(audit(), []);
  assert.deepEqual(
    firstWaveDossiers.dossiers.map((d) => d.programId).sort(),
    fundingRegistry.programs
      .filter((p) => p.priority === "first-wave")
      .map((p) => p.id)
      .sort(),
  );
});
test("source dates fail closed at future, invalid and stale boundaries", () => {
  for (const date of ["2026-10-18", "2026-02-30", "2026-01-01"]) {
    const x = structuredClone(firstWaveDossiers);
    x.sources[0].checkedOn = date;
    assert.ok(audit(x).some((e) => /date|Stale/.test(e)));
  }
  assert.deepEqual(audit(undefined, "2027-01-15"), []);
  assert.ok(audit(undefined, "2027-01-16").some((e) => e.includes("Stale")));
});
test("missing term or resolution question cannot pass", () => {
  const x = structuredClone(firstWaveDossiers);
  x.dossiers[0].requirements = x.dossiers[0].requirements.filter(
    (r) => r.dimension !== "term",
  );
  assert.ok(audit(x).some((e) => e.includes("Missing or duplicate term")));
  const y = structuredClone(firstWaveDossiers);
  delete y.dossiers[0].requirements.find((r) => r.finding === "unresolved")!
    .unresolvedQuestion;
  assert.ok(audit(y).some((e) => e.includes("resolution question")));
});
test("unreferenced assertions, duplicate sources and credential URLs fail", () => {
  const x = structuredClone(firstWaveDossiers);
  x.dossiers[0].requirements[0].sourceIds = ["invented"];
  x.sources.push({ ...x.sources[0] });
  x.sources[1].url = "https://private:secret@example.com/";
  for (const expected of [
    "Missing evidence",
    "Duplicate source",
    "Unsafe source URL",
  ])
    assert.ok(audit(x).some((e) => e.includes(expected)));
});
test("research cannot promote commercial status via a cast", () => {
  const x = structuredClone(firstWaveDossiers);
  Object.assign(x.dossiers[0], {
    offerEnabled: true,
    applicationStatus: "approved",
  });
  assert.ok(audit(x).some((e) => e.includes("cannot enable")));
});
