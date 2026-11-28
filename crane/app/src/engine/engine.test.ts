import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openFixture, type RawPack } from "./fixture.ts";
import { checkBody } from "./check.ts";
import { editDistance, highlight, matchWindow, spellingVariants, stem, tokens } from "./text.ts";

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

test("Ask never answers by phrasing: a question that once matched a cached answer gets the rules", async () => {
  // "who can give the stop signal" used to serve a cached "stop signal" answer over the signal sections.
  const r = await e.find("who can give the stop signal");
  assert.ok(!("answer_id" in r) && !("body" in r), "find returns search results, never an answer");
  assert.equal(r.groups[0]?.root_id, "29cfr1926.1419");
  assert.ok(!("ask" in e), "no phrasing lookup on the engine");
});

const first = async (q: string) => (await e.find(q)).groups[0]?.root_id;
const roots = async (q: string, n = 3) => (await e.find(q)).groups.slice(0, n).map((g) => g.root_id);

test("signal words reach the signal sections, however they are spelled", async () => {
  for (const q of ["signaling", "signalling", "signals", "hand signal", "hand signals", "who can give signals", "crane signalling"]) {
    assert.equal(await first(q), "29cfr1926.1419", q);
  }
  assert.ok((await roots("signaling", 5)).includes("29cfr1926.1421"), "voice signals in the first five");
  assert.ok((await roots("hand signals", 5)).includes("29cfr1926.1422"), "the hand signal chart in the first five");
});

test("typos, hyphens and run-together words still find the right sections", async () => {
  const outrig = await e.find("outrigers");
  assert.deepEqual(outrig.readings, [{ word: "outrigers", as: ["outriggers"], via: "typo" }]);
  assert.ok(outrig.groups.length > 0);
  assert.ok(e.sections.get(outrig.groups[0]!.best_id)!.text.toLowerCase().includes("outrigger"));
  for (const q of ["de-energized", "deenergized", "de-energised"]) {
    const top = await roots(q, 2);
    assert.ok(top.includes("29cfr1926.1408") || top.includes("29cfr1926.1407"), `${q}: ${top}`);
  }
  assert.ok((await roots("powerline", 5)).some((r) => /^29cfr1926\.14(0[7-9]|1[01])$/.test(r)), "powerline reads as power line");
  assert.equal((await e.find("tyre pressure")).readings[0]?.as[0], "tire");
  // A rare word the pack holds splits only into two words the pack writes side by side.
  for (const w of ["nothing", "inclined", "offering", "passage", "appreciable"]) assert.deepEqual((await e.find(w)).terms, [stem(w)], w);
  const pl = (await e.find("powerline")).terms;
  assert.ok(pl.includes("power") && pl.includes("line"), `powerline: ${pl}`);
});

test("each group shows a paragraph with text and opens a real section", async () => {
  for (const q of ["barge cranes floating on water", "how close can I get to power lines", "hand signals"]) {
    const r = await e.find(q);
    assert.ok(r.groups.length > 0, q);
    const seen = new Set<string>();
    for (const g of r.groups) {
      assert.ok(!seen.has(g.root_id), "one group per section");
      seen.add(g.root_id);
      assert.ok(e.sections.has(g.best_id));
      assert.equal(e.rootOf(g.best_id)?.section_id ?? g.best_id, g.root_id);
      for (const h of g.hits) assert.equal(e.rootOf(h.section_id)?.section_id ?? h.section_id, g.root_id);
    }
    assert.ok(e.sections.get(r.groups[0]!.best_id)!.text.length > 0, q);
  }
  assert.equal(await first("barge cranes floating on water"), "29cfr1926.1437");
});

