// @vitest-environment jsdom
/**
 * A strike: the screenplay names a board line by its id, the check names a
 * target that is not such a line, and the X and the dimmed text are a
 * function of time, so the line is crossed out after its word and not before,
 * whichever way the film is sought. (Where the X lies is measured in a real
 * browser: frame.test.ts.)
 */
import { describe, expect, it } from "vitest";
import { Film, STRUCK } from "./stage";
import { actionSchema, scriptSchema, type BeatTime, type Timing } from "./schema";

/** A beat's words, one every half second from `t0`. */
const said = (say: string, t0: number): BeatTime => {
  const words = say.split(/\s+/).map((text, k) => ({ text, start: t0 + k * 0.5, end: t0 + k * 0.5 + 0.4 }));
  return { start: t0, end: words[words.length - 1]!.end, words };
};
type Beat = { say: string; do?: Record<string, unknown>[] };
const slip: Beat = { say: "Four plus four plus two is ten.", do: [{ do: "write", tex: "4+4+2=10", id: "slip", at: "Four" }] };
const struck: Beat = { say: "Count the sides again. One is missing here.", do: [{ do: "strike", target: "slip", at: "missing" }] };
const mended: Beat = { say: "Four plus four plus two plus two is twelve.", do: [{ do: "write", tex: "4+4+2+2=12", fresh: true, at: "Four" }] };
const next: Beat = { say: "Now a new one.", do: [{ do: "clear" }, { do: "problem", text: "How far around?", id: "p", at: "Now" }] };

function film(beats: Beat[]) {
  const script = scriptSchema.parse({ id: "t", title: "t", shots: [{ beats }] });
  const starts = beats.map((_, i) => 0.5 + i * 6);
  const timing: Timing = { duration: beats.length * 6 + 2, shots: [beats.map((b, i) => said(b.say, starts[i]!))] };
  const root = document.createElement("div");
  document.body.appendChild(root);
  const f = new Film(root, script, timing, undefined, { checks: false });
  const wordAt = (beat: number, word: string) => timing.shots[0]![beat]!.words.find((w) => w.text.replace(/\W/g, "") === word)!.start;
  return { f, root, wordAt };
}
const style = (el: Element | null) => (el as HTMLElement).style;
/** How much of each of the X's two strokes is drawn, 0 to 1, in drawing order. */
const drawn = (el: Element | null) => [...el!.querySelectorAll("svg > path")].map((p) => 1 - Number(p.getAttribute("stroke-dashoffset")));

describe("a strike in the screenplay", () => {
  it("names one board line, on a word", () => {
    expect(actionSchema.safeParse({ do: "strike", target: "slip", at: "missing" }).success).toBe(true);
    expect(actionSchema.safeParse({ do: "strike", target: "slip" }).success).toBe(true);
    expect(actionSchema.safeParse({ do: "strike", at: "missing" }).success).toBe(false);
    expect(actionSchema.safeParse({ do: "strike", target: ["slip", "mend"] }).success).toBe(false);
    expect(actionSchema.safeParse({ do: "strike", target: "slip", tex: "4+4" }).success).toBe(false);
  });

  it("is no issue when it names a line of the column being written", () => {
    expect(film([slip, struck, mended]).f.issues).toEqual([]);
  });

  it("is an issue when no earlier line has that id", () => {
    const unknown = film([slip, { say: "One is missing here.", do: [{ do: "strike", target: "slop", at: "missing" }] }]);
    expect(unknown.f.issues).toEqual([`Shot 1: strike of "slop", but no earlier board line has that id. Give the line an "id" and strike it after it is written.`]);
    expect(unknown.root.querySelector(".film-struck")).toBeNull();
    // struck on a word said before the line is written
    const early = film([{ say: "Four plus four plus two is ten.", do: [{ do: "write", tex: "4+4+2=10", id: "slip", at: "ten" }, { do: "strike", target: "slip", at: "Four" }] }]);
    expect(early.f.issues).toEqual([`Shot 1: strike of "slip", but no earlier board line has that id. Give the line an "id" and strike it after it is written.`]);
  });

  it("is an issue when the line is in an earlier column, is a card, or is struck already", () => {
    const strike = (target: string, at: string) => ({ do: "strike", target, at });
    const cleared = film([slip, next, { say: "That first line is out.", do: [strike("slip", "out")] }]);
    expect(cleared.f.issues).toEqual([`Shot 1: strike of "slip", but that line is in an earlier column, before a "clear". Strike a line of the column being written.`]);
    const card = film([slip, next, { say: "That card is out.", do: [strike("p", "out")] }]);
    expect(card.f.issues).toEqual([`Shot 1: strike of "p", but that is a "problem", not a line of working. Strike a "write", a "text" or an "answer".`]);
    const twice = film([slip, struck, { say: "Out it goes again.", do: [strike("slip", "again")] }]);
    expect(twice.f.issues).toEqual([`Shot 1: strike of "slip", but that line is already struck.`]);
    expect(twice.root.querySelectorAll(".film-struck").length).toBe(1);
  });
});

