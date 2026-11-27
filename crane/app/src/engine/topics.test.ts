import { test } from "node:test";
import assert from "node:assert/strict";
import type { Question, Section, SkillRow } from "./types.ts";
import { topicSections } from "./topics.ts";

const sec = (id: string, ord: number): Section => ({ section_id: id, source_id: "s", parent_id: null, ord, depth: 0, kind: "section", citation: id, heading: null, text: "", lang: "en" });
const skill = (skill_id: string, topic_id: string): SkillRow => ({ skill_id, topic_id, title: skill_id, lang: "en" });
const q = (skill_id: string, section_ids: string[]): Question => ({ q_id: Math.random().toString(), skill_id, variant_of: null, kind: "mc", stem: "", choices: [], answer: "0", rationales: [], section_ids, difficulty: 0.5, lang: "en" });

test("a topic's rules are the sections its questions cite, most cited first, existing only", () => {
  const e = {
    sections: new Map([["a", sec("a", 3)], ["b", sec("b", 1)], ["c", sec("c", 2)]]),
    skills: [skill("s1", "t"), skill("s2", "t"), skill("x", "other")],
    questions: [q("s1", ["a", "b"]), q("s2", ["b", "missing"]), q("s1", ["c"]), q("x", ["a", "a", "a"])],
  };
  // b: 2 citations; a and c: 1 each, then by document order (c before a). "missing" is not in the pack.
  assert.deepEqual(topicSections(e, "t").map((s) => s.section_id), ["b", "c", "a"]);
  assert.deepEqual(topicSections(e, "t", 1).map((s) => s.section_id), ["b"]);
  assert.deepEqual(topicSections(e, "none"), []);
});

test("excerpts end on a whole word", async () => {
  const { excerpt } = await import("./text.ts");
  assert.equal(excerpt("short text"), "short text");
  const e = excerpt("The equipment must not be assembled or used unless ground conditions are firm, drained, and graded to a sufficient extent", 100);
  assert.ok(e.length <= 100, e);
  assert.ok(e.endsWith("…"));
  assert.match(e, /\b(a|to|graded|sufficient)…$/);
  assert.doesNotMatch(excerpt("one, two, three, four", 12), /,…$/);
});
