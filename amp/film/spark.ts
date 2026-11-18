/**
 * House voices: takes from our own Chatterbox service on the Spark (spark-voice/).
 *
 * The service speaks words, not digits or symbols, so each written word is
 * spelled as spoken first ("12" is "twelve", "×" is "times"). The service
 * times every spoken word by forced alignment; here those times become the
 * per-character alignment ElevenLabs returns for the written text, so word
 * timing, the take checks and the stage work unchanged.
 */
import type { Voice } from "./cast";
import type { Alignment, Heard, Take } from "./voice";

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES: [number, string][] = [[1e9, "billion"], [1e6, "million"], [1000, "thousand"], [100, "hundred"]];
const DENOMINATORS: Record<number, [string, string]> = {
  2: ["half", "halves"], 3: ["third", "thirds"], 4: ["fourth", "fourths"], 5: ["fifth", "fifths"], 6: ["sixth", "sixths"],
  7: ["seventh", "sevenths"], 8: ["eighth", "eighths"], 9: ["ninth", "ninths"], 10: ["tenth", "tenths"], 12: ["twelfth", "twelfths"],
  100: ["hundredth", "hundredths"],
};
const SYMBOLS: Record<string, string> = {
  "+": "plus", "−": "minus", "–": "minus", "-": "minus", "×": "times", "·": "times", "÷": "divided by", "=": "equals",
  "%": "percent", "°": "degrees", "<": "is less than", ">": "is greater than", "≤": "is at most", "≥": "is at least", "≈": "is about",
};

/** A whole number in words: 2024 is "two thousand twenty-four". */
export function numberWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`Cannot say ${n}`);
  if (n < 20) return ONES[n]!;
  if (n < 100) return TENS[Math.floor(n / 10)]! + (n % 10 ? `-${ONES[n % 10]}` : "");
  for (const [size, name] of SCALES) {
    if (n >= size) {
      const rest = n % size;
      return `${numberWords(Math.floor(n / size))} ${name}${rest ? ` ${numberWords(rest)}` : ""}`;
    }
  }
  return String(n);
}

/** One written token's core (no surrounding punctuation) as spoken words. */
function sayCore(core: string): string {
  if (!core) return "";
  if (core in SYMBOLS) return SYMBOLS[core]!;
  let m = core.match(/^\$(\d[\d,]*)(?:\.(\d\d))?$/);
  if (m) {
    const d = Number(m[1]!.replace(/,/g, "")), c = m[2] ? Number(m[2]) : 0;
    return `${numberWords(d)} dollar${d === 1 ? "" : "s"}${c ? ` and ${numberWords(c)} cent${c === 1 ? "" : "s"}` : ""}`;
  }
  m = core.match(/^(\d+)\/(\d+)$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]), den = DENOMINATORS[b];
    return den ? `${numberWords(a)} ${a === 1 ? den[0] : den[1]}` : `${numberWords(a)} over ${numberWords(b)}`;
  }
  m = core.match(/^([−-])?(\d[\d,]*)(?:\.(\d+))?(%|°)?$/);
  if (m && (!m[2]!.includes(",") || /^\d{1,3}(,\d{3})+$/.test(m[2]!))) {
    const whole = numberWords(Number(m[2]!.replace(/,/g, "")));
    const frac = m[3] ? ` point ${[...m[3]].map((d) => ONES[Number(d)]).join(" ")}` : "";
    return `${m[1] ? "minus " : ""}${whole}${frac}${m[4] ? ` ${SYMBOLS[m[4]]}` : ""}`;
  }
  m = core.match(/^(\d+)(st|nd|rd|th)$/);
  if (m) return ordinal(Number(m[1]));
  // a symbol between two numbers written together: 3×4, 12=12
  m = core.match(/^(\d+)([+×÷=<>−-])(\d+)$/);
  if (m) return `${sayCore(m[1]!)} ${SYMBOLS[m[2]!]} ${sayCore(m[3]!)}`;
  m = core.match(/^(\p{L}+)²$/u) ?? core.match(/^(\p{L}+)\^2$/u);
  if (m) return `${m[1]} squared`;
  return core.replace(/²/g, " squared").replace(/³/g, " cubed");
}

function ordinal(n: number) {
  const word = numberWords(n);
  const irregular: Record<string, string> = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };
  const parts = word.split(/([ -])/);
  const last = parts.pop()!;
  return parts.join("") + (irregular[last] ?? (last.endsWith("y") ? `${last.slice(0, -1)}ieth` : `${last}th`));
}

export type Spoken = {
  /** The text the voice reads: every written word spelled as spoken, punctuation kept for its phrasing. */
  text: string;
  /** The written words, as the text splits on spaces. */
  written: string[];
  /** For each written word, its spoken words: lower case letters and apostrophes. Punctuation alone has none. */
  spoken: string[][];
};

