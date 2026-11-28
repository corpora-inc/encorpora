/**
 * No text a model wrote ever reaches a screen. Two halves:
 *
 * 1. Every string field reachable from the model-assisted methods' results is
 *    classified here. A new field (the engine's types gain one) fails this
 *    test until someone decides what it is; a field classified `model` must be
 *    dropped by `shown.ts`.
 * 2. `shown.ts` run over responses carrying model-written text (an `other`
 *    cause, action and part, a note, an unknown heading) shows none of it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ASK_HEADINGS, shownAsk, shownProposal, shownSuggest } from "./shown.ts";
import type { LessonProposal, StepAsk, SymptomSuggest } from "./types.ts";

const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const types = readFileSync(`${repo}harvest/api/types.ts`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** What each string field is. `pack`: the pack's printed text. `fixed`: one of the engine's fixed strings.
 * `id`: an id, version, time or model name (never prose). `model`: may be model-written; shown.ts drops it. */
const CLASSIFIED: Record<string, "pack" | "fixed" | "id" | "model" | "not shown"> = {
  "SymptomSuggest.model": "id",
  "SymptomSuggest.prompt_version": "id",
  "SymptomEntry.also": "pack",
  "SymptomEntry.causes": "pack",
  "SymptomEntry.statement": "pack",
  "SymptomEntry.symptom_id": "id",
  "SymptomEntry.title": "pack",
  "SymptomEntry.tree_id": "id",
  "LessonPrefill.model": "id",
  "LessonPrefill.prompt_version": "id",
  "ProposedText.label": "id",
  "ProposedText.value": "model",
  "ProposedParts.labels": "id",
  "PartUsed.ident": "pack",
  "PartUsed.qty": "pack",
  "PartUsed.text": "model",
  "StepAsk.heading": "fixed",
  "StepAsk.model": "id",
  "StepAsk.prompt_version": "id",
  "ShownSentence.text": "pack",
  "LlmStatus.model": "id",
  "LlmStatus.prompt_versions": "id",
  "LlmLast.at": "id",
  "LlmLast.error": "not shown",
  "LlmLast.method": "id",
};

/** Types that carry no model output (the search, citations, applicability): not walked. */
const TRUSTED = new Set(["SymptomSearch", "Citation", "Applicability", "Confidence"]);
const ROOTS = { "symptom.suggest": "SymptomSuggest", "lesson.prefill": "LessonPrefill", "step.ask": "StepAsk", "llm.status": "LlmStatus" };

