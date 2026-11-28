import { test } from "node:test";
import assert from "node:assert/strict";
import { openFixture } from "./fixture.ts";
import { fromShow, type ShowPack } from "./show.ts";

const reasons = ["The rule names a competent person for this check.", "A qualified person does the annual inspection.", "The rule puts this on the employer, not the operator.", "The manufacturer has no role in the shift inspection."];
const show: ShowPack = {
  format: "harvest-show/1",
  info: { pack_id: "crane-us", built_at: "2026-11-28T03:23:29+00:00", schema_version: 1, row_counts: { section: 2 }, sources: [{ source_id: "ecfr-29-1926-cc", edition: "eCFR up to date as of 2026-11-24", title: "t" }] },
  sections: [
    { section_id: "29cfr1926-subpart-CC", source_id: "ecfr-29-1926-cc", parent_id: null, ord: 0, depth: 0, kind: "subpart", citation: "Subpart CC of Part 1926", heading: "Subpart CC", text: "Subpart CC", lang: "en" },
    { section_id: "29cfr1926.1412", source_id: "ecfr-29-1926-cc", parent_id: "29cfr1926-subpart-CC", ord: 1, depth: 1, kind: "section", citation: "§1926.1412", heading: "Inspections.", text: "", lang: "en" },
    { section_id: "29cfr1926.1412(d)(1)", source_id: "ecfr-29-1926-cc", parent_id: "29cfr1926.1412", ord: 2, depth: 2, kind: "paragraph", citation: "§1926.1412(d)(1)", heading: null, text: "A competent person must begin a visual inspection prior to each shift.", lang: "en" },
  ],
  topics: [{ topic_id: "inspections", parent_id: null, ord: 1, title: "Inspections", summary: "s", lang: "en" }],
  skills: [{ skill_id: "inspections.shift", topic_id: "inspections", title: "Shift inspection", lang: "en" }],
  lessons: [{ lesson_id: "l1", topic_id: "inspections", ord: 1, title: "The shift inspection", lang: "en", body: [{ t: "text", text: "A **competent person** checks." }, { t: "check", question: "Who?", answer: "A competent person." }, { t: "cite", section_id: "29cfr1926.1412(d)(1)" }] }],
  terms: [],
  diagrams: [],
  questions: [
    { q_id: "ok", skill_id: "inspections.shift", variant_of: null, kind: "mc", stem: "Who?", choices: ["a", "b", "c", "d"], answer: "0", rationales: reasons, section_ids: ["29cfr1926.1412(d)(1)"], difficulty: 0.3, lang: "en" },
    { q_id: "verdict", skill_id: "inspections.shift", variant_of: null, kind: "mc", stem: "Who?", choices: ["a", "b", "c", "d"], answer: "0", rationales: ["Correct. The rule names a competent person.", ...reasons.slice(1)], section_ids: [], difficulty: 0.3, lang: "en" },
    { q_id: "free", skill_id: "inspections.shift", variant_of: null, kind: "free_text", stem: "Explain.", choices: [], answer: "{}", rationales: [], section_ids: [], difficulty: 0.5, lang: "en" },
  ],
  procedures: [{ proc_id: "p", title: "Shift", kind: "inspection", summary: "s", roles: ["operator"], lang: "en", steps: [
    { ord: 1, text: "Check", detail: { trainee: "a", operator: "b", inspector: "c" }, check_kind: "pass_fail", section_ids: ["29cfr1926.1412(d)(1)"], lang: "en",
      deficiency: { basis: "practice", guidance: "g", action: "a", section_id: null, quote: null } },
  ] }],
  exams: [{ id: "mobile-core", title: "Core", minutes: 90, passPercent: 70, domains: [{ id: "core.site", title: "Site", skillIds: ["inspections.shift"], count: 1 }] }],
  prereqs: {},
};

test("the harvest-show/1 pack opens through the one engine", async () => {
  const e = openFixture(fromShow(show));
  assert.equal(e.info.pack_id, "crane-us");
  assert.equal(e.info.fixture, false);
  assert.equal(e.info.ecfr_date, "2026-11-24");
  // The subpart only groups sections: the rule tree starts at the section.
  assert.equal(e.rootOf("29cfr1926.1412(d)(1)")?.section_id, "29cfr1926.1412");
  assert.equal(e.sections.has("29cfr1926-subpart-CC"), false);
  assert.deepEqual(e.ancestors("29cfr1926.1412(d)(1)").map((s) => s.depth), [0, 1]);
  assert.deepEqual(e.lessons[0]!.body.map((s) => s.t), ["text", "check", "cite"]);
  assert.equal(e.procedures[0]!.steps[0]!.deficiency?.basis, "practice");
  assert.equal(e.exams[0]!.minutes, 90);
  assert.equal((await e.find("competent person shift")).groups[0]?.root_id, "29cfr1926.1412");
});

test("practice shows only multiple-choice items whose reasons are real", () => {
  const e = openFixture(fromShow(show));
  assert.deepEqual(e.questions.map((q) => q.q_id), ["ok"]);
});

test("a pack in another format is refused", () => {
  assert.throws(() => fromShow({ ...show, format: "harvest-show/0" as "harvest-show/1" }), /harvest-show\/1/);
});
