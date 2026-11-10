import { describe, expect, it } from "vitest";
import { APPROVED, approvedVoice, defaultVoice, isTagWord, NARRATOR_ID, neighbours, resolveCast, runsOf, takeKeyParts, templateOf, TURN_GAP, voiceBindings } from "./cast";
import { takeKey } from "./voice";
import { scriptSchema } from "./schema";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

const flat = scriptSchema.parse({ id: "solo", title: "Solo", shots: [{ beats: [{ say: "One." }, { say: "Two." }] }, { beats: [{ say: "Three." }] }] });
const play = scriptSchema.parse({
  id: "sinusoid-compare-rule--cast", title: "Circle and wave",
  cast: { teacher: {}, learner: {} },
  shots: [
    { beats: [{ say: "A sine wave." }, { say: "So the wave is the height?", speaker: "learner" }, { say: "Yes.", speaker: "teacher" }, { say: "And A is the radius." }] },
    { beats: [{ say: "Read the graph.", speaker: "learner" }] },
  ],
});

describe("resolveCast", () => {
  it("preserves the narrator and take identity of existing solo films", () => {
    const c = resolveCast(flat);
    expect(c.named).toBe(false);
    expect(c.roles).toEqual([{ role: "narrator", name: "Madeline Brousseaux", voice: { id: NARRATOR_ID } }]);
    expect(resolveCast({ ...flat, shots: [{ beats: [{ say: "One.", speaker: "narrator" }] }] })).toEqual(c);
  });
  it("binds role-only screenplays to real speaker names without mutating them", () => {
    const before = JSON.stringify(play);
    const c = resolveCast(play, { teacher: "paul" });
    expect(c.named).toBe(true);
    expect(c.roles.map((r) => [r.role, r.name, r.voice.id])).toEqual([
      ["teacher", "Paul", "J3Ei0Lj6fAobhIqY5ySH"],
      ["learner", "Champ", "SYXbTJsLE7zmSjr1DchT"],
    ]);
    expect(c.roles[1]!.voice.tag).toBe("[energetic]");
    expect(JSON.stringify(play)).toBe(before);
    expect(resolveCast(play, voiceBindings(c))).toEqual(c);
  });
  it("balances deterministic teacher defaults across film ids and ignores catalog ordering", () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `film-${i}`);
    const assignments = ids.map(id => defaultVoice("teacher", id));
    for (const id of [NARRATOR_ID, "J3Ei0Lj6fAobhIqY5ySH"]) {
      const count = assignments.filter(v => v === id).length;
      expect(count).toBeGreaterThan(450);
      expect(count).toBeLessThan(550);
    }
    expect(ids.reverse().map(id => defaultVoice("teacher", id))).toEqual(assignments.reverse());
  });
  it("rejects voices outside their roles, including Paul as the learner", () => {
    for (const learner of ["paul", "J3Ei0Lj6fAobhIqY5ySH", "madeline"]) {
      expect(() => resolveCast(play, { learner })).toThrow(/not approved for the learner/);
    }
    expect(() => resolveCast(play, { teacher: "champ" })).toThrow(/not approved for the teacher/);
    expect(() => resolveCast(flat, { narrator: "champ" })).toThrow(/not approved for the narrator/);
    expect(() => approvedVoice("someone", "x")).toThrow(/not an approved voice/);
    expect(() => approvedVoice("constructor", "x")).toThrow(/not an approved voice/);
    expect(Object.keys(APPROVED)).toHaveLength(3);
  });
  it("rejects people and voice bindings in the screenplay", () => {
    expect(scriptSchema.safeParse({ ...play, cast: { teacher: { voice: "paul" }, learner: {} } }).success).toBe(false);
    expect(scriptSchema.safeParse({ ...play, cast: { madeline: {}, paul: {} } }).success).toBe(false);
    expect(scriptSchema.safeParse({ ...flat, shots: [{ beats: [{ say: "Hi", speaker: "paul" }] }] }).success).toBe(false);
  });
  it("refuses absent speakers and overrides for roles the lesson does not have", () => {
    expect(() => resolveCast({ ...flat, shots: [{ beats: [{ say: "Hi", speaker: "learner" }] }] })).toThrow(/not in the cast/);
    expect(() => resolveCast(play, { narrator: "paul" })).toThrow(/no role "narrator"/);
    expect(resolveCast(flat, { narrator: "paul" }).roles[0]!.voice).toEqual({ id: "J3Ei0Lj6fAobhIqY5ySH" });
  });
  it("loads the curated screenplays with valid roles", () => {
    const dir = new URL("./lessons/", import.meta.url);
    const files = readdirSync(dir).filter(f => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const script = scriptSchema.parse(JSON.parse(readFileSync(new URL(file, dir), "utf8")));
      expect(script.id).toBe(file.slice(0, -5));
      expect(resolveCast(script).roles.length).toBeGreaterThan(0);
    }
  });
});