test("a typed citation opens that paragraph first, forgiving case and a missing level", async () => {
  for (const [q, want] of [
    ["1926.1419(c)", "29cfr1926.1419(c)"],
    ["§1926.1419(C)", "29cfr1926.1419(c)"],
    ["1926.1419(z)", "29cfr1926.1419"],
    ["1926.1419 signal", "29cfr1926.1419"],
    ["29 CFR 1926.1408(a)(2)(iii)(a)", "29cfr1926.1408(a)(2)(iii)(A)"],
  ] as [string, string][]) {
    const r = await e.find(q);
    assert.equal(r.groups[0]?.best_id, want, q);
    assert.equal(r.groups[0]?.cited, true, q);
    for (const g of r.groups) assert.ok(Number.isFinite(g.score), `${q}: finite scores`);
  }
});

test("misspelt words are matched as whole words, not stems", async () => {
  for (const [q, word] of [
    ["operater", "operator"],
    ["certificaton", "certification"],
    ["inspeciton", "inspection"],
    ["riging", "rigging"],
    ["riggin", "rigging"],
    ["enegized", "energized"],
  ] as [string, string][]) {
    const r = await e.find(q);
    assert.deepEqual(r.readings, [{ word: q, as: [word], via: "typo" }], q);
    assert.ok(r.groups.length > 0, q);
  }
});

test("a pasted blob does not stall the search", async () => {
  const t = Date.now();
  await e.find("x".repeat(20000));
  await e.find(Array.from({ length: 2000 }, (_, i) => `zq${i.toString(36)}word`).join(" "));
  assert.ok(Date.now() - t < 500, `${Date.now() - t} ms`);
});

test("an empty or off-topic query finds nothing", async () => {
  assert.deepEqual((await e.find("   ")).groups, []);
  assert.deepEqual((await e.find("xyzzy qwerty")).groups, []);
});

test("a starter answer adapts to the role when a role variant exists", () => {
  const op = e.answer("a.powerline-clearance", "operator");
  const tr = e.answer("a.powerline-clearance", "trainee");
  assert.equal(op?.answer_id, tr?.answer_id);
  assert.notDeepEqual(op?.body, tr?.body);
  assert.equal(tr?.body[0]?.t, "text");
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
  assert.deepEqual(tokens("How close to the power-lines?"), ["close", "powerlin", "power", "line"]);
  assert.deepEqual(tokens("1,000 kV"), ["1000", "kv"]);
  assert.deepEqual(tokens("de-energized"), ["deenerg", "de", "energ"]);
  for (const w of ["signalling", "signaling", "signals", "signal"]) assert.equal(stem(w), "signal", w);
});

test("find ranks the power line sections first for a power line query", async () => {
  const top = await roots("minimum clearance distance power line voltage", 3);
  assert.ok(top.every((r) => r.startsWith("29cfr1926.14")));
  assert.ok(top.includes("29cfr1926.1408"));
});

test("spelling variants and edit distance", () => {
  assert.ok(spellingVariants("metre").includes("meter"));
  assert.ok(spellingVariants("licence").includes("license"));
  assert.ok(spellingVariants("manoeuvres").includes("maneuvers"));
  assert.ok(spellingVariants("energised").includes("energized"));
  assert.equal(editDistance("outrig", "outrigg"), 1);
  assert.equal(editDistance("sigånl", "signal"), 2);
  assert.equal(editDistance("abc", "xyzabc"), 3);
});

test("a result's excerpt keeps the first matched word in view and starts on a whole word", () => {
  const terms = new Set(["outrigg"]);
  const long = `${"the crane must be level and the load must be steady and ".repeat(6)}the competent person checks the outriggers before the lift.`;
  const w = matchWindow(long, terms);
  assert.ok(w.includes("outriggers"), w);
  assert.match(w, /^…[a-z]+ /);
  assert.ok(!w.startsWith("…he "), w);
  const sentence = `Short first sentence here. ${"Filler words that run on and on. ".repeat(5)}Outriggers must be set.`;
  assert.ok(matchWindow(sentence, terms).startsWith("…Outriggers"));
  assert.equal(matchWindow("Outriggers first.", terms), "Outriggers first.");
  const nums = highlight("Lines over 1,000 kV and §1926.1419.", new Set(tokens("1,000 1926.1419")));
  assert.deepEqual(nums.filter((r) => r.mark).map((r) => r.text), ["1,000", "1926.1419"]);
});