/** What the voice is asked to say for `text`, and which spoken words belong to which written word. */
export function speakable(text: string): Spoken {
  const written = text.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  const spoken = written.map((word) => {
    const m = word.match(/^([^\p{L}\p{N}$−+×÷=<>≤≥≈°%-]*)(.*?)([^\p{L}\p{N}%°²³]*)$/u)!;
    const [lead, core, trail] = [m[1]!, m[2]!, m[3]!];
    // a lone symbol keeps its trailing punctuation ("=" or "×,")
    const said = core ? sayCore(core) : SYMBOLS[trail.replace(/[.,;:!?]+$/, "")] ?? "";
    parts.push(`${lead}${said}${core ? trail : ""}`.trim());
    return said.toLowerCase().replace(/[’]/g, "'").split(/[\s-]+/).map((w) => w.replace(/[^a-z']/g, "")).filter((w) => /[a-z]/.test(w));
  });
  return { text: parts.filter(Boolean).join(" "), written, spoken };
}

/**
 * Spoken-word times as the per-character alignment of the written text.
 * A written word runs from its first spoken word's start to its last one's
 * end; its letters and digits share that span evenly, so its first letter starts and
 * its last letter ends exactly there. A word with nothing spoken (a dash) sits
 * at the end of the word before it.
 */
export function alignmentOf(written: string[], spoken: string[][], times: { start: number; end: number }[]): Alignment {
  const need = spoken.reduce((n, s) => n + s.length, 0);
  if (times.length !== need) throw new Error(`The aligner timed ${times.length} words for ${need}`);
  const out: Alignment = { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] };
  let k = 0, last = 0;
  written.forEach((word, i) => {
    if (i) {
      out.characters.push(" ");
      out.character_start_times_seconds.push(last);
      out.character_end_times_seconds.push(last);
    }
    const mine = times.slice(k, k + spoken[i]!.length);
    k += spoken[i]!.length;
    const start = mine.length ? mine[0]!.start : last, end = mine.length ? Math.max(start, mine[mine.length - 1]!.end) : last;
    // Letters and digits share the span; punctuation takes no time, so the word's last letter ends at its end.
    const chars = [...word], letters = chars.filter((ch) => /[\p{L}\p{N}]/u.test(ch)).length || chars.length;
    const step = (end - start) / letters;
    let n = 0;
    chars.forEach((ch) => {
      const timed = letters === chars.length || /[\p{L}\p{N}]/u.test(ch);
      const t0 = start + n * step;
      out.characters.push(ch);
      out.character_start_times_seconds.push(t0);
      if (timed) n++;
      out.character_end_times_seconds.push(timed ? (n === letters ? end : start + n * step) : t0);
    });
    last = end;
  });
  return out;
}

/** The service's address: FILM_SPARK_VOICE_URL, e.g. http://<spark address>:18093 (spark-voice/README.md). */
export function sparkUrl() {
  const url = process.env.FILM_SPARK_VOICE_URL;
  if (!url) throw new Error("FILM_SPARK_VOICE_URL is not set: start the Spark voice service (film/spark-voice/README.md) and point this at it");
  return url.replace(/\/+$/, "");
}

/** Retakes of a house voice cost nothing, so it gets more tries than a paid voice. */
export const SPARK_TRIES = 5;
/** The seed of try `k`: a retake is a new seed; the first take is always the same. */
export const sparkSeed = (k: number) => 1000 + k;

/**
 * Candidates the service makes of each take; it answers the best by its own
 * score (spark-voice/score.py): transcript, sounds that are no word, UTMOS
 * naturalness, likeness to the voice, pace. FILM_SPARK_CANDIDATES overrides.
 */
export const sparkCandidates = () => Math.max(1, Math.min(8, Number(process.env.FILM_SPARK_CANDIDATES ?? 3) || 3));
/**
 * What a house take is made by beyond model, voice and text: the service's
 * processing (2: onsets found in the audio, tails cut at the last word, noises
 * reported; spark-voice/quality.py) and the number of candidates. A change to
 * either is a new take, so cached takes made the old way are never reused.
 */
export const sparkRecipe = (n = sparkCandidates()) => `p2n${n}`;

type Reply = { sample_rate: number; pcm: string; words: { word: string; start: number; end: number }[]; faults?: string[]; candidates?: unknown[] };

/** One take of `text` in a house voice. `sent` is the text after the voice's tag and respellings. */
export async function sparkTake(voice: Voice, sent: string, k: number, fetcher: typeof fetch = fetch, n = sparkCandidates()): Promise<Take & { seed: number }> {
  if (!voice.spark) throw new Error(`${voice.id} is not a house voice`);
  const { text, written, spoken } = speakable(sent);
  const words = spoken.flat();
  if (!words.length) throw new Error(`Nothing to say in "${sent}"`);
  const seed = sparkSeed(k);
  const reply = await ask<Reply>("/tts", { model: voice.spark.model, voice: voice.spark.voice, text, words, seed, stage: k, n, align: true }, fetcher);
  if (reply.sample_rate !== 44100) throw new Error(`The Spark voice answered at ${reply.sample_rate} Hz, not 44100`);
  // `faults` are sounds the service heard that are no word; judge() retakes on them.
  return { audio: reply.pcm, alignment: alignmentOf(written, spoken, reply.words), seed, faults: reply.faults ?? [], ...(reply.candidates ? { candidates: reply.candidates } : {}) };
}

/** POST to the service. 503 means the Spark is busy with another GPU job or short of memory: wait, then ask again. */
async function ask<T>(path: string, request: unknown, fetcher: typeof fetch): Promise<T> {
  const body = JSON.stringify(request);
  for (let attempt = 0; ; attempt++) {
    const res = await fetcher(`${sparkUrl()}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (res.ok) return (await res.json()) as T;
    const why = (await res.text()).slice(0, 300);
    if (res.status !== 503 || attempt >= 20) throw new Error(`Spark voice ${res.status}: ${why}`);
    console.log(`Spark voice busy (${why}); asking again in 30 s`);
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

/** What Whisper on the Spark hears in a take, in the shape of Scribe's answer. */
export const sparkHear = (pcm: Int16Array, fetcher: typeof fetch = fetch) =>
  ask<Heard>("/hear", { sample_rate: 44100, pcm: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString("base64") }, fetcher);
