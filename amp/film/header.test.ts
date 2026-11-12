// @vitest-environment jsdom
/**
 * A header: the screenplay pins a formula or a line of words, with a fine-print
 * name, at the top of the board. It stays through every "clear" until another
 * header replaces it, "off" removes it, or a later shot starts; it arrives,
 * changes or leaves only on an empty column, so the work under it never moves.
 * Its state is a function of time, like every board event. (Where it sits, and
 * that nothing overlaps it, is measured in a real browser: frame.test.ts.)
 */
import { describe, expect, it } from "vitest";
import { Film } from "./stage";
import { mathProblems } from "./mathcheck";
import { actionSchema, scriptSchema, type BeatTime, type Timing } from "./schema";

/** A beat's words, one every half second from `t0`. */
const said = (say: string, t0: number): BeatTime => {
  const words = say.split(/\s+/).map((text, k) => ({ text, start: t0 + k * 0.5, end: t0 + k * 0.5 + 0.4 }));
  return { start: t0, end: words[words.length - 1]!.end, words };
};
type Beat = { say: string; do?: Record<string, unknown>[] };
/** Each shot's beats, six seconds apart. */
function film(...shots: Beat[][]) {
  const script = scriptSchema.parse({ id: "t", title: "t", shots: shots.map((beats) => ({ beats })) });
  let t = 0.5;
  const timing: Timing = { duration: 0, shots: shots.map((beats) => beats.map((b) => { const s = said(b.say, t); t += 6; return s; })) };
  timing.duration = t + 2;
  const root = document.createElement("div");
  document.body.appendChild(root);
  const f = new Film(root, script, timing, undefined, { checks: false });
  const wordAt = (shot: number, beat: number, word: string) => timing.shots[shot]![beat]!.words.find((w) => w.text.replace(/\W/g, "") === word)!.start;
  const heads = [...root.querySelectorAll<HTMLElement>(".film-head")];
  /** Each header's opacity at t. */
  const shown = (t: number) => { f.seek(t); return heads.map((h) => Number(h.style.opacity)); };
  return { f, root, heads, shown, wordAt, script };
}
const form: Beat = { say: "Point-slope form names a point and a slope.", do: [{ do: "header", tex: "y-y_1=m(x-x_1)", label: "Point-slope form", at: "names" }] };
const work: Beat = { say: "Start from the original.", do: [{ do: "write", tex: "y+1=3(x-2)", at: "Start" }] };
const again: Beat = { say: "A new column, the same header.", do: [{ do: "clear" }, { do: "write", tex: "y+1=3(x-2)", fresh: true, at: "new" }] };
const standard: Beat = { say: "Standard form comes next.", do: [{ do: "clear" }, { do: "header", tex: "Ax+By=C", label: "Standard form", at: "Standard" }] };
const off: Beat = { say: "The header goes away now.", do: [{ do: "clear" }, { do: "header", off: true, at: "away" }] };
const more: Beat = { say: "Five y is ten.", do: [{ do: "write", tex: "5y=10", at: "Five" }] };

describe("a header in the screenplay", () => {
  it("is a formula or a line of words, with an optional name; or off", () => {
    const ok = (a: unknown) => actionSchema.safeParse(a).success;
    expect(ok({ do: "header", tex: "y-y_1=m(x-x_1)", label: "Point-slope form", at: "form" })).toBe(true);
    expect(ok({ do: "header", text: "Read each gridline" })).toBe(true);
    expect(ok({ do: "header", tex: "Ax+By=C", keep: true })).toBe(true);
    expect(ok({ do: "header", off: true, at: "now" })).toBe(true);
    expect(ok({ do: "header" })).toBe(false);
    expect(ok({ do: "header", label: "Point-slope form" })).toBe(false);
    expect(ok({ do: "header", tex: "x", text: "x" })).toBe(false);
    expect(ok({ do: "header", off: true, tex: "x" })).toBe(false);
    expect(ok({ do: "header", off: true, keep: true })).toBe(false);
    expect(ok({ do: "header", tex: "x", note: "\\times 2" })).toBe(false);
  });

  it("is no issue on an empty column: at the start, or after a clear", () => {
    expect(film([form, work, again, standard, more, off, more]).f.issues).toEqual([]);
  });

  it("is an issue when the column under it already holds work, and is not drawn", () => {
    const late = film([work, form]);
    expect(late.f.issues).toEqual([`Shot 1: the header "Point-slope form" comes while the column under it already holds work, so the work would have to move. A header arrives, changes or leaves only on an empty column: put it right after a "clear", before the column's first line.`]);
    expect(late.heads).toEqual([]);
    const offLate = film([form, work, { say: "It goes now.", do: [{ do: "header", off: true, at: "goes" }] }]);
    expect(offLate.f.issues).toEqual([`Shot 1: a header off comes while the column under it already holds work, so the work would have to move. A header arrives, changes or leaves only on an empty column: put it right after a "clear", before the column's first line.`]);
    expect(film([{ say: "Nothing is up.", do: [{ do: "header", off: true, at: "Nothing" }] }]).f.issues).toEqual([`Shot 1: a header off, but no header is up.`]);
  });

  it("ends with its shot: a later shot that goes on writing in its column is an issue, unless the header keeps", () => {
    expect(film([form, work], [more]).f.issues).toEqual([`Shot 2: this shot goes on writing in the column begun under the header "Point-slope form" (shot 1), but a header ends with its shot. Start this shot with a "clear" (and the header again if it should stay), or give the header "keep": true.`]);
    expect(film([form, work], [{ ...more, do: [{ do: "clear" }, ...more.do!] }]).f.issues).toEqual([]);
    const kept = { ...form, do: [{ ...form.do![0], keep: true }] };
    expect(film([kept, work], [more]).f.issues).toEqual([]);
  });
});

