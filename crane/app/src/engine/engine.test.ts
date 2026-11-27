import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openFixture, type RawPack } from "./fixture.ts";
import { checkBody } from "./check.ts";
import { stem, tokens } from "./text.ts";

const raw = JSON.parse(readFileSync(new URL("./fixture/pack.json", import.meta.url), "utf8")) as RawPack;
const e = openFixture(raw);

test("the fixture is marked as a fixture and carries its sources", () => {
  assert.equal(e.info.fixture, true);
  assert.ok(e.info.sources.length >= 4);
  for (const s of e.info.sources) assert.match(s.sha256, /^[0-9a-f]{64}$/);
});

test("every baked answer passes the support check with nothing dropped", () => {
  for (const a of raw.answer) {
    const r = checkBody(JSON.parse(a.body), e.sections);
    assert.equal(r.dropped, 0, a.answer_id);
    assert.ok(r.citations.length > 0, a.answer_id);
  }
  for (const l of e.lessons) assert.equal(checkBody(l.body, e.sections).dropped, 0, l.lesson_id);
});

test("the support check drops a forged quote and an unknown cite", () => {
  const r = checkBody(
    [
      { t: "text", text: "claim" },
      { t: "quote", section_id: "29cfr1926.1408(a)(2)", text: "closer than 15 feet" },
      { t: "cite", section_id: "29cfr9999.1" },
      { t: "cite", section_id: "29cfr1926.1408(a)(2)" },
    ],
    e.sections,
  );
  assert.equal(r.quotes_ok, false);
  assert.equal(r.cites_ok, false);
  assert.equal(r.dropped, 2);
  assert.deepEqual(r.citations, ["29cfr1926.1408(a)(2)"]);
  const none = checkBody([{ t: "text", text: "unsupported" }, { t: "quote", section_id: "x", text: "y" }], e.sections);
  assert.deepEqual(none.body, [], "no support left means no claims");
});

test("paraphrases hit the answer cache", async () => {
  const cases: [string, string][] = [
    ["how close can I get to power lines", "a.powerline-clearance"],
    ["I need to learn about clearance", "a.powerline-clearance"],
    ["when do I need a signal person?", "a.signal-person"],
    ["what's on the shift inspection", "a.shift-inspection"],
    ["who can give the stop signal", "a.stop-signal"],
    ["ground conditions", "a.ground"],
    ["standing under a suspended load", "a.fall-zone"],
  ];
  for (const [q, id] of cases) {
    const r = await e.ask(q, { role: "operator", lang: "en" });
    assert.equal(r.mode, "baked", q);
    assert.equal(r.answer_id, id, q);
    assert.ok(r.citations.length > 0);
    assert.deepEqual(r.check, { quotes_ok: true, cites_ok: true, dropped: 0 });
  }
});

test("an answer adapts to the role when a role variant exists", async () => {
  const op = await e.ask("how close can I get to a power line", { role: "operator", lang: "en" });
  const tr = await e.ask("how close can I get to a power line", { role: "trainee", lang: "en" });
  assert.equal(op.answer_id, tr.answer_id);
  assert.notDeepEqual(op.body, tr.body);
  assert.equal(e.answer("a.powerline-clearance", "trainee")?.body[0]?.t, "text");
});

test("an uncovered question declines with the nearest sections", async () => {
  const r = await e.ask("rules for barge mounted cranes on water", { role: "operator", lang: "en" });
  assert.equal(r.mode, "declined");
  assert.deepEqual(r.body, []);
  assert.ok(r.nearest.length > 0);
  for (const id of r.nearest) assert.ok(e.sections.has(id));
  const empty = await e.ask("   ", { role: "operator", lang: "en" });
  assert.equal(empty.mode, "declined");
});

test("hierarchy: ancestors, children, root and cross references", () => {
  const path = e.ancestors("29cfr1926.1408(a)(2)(iii)(A)").map((s) => s.section_id);
  assert.deepEqual(path, ["29cfr1926.1408", "29cfr1926.1408(a)", "29cfr1926.1408(a)(2)", "29cfr1926.1408(a)(2)(iii)", "29cfr1926.1408(a)(2)(iii)(A)"]);
  assert.equal(e.rootOf("29cfr1926.1408(b)(3)")?.section_id, "29cfr1926.1408");
  assert.ok(e.children("29cfr1926.1408").length >= 8);
  assert.ok(e.xrefsFrom("29cfr1926.1412(d)(3)").includes("29cfr1926.1415"));
  assert.ok(e.xrefsTo("29cfr1926.1415").includes("29cfr1926.1412(d)(3)"));
});

test("static tables are consistent", () => {
  const skills = new Set(e.skills.map((s) => s.skill_id));
  for (const q of e.questions) {
    assert.ok(skills.has(q.skill_id));
    assert.equal(q.choices.length, q.rationales.length);
    for (const id of q.section_ids) assert.ok(e.sections.has(id), id);
  }
  for (const p of e.procedures) {
    assert.ok(p.steps.length > 0);
    p.steps.forEach((s, i) => assert.equal(s.ord, i + 1, "step ords are 1-based, as in packs"));
    for (const s of p.steps) for (const r of ["trainee", "operator", "inspector"] as const) assert.ok(s.detail[r]);
  }
  for (const r of ["trainee", "operator", "inspector"] as const) assert.ok(e.starters(r).length >= 3);
  for (const t of e.terms) assert.ok(e.sections.get(t.section_id)!.text.includes(t.quote!));
  assert.ok(e.explanation("29cfr1926.1408", "inspector", "en"));
  assert.equal(e.explanation("29cfr1926.1408", "inspector", "xx"), null);
});

test("tokenizer and stemmer", () => {
  assert.equal(stem("inspections"), stem("inspection"));
  assert.equal(stem("lines"), "line");
  assert.equal(stem("boxes"), "box");
  assert.deepEqual(tokens("How close to the power-lines?"), ["close", "power", "line"]);
  assert.deepEqual(tokens("1,000 kV"), ["1", "000", "kv"]);
});

test("search ranks the power line section first for a power line query", async () => {
  const hits = await e.search("minimum clearance distance power line voltage", 5);
  assert.ok(hits[0]!.section_id.startsWith("29cfr1926.14"));
  assert.ok(hits.some((h) => h.section_id.startsWith("29cfr1926.1408")));
});
