// @vitest-environment jsdom
import { expect, it } from "vitest";
import { Film } from "./stage";
import { resolveCast, voiceBindings } from "./cast";
import { scriptSchema, type Timing } from "./schema";

it("renders the recorded speaker names and lights the learner on their turn", () => {
  const script = scriptSchema.parse({
    id: "cast-reference", title: "A learner's question",
    cast: { teacher: {}, learner: {} },
    shots: [{ beats: [
      { say: "One whole.", speaker: "teacher" },
      { say: "How many tenths?", speaker: "learner" },
    ] }],
  });
  const timing: Timing = {
    duration: 5,
    voices: voiceBindings(resolveCast(script, { teacher: "paul" })),
    shots: [[
      { start: 0, end: 1, words: [{ text: "One", start: 0, end: 0.4 }, { text: "whole.", start: 0.5, end: 1 }] },
      { start: 2, end: 3.5, words: [{ text: "How", start: 2, end: 2.4 }, { text: "many", start: 2.5, end: 2.9 }, { text: "tenths?", start: 3, end: 3.5 }] },
    ]],
  };
  const root = document.createElement("div");
  document.body.appendChild(root);
  const film = new Film(root, script, timing, undefined, { checks: false });
  expect(film.tags.map(tag => tag.el.textContent)).toEqual(["Paul", "Champ"]);
  film.seek(2.5);
  expect(film.tags[1]!.el.classList.contains("on")).toBe(true);
  expect(film.tags[0]!.el.classList.contains("on")).toBe(false);
  root.remove();
});
