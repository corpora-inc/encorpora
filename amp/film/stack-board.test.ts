// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Film } from "./stage";
import { scriptSchema, type BeatTime, type Timing } from "./schema";

/** A beat's words, one every half second from `t0`. */
const said = (say: string, t0: number): BeatTime => {
  const words = say.split(/\s+/).map((text, k) => ({ text, start: t0 + k * 0.5, end: t0 + k * 0.5 + 0.4 }));
  return { start: t0, end: words[words.length - 1]!.end, words };
};
const beats = [
  { say: "Stack them.", do: [{ do: "stack", rows: ["12.06", "2.25"], op: "-", headers: true, id: "s", at: "Stack" }] },
  { say: "Every place lines up: tenths over tenths.", do: [{ do: "places", of: "s", at: "place" }, { do: "places", of: "s", place: "tenths", at: "tenths" }] },
  { say: "Hundredths: six minus five is one.", do: [{ do: "column", of: "s", at: "Hundredths", write: "is" }] },
  { say: "Tenths: zero minus two? Trade one whole for ten tenths. Ten minus two is eight.", do: [{ do: "column", of: "s", at: "Tenths", trade: "Trade", write: "eight" }] },
  { say: "Ones: one minus two? Trade the ten. Eleven minus two is nine.", do: [{ do: "column", of: "s", at: "Ones", trade: "Trade", write: "nine" }] },
];
const script = scriptSchema.parse({ id: "t", title: "t", shots: [{ beats }] });
const starts = [0.5, 2, 6, 10, 18];
const timing: Timing = { duration: 26, shots: [beats.map((b, i) => said(b.say, starts[i]!))] };
const wordAt = (beat: number, word: string, nth = 1) => timing.shots[0]![beat]!.words.filter((w) => w.text.replace(/\W/g, "") === word)[nth - 1]!.start;

function film() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  return { f: new Film(root, script, timing, undefined, { checks: false }), root };
}
const opacity = (el: Element | null | undefined) => Number((el as HTMLElement).style.opacity || "1");

describe("a stack with headers", () => {
  it("names every place over its column and draws the point line", () => {
    const { root } = film();
    const heads = [...root.querySelectorAll(".film-stack-cell.head")].map((e) => e.textContent);
    expect(heads).toEqual(["tens", "ones", "tenths", "hundredths"]);
    expect(root.querySelector(".film-stack.headers .film-stack-pointline")).not.toBeNull();
  });
  it("brings the names in with the first places, and lights a named column", () => {
    const { f, root } = film();
    const head = root.querySelector(".film-stack-cell.head")!;
    f.seek(wordAt(1, "place") - 0.1);
    expect(opacity(head)).toBe(0);
    f.seek(wordAt(1, "place") + 0.6);
    expect(opacity(head)).toBe(1);
    // bands: one per place (4), then one per worked column (3); the tenths place band is the third
    const bands = root.querySelectorAll(".film-stack-band");
    f.seek(wordAt(1, "tenths", 2) + 0.4);
    expect(opacity(bands[2])).toBeGreaterThan(0.9);
    expect(opacity(bands[1])).toBe(0);
  });
  it("writes a column's trade and digit on their own words", () => {
    const { f, root } = film();
    const borrow = () => [...root.querySelectorAll(".film-stack-cell.borrow")].find((e) => e.textContent?.includes("10"))!;
    const eight = () => [...root.querySelectorAll(".film-stack-cell.answer")].find((e) => e.textContent?.includes("8"))!;
    f.seek(wordAt(3, "Trade") - 0.05);
    expect(opacity(borrow())).toBe(0);
    f.seek(wordAt(3, "Trade") + 0.5);
    expect(opacity(borrow())).toBe(1);
    expect(opacity(eight())).toBe(0);
    f.seek(wordAt(3, "eight") + 0.5);
    expect(opacity(eight())).toBe(1);
  });
  it("refuses a write word that is not said after the column starts", () => {
    const bad = scriptSchema.parse({ id: "t", title: "t", shots: [{ beats: [beats[0], { say: "Hundredths: six minus five is one.", do: [{ do: "column", of: "s", at: "one", write: "six" }] }] }] });
    const t: Timing = { duration: 9, shots: [[said(beats[0]!.say, 0.5), said("Hundredths: six minus five is one.", 2)]] };
    expect(() => new Film(document.createElement("div"), bad, t, undefined, { checks: false })).toThrow(/write: the word "six" is not said after/);
  });
});
