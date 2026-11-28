#!/usr/bin/env node
/**
 * Build the FIXTURE pack the app runs on until the real pack ships.
 *
 *   node scripts/build-fixture.mjs <sections.json>
 *
 * <sections.json> is the eCFR index written by crane/content/verify/ecfr.py
 * (`python ecfr.py --out sections.json`). Sections and their exact text come
 * from it; everything else comes from scripts/fixture/authored.mjs. Every
 * quote is verified verbatim; the build fails on any mismatch, unknown
 * section or bad answer key. Output: src/engine/fixture/pack.json, rows in the
 * harvest/CONTRACT.md schema.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { fileURLToPath } from "node:url";
import * as A from "./fixture/authored.mjs";
import { rationaleProblems } from "../src/engine/rationale.ts";

const input = process.argv[2];
if (!input) {
  console.error("usage: build-fixture.mjs <sections.json>");
  process.exit(2);
}
const src = JSON.parse(readFileSync(input, "utf8"));
const norm = (s) => s.replace(/\s+/g, " ").trim();
const sha = (s) => createHash("sha256").update(s).digest("hex");
const errors = [];
const fail = (msg) => errors.push(msg);

// Sections: exact own text, document order, depth from the parent chain.
const byId = new Map();
const sections = [];
src.order.forEach((id, ord) => {
  const n = src.sections[id];
  const text = norm(n.own ?? "");
  let heading = n.heading ? norm(n.heading) : null;
  // "§ 1926.1408 Power line safety…" -> "Power line safety…"
  if (heading && n.kind === "section") heading = heading.replace(/^§\s*[0-9.]+\s*/, "");
  const parent = n.parent_id ?? null;
  const depth = parent ? (byId.get(parent)?.depth ?? 0) + 1 : 0;
  const row = { section_id: id, source_id: n.source_id, parent_id: parent, ord, depth, kind: n.kind, citation: n.citation, heading, text, text_sha256: sha(text), lang: "en" };
  byId.set(id, row);
  sections.push(row);
});