describe("runsOf", () => {
  it("a one-voice lesson has exactly one run per shot, with the shot's words", () => {
    const runs = runsOf(flat, resolveCast(flat));
    expect(runs.map((r) => [r.shot, r.from, r.to, r.text])).toEqual([[0, 0, 1, "One. Two."], [1, 0, 0, "Three."]]);
  });
  it("consecutive beats by one speaker are one take; a change of speaker starts another", () => {
    const runs = runsOf(play, resolveCast(play));
    expect(runs.map((r) => [r.shot, r.role.role, r.from, r.to, r.text])).toEqual([
      [0, "teacher", 0, 0, "A sine wave."],
      [0, "learner", 1, 1, "So the wave is the height?"],
      [0, "teacher", 2, 3, "Yes. And A is the radius."],
      [1, "learner", 0, 0, "Read the graph."],
    ]);
  });
  it("a take's context is what the same voice said before and after", () => {
    const runs = runsOf(play, resolveCast(play));
    expect(neighbours(runs, 0)).toEqual({ prev: undefined, next: "Yes. And A is the radius." });
    expect(neighbours(runs, 1)).toEqual({ prev: undefined, next: "Read the graph." });
    expect(neighbours(runs, 2)).toEqual({ prev: "A sine wave.", next: undefined });
  });
  it("the breath between turns is a real pause", () => {
    expect(TURN_GAP).toBeGreaterThanOrEqual(0.3);
    expect(TURN_GAP).toBeLessThanOrEqual(0.8);
  });
});

describe("takeKey", () => {
  it("the narrator's untagged takes keep the key they always had", () => {
    const old = createHash("sha256").update(JSON.stringify([NARRATOR_ID, "eleven_v4", "One. Two."])).digest("hex").slice(0, 24);
    expect(takeKey({ id: NARRATOR_ID }, "One. Two.")).toBe(old);
  });
  it("another voice, or a tag, is another take", () => {
    const a = takeKeyParts({ id: NARRATOR_ID }, "x"), b = takeKeyParts({ id: "J3Ei0Lj6fAobhIqY5ySH" }, "x"), c = takeKeyParts({ id: NARRATOR_ID, tag: "[energetic]" }, "x");
    expect(new Set([a, b, c].map((p) => JSON.stringify(p))).size).toBe(3);
    expect(takeKey({ id: NARRATOR_ID }, "x")).not.toBe(takeKey({ id: "J3Ei0Lj6fAobhIqY5ySH" }, "x"));
  });
  it("a bracketed tag in the alignment is not a word of the script", () => {
    expect(isTagWord("[energetic]")).toBe(true);
    expect(isTagWord(" [energetic] ")).toBe(true);
    expect(isTagWord("energetic")).toBe(false);
    expect(isTagWord("[a] b")).toBe(false);
  });
});

describe("templateOf", () => {
  it("a variant takes its facts from its template; a plain id is its own template", () => {
    expect(templateOf("sinusoid-compare-rule--cast")).toEqual({ template: "sinusoid-compare-rule", variant: "cast" });
    expect(templateOf("sinusoid-compare-rule")).toEqual({ template: "sinusoid-compare-rule", variant: undefined });
    expect(templateOf("two-step-word-problem")).toEqual({ template: "two-step-word-problem", variant: undefined });
  });
});

