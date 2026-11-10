/**
 * The voice: one take per run of beats by the same speaker (one per shot in a
 * one-voice lesson) from ElevenLabs, each one listened to before it is used.
 *
 * A take is kept only if it passes every check:
 *   - a speech-to-text pass hears exactly the words of the script (nothing skipped,
 *     repeated, garbled or misread),
 *   - it ends in silence (the voice was not cut off),
 *   - it never clips.
 * A take that fails is generated again, automatically. Kept takes are cached by
 * their text, so a film is voiced once and re-renders cost nothing.
 *
 * Check the cached takes of a lesson:   npx tsx film/voice.ts <template-id>
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDGE, envelope, SR } from "./audio";
import { MODEL, NARRATOR_ID, requireVoices, resolveCast, runsOf, spokenText, takeKeyParts, type Voice } from "./cast";
import { FILM_VOICES } from "./paths";

/** The narrator: Madeline Brousseaux, by exact id (docs/amp-media-pipeline.md). Other approved voices are in voices.ts. */
export const VOICE_ID = NARRATOR_ID;
export { MODEL };
/** The cache key of a take: voice, model, text, and the voice's tag when it has one. */
export const takeKey = (voice: Voice, text: string) => createHash("sha256").update(JSON.stringify(takeKeyParts(voice, text))).digest("hex").slice(0, 24);
const HEAR_MODEL = "scribe_v2";
const TRIES = 3;

export type Alignment = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
export type Take = { audio: string; alignment: Alignment };
type Heard = { text: string; words: { text: string; start: number; end: number; type: string }[] };

function apiKey() {
  if (process.env.ELEVEN_LABS_API_KEY) return process.env.ELEVEN_LABS_API_KEY;
  throw new Error("ELEVEN_LABS_API_KEY is not set");
}

// ------------------------------------------------------------------ what was said, normalized
const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE: Record<string, number> = { hundred: 100, thousand: 1000, million: 1e6 };
/** Words a transcript may write either way: "$23" is "23 dollars" for "twenty-three dollar fee". */
const SAME: Record<string, string> = { dollars: "dollar", cents: "cent" };
/** "two sevenths" is "2/7": a fraction word after a number is "over" and its number. */
const PER: Record<string, number> = {
  half: 2, halves: 2, third: 3, thirds: 3, fourth: 4, fourths: 4, quarter: 4, quarters: 4, fifth: 5, fifths: 5,
  sixth: 6, sixths: 6, seventh: 7, sevenths: 7, eighth: 8, eighths: 8, ninth: 9, ninths: 9, tenth: 10, tenths: 10,
};
/** Words a transcript may add or drop without changing what was said. */
const FILLER = new Set(["and"]);
const isNum = (w: string | undefined) => !!w && (w in SMALL || w in TENS || w in SCALE);

/**
 * Words in one spelling for both script and hearing: number words as digits,
 * symbols as words. Punctuation ends a number, so "six: fifteen" stays two.
 * Each word keeps the time of the piece it came from.
 */