// Cross references: "§ 1926.1415", "§§ 1926.1415 and 1926.1416", "paragraph (b) of this section".
const xrefs = new Set();
const sectionOf = (id) => id.replace(/\(.*$/, "");
for (const s of sections) {
  const base = sectionOf(s.section_id);
  for (const m of s.text.matchAll(/§§?\s*((?:19\d\d\.\d+(?:\([a-zA-Z0-9]+\))*(?:,\s*|\s+and\s+|\s+through\s+)?)+)/g)) {
    for (const ref of m[1].matchAll(/(19\d\d\.\d+)((?:\([a-zA-Z0-9]+\))*)/g)) {
      const to = `29cfr${ref[1]}${ref[2]}`;
      const target = byId.has(to) ? to : byId.has(`29cfr${ref[1]}`) ? `29cfr${ref[1]}` : null;
      if (target && target !== s.section_id) xrefs.add(`${s.section_id}\t${target}`);
    }
  }
  for (const m of s.text.matchAll(/paragraphs? ((?:\([a-zA-Z0-9]+\))+) of this section/g)) {
    const to = `${base}${m[1]}`;
    if (byId.has(to) && to !== s.section_id) xrefs.add(`${s.section_id}\t${to}`);
  }
}

function checkSection(where, id) {
  if (!byId.has(id)) fail(`${where}: unknown section ${id}`);
}
function checkQuote(where, id, quote) {
  checkSection(where, id);
  const s = byId.get(id);
  if (s && !s.text.includes(norm(quote))) fail(`${where}: quote is not verbatim in ${id}: "${quote.slice(0, 80)}"`);
}
/**
 * A content-lane quote, placed exactly: table cells ("a | b") read as the
 * section text writes them, and a quote from a sub-paragraph of the cited
 * section is cited to that sub-paragraph.
 */
function citeQuote(where, id, quote) {
  checkSection(where, id);
  const q = norm(quote.replace(/\s*\|\s*/g, " "));
  if (byId.get(id)?.text.includes(q)) return { section_id: id, quote: q };
  const inside = sections.filter((s) => s.section_id.startsWith(`${id}(`) && s.text.includes(q)).sort((a, b) => b.depth - a.depth);
  if (inside[0]) return { section_id: inside[0].section_id, quote: q };
  fail(`${where}: quote is not verbatim in ${id} or its paragraphs: "${quote.slice(0, 80)}"`);
  return null;
}
function checkBody(where, body) {
  for (const seg of body) {
    if (seg.t === "quote") checkQuote(where, seg.section_id, seg.text);
    else if (seg.t === "cite") checkSection(where, seg.section_id);
    else if (seg.t === "diagram") {
      if (!A.diagrams.some((d) => d.diagram_id === seg.diagram_id)) fail(`${where}: unknown diagram ${seg.diagram_id}`);
    } else if (seg.t !== "text") fail(`${where}: unknown segment ${seg.t}`);
  }
  if (!body.some((seg) => seg.t === "cite")) fail(`${where}: no citation`);
}

const PROV = {
  prov_id: "fixture-hand-v1", backend: "human", model: "none", prompt_id: "fixture", prompt_version: "1", prompt_sha256: sha("fixture"),
  input_sha256: sha(JSON.stringify(src.sources)), output_sha256: "", created_at: new Date(0).toISOString(),
  verifier: "scripts/build-fixture.mjs verbatim check", verdict: "pass", notes: "Sample content for development. Not the release pack.",
};
const L = { lang: "en", prov_id: PROV.prov_id };

const terms = A.terms.map((t) => (checkQuote(`term ${t.term_id}`, t.section_id, t.quote), { ...t, ...L }));
const facts = A.facts.map((f) => (checkQuote(`fact ${f.fact_id}`, f.section_id, f.quote), { ...f, ...L }));
const explanations = A.explanations.map((e) => (checkSection(`explanation ${e.section_id}`, e.section_id), { ...e, ...L }));
const lessons = A.lessons.map((l) => (checkBody(`lesson ${l.lesson_id}`, l.body), { ...l, body: JSON.stringify(l.body), ...L }));
const diagrams = A.diagrams.map((d) => (d.section_ids.forEach((id) => checkSection(`diagram ${d.diagram_id}`, id)), { ...d, section_ids: JSON.stringify(d.section_ids), ...L }));
const skillIds = new Set(A.skills.map((s) => s.skill_id));
const questions = A.questions.map((q) => {
  if (!skillIds.has(q.skill_id)) fail(`question ${q.q_id}: unknown skill ${q.skill_id}`);
  q.section_ids.forEach((id) => checkSection(`question ${q.q_id}`, id));
  const k = Number(q.answer);
  if (!Number.isInteger(k) || k < 0 || k >= q.choices.length) fail(`question ${q.q_id}: bad key`);
  // Real feedback for every choice, or the pack does not build.
  for (const problem of rationaleProblems(q)) fail(`question ${problem}`);
  if (q.variant_of && !A.questions.some((o) => o.q_id === q.variant_of)) fail(`question ${q.q_id}: unknown base ${q.variant_of}`);
  return { ...q, choices: JSON.stringify(q.choices), rationales: JSON.stringify(q.rationales), section_ids: JSON.stringify(q.section_ids), ...L };
});
const answers = [];
const answer_alias = [];
for (const a of A.answers) {
  checkBody(`answer ${a.answer_id}`, a.body);
  const cites = [...new Set(a.body.filter((s) => s.t !== "text" && s.section_id).map((s) => s.section_id))];
  answers.push({ answer_id: a.answer_id, question: a.question, body: JSON.stringify(a.body), section_ids: JSON.stringify(cites), level: a.level, ...L });
  for (const alias of [a.question, ...a.aliases]) answer_alias.push({ alias: alias.toLowerCase(), answer_id: a.answer_id, lang: "en" });
}
// Procedures: every file in crane/content/procedures, the content lane's source of truth.
const procDir = fileURLToPath(new URL("../../content/procedures/", import.meta.url));
const procedures = readdirSync(procDir)
  .filter((f) => f.endsWith(".yaml"))
  .sort()
  .map((f) => parseYaml(readFileSync(procDir + f, "utf8")));
const procedure = [];
const proc_step = [];
for (const p of procedures) {
  if (p.steps.some((s, i) => s.ord !== i + 1)) fail(`procedure ${p.proc_id}: step ords are not 1..n`);
  procedure.push({ proc_id: p.proc_id, title: p.title, kind: p.kind, summary: p.summary, roles: JSON.stringify(p.roles), ...L });
  // Step ords are 1-based, as in packs from the pipeline (CONTRACT proc_step).
  p.steps.forEach((s, i) => {
    const ord = i + 1;
    s.section_ids.forEach((id) => checkSection(`step ${p.proc_id}#${ord}`, id));
    if (!["pass_fail", "value", "note", "photo"].includes(s.check_kind)) fail(`step ${p.proc_id}#${ord}: check_kind ${s.check_kind}`);
    for (const r of ["trainee", "operator", "inspector"]) if (!s.detail?.[r]) fail(`step ${p.proc_id}#${ord}: no ${r} detail`);
    const d = s.deficiency;
    // A deficiency cites a rule with its exact words, or (good practice, no rule) cites nothing; never half.
    if (d && (d.section_id == null) !== (d.quote == null)) fail(`step ${p.proc_id}#${ord} deficiency: section_id and quote go together`);
    const cited = d?.section_id ? citeQuote(`step ${p.proc_id}#${ord} deficiency`, d.section_id, d.quote) : null;
    const deficiency = d ? { guidance: d.guidance, action: d.action, section_id: cited?.section_id ?? null, quote: cited?.quote ?? null } : null;
    proc_step.push({ proc_id: p.proc_id, ord, text: s.text, detail: JSON.stringify(s.detail), check_kind: s.check_kind, section_ids: JSON.stringify(s.section_ids), deficiency: deficiency ? JSON.stringify(deficiency) : null, ...L });
  });
}
for (const [id, list] of Object.entries(A.prereqs)) for (const p of [id, ...list]) if (!skillIds.has(p)) fail(`prereq ${p}: unknown skill`);
for (const [role, ids] of Object.entries(A.starters)) for (const id of ids) if (!A.answers.some((a) => a.answer_id === id)) fail(`starter ${role}: unknown answer ${id}`);
for (const e of A.exams) for (const d of e.domains) for (const s of d.skillIds) if (!skillIds.has(s)) fail(`exam ${e.id}: unknown skill ${s}`);

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} fixture error(s).`);
  process.exit(1);
}

const pack = {
  pack_meta: {
    pack_id: "crane-us-fixture", version: "fixture-2026.11.27", schema_version: "1", fixture: "true", built_at: new Date(0).toISOString(),
    corpus_id: "crane-us", embedder_id: "none", embed_dim: "0", bake_backends: JSON.stringify(["human"]),
    source_count: String(Object.keys(src.sources).length), ecfr_date: src.date,
  },
  source: Object.values(src.sources).map((s) => ({ ...s, retrieved_at: src.date, media_type: "application/xml" })),
  section: sections,
  xref: [...xrefs].map((x) => { const [from_id, to_id] = x.split("\t"); return { from_id, to_id, kind: "cites" }; }),
  equipment: A.equipment.map((e) => ({ ...e, aliases: JSON.stringify(e.aliases) })),
  term: terms, fact: facts, explanation: explanations,
  topic: A.topics.map((t) => ({ ...t, lang: "en" })),
  skill: A.skills.map((s) => ({ ...s, lang: "en" })),
  lesson: lessons, diagram: diagrams, question: questions, answer: answers, answer_alias, procedure, proc_step,
  provenance: [PROV],
  // App-side data the schema does not carry yet: practice prerequisites, starters and exam blueprints.
  app: { prereqs: A.prereqs, starters: A.starters, exams: A.exams },
};
pack.pack_meta.row_counts = JSON.stringify(Object.fromEntries(Object.entries(pack).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length])));
const out = fileURLToPath(new URL("../src/engine/fixture/pack.json", import.meta.url));
writeFileSync(out, JSON.stringify(pack));
console.log(`wrote ${out}: ${sections.length} sections, ${pack.xref.length} xrefs, ${answers.length} answers, ${questions.length} questions, ${proc_step.length} steps`);