function interfaces() {
  const out = new Map<string, [string, string][]>();
  for (const m of types.matchAll(/export interface (\w+) \{([\s\S]*?)\n\}/g)) {
    const fields = [...m[2]!.matchAll(/^ {2}(\w+)\??: (.+);$/gm)].map((f) => [f[1]!, f[2]!] as [string, string]);
    out.set(m[1]!, fields);
  }
  return out;
}
const aliases = new Map([...types.matchAll(/export type (\w+) =\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));

function stringFields(root: string): string[] {
  const ifs = interfaces();
  const seen = new Set<string>();
  const found: string[] = [];
  const walk = (name: string) => {
    if (seen.has(name) || TRUSTED.has(name)) return;
    seen.add(name);
    for (const [field, ty] of ifs.get(name) ?? []) {
      for (let tok of ty.split("|").map((t) => t.trim())) {
        tok = tok.replace(/\[\]$/, "").replace(/^Record<string, (.+)>$/, "$1");
        if (tok === "string") found.push(`${name}.${field}`);
        else if (ifs.has(tok)) walk(tok);
        else if (aliases.has(tok) && !/^"/.test(aliases.get(tok)!)) walk(aliases.get(tok)!);
      }
    }
  };
  walk(root);
  return found;
}

test("every string a model-assisted method returns is classified", () => {
  const all = new Set<string>();
  for (const [method, root] of Object.entries(ROOTS)) {
    assert.ok(interfaces().has(root), `${method}: ${root} not in the generated types`);
    for (const path of stringFields(root)) {
      all.add(path);
      assert.ok(path in CLASSIFIED, `${method} returns ${path}, a string nobody has classified: decide whether a model can write it before any screen shows it`);
    }
  }
  // And the walk sees them all (a parser that found nothing would pass the loop above).
  assert.deepEqual([...all].sort(), Object.keys(CLASSIFIED).sort());
});

test("the fixed headings are the engine's", () => {
  const rust = readFileSync(`${repo}harvest/core/src/assist/prompts.rs`, "utf8");
  const block = rust.match(/T3_TEMPLATES: \[&str; \d+\] = \[([\s\S]*?)\];/)![1]!;
  assert.deepEqual([...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]), [...ASK_HEADINGS]);
});

const MODEL = "MODEL TEXT";
const has = (x: unknown) => JSON.stringify(x).includes(MODEL);

test("a model's own words in a lesson proposal are never shown", () => {
  const p: LessonProposal = {
    job_id: { value: "job-1", source: "job", label: null },
    asset_id: { value: "unit-101", source: "job", label: null },
    equip_id: { value: "pump40-diesel", source: "job", label: null },
    tree_id: { value: "t-nocrank", source: "job", label: null },
    symptom_id: { value: "s-nocrank", source: "job", label: null },
    cause: { value: "Start fuse F2 blown.", source: "model", label: "C2" },
    action: { value: `${MODEL} swapped it`, source: "model", label: "other" },
    parts: { value: [{ text: "Fuse, 15 A", ident: "F2", qty: null }, { text: `${MODEL} zip tie`, ident: null, qty: null }], labels: ["P1", "other"], source: "model" },
    minutes: { value: 25, source: "model" },
    note: { value: `${MODEL} happened twice`, source: "model", label: null },
  };
  const s = shownProposal(p);
  assert.equal(has(s), false);
  assert.deepEqual(s.cause, { value: "Start fuse F2 blown.", from: "model" });
  assert.deepEqual(s.action, { value: null, from: "unknown" });
  assert.deepEqual(s.parts, { value: [{ text: "Fuse, 15 A", ident: "F2", qty: null }], from: "model" });
  assert.deepEqual(s.minutes, { value: 25, from: "model" });
  assert.deepEqual(s.note, { value: null, from: "unknown" });
});

test("an answer shows a fixed heading and cited sentences only", () => {
  const cite = { citation: "Table 3-1, Question 1", page_label: "3-2", section_id: "m40.3-1.q1", page_asset_id: "page-3-2" } as unknown as NonNullable<StepAsk["sentences"][number]["citation"]>;
  const r: StepAsk = {
    decision: "answer",
    elapsed_ms: 1,
    heading: `${MODEL}: here is what I think`,
    model: "scripted",
    prompt_version: "t3",
    nearest: [],
    sentences: [
      { text: "Pull F2 and check it with the multimeter.", citation: cite },
      { text: `${MODEL} uncited`, citation: null },
    ],
  };
  const s = shownAsk(r);
  assert.equal(has(s), false);
  assert.equal(s.heading, "");
  assert.equal(s.sentences.length, 1);
  assert.equal(shownAsk({ ...r, sentences: [r.sentences[1]!] }).decision, "decline");
});

test("a suggestion shows the pack's entries, with no scores", () => {
  const r = {
    decision: "suggest",
    elapsed_ms: 1,
    model: "scripted",
    prompt_version: "t1",
    search: {},
    entries: [{ symptom_id: "s-1", tree_id: "t-1", title: "Engine will not crank", statement: "The engine does not crank.", also: [], causes: ["Battery discharged."], confidence: "closest", match: 0.42, applicability: null }],
  } as unknown as SymptomSuggest;
  const s = shownSuggest(r);
  assert.equal(JSON.stringify(s).includes("0.42"), false);
  assert.deepEqual(Object.keys(s.entries[0]!).sort(), ["applicability", "statement", "symptom_id", "title", "tree_id"]);
});
