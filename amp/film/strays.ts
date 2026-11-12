/**
 * Sounds in the voice that are not where a word is.
 *
 * Every take is split into islands of sound (audio.ts `sounds`). An island
 * inside a word's timing is part of that word; so is any voiced island. The rest
 * are noise in a pause: a hiss, a breath, a click, or a consonant the voice let
 * drift away from its word. Which of these an island is depends on the words
 * beside it, so each one is judged against the word before and the word after:
 *
 *   - after a word that ends in a stop ("eight", "six", "cents", "match"), noise
 *     within CLOSURE is the stop's release, or the hiss after it: part of the
 *     word, kept. So is a stop's burst before the vowel of the next word
 *     ("twenty"), and the "s" of "start" before its closure (ONSET);
 *   - after a word that ends in a hiss ("squares", "corners", "dollars"), a hiss
 *     closer than LOOSE is that word's. From LOOSE to DETACHED it is the word's
 *     own last sound come loose: removing it would say "square", so it is joined
 *     back instead, by cutting the silence between them down to JOIN (only silence
 *     is cut). The same for a word's first hiss ("six"). A breath is no hiss
 *     (SIBILANT) and is never joined;
 *   - but a noise within WORD_TAIL of such a word that the word's own timing covers
 *     (TAIL_CLAIM of it, in every timing there is) is the word's last sound even
 *     when it does not measure as a clean hiss: the "ce" of "balance", the "th" of
 *     "tenth". It is kept as it is, never removed and never a fault;
 *   - anything else heard, with at least GAP of silence to the sound on both
 *     sides, is a stray: it is made digital silence, with short fades;
 *   - a stray closer than GAP to a word cannot be removed without touching the
 *     word: that take is faulty and is made again (voice.ts).
 *
 * Word timings come from the voice service (its alignment) and from the
 * transcript. Both find a word but not its edges. On the takes measured they
 * routinely stretch a word's end over the hiss that follows it, and the service
 * sometimes places a word half a second late, so both are used: an island counts
 * as inside a word when it ends at least EDGE_SLACK before the end of the words it
 * overlaps, or covers most of one word's timing. Measured on the 2,345 cached
 * takes: unstressed last syllables end 20 to 180 ms before that end; every loose
 * hiss, release and stray ends after it.
 */
import { AUDIBLE_FOR, cutOut, EDGE, fadeAround, isHeard, isNoise, silence, sounds, SR, type Sound } from "./audio";

export type Span = { start: number; end: number };
export type TimedWord = Span & { text: string };

/** Silence this long on both sides lets a stray go without its fades touching a word. */
export const GAP = 0.03;
/** A stop's closure lasts up to this before its release or its "s" ("six", "box", "checks": 40 to 170 ms measured). */
export const CLOSURE = 0.25;
/** A stop's burst, or the "s" of "start", stands up to this before the word's vowel ("twenty": 10 to 30 ms measured). */
export const ONSET = 0.12;
/**
 * A word's own hiss closer than LOOSE is still part of it (a short break before a
 * final "s" is ordinary speech). From LOOSE to DETACHED it has come loose: "squares",
 * "corners", "dollars" measured 130 to 220 ms; "circles" 60 to 70 ms.
 */
export const LOOSE = 0.06;
export const DETACHED = 0.3;
/**
 * Only a hiss can be a word's loose "s", "f" or "th": under 2.5 % of its energy below
 * 1 kHz (measured: loose ends 0.1 to 1.8 %). A breath carries more there (3 to 7 %),
 * so a breath next to such a word is a stray all the same.
 */
export const SIBILANT = 0.025;
/**
 * What is left of the silence when a loose hiss is joined back to its word: 10 ms,
 * well inside GAP, so the joined hiss reads as part of the word on any 10 ms grid.
 */
export const JOIN = 0.01;
/**
 * A word's own last sound that does not measure as a clean hiss. The "ce" of
 * "balance" and the "th" of "tenth" stood 80 ms after the voiced part of the word
 * with 3.4 % and 2.6 % of their energy low, so they were taken for a breath and
 * removed: the film said "balan-". What tells them from a breath is the word's own
 * timing. The service and the transcript both ran 60 to 120 ms into them (60 to
 * 80 % of the noise). Of the other 56 sounds removed from some 2,550 cached takes
 * the word before covered nothing, in either timing, but for one hiss half a second
 * out that the service's timing was stretched over.
 *
 * So a noise that begins within WORD_TAIL of the sound of a word that does not end
 * open, and of which every timing of that word covers at least TAIL_CLAIM, is that
 * word's ending and stays as it is. A timing that runs over less of it ("squares"
 * and a breath), or a noise further out, is judged as before.
 */