describe("a struck line", () => {
  it("is crossed out after its word and not before: one stroke, then the other, and its text dims", () => {
    const { f, root, wordAt } = film([slip, struck, mended]);
    const cue = wordAt(1, "missing");
    const stroke = root.querySelector(".film-struck"), math = root.querySelector(".film-line.write .film-math");
    expect(stroke?.parentElement?.textContent).toContain("10");
    // two strokes, each one dash of its whole length, round-capped in the warm ink by the stylesheet
    const paths = [...stroke!.querySelectorAll("svg > path")];
    expect(paths.length).toBe(2);
    for (const p of paths) {
      expect(p.getAttribute("pathLength")).toBe("1");
      expect(p.getAttribute("stroke-dasharray")).toBe("1 2");
    }
    f.seek(cue - 0.05);
    expect(style(stroke).visibility).toBe("hidden");
    expect(drawn(stroke)).toEqual([0, 0]);
    expect(Number(style(math).opacity)).toBe(1);
    // a quarter of the way: half the first stroke, none of the second, the text already dimming
    f.seek(cue + 0.15);
    expect(style(stroke).visibility).toBe("inherit");
    expect(drawn(stroke)[0]).toBeCloseTo(0.5, 6);
    expect(drawn(stroke)[1]).toBe(0);
    expect(Number(style(math).opacity)).toBeLessThan(1);
    // halfway: the first stroke whole, the second not begun, the text halfway dimmed
    f.seek(cue + 0.3);
    expect(drawn(stroke)).toEqual([1, 0]);
    expect(Number(style(math).opacity)).toBeCloseTo((1 + STRUCK) / 2, 5);
    // three quarters: half the second stroke
    f.seek(cue + 0.45);
    expect(drawn(stroke)[0]).toBe(1);
    expect(drawn(stroke)[1]).toBeCloseTo(0.5, 6);
    f.seek(cue + 0.65);
    expect(drawn(stroke)).toEqual([1, 1]);
    expect(Number(style(math).opacity)).toBe(STRUCK);
    // only the struck line: the mended one keeps its ink and gets no stroke
    const lines = root.querySelectorAll(".film-line.write");
    expect(lines.length).toBe(2);
    expect(lines[1]!.querySelector(".film-struck")).toBeNull();
    expect(style(lines[1]!.querySelector(".film-math")).opacity).toBe("");
  });

  it("is a state of the time sought: back before the word it is whole again, and it stays struck to the end", () => {
    const { f, root, wordAt } = film([slip, struck, mended, next]);
    const cue = wordAt(1, "missing");
    const stroke = root.querySelector(".film-struck"), math = root.querySelector(".film-line.write .film-math");
    f.seek(f.duration);
    expect(drawn(stroke)).toEqual([1, 1]);
    expect(Number(style(math).opacity)).toBe(STRUCK);
    f.seek(cue - 1);
    expect(style(stroke).visibility).toBe("hidden");
    expect(drawn(stroke)).toEqual([0, 0]);
    expect(Number(style(math).opacity)).toBe(1);
    f.seek(wordAt(3, "new") + 1);
    expect(style(stroke).visibility).toBe("inherit");
    expect(drawn(stroke)).toEqual([1, 1]);
  });

  it("dims the words of a struck line of text, not the X", () => {
    const { f, root, wordAt } = film([
      { say: "Add two sides.", do: [{ do: "text", text: "Add two sides.", id: "note", at: "Add" }] },
      { say: "No, that is wrong.", do: [{ do: "strike", target: "note", at: "wrong" }] },
    ]);
    const line = root.querySelector(".film-line.text")!;
    const words = line.querySelector(".film-struck-words"), stroke = line.querySelector(".film-struck");
    expect(words?.textContent).toBe("Add two sides.");
    expect(stroke?.parentElement).toBe(line);
    f.seek(wordAt(1, "wrong") + 0.65);
    expect(Number(style(words).opacity)).toBe(STRUCK);
    expect(style(stroke).opacity).toBe("");
  });

  it("is rendered while the X is drawn: those frames are not held copies", () => {
    const { f, wordAt } = film([slip, struck, mended]);
    const cue = wordAt(1, "missing");
    expect(f.moving().some(([a, b]) => a <= cue && b >= cue + 0.6)).toBe(true);
  });
});
