import { test } from "node:test";
import assert from "node:assert/strict";
import type { Procedure, ProcStep } from "../engine/types.ts";
import type { Run, StepRecord } from "../store/runs.ts";
import { exportName, outcomeOf, photoPath, runReport } from "./report.ts";

const detail = { trainee: "", operator: "", inspector: "" };
const step = (ord: number, check_kind: ProcStep["check_kind"], section_ids: string[]): ProcStep => ({
  proc_id: "p", ord, text: `Step ${ord}`, detail, check_kind, section_ids, deficiency: null, lang: "en",
});
const proc: Procedure = {
  proc_id: "p", title: "Shift inspection", kind: "inspection", summary: "", roles: ["operator"], lang: "en",
  steps: [step(1, "pass_fail", ["29cfr1926.1412(d)(1)(i)"]), step(2, "value", ["a"]), step(3, "note", []), step(4, "photo", ["b"]), step(5, "pass_fail", ["c"])],
};
const SHA = "a".repeat(64);
// Local, so the test does not load the persisted store (it needs localStorage).
const emptyStep = (): StepRecord => ({ result: null, value: "", note: "", photoIds: [], at: null });
const run = (): Run => ({
  id: "run-abc-123456", procId: "p", title: "Shift inspection", role: "operator", equipment: "mobile",
  startedAt: "2026-11-27T10:00:00.000Z", finishedAt: "2026-11-27T10:30:00.000Z",
  steps: [
    { ...emptyStep(), result: "fail", note: "Worn at the sprocket ", at: "2026-11-27T10:01:00.000Z" },
    { ...emptyStep(), value: "95", at: "2026-11-27T10:02:00.000Z" },
    { ...emptyStep(), note: "  ", at: "2026-11-27T10:03:00.000Z" },
    { ...emptyStep(), photoIds: ["ph1"], at: "2026-11-27T10:04:00.000Z" },
    emptyStep(),
  ],
});
const pack = { pack_id: "crane-us", version: "2026.11.27-1" };

test("a run maps to harvest-run/1 with every step listed", () => {
  const r = runReport(run(), proc, pack, new Map([["ph1", SHA]]));
  assert.equal(r.format, "harvest-run/1");
  assert.deepEqual(
    { pack_id: r.pack_id, pack_version: r.pack_version, run_id: r.run_id, proc_id: r.proc_id, title: r.title, role: r.role, equip_id: r.equip_id, asset: r.asset, status: r.status, steps_known: r.steps_known, started_at: r.started_at, finished_at: r.finished_at },
    { pack_id: "crane-us", pack_version: "2026.11.27-1", run_id: "run-abc-123456", proc_id: "p", title: "Shift inspection", role: "operator", equip_id: "mobile", asset: null, status: "complete", steps_known: true, started_at: "2026-11-27T10:00:00.000Z", finished_at: "2026-11-27T10:30:00.000Z" },
  );
  assert.deepEqual(r.steps.map((s) => s.ord), [1, 2, 3, 4, 5]);
  assert.deepEqual(r.steps.map((s) => s.outcome), ["fail", "value", null, "photo", null]);
  assert.deepEqual(r.steps.map((s) => s.deficiency), [true, false, false, false, false]);
  assert.deepEqual(r.steps[0], {
    ord: 1, text: "Step 1", section_ids: ["29cfr1926.1412(d)(1)(i)"], check_kind: "pass_fail", outcome: "fail",
    value: null, note: "Worn at the sprocket", photos: [], structured: null, deficiency: true, recorded_at: "2026-11-27T10:01:00.000Z",
  });
  assert.equal(r.steps[1]!.value, "95");
  assert.deepEqual(r.steps[3]!.photos, [{ path: photoPath("ph1"), sha256: SHA }]);
  // A blank note is not a recorded note step; an untouched step has no time.
  assert.equal(r.steps[2]!.recorded_at, null);
  assert.equal(r.steps[4]!.recorded_at, null);
  assert.deepEqual(Object.keys(r.steps[0]!).sort(), ["check_kind", "deficiency", "note", "ord", "outcome", "photos", "recorded_at", "section_ids", "structured", "text", "value"]);
});

test("an unfinished run is open", () => {
  assert.equal(runReport({ ...run(), finishedAt: null }, proc, pack, new Map([["ph1", SHA]])).status, "open");
});

test("when the pack's procedure changed, only recorded steps are listed, without pack text", () => {
  const changed = { ...proc, steps: proc.steps.slice(0, 3) };
  const r = runReport(run(), changed, pack, new Map([["ph1", SHA]]));
  assert.equal(r.steps_known, false);
  assert.equal(r.title, "Shift inspection");
  assert.deepEqual(r.steps.map((s) => s.ord), [1, 2, 4]);
  for (const s of r.steps) assert.deepEqual([s.text, s.check_kind, s.section_ids], [null, null, []]);
});

test("a photo without a hash is an error, not a silent gap", () => {
  assert.throws(() => runReport(run(), proc, pack, new Map()), /ph1/);
  assert.throws(() => runReport(run(), proc, pack, new Map([["ph1", "xyz"]])), /ph1/);
});

test("outcomes follow the core's rules per check kind", () => {
  assert.equal(outcomeOf("pass_fail", { ...emptyStep(), result: "pass" }), "pass");
  assert.equal(outcomeOf("value", { ...emptyStep(), value: " " }), null);
  assert.equal(outcomeOf("photo", emptyStep()), null);
  assert.throws(() => outcomeOf("dance", emptyStep()));
});

test("export names are safe file names", () => {
  assert.equal(exportName(run()), "p-2026-11-27-123456.zip");
  assert.match(exportName({ ...run(), procId: "../x y" }), /^x-y-2026-11-27-123456\.zip$/);
});
