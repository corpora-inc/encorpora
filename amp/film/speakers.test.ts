// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { defaultVoice, resolveCast, runsOf, voiceBindings } from "./cast";
import { Film } from "./stage";
import { scriptSchema, type Timing } from "./schema";

const CHAMP = "SYXbTJsLE7zmSjr1DchT";
const SARAH = "EXAVITQu4vr4xnSDxMaL";
const PAUL = "J3Ei0Lj6fAobhIqY5ySH";

it("plays a teacher and two learners on distinct voices", () => {
  const script = scriptSchema.parse(JSON.parse(readFileSync("film/lessons/count-objects--speakers.json", "utf8")));
  const cast = resolveCast(script);
  expect(cast.roles.map((role) => [role.role, role.kind, role.voice.id])).toEqual([
    ["teacher", "teacher", defaultVoice("teacher", script.id)],
    ["champ", "learner", CHAMP],
    ["maya", "learner", SARAH],
  ]);
  expect(new Set(cast.roles.map((role) => role.voice.id)).size).toBe(3);
  expect(cast.roles[2]!.voice.tag).toBeUndefined();
  expect(cast.roles[1]!.voice.tag).toBe("[energetic]");
  expect(() => resolveCast(script, { maya: "champ" })).toThrow(/already assigned/);
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
  const timing: Timing = {
    duration: 8,
    voices: binding,
    shots: [[
      { start: 0.4, end: 2, words: [{ text: "Two", start: 0.4, end: 0.7 }, { text: "plus", start: 0.8, end: 1.1 }, { text: "two", start: 1.2, end: 1.5 }, { text: "is", start: 1.6, end: 1.8 }, { text: "four.", start: 1.9, end: 2 }] },
      { start: 2.6, end: 4.2, words: [{ text: "Is", start: 2.6, end: 2.8 }, { text: "the", start: 2.9, end: 3.1 }, { text: "answer", start: 3.2, end: 3.6 }, { text: "four?", start: 3.7, end: 4.2 }] },
      { start: 4.8, end: 6.2, words: [{ text: "Yes.", start: 4.8, end: 5.2 }, { text: "Four.", start: 5.4, end: 6.2 }] },
    ]],
  };
  const root = document.createElement("div");
  document.body.appendChild(root);
  const film = new Film(root, script, timing, undefined, { checks: false });
  expect(root.querySelector(".film-cast, .film-cast-tag")).toBeNull();
  film.seek(1);
  expect(root.querySelector(".film-line")).not.toBeNull();
  film.seek(3.4);
  film.seek(5.6);
  expect(root.querySelector(".film-cast, .film-cast-tag")).toBeNull();
  expect(resolveCast(script, binding)).toEqual(cast);
  root.remove();
});
