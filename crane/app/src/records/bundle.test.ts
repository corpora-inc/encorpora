import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import type { Procedure } from "../engine/types.ts";
import type { Run, StepRecord } from "../store/runs.ts";
import { MissingPhotoError, runBundle } from "./bundle.ts";

const rec = (p: Partial<StepRecord>): StepRecord => ({ result: null, value: "", note: "", photoIds: [], at: null, ...p });
const detail = { trainee: "", operator: "", inspector: "" };
const proc: Procedure = {
  proc_id: "p", title: "Check", kind: "inspection", summary: "", roles: ["operator"], lang: "en",
  steps: [
    { proc_id: "p", ord: 1, text: "Hook", detail, check_kind: "pass_fail", section_ids: ["s"], deficiency: null, lang: "en" },
    { proc_id: "p", ord: 2, text: "Pads", detail, check_kind: "photo", section_ids: [], deficiency: null, lang: "en" },
  ],
};
const run: Run = {
  id: "run-x-abcdef", procId: "p", title: "Check", role: "inspector", equipment: null,
  startedAt: "2026-11-27T10:00:00.000Z", finishedAt: null,
  steps: [rec({ result: "fail", photoIds: ["a"], at: "2026-11-27T10:01:00.000Z" }), rec({ photoIds: ["a", "b"], at: "2026-11-27T10:02:00.000Z" })],
};
const photos: Record<string, Uint8Array<ArrayBuffer>> = { a: new Uint8Array([1, 2, 3]), b: new Uint8Array([9, 9]) };

test("the bundle holds run.json and each photo once, hashes matching the bytes", async () => {
  const b = await runBundle(run, proc, { pack_id: "crane-us", version: "v1" }, async (id) => (photos[id] ? new Blob([photos[id]!]) : null));
  assert.equal(b.name, "p-2026-11-27-abcdef.zip");
  const files = unzipSync(b.bytes);
  assert.deepEqual(Object.keys(files).sort(), ["photos/a.jpg", "photos/b.jpg", "run.json"]);
  const report = JSON.parse(new TextDecoder().decode(files["run.json"]));
  assert.equal(report.format, "harvest-run/1");
  for (const step of report.steps)
    for (const p of step.photos) assert.equal(p.sha256, createHash("sha256").update(files[p.path]!).digest("hex"), p.path);
  assert.deepEqual(report.steps[1].photos.map((p: { path: string }) => p.path), ["photos/a.jpg", "photos/b.jpg"]);
});

test("a photo gone from storage fails the export", async () => {
  await assert.rejects(runBundle(run, proc, { pack_id: "crane-us", version: "v1" }, async () => null), MissingPhotoError);
});
