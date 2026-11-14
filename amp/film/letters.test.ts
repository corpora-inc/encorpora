import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { captionText } from "./captions";
import { MODEL, NARRATOR_ID, neighbours, resolveCast, runsOf, spokenText, takeKeyParts } from "./cast";
import { displayScript, displayText, heldLetterFaults, letterNotes, MIN_LETTER_HOLD } from "./letters";
import { scriptSchema, type Timing } from "./schema";
import { heldHighlights } from "./stage";
import { differences, goodTake, judge, spoken, takeKey, wordsOf, type Alignment } from "./voice";

// A synthetic cache exercises judge and goodTake without files or service calls.
const cache = vi.hoisted(() => new Map<string, string>());
vi.mock("node:fs", async (original) => ({
  ...await original<typeof import("node:fs")>(),
  existsSync: (path: string) => cache.has(path),
  readFileSync: (path: string) => { if (!cache.has(path)) throw new Error(`Unexpected read: ${path}`); return cache.get(path)!; },
  writeFileSync: (path: string, data: string) => cache.set(path, data),
  mkdirSync: () => {},
}));

/** Each word starts one second apart; punctuation is assigned a long pause. */
function alignment(text: string, hold = 0.24, start = 0): Alignment {
  const a: Alignment = { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] };
  text.split(" ").forEach((word, wi) => {
    [...word, " "].forEach((ch, ci) => {
      a.characters.push(ch);
      a.character_start_times_seconds.push(start + wi + ci * hold / word.replace(/\W/g, "").length);
      a.character_end_times_seconds.push(/\w/.test(ch) ? start + wi + (ci + 1) * hold / word.replace(/\W/g, "").length : start + wi + 0.9);
    });
  });
  return a;
}
const script = (say: string) => scriptSchema.parse({ id: "letters", title: "Letters", shots: [{ beats: [{ say }] }] });
const timing = (say: string): Timing => {
  const words = wordsOf(alignment(spokenText({ id: NARRATOR_ID }, say)), say);
  return { duration: words.length + 1, shots: [[{ start: words[0]!.start, end: words.at(-1)!.end, words }]] };
};

