import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { audioProblems, EDGE, envelope, loneSounds, SR } from "./audio";
import { inSilence, Voice } from "./fixtures/voice-signals";
import { beginningOf, endingOf, JOIN, repairTake, ROOM, saidAs, SIBILANT, strayPlan, type TimedWord } from "./strays";
import { judge, type Take } from "./voice";

const loudest = (pcm: Int16Array, from: number, to: number) => {
  let m = 0;
  for (let i = Math.round(from * SR); i < Math.round(to * SR); i++) m = Math.max(m, Math.abs(pcm[i]!));
  return m;
};

/**
 * "...take away zero." and then, after near silence, a 0.1 s hiss at -36 dBFS: the
 * stray the founder heard at 1:07. The service's timing of "zero." runs over it, as
 * it did there.
 */
function zeroAndHiss(gap = 0.2) {
  const v = new Voice().rest(0.1).say(0.25).rest(0.08).say(0.4);
  const zeroEnd = v.t;
  v.rest(gap);
  const hissAt = v.t;
  v.hiss(0.1, -36).rest(0.3);
  const words: TimedWord[] = [{ text: "away", start: 0.1, end: 0.35 }, { text: "zero.", start: 0.43, end: hissAt + 0.06 }];
  return { pcm: v.pcm(), words, zeroEnd, hissAt };
}

describe("a stray sound after the last word", () => {
  it("is found even though the word's timing covers it, and removed", () => {
    const { pcm, words, hissAt } = zeroAndHiss();
    const plan = strayPlan(pcm, words);
    expect(plan.map((s) => [s.kind, s.word])).toEqual([["remove", "zero."]]);
    expect(plan[0]!.sound.start).toBeCloseTo(hissAt, 1);
    const fixed = repairTake(pcm, plan);
    expect(loudest(fixed.pcm, hissAt - 0.01, hissAt + 0.11)).toBe(0);
    expect(strayPlan(fixed.pcm, words)).toEqual([]);
    // the word itself is untouched
    expect(loudest(fixed.pcm, 0.43, 0.83)).toBe(loudest(pcm, 0.43, 0.83));
  });

  it("leaves no edge louder than the edge limit when the repaired take meets digital silence", () => {
    const { pcm, words } = zeroAndHiss();
    // the take as the narration holds it: digital silence on both sides, and inside where the hiss was
    const narration = inSilence(repairTake(pcm, strayPlan(pcm, words)).pcm);
    expect(audioProblems(narration)).toEqual([]);
    expect(Math.max(...envelope(narration))).toBeGreaterThan(EDGE);
  });

  it("is a fault when it starts 20 ms from the word: too close to remove", () => {
    const { pcm, words } = zeroAndHiss(0.02);
    expect(strayPlan(pcm, words).map((s) => s.kind)).toEqual(["near"]);
  });

  it("is removed from the start of a take too, before its first word", () => {
    const v = new Voice().rest(0.05).hiss(0.08, -35).rest(0.25);
    const at = v.t;
    v.say(0.3).rest(0.2);
    const pcm = v.pcm();
    const plan = strayPlan(pcm, [{ text: "Nobody", start: at, end: at + 0.3 }]);
    expect(plan.map((s) => [s.kind, s.side])).toEqual([["remove", "before"]]);
    // the hiss is gone, and so is the room tone more than ROOM before the word
    expect(loudest(repairTake(pcm, plan).pcm, 0, at - ROOM)).toBe(0);
  });

  it("is removed from a pause between two sentences of one take", () => {
    const v = new Voice().rest(0.1).say(0.3);
    const firstEnd = v.t;
    v.rest(0.17).hiss(0.09, -37).rest(0.25);
    const next = v.t;
    v.say(0.3).rest(0.2);
    const words = [{ text: "zero.", start: 0.1, end: firstEnd + 0.2 }, { text: "Right", start: next, end: next + 0.3 }];
    expect(strayPlan(v.pcm(), words).map((s) => s.kind)).toEqual(["remove"]);
  });
});

