#!/usr/bin/env node
/**
 * Capture the /design gallery's sample data from the real engine: every
 * response is exactly what `harvest serve` returned for the fictional Model 40
 * pump fixture, so the gallery shows the engine's own shapes and words.
 *
 *   harvest fixture .engine/pump40 --maint --samples .engine/pump40-samples
 *   node scripts/model-stub.mjs 4390
 *   harvest serve .engine/pump40 --records .engine/capture.db --pubkey <test key> --bind 127.0.0.1:4322 \
 *     --llm http://127.0.0.1:4390/v1 --llm-model scripted --prefill cause,action,parts,minutes,note
 *   harvest serve .engine/pump40 --records .engine/capture-off.db --pubkey <test key> --bind 127.0.0.1:4326
 *   MAINT_ENGINE=http://127.0.0.1:4322 MAINT_ENGINE_OFF=http://127.0.0.1:4326 node scripts/capture-samples.mjs
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
w = await answer2({ outcome: w.step.record.branches.find((b) => /^cranks$/i.test(b.label)).outcome });
steps.end = w;

// A goto into another table, and the job after following it.
let g = await call("job.start", { asset_id: unit.asset_id, symptom_id: "s-nocrank", level });
const job4 = g.job.job_id;
const answer4 = (p) => call("job.answer", { job_id: job4, node_id: g.step.node.node_id, ...p });
g = await answer4({ outcome: "done" });
g = await answer4({ outcome: "no" });
g = await answer4({ outcome: g.step.record.branches.find((b) => /temperature/i.test(b.label)).outcome });
steps.goto = g;
steps.followed = await call("job.follow", { job_id: job4 });

// The overheat tree's three-way choice.
let h = await call("job.start", { asset_id: unit.asset_id, symptom_id: "s-hot", level });
const job3 = h.job.job_id;
const answer3 = (p) => call("job.answer", { job_id: job3, node_id: h.step.node.node_id, ...p });
h = await answer3({ outcome: "done" });
h = await answer3({ outcome: "yes" });
steps.choice = h;
out.steps = steps;

out.decode = await call("signal.decode", { asset_id: unit.asset_id, format: "j1939_candump", input: "(1700000000.000000) can0 18FECA00#0401A8000101FFFF\n(1700000001.000000) can0 18FECA00#0401A8000101FFFF\n" });
out.closestMatch = await call("signal.match", { asset_id: unit.asset_id, observations: [{ signal_kind: null, value: "engine running hot" }] });
out.task = await call("task.get", { proc_id: "proc-battery", equip_id: unit.equip_id });
const run = await call("run.start", { proc_id: "proc-battery", asset: unit.asset_id, equip_id: unit.equip_id, role: level });
const r1 = await call("run.record", { run_id: run.run_id, ord: 1, outcome: "pass" });
const r2 = await call("run.record", { run_id: run.run_id, ord: 2, outcome: "pass" });
// The run as the app holds it after two steps: the start, plus each recorded step.
out.run = { ...run, steps: [r1.record, r2.record] };
// The model-assisted methods, against the scripted model (scripts/model-stub.mjs): every decision.
out.llmBefore = await call("llm.status");
const VAGUE = "the pump engine is acting up";
out.suggest = {
  route: await call("symptom.suggest", { asset_id: unit.asset_id, text: "engine does not crank" }),
  suggest: await call("symptom.suggest", { asset_id: unit.asset_id, text: `${VAGUE} and making a weird noise` }),
  clarify: await call("symptom.suggest", { asset_id: unit.asset_id, text: `${VAGUE} and there is a rattle` }),
  list: await call("symptom.suggest", { asset_id: unit.asset_id, text: `${VAGUE} and grinding` }),
};
out.stepAsk = {
  answer: await call("step.ask", { job_id: job3, question: "How do I check this?" }),
  decline: await call("step.ask", { job_id: job3, question: "What colour is the paint?" }),
};
out.prefill = await call("lesson.prefill", { job_id: job2, text: "The fuse let go. Swapped it, took 25 minutes." });
out.llm = await call("llm.status");
if (process.env.MAINT_ENGINE_OFF) {
  const res = await fetch(`${process.env.MAINT_ENGINE_OFF}/api/llm.status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  out.llmOff = (await res.json()).result;
}
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

// Reference tables, read for the unit before and after its firmware is known, and the codes that resolve to rows.
out.tables = await call("table.list");
out.attrsEmpty = await call("asset.attrs", { asset_id: unit.asset_id });
out.ref = {
  codes: await call("table.get", { table_id: "tab-3-3", asset_id: unit.asset_id }),
  specs: await call("table.get", { table_id: "tab-6-1", asset_id: unit.asset_id }),
  lookup: await call("table.lookup", { query: "E52", asset_id: unit.asset_id }),
  lookupNone: await call("table.lookup", { query: "E99", asset_id: unit.asset_id }),
  search: await call("manual.search", { query: "E52 inverter", asset_id: unit.asset_id, k: 6 }),
  matchTree: await call("signal.match", { asset_id: unit.asset_id, observations: [{ signal_kind: null, value: "E21" }] }),
  matchUnknown: await call("signal.match", { asset_id: unit.asset_id, observations: [{ signal_kind: null, value: "E52" }] }),
};
out.attrsTyped = await call("asset.set_attrs", { asset_id: unit.asset_id, source: "typed", values: { firmware: "2.6" } });
out.ref.codesKnown = await call("table.get", { table_id: "tab-3-3", asset_id: unit.asset_id });
out.ref.matchKnown = await call("signal.match", { asset_id: unit.asset_id, observations: [{ signal_kind: null, value: "E52" }] });
out.attrsPlate = await call("asset.set_attrs", { asset_id: unit.asset_id, source: "plate", plate: { serial: unit.serial } });
out.attrsAll = await call("asset.set_attrs", { asset_id: unit.asset_id, source: "typed", values: { sb_40_07: "incorporated" } });
out.ref.specsKnown = await call("table.get", { table_id: "tab-6-1", asset_id: unit.asset_id });
// Back to unknown, so later captures read as a unit with nothing answered.
await call("asset.set_attrs", { asset_id: unit.asset_id, source: "typed", values: { firmware: null, sb_40_07: null } });
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