export const WORD_TAIL = 0.25;
export const TAIL_CLAIM = 0.5;
/** An island counts as inside a word when it ends this long before the word's timed end. */
const EDGE_SLACK = 0.02;
/** Room tone kept before a take's first sound and after its last; the rest becomes digital silence. */
export const ROOM = 0.1;

// ------------------------------------------------------------------ how a word ends and begins
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
/** A whole number in words, as said. */
export function numberWords(n: number): string[] {
  if (!Number.isInteger(n) || n < 0) return [];
  if (n < 20) return [ONES[n]!];
  if (n < 100) return n % 10 ? [TENS[Math.floor(n / 10)]!, ONES[n % 10]!] : [TENS[n / 10]!];
  for (const [size, name] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"], [100, "hundred"]] as const)
    if (n >= size) return [...numberWords(Math.floor(n / size)), name, ...(n % size ? numberWords(n % size) : [])];
  return [];
}
/** The words a token is said as, enough to know its first and last sound. Empty when unsure. */
export function saidAs(token: string): string[] {
  const t = token.toLowerCase().replace(/^[^\p{L}\p{N}$−-]+|[^\p{L}\p{N}%°²³]+$/gu, "");
  if (!t) return [];
  const out: string[] = [];
  if (/^[−-]/.test(t)) out.push("minus");
  const body = t.replace(/^[−-]/, "");
  const money = body.match(/^\$(\d+)(?:\.(\d\d))?$/);
  if (money) return [...out, ...numberWords(Number(money[1])), money[2] && Number(money[2]) ? "cents" : "dollars"];
  if (/^[\d.,]+%$/.test(body)) return [...out, "percent"];
  if (/^[\d.,]+°$/.test(body)) return [...out, "degrees"];
  if (/[²]$/.test(body)) return [...out, "squared"];
  if (/[³]$/.test(body)) return [...out, "cubed"];
  const num = body.replace(/,(?=\d{3}\b)/g, "").match(/^(\d+)(?:\.(\d+))?$/);
  if (num) return [...out, ...numberWords(Number(num[1])), ...(num[2] ? ["point", ...[...num[2]].map((d) => ONES[Number(d)]!)] : [])];
  if (/^\p{L}+(?:[-'’]\p{L}+)*$/u.test(body)) return [...out, ...body.split(/[-'’]/)];
  return [];
}
/** Letters said alone ("Group C.", "x") end and begin as their names do. */
const LETTER: Record<string, string> = {
  a: "ay", b: "bee", c: "see", d: "dee", e: "ee", f: "ef", g: "gee", h: "aitch", i: "eye", j: "jay", k: "kay", l: "el", m: "em",
  n: "en", o: "oh", p: "pee", q: "cue", r: "ar", s: "es", t: "tee", u: "you", v: "vee", w: "double you", x: "ex", y: "why", z: "zee",
};
type Edge = "stop" | "hiss" | "open" | "unknown";
/**
 * The consonant sounds a written word ends with, from its spelling: after its
 * last vowel, with silent letters dropped. S a stop (a closure comes first: t d
 * k p b g, ch and j, x), F a hiss (s z f v th sh), N a nasal or other sonorant.
 */
function endSounds(w: string): string {
  if (/eighths?$/.test(w)) return /s$/.test(w) ? "SFF" : "SF";
  if (/(enough|tough|rough|cough|laugh)s?$/.test(w)) return /s$/.test(w) ? "FF" : "F";
  // -es after a hiss is its own syllable, a vowel and z: "pieces", "matches", "edges"
  if (/([sxz]|ch|sh|[cg])es$/.test(w) && w.length > 3) return "F";
  // a final "-le" is a syllable of its own, ending in l: "circles", "triangle", "table"
  if (/[^aeiouy]les?$/.test(w)) return /s$/.test(w) ? "NF" : "N";
  let soft = false;
  // a silent final e (but not the only vowel: "the", "be"): "write", "once", "edge", "notes"
  const m = w.match(/^(.*[aeiouy].*[^aeiouy])e(s?)$/);
  if (m && !/(ee|ie|oe|ue)s?$/.test(w)) { soft = /[cg]$/.test(m[1]!); w = m[1]! + m[2]!; }
  let tail = w.match(/[^aeiouy]*$/)![0], end = "";
  // a soft c or g before the silent e: "once" ends in s, "change" and "edge" in j
  if (soft && /[cg]s?$/.test(tail)) { end = (/c/.test(tail.slice(-2)) ? "F" : "S") + (tail.endsWith("s") ? "F" : ""); tail = tail.replace(/[cg]s?$/, ""); }
  let out = "";
  for (let i = 0; i < tail.length; i++) {
    const two = tail.slice(i, i + 2), ch = tail[i]!;
    if (two === "gh") { i++; continue; }
    if (two === "th" || two === "sh" || two === "ph") { out += "F"; i++; continue; }
    if (two === "ch" || two === "ck") { out += "S"; i++; continue; }
    if (two === "ng") { out += "N"; i++; continue; }
    if (ch === "x") out += "SF";
    else if ("tdkpbqjcg".includes(ch)) out += "S";
    else if ("szfv".includes(ch)) out += "F";
    else if (ch === "w" || ch === "h") continue;
    else out += "N";
  }
  return out + end;
}
/** How a spoken word ends: in a stop (its release and any "s" may follow a closure), a hiss, or neither. */
export function endingOf(text: string): Edge {
  const said = saidAs(text);
  let w = said[said.length - 1];
  if (!w) return "unknown";
  if (w.length === 1) w = LETTER[w]!.split(" ").pop()!;
  const sounds = endSounds(w);
  if (sounds.includes("S")) return "stop";
  return sounds.endsWith("F") ? "hiss" : "open";
}
/**
 * How a spoken word begins: with a stop, whose burst may stand a moment before
 * its vowel ("twenty", and the "s" of "start" or "square" before its closure);
 * with a voiceless hiss that could drift off ("six", "four", "she"); or neither.
 */
export function beginningOf(text: string): Edge {
  let w = saidAs(text)[0];
  if (!w) return "unknown";
  if (w.length === 1) w = LETTER[w]!;
  if (/^s[ptkq]|^sc(?![eiy])|^ch|^t(?!h)|^[dkpbgqj]|^c(?![eiyh])/.test(w)) return "stop";
  // "th" is voiced in the small words ("the", "this", "then"): a voiced sound does not drift off as noise
  if (/^(s|sh|f|ph|c[eiy])/.test(w) || (/^th/.test(w) && !/^th(e|is|at|ere|ey|em|en|ose|us|ough)/.test(w))) return "hiss";
  return "open";
}

// ------------------------------------------------------------------ the plan for one stretch of voice
export type Stray = {
  /** remove: silence it. join: cut the silence between it and its word. near: too close to a word to remove. */
  kind: "remove" | "join" | "near";
  sound: Sound;
  /** The word it sits after (or before, `side`), as written. */
  word: string;
  side: "after" | "before";
  /** Silence between it and the nearest sound that stays. */
  gap: number;
};

// gaps are whole 10 ms windows measured by subtraction: compare them with a little slack
const below = (gap: number, limit: number) => gap < limit - 1e-6;
const within = (gap: number, limit: number) => gap <= limit + 1e-6;

/**
 * Every heard noise in `pcm` that is not part of a word, and what to do with it.
 * `words` are the voice service's timings of the script's words, `heard` the
 * transcript's: either may be off by a syllable, so both are used, for where the
 * words are and for which word a sound sits next to.
 */
export function strayPlan(pcm: Int16Array, words: TimedWord[], heard: TimedWord[] = []): Stray[] {
  const all = sounds(pcm);
  const spans = [...words, ...heard];
  // Inside a word: ending well before the last word it overlaps ends (a timed start is often
  // late, and a stray hides under a stretched end), or covering most of a word's timed span
  // (a short word, "x", whose timing is narrower than its sound).
  const inside = (s: Sound) => {
    const over = spans.filter((w) => w.start < s.end && w.end > s.start);
    return over.length > 0 && (s.end <= Math.max(...over.map((w) => w.end)) - EDGE_SLACK ||
      over.some((w) => Math.min(w.end, s.end) - Math.max(w.start, s.start) >= 0.5 * (w.end - w.start)));
  };
  // what stays: whatever of a word has substance (a word said softly is still the word; a 10 ms
  // crumb of its decay is not where it ends), and heard voice. Heard noise outside every word
  // is judged below.
  const substance = (s: Sound) => s.peak >= EDGE || s.end - s.start >= AUDIBLE_FOR - 1e-9;
  const stays = all.filter((s) => (inside(s) && substance(s)) || (isHeard(s) && !isNoise(s)));
  const judged = all.filter((s) => isHeard(s) && isNoise(s) && !inside(s));
  const out: Stray[] = [];
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  // The word before a sound claims it when, in every timing given, the last word that starts
  // before the sound does not end open and its span covers at least TAIL_CLAIM of the sound.
  const timings = [words, heard].filter((timed) => timed.length > 0);
  const claimed = (s: Sound) => timings.length > 0 && timings.every((timed) => {
    const w = timed.reduce<TimedWord | undefined>((last, x) => (x.start < s.start && (!last || x.start >= last.start) ? x : last), undefined);
    return !!w && endingOf(w.text) !== "open" && Math.min(w.end, s.end) - s.start >= TAIL_CLAIM * (s.end - s.start) - 1e-6;
  });
  for (const s of judged) {
    const prevSound = stays.filter((x) => x.end <= s.start).at(-1), nextSound = stays.find((x) => x.start >= s.end);
    const gapP = prevSound ? s.start - prevSound.end : Infinity, gapN = nextSound ? nextSound.start - s.end : Infinity;
    const before = sorted.filter((w) => w.start < s.start).at(-1), after = sorted.find((w) => w.start >= s.start);
    const end = before ? endingOf(before.text) : "open", begin = after ? beginningOf(after.text) : "open";
    const keep = () => { stays.push(s); stays.sort((a, b) => a.start - b.start); };
    // part of the word before: a stop's release or what follows its closure, or its own hiss close by
    if (before && ((end === "stop" && within(gapP, CLOSURE)) || (end !== "open" && below(gapP, LOOSE)))) { keep(); continue; }
    // part of the word after: a stop's burst before its vowel, the "s" of "start", or its own hiss close by
    if (after && ((begin === "stop" && within(gapN, ONSET)) || (begin !== "open" && below(gapN, LOOSE)))) { keep(); continue; }
    // a word's own last (or first) hiss come loose: join it back. (When the word has its hiss
    // already, the join only lengthens it; removing it, if it is the word's, would change the word.)
    // ("once. So": between two such words it goes to the nearer one.)
    const sibilant = s.low < SIBILANT;
    const toBefore = sibilant && before && prevSound && end !== "open" && end !== "stop" && within(gapP, DETACHED);
    const toAfter = sibilant && after && nextSound && begin !== "open" && begin !== "stop" && within(gapN, DETACHED);
    if (toBefore && (!toAfter || gapP <= gapN)) { out.push({ kind: "join", sound: s, word: before!.text, side: "after", gap: gapP }); keep(); continue; }
    // the last sound of the word before, by that word's own timing: it stays as it is
    if (prevSound && within(gapP, WORD_TAIL) && claimed(s)) { keep(); continue; }
    if (toAfter) { out.push({ kind: "join", sound: s, word: after!.text, side: "before", gap: gapN }); keep(); continue; }
    const towardBefore = gapP <= gapN, gap = Math.min(gapP, gapN);
    const word = (towardBefore ? before ?? after : after ?? before)?.text ?? "";
    out.push({ kind: below(gap, GAP) ? "near" : "remove", sound: s, word, side: towardBefore ? (before ? "after" : "before") : (after ? "before" : "after"), gap });
  }
  return out;
}

/** One line a person can act on; `at` says where (by default, the time in the take). */
export function describe(s: Stray, at = `at ${s.sound.start.toFixed(2)} s`) {
  const ms = (t: number) => `${Math.round(t * 1000)} ms`;
  if (s.kind === "join") return `the ${s.side === "after" ? "end" : "start"} of "${s.word}" came loose ${at} (${ms(s.gap)} of silence)`;
  return `a stray sound ${at} (${ms(s.sound.end - s.sound.start)}) ${s.side} "${s.word}"${s.kind === "near" ? `, ${ms(s.gap)} from it: too close to remove` : ""}`;
}

/**
 * A take with its strays silenced, its loose hisses joined back, and everything
 * outside its sounds (before the first, after the last, beyond ROOM) made digital
 * silence: a breath or click at either end of a take never reaches the film.
 * `map` carries a time in the take to the repaired take; `joins` are the new edits.
 */
export function repairTake(src: Int16Array, plan: Stray[]) {
  const pcm = Int16Array.from(src);
  for (const s of plan) if (s.kind === "remove") silence(pcm, s.sound.start - 0.005, s.sound.end + 0.005);
  // the take's own edges: room tone ends ROOM after its last sound, starts ROOM before its first
  const left = sounds(pcm).filter(isHeard);
  if (left.length) {
    const ia = Math.round(Math.max(0, left[0]!.start - ROOM) * SR), ib = Math.round(Math.min(pcm.length / SR, left[left.length - 1]!.end + ROOM) * SR);
    if (ia > 0) { pcm.fill(0, 0, ia); fadeAround(pcm, ia, false, true); }
    if (ib < pcm.length) { pcm.fill(0, ib); fadeAround(pcm, ib, true, false); }
  }
  // join each loose hiss to its word: cut the silence between them down to JOIN, cutting only silence
  const loose = plan.filter((s) => s.kind === "join");
  const cuts = loose.map((s): [number, number] => {
    const from = s.side === "after" ? s.sound.start - s.gap : s.sound.end;
    return [from + JOIN / 2, from + s.gap - JOIN / 2];
  });
  const out = cutOut(pcm, cuts);
  return { pcm: out.pcm, map: out.map, joins: loose.map((s, k) => ({ at: out.map(cuts[k]![0]), word: s.word })) };
}
