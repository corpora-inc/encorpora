// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { defaultVoice, requireVoices, resolveCast, runsOf, voiceBindings } from "./cast";
import { mathProblems } from "./mathcheck";
import { Film } from "./stage";
import { scriptSchema, type Timing } from "./schema";
import { VOICES, type VoiceSpec } from "./voices";

const CHAMP = "SYXbTJsLE7zmSjr1DchT";
const PAUL = "J3Ei0Lj6fAobhIqY5ySH";
/** Not an approved voice. The test binds it; `VOICES` does not. */
const SECOND: VoiceSpec = { id: "test-learner-2", name: "Test Learner", short: "testlearner", kinds: ["learner"] };
const registry = [...VOICES, SECOND];

const timingFor = (voices: Record<string, string>): Timing => ({
  duration: 8,
  voices,
  shots: [[
    { start: 0.4, end: 2, words: [{ text: "Two", start: 0.4, end: 0.7 }, { text: "plus", start: 0.8, end: 1.1 }, { text: "two", start: 1.2, end: 1.5 }, { text: "is", start: 1.6, end: 1.8 }, { text: "four.", start: 1.9, end: 2 }] },
    { start: 2.6, end: 4.2, words: [{ text: "Is", start: 2.6, end: 2.8 }, { text: "the", start: 2.9, end: 3.1 }, { text: "answer", start: 3.2, end: 3.6 }, { text: "four?", start: 3.7, end: 4.2 }] },
    { start: 4.8, end: 6.2, words: [{ text: "Yes.", start: 4.8, end: 5.2 }, { text: "Four.", start: 5.4, end: 6.2 }] },
  ]],
});

it("dry-checks two learners without a third approved voice, and stages them from a test registry", () => {
  const script = scriptSchema.parse(JSON.parse(readFileSync("film/lessons/count-objects--speakers.json", "utf8")));
  expect(VOICES.filter((voice) => voice.kinds.includes("learner")).map((voice) => voice.short)).toEqual(["champ"]);

  const dry = resolveCast(script);
  expect(dry.roles.map((role) => [role.role, role.voice?.id ?? null])).toEqual([
    ["teacher", defaultVoice("teacher", script.id)],
    ["champ", CHAMP],
    ["maya", null],
  ]);
  expect(Object.values(voiceBindings(dry)).filter((id) => id === CHAMP)).toEqual([CHAMP]);
  expect(resolveCast(script, voiceBindings(dry))).toEqual(dry);
  expect(() => requireVoices(dry)).toThrow(/needs another approved learner voice/);
  expect(() => resolveCast(script, { maya: "champ" })).toThrow(/already assigned/);
  expect(mathProblems(script)).toEqual([]);

  const dryRoot = document.createElement("div");
  document.body.appendChild(dryRoot);
  const dryFilm = new Film(dryRoot, script, timingFor(voiceBindings(dry)), undefined, { still: 6 });
  expect(dryFilm.issues).toEqual([]);
  dryFilm.seek(1);
  expect(dryRoot.querySelector(".film-line")).not.toBeNull();
  dryFilm.seek(5.6);
  expect(dryRoot.querySelector(".film-cast, .film-cast-tag")).toBeNull();
  dryRoot.remove();

  const cast = resolveCast(script, {}, registry);
  expect(cast.roles.map((role) => [role.role, role.kind, role.voice?.id])).toEqual([
    ["teacher", "teacher", defaultVoice("teacher", script.id, registry)],
    ["champ", "learner", CHAMP],
    ["maya", "learner", SECOND.id],
  ]);
  expect(new Set(cast.roles.map((role) => role.voice?.id)).size).toBe(3);
  expect(cast.roles[2]!.voice?.tag).toBeUndefined();
  expect(cast.roles[1]!.voice?.tag).toBe("[energetic]");
  expect(() => resolveCast(script, { maya: "champ" }, registry)).toThrow(/already assigned/);
  expect(() => resolveCast(script, { maya: SECOND.short })).toThrow(/not an approved voice/);
  const duo = scriptSchema.parse({
    id: "duo",
    title: "Duo",
    cast: { teacher: {}, learner: {} },
    shots: [{ beats: [{ say: "Yes.", speaker: "teacher" }, { say: "Why?", speaker: "learner" }] }],
  });
  expect(voiceBindings(resolveCast(duo, { teacher: "paul" }))).toEqual({ teacher: PAUL, learner: CHAMP });
  expect(runsOf(script, cast).map((run) => [run.shot, run.role.role, run.from, run.to])).toEqual([
    [0, "teacher", 0, 0],
    [0, "champ", 1, 1],
    [0, "maya", 2, 2],
  ]);
  const binding = voiceBindings(cast);
  const root = document.createElement("div");
  document.body.appendChild(root);
  const film = new Film(root, script, timingFor(binding), undefined, { still: 6, voices: registry });
  expect(film.issues).toEqual([]);
  expect(root.querySelector(".film-cast, .film-cast-tag")).toBeNull();
  film.seek(1);
  expect(root.querySelector(".film-line")).not.toBeNull();
  film.seek(3.4);
  film.seek(5.6);
  expect(root.querySelector(".film-cast, .film-cast-tag")).toBeNull();
  expect(resolveCast(script, binding, registry)).toEqual(cast);
  root.remove();
});