describe("what is part of a word", () => {
  it("a loose last hiss of a word that ends in one is joined back, not removed", () => {
    // "More squares!": the voiced "square" and, 130 ms later, its "s"
    const v = new Voice().rest(0.1).say(0.35);
    const wordEnd = v.t;
    v.rest(0.13).hiss(0.09, -36).rest(0.3);
    const pcm = v.pcm(), words = [{ text: "squares!", start: 0.1, end: wordEnd + 0.17 }];
    const plan = strayPlan(pcm, words);
    expect(plan.map((s) => [s.kind, s.word])).toEqual([["join", "squares!"]]);
    const fixed = repairTake(pcm, plan);
    expect(fixed.pcm.length / SR).toBeCloseTo(pcm.length / SR - (0.13 - JOIN), 2);
    // the hiss is still there, now right after the word, and nothing is left to repair
    expect(loudest(fixed.pcm, wordEnd, wordEnd + 0.12)).toBeGreaterThan(1000);
    expect(strayPlan(fixed.pcm, words.map((w) => ({ ...w, end: fixed.map(w.end) })))).toEqual([]);
    expect(audioProblems(inSilence(fixed.pcm), fixed.joins.map((j) => ({ at: j.at + 0.45, what: "join", within: JOIN / 2 })))).toEqual([]);
  });

  it("a breath beside such a word is no part of it: it is removed, not joined", () => {
    const v = new Voice().rest(0.1).say(0.35);
    const wordEnd = v.t;
    v.rest(0.13).breathe(0.15, -38).rest(0.3);
    const plan = strayPlan(v.pcm(), [{ text: "squares!", start: 0.1, end: wordEnd + 0.17 }]);
    expect(plan.map((s) => s.kind)).toEqual(["remove"]);
    expect(plan[0]!.sound.low).toBeGreaterThan(SIBILANT);
  });

  it("the release of a final stop, and the s after a closure, stay", () => {
    for (const [text, gap, db, dur] of [["eight.", 0.1, -36, 0.08], ["Six.", 0.09, -30, 0.18], ["cents.", 0.12, -32, 0.16]] as const) {
      const v = new Voice().rest(0.1).say(0.3);
      const end = v.t;
      v.rest(gap).hiss(dur, db).rest(0.3);
      expect(strayPlan(v.pcm(), [{ text, start: 0.1, end: end + gap + 0.04 }])).toEqual([]);
    }
  });

  it("an ordinary short word alone, voiced or as loud as speech, is never a stray", () => {
    const v = new Voice().rest(0.3).say(0.18, -16).rest(0.5).say(0.12, -24).rest(0.4);
    const pcm = v.pcm();
    expect(strayPlan(pcm, [{ text: "No.", start: 0.3, end: 0.48 }, { text: "Five.", start: 0.98, end: 1.1 }])).toEqual([]);
    expect(strayPlan(pcm, [])).toEqual([]);
    expect(loneSounds(inSilence(pcm))).toEqual([]);
  });

  it("clean speech has nothing to repair, and repairing it changes no word", () => {
    const v = new Voice().rest(0.2).say(0.3).rest(0.04).say(0.25).rest(0.3).say(0.4).rest(0.35);
    const pcm = v.pcm(), words = [{ text: "One", start: 0.2, end: 0.5 }, { text: "two,", start: 0.54, end: 0.79 }, { text: "three.", start: 1.09, end: 1.49 }];
    expect(strayPlan(pcm, words)).toEqual([]);
    const fixed = repairTake(pcm, []);
    expect(fixed.pcm.length).toBe(pcm.length);
    expect(loudest(fixed.pcm, 0.19, 1.6)).toBe(loudest(pcm, 0.19, 1.6));
  });

  it("the transcript places a word the service timed late: \"the count|s\" keeps its s", () => {
    // measured on a cached take: the service put "counts." 0.5 s late; the transcript had it right
    const v = new Voice().rest(0.1).say(0.1).rest(0.02).say(0.26);
    const countEnd = v.t;
    v.rest(0.1).hiss(0.15, -30).rest(0.3);
    const pcm = v.pcm();
    const service = [{ text: "the", start: 0.1, end: 0.2 }, { text: "counts.", start: countEnd + 0.3, end: countEnd + 0.85 }];
    expect(strayPlan(pcm, service).map((s) => [s.kind, s.word])).toEqual([["remove", "the"]]);
    expect(strayPlan(pcm, service, [{ text: "the", start: 0.1, end: 0.2 }, { text: "counts.", start: 0.25, end: countEnd + 0.22 }])).toEqual([]);
  });

  it("a word said softly still counts: the \"ts\" of a quiet \"points\" stays", () => {
    const v = new Voice().rest(0.1).say(0.4).rest(0.15);
    const soft = v.t;
    v.say(0.07, -40).rest(0.15).hiss(0.13, -33).rest(0.1);
    const words = [{ text: "conflicting", start: 0.1, end: 0.5 }, { text: "points.", start: soft - 0.02, end: soft + 0.33 }];
    expect(strayPlan(v.pcm(), words)).toEqual([]);
  });

  it("a short word timed narrower than its sound (\"x\") is not a stray", () => {
    const v = new Voice().rest(0.1).say(0.25);
    const at = v.t;
    v.rest(0.06).hiss(0.15, -24).rest(0.3);
    const x = at + 0.08;
    expect(strayPlan(v.pcm(), [{ text: "two", start: 0.1, end: 0.35 }, { text: "x", start: x, end: x + 0.06 }])).toEqual([]);
  });

  it("a quiet unstressed syllable inside the word's timing stays", () => {
    // "seven": a voiced "se", a dip, and a quiet noisy "ven" still inside the timing
    const v = new Voice().rest(0.1).say(0.2).rest(0.05).hiss(0.08, -38).rest(0.3);
    expect(strayPlan(v.pcm(), [{ text: "seventy", start: 0.1, end: 0.5 }])).toEqual([]);
  });
});

