// @vitest-environment jsdom
/**
 * A shot begins, and starts to fade in, half a second before its first word. The setup in its
 * first beat (a hide, show or clear with no `at` word) takes effect at the shot's own start, so
 * the shot appears already in that state: a bar's title hidden there never shows and then
 * vanishes, and the last shot's board leaves with the last shot's figure instead of sitting beside
 * the new one. A cue word, a later beat and an action that animates keep their times.
 */
import { describe, expect, it } from "vitest";
import { Film } from "./stage";
import { scriptSchema, type BeatTime, type Timing } from "./schema";

/** A beat's words, one every half second from `t0`. */
const said = (say: string, t0: number): BeatTime => {
  const words = say.split(/\s+/).map((text, k) => ({ text, start: t0 + k * 0.5, end: t0 + k * 0.5 + 0.4 }));
  return { start: t0, end: words[words.length - 1]!.end, words };
};
type Beat = { say: string; do?: Record<string, unknown>[] };

/** Two bars, each with its built-in title ("One whole"). */
const bars = {
  view: [-1, -1, 11, 4],
  points: { A: [0, 0], B: [5, 0] },
  parts: [
    { id: "W1", bar: "A", w: 4, h: 1, divisions: 2, start: true },
    { id: "W2", bar: "B", w: 4, h: 1, divisions: 3, start: true },
  ],
};
const opener: Beat = { say: "Here is a sum.", do: [{ do: "write", tex: "1+1=2", at: "Here" }] };

/** Shot 1 is board work only; shot 2 holds the bars, its beats from 6.5 s, 4 s apart. */
function film(beats: Beat[]) {
  const script = scriptSchema.parse({ id: "t", title: "t", shots: [{ beats: [opener] }, { figure: bars, beats }] });
  const timing: Timing = { duration: 6.5 + beats.length * 4 + 2, shots: [[said(opener.say, 0.5)], beats.map((b, i) => said(b.say, 6.5 + i * 4))] };
  const root = document.createElement("div");
  document.body.appendChild(root);
  const f = new Film(root, script, timing, undefined, { checks: false });
  const shot = f.shots[1]!;
  const opacity = (el: HTMLElement) => (el.style.display === "none" || el.style.visibility === "hidden" ? 0 : Number(el.style.opacity || "1"));
  /** How much of each bar's title can be seen at t: the shot's own opacity times the title's. */
  const titles = (t: number) => {
    f.seek(t);
    return [...shot.el.querySelectorAll<HTMLElement>(".film-bar-title")].map((el) => opacity(shot.el) * opacity(el));
  };
  const wordAt = (beat: number, word: string) => timing.shots[1]![beat]!.words.find((w) => w.text.replace(/\W/g, "") === word)!.start;
  return { f, shot, titles, wordAt, beatStart: (beat: number) => timing.shots[1]![beat]!.start };
}

describe("a shot's opening setup", () => {
  it("hides a bar's title before the shot appears: it never shows while the shot fades in", () => {
    const { shot, titles, beatStart } = film([{ say: "Two bars, each one whole.", do: [{ do: "hide", target: ["W1.title", "W2.title"], dur: 0.01 }] }]);
    expect(shot.t0).toBeCloseTo(6);
    for (let t = shot.t0 - 0.1; t <= beatStart(0) + 1.5; t += 0.02) for (const v of titles(t)) expect(v).toBeLessThan(0.002);
    // the shot itself has faded in: the titles are hidden, not the figure
    expect(Number(shot.el.style.opacity)).toBe(1);
  });

  it("hides at once even when the hide has a longer dur: the shot's fade-in is its only entrance", () => {
    const { shot, titles } = film([{ say: "Two bars, each one whole.", do: [{ do: "hide", target: "W1.title" }] }]);
    for (let t = shot.t0; t <= shot.t0 + 1.2; t += 0.02) expect(titles(t)[0]).toBeLessThan(0.002);
    // the other bar's title, not hidden, fades in with the shot
    expect(titles(shot.t0 + 1)[1]).toBeGreaterThan(0.9);
  });

  it("keeps the beat's other actions where they were: setup keeps its stagger slot", () => {
    const { shot, beatStart } = film([{ say: "Two bars, each one whole.", do: [
      { do: "hide", target: "W1.title" }, { do: "write", tex: "\\tfrac12" }, { do: "draw", target: "W2", dur: 0.8 },
    ] }]);
    const t = (kind: string) => shot.list.find((e) => e.a.do === kind)!.t0;
    expect(t("hide")).toBeLessThanOrEqual(shot.t0);
    expect(t("write")).toBeCloseTo(beatStart(0) + 0.1);
    // a draw animates on purpose: it starts with the beat, as before
    expect(t("draw")).toBeCloseTo(beatStart(0) + 0.2);
  });

  it("still waits for the word when the hide on the first beat has one", () => {
    const { titles, wordAt } = film([{ say: "Two bars, each one whole.", do: [{ do: "hide", target: "W1.title", at: "whole", dur: 0.01 }] }]);
    const cue = wordAt(0, "whole");
    expect(titles(cue - 0.1)[0]).toBeGreaterThan(0.9);
    expect(titles(cue + 0.05)[0]).toBeLessThan(0.002);
  });

  it("starts a hide without a word on a later beat with that beat", () => {
    const { titles, beatStart } = film([
      { say: "Two bars, each one whole." },
      { say: "Now look at the parts.", do: [{ do: "hide", target: "W1.title", dur: 0.01 }] },
    ]);
    expect(titles(beatStart(1) - 0.05)[0]).toBeGreaterThan(0.9);
    expect(titles(beatStart(1) + 0.05)[0]).toBeLessThan(0.002);
  });

  it("clears the board as the shot changes: the old work has gone once the new figure is in", () => {
    const { f, shot, beatStart } = film([{ say: "Two bars, each one whole.", do: [{ do: "clear" }, { do: "write", tex: "\\tfrac12" }] }]);
    const shown = (t: number) => { f.seek(t); return Number(shot.el.style.opacity); };
    const old = (t: number) => f.board.colOpacity(0, t);
    // the old column is still there when the shot change begins
    expect(old(shot.t0 - 0.05)).toBe(1);
    // and leaves as the new figure comes in: it never stays while the figure is mostly in
    for (let t = shot.t0; t <= beatStart(0) + 1.5; t += 0.02) {
      if (shown(t) > 0.5) expect(old(t)).toBeLessThan(0.5);
    }
    expect(old(shot.t0 + 0.6)).toBeLessThan(0.02);
    // the new column's first line is still written with its beat
    expect(f.board.items.find((i) => i.col === 1)!.t0).toBeCloseTo(beatStart(0) + 0.1);
  });

  it("clears with the word when the clear on the first beat has one", () => {
    const { f, shot, wordAt } = film([{ say: "Two bars, each one whole.", do: [{ do: "clear", at: "each" }, { do: "write", tex: "\\tfrac12", at: "each" }] }]);
    const cue = wordAt(0, "each");
    expect(f.board.colOpacity(0, shot.t0 + 0.6)).toBe(1);
    expect(f.board.colOpacity(0, cue - 0.2)).toBe(1);
    expect(f.board.colOpacity(0, cue + 0.8)).toBeLessThan(0.05);
  });
});