describe("letter names", () => {
  it("respells only marked a, preserves case for other letters, and treats context the same", () => {
    const voice = { id: NARRATOR_ID, tag: "[energetic]" };
    expect(spokenText(voice, "Make *a* longer and *B* shorter. *A*, *x*, a square.")).toBe("[energetic] Make A longer and B shorter. A, x, a square.");
    expect(displayText("Make *a* longer and *B* shorter.")).toBe("Make a longer and B shorter.");
    const s = script("Side *a*.");
    s.shots.push({ beats: [{ say: "Then *b*." }] }, { beats: [{ say: "Back to *A*." }] });
    const runs = runsOf(s, resolveCast(s)), context = neighbours(runs, 1);
    expect(spokenText(voice, context.prev!)).toBe("[energetic] Side A.");
    expect(spokenText(voice, context.next!)).toBe("[energetic] Back to A.");
  });

  it("keeps every unmarked cache key and changes the key when any mark changes", () => {
    const line = "Make a longer and b shorter.", voice = { id: NARRATOR_ID };
    const old = createHash("sha256").update(JSON.stringify([voice.id, MODEL, line])).digest("hex").slice(0, 24);
    expect(takeKey(voice, line)).toBe(old);
    const lines = [line, "Make *a* longer and b shorter.", "Make *a* longer and *b* shorter."];
    expect(new Set(lines.map((text) => takeKey(voice, text))).size).toBe(3);
    // a take voiced with an older respelling of a marked letter is not reused; other marked letters keep their key
    expect(takeKeyParts({ id: NARRATOR_ID }, "Side *a*.")).toEqual([NARRATOR_ID, MODEL, "Side *a*.", "letters-2"]);
    expect(takeKeyParts({ id: NARRATOR_ID }, "Side *b*.")).toEqual([NARRATOR_ID, MODEL, "Side *b*."]);
  });

  it("compares the hearing against bare letters", () => {
    expect(spoken("Make *a* longer and *b* shorter.")).toEqual(spoken("Make a longer and b shorter."));
    const text = "Make A longer and B shorter.";
    const heard = { text, words: text.split(" ").map((text, start) => ({ text, start, end: start + 0.24, type: "word" })) };
    expect(differences("Make *a* longer and *b* shorter.", heard)).toEqual([]);
    // a letter read out as two letters ("A, Y": the founder heard "A why is one, one") is a fault of the take
    const spelled = { text: "AY is one, one.", words: ["AY", "is", "one,", "one."].map((text, i) => ({ text, start: i, end: i + 0.5, type: "word" })) };
    expect(differences("*A* is one, one.", spelled)).not.toEqual([]);
  });

  it("restores alignment words one for one, including punctuation and split hyphenated words", () => {
    const a = alignment("[energetic] Twenty three: A, B. A!");
    const raw = wordsOf(a), restored = wordsOf(a, "Twenty-three: *a*, *B*. *A*!");
    expect(restored.map((w) => w.text)).toEqual(["Twenty", "three:", "a,", "B.", "A!"]);
    expect(restored.map(({ start, end }) => [start, end])).toEqual(raw.map(({ start, end }) => [start, end]));
    expect(wordsOf(a)).toEqual(raw);
    expect(() => wordsOf(alignment("a square A"), "A square and *a*")).toThrow(/alignment does not match/);
    expect(wordsOf(alignment("Say A and A."), "Say A and *a*.").map((w) => w.text)).toEqual(["Say", "A", "and", "a."]);
  });

  it("shows bare letters in captions, transcript and storyboard script without changing the source", () => {
    const say = "Make *a* longer and *b* shorter.", s = script(say);
    expect(displayScript(s).shots[0]!.beats[0]!.say).toBe("Make a longer and b shorter.");
    expect(s.shots[0]!.beats[0]!.say).toBe(say);
    const captions = captionText(timing(say));
    for (const text of Object.values(captions)) {
      expect(text).toContain("Make a longer and b shorter.");
      expect(text).not.toMatch(/\*|\bay\b/);
    }
  });

  it("counts marked and unmarked cue occurrences together, case-insensitively", () => {
    const say = "A square beside *a*, then *A*.";
    const s = script(say), t = timing(say);
    s.shots[0]!.beats[0]!.do = [1, 2, 3].map((nth) => ({ do: "highlight", target: "side", at: "a", nth }));
    const marked = heldHighlights(displayScript(s), t);
    const bare = script(displayText(say));
    bare.shots[0]!.beats[0]!.do = s.shots[0]!.beats[0]!.do;
    expect(marked).toEqual(heldHighlights(bare, timing(displayText(say))));
    expect(marked.map((h) => h.word)).toEqual(["a", "a", "a"]);
    expect(marked[0]!.t).toBeLessThan(marked[1]!.t);
    expect(marked[1]!.t).toBeLessThan(marked[2]!.t);
  });

  it("faults only a marked a held below the threshold, ignoring punctuation's pause", () => {
    expect(heldLetterFaults("*a*.", wordsOf(alignment("A.", 0.04, 60.1))))
      .toEqual(['at 60.1 s the letter "a" was read as a word, not as a letter']);
    expect(heldLetterFaults("*A*.", wordsOf(alignment("A.", 0.119, 60.1)))).toHaveLength(1);
    expect(heldLetterFaults("*a*.", wordsOf(alignment("A.", MIN_LETTER_HOLD, 60.1)))).toEqual([]);
    expect(heldLetterFaults("a *b*.", wordsOf(alignment("a b.", 0.04)))).toEqual([]);
  });

  it("judges a short letter as a fault and retries a synthetic cached take", async () => {
    const text = "*a*.", key = takeKey({ id: NARRATOR_ID }, text);
    const short = { audio: Buffer.alloc(44100 * 2).toString("base64"), alignment: alignment("A.", 0.04) };
    const held = { ...short, alignment: alignment("A.", 0.24) };
    const heard = JSON.stringify({ text: "A.", words: [{ text: "A.", start: 0, end: 0.24, type: "word" }] });
    cache.set(`/takes/${key}.json`, JSON.stringify(short));
    cache.set(`/takes/${key}.1.json`, JSON.stringify(held));
    cache.set(`/takes/${key}.heard.json`, heard);
    cache.set(`/takes/${key}.1.heard.json`, heard);
    expect(await judge(text, short, `/takes/${key}.heard.json`)).toEqual(['at 0.0 s the letter "a" was read as a word, not as a letter']);
    const result = await goodTake("/takes", text);
    expect(result).toEqual({ take: held, faults: [], spent: 0 });
    expect(JSON.parse(cache.get(`/takes/${key}.json`)!)).toEqual(held);
  });
});

describe("dry letter notes", () => {
  it.each(["legs a and b", "a plus b", "side a.", "a,", "a:", "a;", "a?", "leg a grows", "point A moves", "angle a grows", "length a grows", "letter a grows", "a or b", "a minus b", "a times b", "a squared", "a cubed", "a equals b", "a over b", "Make a longer and b shorter."])("notes %s", (say) => {
    expect(letterNotes(script(say))).toEqual([`shot 1: "${say}": if this is the letter a, write *a* so the voice says its name`]);
  });
  it.each(["a square of side", "a right triangle", "legs *a* and *b*", "side *A*.", "data plus b", "a1 plus b", "a's length"])("leaves %s alone", (say) => {
    expect(letterNotes(script(say))).toEqual([]);
  });
});