describe("how words end and begin", () => {
  it("knows stops, hisses and open endings, numbers and letters too", () => {
    expect(["eight.", "Six!", "cents", "minutes", "box", "thirds", "write", "6", "x"].map(endingOf)).toEqual(Array(9).fill("stop"));
    expect(["squares!", "corners.", "dollars.", "pieces", "edges", "half", "$23", "is", "circles!", "surface.", "enough."].map(endingOf)).toEqual(Array(11).fill("hiss"));
    expect(["zero.", "two", "seven", "C.", "long", "20", "triangle"].map(endingOf)).toEqual(Array(7).fill("open"));
    expect(["Start", "square", "Step"].map(beginningOf)).toEqual(["stop", "stop", "stop"]);
    expect(["Six", "four", "Three", "circle"].map(beginningOf)).toEqual(Array(4).fill("hiss"));
    expect(["twenty", "the", "half", "one"].map(beginningOf)).toEqual(["stop", "open", "open", "open"]);
    expect(saidAs("1,250")).toEqual(["one", "thousand", "two", "hundred", "fifty"]);
    expect(saidAs("$2.50")).toEqual(["two", "cents"]);
  });
});

describe("judging a take", () => {
  /** A take as the service returns it, with its transcript cached so nothing is called. */
  function take(pcm: Int16Array, text: string, words: TimedWord[]) {
    const characters: string[] = [], st: number[] = [], en: number[] = [];
    words.forEach((w, i) => {
      if (i) { characters.push(" "); st.push(w.start); en.push(w.start); }
      for (const ch of w.text) { characters.push(ch); st.push(w.start); en.push(w.end); }
    });
    const t: Take = { audio: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString("base64"), alignment: { characters, character_start_times_seconds: st, character_end_times_seconds: en } };
    const cache = join(mkdtempSync(join(tmpdir(), "strays-")), "take.heard.json");
    writeFileSync(cache, JSON.stringify({ text, words: words.map((w) => ({ text: w.text, start: w.start, end: w.end, type: "word" })) }));
    return { t, cache };
  }

  it("retakes a take whose stray is too close to a word, and passes one whose stray can be removed", async () => {
    for (const [gap, faulty] of [[0.02, true], [0.2, false]] as const) {
      const { pcm, words } = zeroAndHiss(gap);
      const { t, cache } = take(pcm, "away zero.", words);
      const faults = await judge("away zero.", t, cache);
      expect(faults.some((f) => /too close to remove/.test(f))).toBe(faulty);
      expect(faults.filter((f) => !/too close to remove/.test(f))).toEqual([]);
    }
  });
});