export function spokenWords(items: { text: string; t: number }[]) {
  const toks: { w: string; t: number }[] = [];
  for (const it of items) {
    const s = it.text
      .toLowerCase()
      .replace(/(\d),(?=\d{3}\b)/g, "$1")
      .replace(/\$\s?(\d+)\.(\d\d)\b/g, " $1 dollars $2 cents ")
      .replace(/(\d)\s*\/\s*(\d)/g, "$1 over $2")
      .replace(/\b(\p{L})\((\p{L})\)/gu, "$1 of $2")
      .replace(/²/g, " squared ").replace(/³/g, " cubed ").replace(/\^\s*2\b/g, " squared ").replace(/\^\s*3\b/g, " cubed ")
      .replace(/(\d)(\p{L})/gu, "$1 $2").replace(/(\p{L})(\d)/gu, "$1 $2")
      .replace(/\$\s?(\d+(?:\.\d+)?)/g, " $1 dollars ")
      .replace(/(\d)\.(?=\d)/g, "$1 point ")
      .replace(/[’']/g, "")
      .replace(/(\p{L})-(?=\p{L})/gu, "$1 ")
      .replace(/[−–]|-(?=\s*[\d\p{L}(])/gu, " minus ")
      .replace(/\+/g, " plus ").replace(/=/g, " equals ").replace(/[×·]/g, " times ").replace(/÷/g, " divided by ")
      .replace(/°/g, " degrees ").replace(/%/g, " percent ")
      .replace(/\bnegative\b/g, "minus");
    for (const w of s.match(/[\p{L}\p{N}]+|[.,;:?!]/gu) ?? []) if (!FILLER.has(w)) toks.push({ w: SAME[w] ?? w, t: it.t });
  }
  // "two point oh one": "oh" is a zero next to numbers
  toks.forEach((k, i) => {
    const p = toks[i - 1]?.w;
    if (k.w === "oh" && p && (p === "point" || /^\d+$/.test(p) || p in SMALL)) k.w = "zero";
  });
  const out: { w: string; t: number }[] = [];
  let total = 0, part = 0, last: "" | "small" | "tens" | "hundred" | "scale" = "", t0 = 0;
  const flush = () => { if (last) out.push({ w: String(total + part), t: t0 }); total = part = 0; last = ""; };
  for (let i = 0; i < toks.length; i++) {
    const { w, t } = toks[i]!;
    const next = toks[i + 1]?.w;
    if (w === "a" && next && next in SCALE && !last) { last = "small"; part = 1; t0 = t; continue; }
    if (w in SMALL) {
      const v = SMALL[w]!;
      if (!(last === "" || (last === "tens" && part % 10 === 0 && v < 10) || last === "hundred" || last === "scale")) flush();
      if (!last) t0 = t;
      part += v; last = "small"; continue;
    }
    if (w in TENS) {
      if (!(last === "" || last === "hundred" || last === "scale")) flush();
      if (!last) t0 = t;
      part += TENS[w]!; last = "tens"; continue;
    }
    if (w === "hundred" && (last === "small" || last === "tens")) { part *= 100; last = "hundred"; continue; }
    if (w in SCALE && w !== "hundred" && last && last !== "scale") { total += part * SCALE[w]!; part = 0; last = "scale"; continue; }
    flush();
    if (/^[.,;:?!]$/.test(w)) continue;
    out.push({ w, t });
  }
  flush();
  // digits after "point" are read one at a time: 2.01 is "two point zero one"
  const split: { w: string; t: number }[] = [];
  out.forEach((x, i) => {
    const prev = out[i - 1]?.w;
    if (prev === "point" && /^\d{2,}$/.test(x.w)) for (const d of x.w) split.push({ w: d, t: x.t });
    else if (x.w in PER && prev && /^\d+$/.test(prev)) split.push({ w: "over", t: x.t }, { w: String(PER[x.w]), t: x.t });
    else split.push(x);
  });
  return split;
}
export const spoken = (text: string) => spokenWords([{ text, t: 0 }]).map((x) => x.w);

/** Where the hearing differs from the script, as short readable pieces with the time heard. */
export function differences(script: string, heard: Heard) {
  const want = spoken(script).join("");
  let got = "";
  const at: number[] = [];
  for (const x of spokenWords(heard.words.filter((w) => w.type === "word").map((w) => ({ text: w.text, t: w.start })))) {
    got += x.w;
    for (const _ of x.w) at.push(x.t);
  }
  // character-level alignment (both strings are a few hundred characters)
  const n = want.length, m = got.length, W = m + 1;
  const dp = new Uint16Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i * W + j] = want[i] === got[j] ? dp[(i + 1) * W + j + 1]! + 1 : Math.max(dp[(i + 1) * W + j]!, dp[i * W + j + 1]!);
  const out: { at: number; want: string; got: string }[] = [];
  let i = 0, j = 0, cw = "", cg = "", t = 0;
  const flush = () => { if (cw || cg) out.push({ at: t, want: cw, got: cg }); cw = cg = ""; };
  while (i < n || j < m) {
    if (i < n && j < m && want[i] === got[j]) { flush(); i++; j++; continue; }
    if (!cw && !cg) t = at[Math.min(j, m - 1)] ?? 0;
    if (j < m && (i >= n || dp[i * W + j + 1]! >= dp[(i + 1) * W + j]!)) cg += got[j++];
    else cw += want[i++];
  }
  flush();
  return out;
}

// ------------------------------------------------------------------ takes
function wavBytes(pcm: Int16Array) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength), h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
export const pcmOf = (t: Take) => {
  const raw = Buffer.from(t.audio, "base64");
  return new Int16Array(raw.buffer, raw.byteOffset, raw.length >> 1);
};

async function generate(voice: Voice, text: string, prev: string | undefined, next: string | undefined, seed?: number): Promise<Take> {
  // Authoring sessions run with FILM_NO_VOICE=1: only a reviewer spends voice characters.
  if (process.env.FILM_NO_VOICE) throw new Error("Voicing is off in this session (FILM_NO_VOICE). Check the screenplay with --dry.");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/with-timestamps?output_format=pcm_44100`, {
    method: "POST",
    headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      // a per-voice tag ("[energetic]") is written before the words and never spoken
      text: spokenText(voice, text),
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
      ...(prev ? { previous_text: spokenText(voice, prev) } : {}),
      ...(next ? { next_text: spokenText(voice, next) } : {}),
      ...(seed !== undefined ? { seed } : {}),
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as any;
  return { audio: body.audio_base64, alignment: body.alignment ?? body.normalized_alignment };
}

async function hear(pcm: Int16Array, cache: string): Promise<Heard> {
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  const form = new FormData();
  form.set("model_id", HEAR_MODEL);
  form.set("language_code", "en");
  form.set("timestamps_granularity", "word");
  form.set("tag_audio_events", "false");
  form.set("file", new Blob([wavBytes(pcm)], { type: "audio/wav" }), "take.wav");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey() }, body: form });
    if (res.ok) {
      const body = (await res.json()) as Heard;
      const kept: Heard = { text: body.text, words: body.words.map((w) => ({ text: w.text, start: w.start, end: w.end, type: w.type })) };
      writeFileSync(cache, JSON.stringify(kept));
      return kept;
    }
    if (attempt >= 2 || res.status < 500) throw new Error(`ElevenLabs speech-to-text ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
}

/** What is wrong with a take, if anything. Empty means it is good to use. */
export async function judge(text: string, take: Take, cache: string) {
  const pcm = pcmOf(take), env = envelope(pcm);
  const faults: string[] = [];
  const tail = env.slice(-5);
  if (!tail.length || Math.max(...tail) >= EDGE) faults.push("the voice is cut off at the end");
  for (let i = 0, run = 0; i < pcm.length; i++) {
    run = pcm[i] === 32767 || pcm[i] === -32768 ? run + 1 : 0;
    if (run === 3) { faults.push(`it clips at ${(i / SR).toFixed(2)} s`); break; }
  }
  const heard = await hear(pcm, cache);
  for (const d of differences(text, heard))
    faults.push(`at ${d.at.toFixed(1)} s the script says "${d.want}" but the voice says "${d.got}"`);
  return faults;
}

/**
 * A good take of `text`, from the cache or made now. Returns the take and, when
 * no try passed, the faults of the best one so a person can listen there.
 */
export async function goodTake(dir: string, text: string, prev?: string, next?: string, voice: Voice = { id: VOICE_ID }) {
  mkdirSync(dir, { recursive: true });
  // the key names the voice (and its tag), so a line voiced by two speakers is two takes
  const hash = takeKey(voice, text);
  const path = join(dir, `${hash}.json`), heardPath = (k: number) => join(dir, `${hash}${k ? `.${k}` : ""}.heard.json`);
  let spent = 0;
  let best: { take: Take; faults: string[] } | undefined;
  let last: string[] = [];
  for (let k = 0; k < TRIES; k++) {
    const file = k ? join(dir, `${hash}.${k}.json`) : path;
    let take: Take;
    if (existsSync(file)) take = JSON.parse(readFileSync(file, "utf8"));
    else {
      take = await generate(voice, text, prev, next, k ? 1000 + k : undefined);
      spent += text.length;
      writeFileSync(file, JSON.stringify(take));
    }
    const faults = await judge(text, take, heardPath(k));
    if (!faults.length) {
      if (k) writeFileSync(path, JSON.stringify(take)), writeFileSync(heardPath(0), readFileSync(heardPath(k)));
      return { take, faults, spent };
    }
    if (!best || faults.length < best.faults.length) best = { take, faults };
    // A difference that comes back in the next take is the script or the matcher,
    // not the voice: another take would not help, so stop paying for them.
    const gist = (f: string) => f.replace(/^at [\d.]+ s /, "");
    if (k > 0 && faults.some((f) => last.includes(gist(f)))) break;
    last = faults.map(gist);
  }
  return { take: best!.take, faults: best!.faults, spent };
}

if (process.argv[1]?.endsWith("voice.ts")) {
  const id = process.argv[2];
  if (!id) throw new Error("Usage: npx tsx film/voice.ts <template-id>");
  const here = new URL(".", import.meta.url).pathname;
  const script = JSON.parse(readFileSync(join(here, "lessons", `${id}.json`), "utf8"));
  const dir = FILM_VOICES;
  // one take per run of beats by the same speaker: a one-voice lesson has one run per shot
  const cast = resolveCast(script);
  requireVoices(cast);
  const runs = runsOf(script, cast);
  let bad = 0;
  for (const r of runs) {
    const who = `shot ${r.shot + 1}${runs.filter((x) => x.shot === r.shot).length > 1 ? `, ${r.role.role} from beat ${r.from + 1}` : ""}`;
    const hash = takeKey(r.role.voice!, r.text);
    const file = join(dir, `${hash}.json`);
    if (!existsSync(file)) { console.log(`${who}: no take yet`); continue; }
    const faults = await judge(r.text, JSON.parse(readFileSync(file, "utf8")), join(dir, `${hash}.heard.json`));
    console.log(`${who}: ${faults.length ? faults.join("; ") : "good"}`);
    bad += faults.length ? 1 : 0;
  }
  process.exitCode = bad ? 1 : 0;
}
