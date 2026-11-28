#!/usr/bin/env node
/**
 * Capture the /design gallery's sample data from the real engine: every
 * response is exactly what `harvest serve` returned for the fictional Model 40
 * pump fixture, so the gallery shows the engine's own shapes and words.
 *
 *   harvest fixture .engine/pump40 --maint --samples .engine/pump40-samples
 *   harvest serve .engine/pump40 --records .engine/capture.db --pubkey <test key> --bind 127.0.0.1:4322
 *   MAINT_ENGINE=http://127.0.0.1:4322 node scripts/capture-samples.mjs
 *
 * Use a fresh records file: the capture imports the fleet and installs the
 * field-note bundle. Writes src/design/captured.json and the pack's figure and
 * page images to src/design/assets/.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const base = process.env.MAINT_ENGINE ?? "http://127.0.0.1:4322";
const samples = process.env.MAINT_SAMPLES ?? path.join(root, ".engine", "pump40-samples");

async function call(method, params = {}) {
  const res = await fetch(`${base}/api/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
  const body = await res.json();
  if (!body.ok) throw new Error(`${method}: ${body.error.code}: ${body.error.message}`);
  return body.result;
}

const out = {};
const registry = JSON.parse(await readFile(path.join(samples, "assets.json"), "utf8"));
const bundle = JSON.parse(await readFile(path.join(samples, "field-bundle.json"), "utf8"));
await call("asset.import", { registry });
await call("field.install", { bundle });

out.pack = await call("pack.info");
out.equipment = await call("equip.list");
out.trees = await call("tree.list");
out.tasks = await call("task.list");
out.assets = await call("asset.list");
const unit = out.assets.find((a) => a.equip_id?.endsWith("diesel")) ?? out.assets[0];
const level = out.pack.levels[0].id;
const level2 = out.pack.levels[1]?.id ?? level;

out.resolve = {
  resolved: await call("equip.resolve", { serial: unit.serial }),
  ambiguous: await call("equip.resolve", { text: "Model 40" }),
  none: await call("equip.resolve", { serial: "ZZ-0001" }),
};

out.search = {
  results: await call("symptom.search", { asset_id: unit.asset_id, text: "engine does not crank" }),
  none: await call("symptom.search", { asset_id: unit.asset_id, text: "smells like toast" }),
  closest: await call("symptom.search", { asset_id: unit.asset_id, text: "engine is hot" }),
  codes: await call("symptom.search", { asset_id: unit.asset_id, observations: [{ signal_kind: "j1939.dm1", value: "spn:168/fmi:1" }] }),
};

// A no-crank job down the measured-value branch, back, and on to the relay test.
const steps = {};
let v = await call("job.start", { asset_id: unit.asset_id, symptom_id: "s-nocrank", level });
const job = v.job.job_id;
steps.symptom = v;
const answer = (p) => call("job.answer", { job_id: job, node_id: v.step.node.node_id, ...p });
v = await answer({ outcome: "done" });
steps.check = v;
steps.checkLevel2 = await call("job.get", { job_id: job, level: level2 });
v = await answer({ outcome: "yes" });
steps.value = v;
v = await answer({ value: 10.8, unit: "V" });
steps.action = v;
v = await call("job.back", { job_id: job });
steps.back = v;
v = await answer({ value: 12.7, unit: "V" });
v = await answer({ outcome: "yes" });
steps.passfail = v;
v = await answer({ outcome: "pass" });
steps.escalate = v;

// A second job that ends with the fault corrected.
let w = await call("job.start", { asset_id: unit.asset_id, symptom_id: "s-nocrank", level });
const job2 = w.job.job_id;
const answer2 = (p) => call("job.answer", { job_id: job2, node_id: w.step.node.node_id, ...p });
w = await answer2({ outcome: "done" });
w = await answer2({ outcome: "no" });
steps.actionCheck = w;
w = await answer2({ outcome: "yes" });
steps.end = w;

// The overheat tree's three-way choice.
let h = await call("job.start", { asset_id: unit.asset_id, symptom_id: "s-hot", level });
const job3 = h.job.job_id;
const answer3 = (p) => call("job.answer", { job_id: job3, node_id: h.step.node.node_id, ...p });
h = await answer3({ outcome: "done" });
h = await answer3({ outcome: "yes" });
steps.choice = h;
out.steps = steps;

out.task = await call("task.get", { proc_id: "proc-battery", equip_id: unit.equip_id });
const run = await call("run.start", { proc_id: "proc-battery", asset: unit.asset_id, equip_id: unit.equip_id, role: level });
const r1 = await call("run.record", { run_id: run.run_id, ord: 1, outcome: "pass" });
const r2 = await call("run.record", { run_id: run.run_id, ord: 2, outcome: "pass" });
// The run as the app holds it after two steps: the start, plus each recorded step.
out.run = { ...run, steps: [r1.record, r2.record] };
out.ask = await call("ask", { question: "How do I check fuse F2?", equip_id: unit.equip_id, scope: { tree_id: "t-nocrank" } });
out.askDeclined = await call("ask", { question: "What colour is the paint?", equip_id: unit.equip_id, scope: { tree_id: "t-nocrank" } });
out.closed = await call("job.close", {
  job_id: job2,
  resolution: "fixed",
  lesson: { job_id: job2, cause: "Start fuse F2 blown", action: "Replaced fuse F2", parts: [{ text: "Fuse, 15 A", qty: "1" }], minutes: 20, note: "Fuse holder was loose.", submit: true },
});
out.jobReport = await call("job.report", { job_id: job2 });
out.jobs = await call("job.list", {});
out.manualTop = await call("manual.children", { equip_id: unit.equip_id });
out.section = await call("manual.section", { section_id: "m40.3-1", equip_id: unit.equip_id });
out.manualSearch = await call("manual.search", { query: "battery voltage", equip_id: unit.equip_id, k: 8 });
out.tree = await call("tree.get", { tree_id: "t-nocrank" });
out.fieldNotes = await call("field.list");
const failed = await call("run.start", { proc_id: "proc-battery", asset: unit.asset_id, equip_id: unit.equip_id, role: level });
out.failedStep = await call("run.record", { run_id: failed.run_id, ord: 1, outcome: "fail" });
out.history = await call("asset.history", { asset_id: unit.asset_id });
out.lessons = await call("lesson.list", {});
out.outbox = await call("sync.status");
out.audit = await call("audit.list", { limit: 30 });
out.chain = await call("audit.verify");

await writeFile(path.join(root, "src/design/captured.json"), `${JSON.stringify(out, null, 1)}\n`);

// The pack's figures and pages, so the gallery shows them without an engine.
const dir = path.join(root, "src/design/assets");
await mkdir(dir, { recursive: true });
const seen = new Set();
for (const s of Object.values(steps)) for (const a of s.step?.assets ?? []) seen.add(a);
for (const a of seen) {
  const res = await fetch(`${base}/asset/${out.pack.pack_id}/${a.asset_id}`);
  if (!res.ok) throw new Error(`asset ${a.asset_id}: HTTP ${res.status}`);
  const ext = a.media_type === "image/svg+xml" ? "svg" : a.media_type.split("/")[1];
  await writeFile(path.join(dir, `${a.asset_id}.${ext}`), Buffer.from(await res.arrayBuffer()));
}
console.log(`captured ${Object.keys(out).length} groups, ${seen.size} assets`);
