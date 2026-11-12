import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { audioProblems, EDGE, envelope, loneSounds, SR } from "./audio";
import { inSilence, Voice } from "./fixtures/voice-signals";
import { beginningOf, endingOf, JOIN, repairTake, ROOM, saidAs, SIBILANT, strayPlan, TAIL_CLAIM, WORD_TAIL, type TimedWord } from "./strays";
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

/**
 * "...on the balance." as a cached take has it: the voiced "balan", `after` seconds
 * of near silence, then its "ce", 160 ms of noise with too much low energy to
 * measure as a clean hiss. Both timings of the word end `over` seconds into that
 * noise (measured: 100 and 120 ms into it, 80 ms after the voiced part). The film
 * said "balan-".
 */
function balance(after = 0.08, over = 0.1, text = "balance.") {
  const v = new Voice().rest(0.1).say(0.4);
  const voicedEnd = v.t;
  v.rest(after);
  const tailAt = v.t;
  v.breathe(0.16, -34).rest(0.4);
  const words: TimedWord[] = [{ text, start: 0.1, end: tailAt + over }];
  return { pcm: v.pcm(), words, voicedEnd, tailAt };
}

describe("the last sound of a word that is no clean hiss", () => {
  it("is kept when the word's own timing covers it: \"balance\" keeps its \"ce\"", () => {
    for (const after of [0.06, 0.08, 0.2]) {
      const { pcm, words, tailAt } = balance(after);
      const plan = strayPlan(pcm, words, words);
      expect(plan, `${after} s after`).toEqual([]);
      // it is no clean hiss, which is why it used to be taken for a breath
      expect(strayPlan(pcm, [{ ...words[0]!, text: "zero." }]).map((s) => s.sound.low > SIBILANT)).toEqual([true]);
      // nothing is silenced and nothing is cut: the word has its ending, where the voice put it
      const fixed = repairTake(pcm, plan);
      expect(fixed.pcm.length).toBe(pcm.length);
      expect(loudest(fixed.pcm, tailAt, tailAt + 0.16)).toBe(loudest(pcm, tailAt, tailAt + 0.16));
      expect(loudest(fixed.pcm, tailAt, tailAt + 0.16)).toBeGreaterThan(300);
    }
  });

  it("is kept on the service's timing alone, and on the two timings measured (120 and 100 ms into it)", () => {
    const { pcm, words, tailAt } = balance();
    expect(strayPlan(pcm, words)).toEqual([]);
    expect(strayPlan(pcm, [{ ...words[0]!, end: tailAt + 0.12 }], words)).toEqual([]);
    // "tenth," lost its "th" the same way: 100 ms of noise, timed 60 to 80 ms into it
    const v = new Voice().rest(0.1).say(0.3).rest(0.08);
    const at = v.t;
    v.breathe(0.1, -36).rest(0.33).say(0.3).rest(0.3);
    const tenth = (over: number) => [{ text: "tenth,", start: 0.1, end: at + over }, { text: "and", start: at + 0.43, end: at + 0.73 }];
    expect(strayPlan(v.pcm(), tenth(0.08), tenth(0.06))).toEqual([]);
  });

  it("is a breath all the same when a timing of the word covers less than half of it", () => {
    expect(TAIL_CLAIM).toBe(0.5);
    // the word timed to the end of its voiced part, or 40 ms into the noise: a breath beside the word
    for (const over of [-0.08, 0.04]) {
      const { pcm, words } = balance(0.08, over);
      expect(strayPlan(pcm, words).map((s) => [s.kind, s.word]), `${over} s into it`).toEqual([["remove", "balance."]]);
    }
    // the service's timing stretched over it, the transcript's not: the two must agree
    const { pcm, words, voicedEnd } = balance();
    const short = [{ ...words[0]!, end: voicedEnd }];
    expect(strayPlan(pcm, words, short).map((s) => s.kind)).toEqual(["remove"]);
    expect(strayPlan(pcm, short, words).map((s) => s.kind)).toEqual(["remove"]);
  });

  it("is a stray 600 ms after the word, removed as before, however the word is timed", () => {
    const { pcm, words, tailAt } = balance(0.6);
    expect(0.6).toBeGreaterThan(WORD_TAIL);
    const plan = strayPlan(pcm, words, words);
    expect(plan.map((s) => [s.kind, s.word, s.side])).toEqual([["remove", "balance.", "after"]]);
    expect(loudest(repairTake(pcm, plan).pcm, tailAt, tailAt + 0.16)).toBe(0);
  });

  it("is not looked for after a word that ends open: \"zero\" has no such sound", () => {
    const { pcm, words } = balance(0.08, 0.1, "zero.");
    expect(strayPlan(pcm, words, words).map((s) => [s.kind, s.word])).toEqual([["remove", "zero."]]);
  });

  it("a sound before a word is judged as before: removed 60 ms ahead of it, a fault 20 ms ahead", () => {
    for (const [ahead, kind] of [[0.06, "remove"], [0.02, "near"]] as const) {
      const v = new Voice().rest(0.1).say(0.4);
      const firstEnd = v.t;
      v.rest(0.6).breathe(0.16, -34).rest(ahead);
      const next = v.t;
      v.say(0.3).rest(0.3);
      const words = [{ text: "balance.", start: 0.1, end: firstEnd }, { text: "Right", start: next, end: next + 0.3 }];
      expect(strayPlan(v.pcm(), words, words).map((s) => [s.kind, s.word, s.side])).toEqual([[kind, "Right", "before"]]);
    }
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

  it("passes a take whose last word ends in a sound that is no clean hiss, even 20 ms before the next word", async () => {
    // "balance. Right": the "ce" stands 80 ms after the voiced part and 20 ms before the next word
    const v = new Voice().rest(0.1).say(0.4).rest(0.08);
    const tailAt = v.t;
    v.breathe(0.16, -34).rest(0.02);
    const next = v.t;
    v.say(0.3).rest(0.4);
    const words = [{ text: "balance.", start: 0.1, end: tailAt + 0.1 }, { text: "Right", start: next, end: next + 0.3 }];
    const { t, cache } = take(v.pcm(), "balance. Right", words);
    expect(await judge("balance. Right", t, cache)).toEqual([]);
    // the same sound that no word's timing covers is too close to "Right" to remove: a fault, as before
    const bare = [{ ...words[0]!, end: tailAt - 0.08 }, words[1]!];
    const again = take(v.pcm(), "balance. Right", bare);
    expect((await judge("balance. Right", again.t, again.cache)).some((f) => /too close to remove/.test(f))).toBe(true);
  });
});