describe("a header on the board", () => {
  it("arrives on its word and survives a clear", () => {
    const { shown, wordAt } = film([form, work, again]);
    const cue = wordAt(0, 0, "names");
    expect(shown(cue - 0.05)).toEqual([0]);
    expect(shown(cue + 0.2)[0]).toBeGreaterThan(0);
    expect(shown(cue + 0.2)[0]).toBeLessThan(1);
    expect(shown(cue + 0.5)).toEqual([1]);
    // the clear starts a new column; the header stays
    expect(shown(wordAt(0, 2, "new") + 1)).toEqual([1]);
  });

  it("is replaced by the next header, and leaves with off", () => {
    const { shown, wordAt } = film([form, work, standard, more, off, more]);
    const second = wordAt(0, 2, "Standard"), gone = wordAt(0, 4, "away");
    expect(shown(second - 0.05)).toEqual([1, 0]);
    expect(shown(second + 0.6)).toEqual([0, 1]);
    expect(shown(gone - 0.05)).toEqual([0, 1]);
    expect(shown(gone + 0.5)).toEqual([0, 0]);
    // the state of the time sought: back before "off" it is up again
    expect(shown(wordAt(0, 3, "Five"))).toEqual([0, 1]);
  });

  it("leaves as a later shot starts, and stays into it with keep", () => {
    const later: Beat = { say: "A new shot.", do: [{ do: "clear" }, { do: "write", tex: "x=1", at: "new" }] };
    const plain = film([form, work], [later]);
    expect(plain.shown(plain.wordAt(1, 0, "new"))).toEqual([0]);
    const kept = film([{ ...form, do: [{ ...form.do![0], keep: true }] }, work], [later]);
    expect(kept.shown(kept.wordAt(1, 0, "new"))).toEqual([1]);
  });

  it("is not an empty screen: a header alone counts as something on the board", () => {
    const { f, wordAt } = film([form]);
    expect(f.board.showing(wordAt(0, 0, "names") - 0.05)).toBe(false);
    expect(f.board.showing(wordAt(0, 0, "slope"))).toBe(true);
  });

  it("is rendered while it fades in and out: those frames are not held copies", () => {
    const { f, wordAt } = film([form, work, off, more]);
    for (const cue of [wordAt(0, 0, "names"), wordAt(0, 2, "away")])
      expect(f.moving().some(([a, b]) => a <= cue && b >= cue + 0.35)).toBe(true);
  });
});

describe("the arithmetic check", () => {
  const check = (...beats: Beat[]) => mathProblems(film(beats).script);
  it("leaves a general form alone", () => {
    expect(check(form, work, { say: "So y is.", do: [{ do: "answer", tex: "y=2" }] })).toEqual([]);
    expect(check({ say: "Standard form.", do: [{ do: "header", tex: "Ax+By=C" }] }, { say: "So y is.", do: [{ do: "write", tex: "0+5y=10" }, { do: "answer", tex: "y=2" }] })).toEqual([]);
  });
  it("checks a header's arithmetic, and holds a header in one letter to the answer under it", () => {
    expect(check({ say: "Facts.", do: [{ do: "header", tex: "4\\times 5=25" }] })).toEqual([`Shot 1: the header "4\\times 5=25" is false: 20 = 25. Fix the arithmetic.`]);
    const original = (tex: string): Beat => ({ say: "The original.", do: [{ do: "header", tex, label: "the original" }] });
    const solved: Beat = { say: "So x is four.", do: [{ do: "write", tex: "2x=8" }, { do: "answer", tex: "x=4" }] };
    expect(check(original("2x+3=11"), solved)).toEqual([]);
    expect(check(original("2x+3=13"), solved)).toEqual([`Shot 1: the board line "2x+3=13" is false for x = 4, the answer it leads to. Fix the step.`]);
  });
});
