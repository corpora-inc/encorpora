/**
 * Clean narration edits, guaranteed.
 *
 * The voice comes as one take per shot. To add a pause, or to shorten a long
 * silence, we cut the take. A cut is only allowed where the take is measured
 * silent, every cut gets a short fade, and the finished narration is checked:
 * every edit must sit in silence, and no stretch of digital silence may meet
 * sound abruptly. A narration that fails is never rendered.
 *
 * Sounds that belong to no word (a hiss, click or breath left in a pause) are
 * found here as "islands" of sound; strays.ts decides, from the words, which
 * of them are strays.
 *
 * Run on any WAV to scan it:   npx tsx film/audio.ts narration.wav
 * It has no word timings, so it lists lone sounds in pauses as suspicious.
 */
import { readFileSync } from "node:fs";

export const SR = 44100;
/** RMS of a 10 ms window below this is silence, where a cut may go: about -49 dBFS. */
export const FLOOR = 0.0035;
/**
 * An edit or an edge of digital silence louder than this is a fault: about -42 dBFS,
 * about 21 dB under speech. A cut into a word measures -35 dBFS or louder. The gap
 * between FLOOR and EDGE keeps room tone near the floor from raising false alarms.
 */
export const EDGE = 0.008;
const HOP = SR / 100;
const FADE = Math.round(SR * 0.005);
/** Fade at the very start and end of a take. */
export const TAKE_FADE = Math.round(SR * 0.02);

/**
 * A sound in a pause is heard when it stays at or above EDGE (-42 dBFS, the level
 * the edge check already treats as audible against digital silence) for
 * AUDIBLE_FOR, or reaches SPEECH even briefly (a click). Measured at the narration's
 * speaking level (about -21 dBFS, see `even`), the stray sounds heard in finished films
 * stayed at or above -42 dBFS for 40 to 90 ms and peaked at -36 to -39 dBFS
 * (sample peaks 1,400 to 1,900); room tone and the decay of a word stay under it.
 */
export const AUDIBLE_FOR = 0.03;
/** A 10 ms window this loud (-30 dBFS, about 9 dB under the speaking level) is as loud as speech. */
export const SPEECH = 0.0316;
/**
 * A 10 ms window with at least this share of its energy under about 1 kHz is
 * voice (a vowel, a nasal, even a breathy vowel); hiss, a breath, a click or the
 * burst of a consonant has little there. Measured on the cached takes: vowels and
 * the unstressed last syllables left as islands ("seven", "number", "circle")
 * 30 to 90 %, a breathy "easy" 25 %; breaths 3 to 7 %; every hiss, loose "s" and
 * released "t" under 5 %.
 */
export const VOICE_LOW = 0.1;

/** RMS of each 10 ms window. */
export function envelope(pcm: Int16Array) {
  const n = Math.floor(pcm.length / HOP), env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * HOP; j < (i + 1) * HOP; j++) s += (pcm[j]! / 32768) ** 2;
    env[i] = Math.sqrt(s / HOP);
  }
  return env;
}

/**
 * The signal as the ear weighs it, as a fraction of full scale: the K-weighting of
 * ITU-R BS.1770, a high shelf (about +4 dB above 1.7 kHz) and then a 38 Hz
 * high-pass. The standard prints coefficients for 48 kHz; these are the same two
 * filters derived for SR.
 */
export function kWeighted(pcm: Int16Array) {
  const biquad = (f0: number, q: number, shelfDb?: number) => {
    const k = Math.tan((Math.PI * f0) / SR), a0 = 1 + k / q + k * k;
    const a = [(2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0];
    if (shelfDb === undefined) return { b: [1, -2, 1], a };
    const vh = 10 ** (shelfDb / 20), vb = vh ** 0.4996667741545416;
    return { b: [(vh + (vb * k) / q + k * k) / a0, (2 * (k * k - vh)) / a0, (vh - (vb * k) / q + k * k) / a0], a };
  };
  const out = Float64Array.from(pcm, (v) => v / 32768);
  for (const { b, a } of [biquad(1681.974450955533, 0.7071752369554196, 3.999843853973347), biquad(38.13547087602444, 0.5003270373238773)]) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < out.length; i++) {
      const x = out[i]!, y = b[0]! * x + b[1]! * x1 + b[2]! * x2 - a[0]! * y1 - a[1]! * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      out[i] = y;
    }
  }
  return out;
}

/**
 * How loud a take sounds: its integrated loudness in LUFS, measured the way
 * ITU-R BS.1770 does. The K-weighted mean square of every 400 ms block (a new
 * block each 100 ms) is taken; blocks under -70 LUFS are silence and are dropped;
 * then blocks more than 10 LU under the mean of the rest are dropped as pauses,
 * and the loudness is the mean of what is left. Both gates follow the take's own
 * level, so a take measures the same however loud it arrives. A take shorter
 * than one block is measured whole. -Infinity when there is nothing to hear.
 */
export function loudness(pcm: Int16Array) {
  const k = kWeighted(pcm), step = SR / 10, lufs = (ms: number) => -0.691 + 10 * Math.log10(ms);
  const tenths = new Float64Array(Math.floor(k.length / step));
  for (let i = 0; i < tenths.length; i++) for (let j = i * step; j < (i + 1) * step; j++) tenths[i]! += k[j]! * k[j]!;
  let blocks: number[] = [];
  for (let i = 0; i + 4 <= tenths.length; i++) blocks.push((tenths[i]! + tenths[i + 1]! + tenths[i + 2]! + tenths[i + 3]!) / (4 * step));
  if (!blocks.length && k.length) blocks = [k.reduce((s, v) => s + v * v, 0) / k.length];
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  blocks = blocks.filter((ms) => lufs(ms) > -70);
  if (!blocks.length) return -Infinity;
  const floor = lufs(mean(blocks)) - 10;
  return lufs(mean(blocks.filter((ms) => lufs(ms) > floor)));
}

/**
 * The loudness every take is brought to, in LUFS. Takes were once matched by
 * the plain RMS of their speaking windows, at -21 dBFS, and the edge and stray
 * limits above were tuned at the teachers' level, so this keeps the teachers as
 * near to it as one value can. Matched that way their takes measured -24.0
 * (Paul) and -23.3 LUFS (Madeline) on average: -23.6 sits between, and moves
 * them up 0.4 and down 0.3 dB. The learner's takes measured -22.4, the loud
 * voice: they come down 1.25 dB.
 */
export const SPEAKING_LUFS = -23.6;

/**
 * One loudness for every take: SPEAKING_LUFS, about -21 dBFS RMS while speaking,
 * with peaks under -1 dBFS (a take whose peaks would pass that is left quieter:
 * 5 of 542 measured takes, by 0.1 to 0.4 dB). Voices are matched by how loud
 * they sound, not by plain RMS: at equal RMS a brighter voice is the louder one,
 * and so is the voice that pauses less.
 */
export function even(src: Int16Array) {
  const level = loudness(src);
  if (level === -Infinity) return Int16Array.from(src);
  let peak = 1;
  for (const v of src) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(10 ** ((SPEAKING_LUFS - level) / 20), (10 ** (-1 / 20) * 32767) / peak);
  return Int16Array.from(src, (v) => Math.round(v * gain));
}

/** Silent stretches of at least `min` seconds between `from` and `to`, in seconds. */
export function quietRuns(env: Float32Array, from: number, to: number, min: number): [number, number][] {
  const out: [number, number][] = [];
  const lo = Math.max(0, Math.floor(from * 100)), hi = Math.min(env.length, Math.ceil(to * 100));
  for (let i = lo; i < hi; ) {
    if (env[i]! >= FLOOR) { i++; continue; }
    let j = i;
    while (j < hi && env[j]! < FLOOR) j++;
    if ((j - i) / 100 >= min) out.push([i / 100, j / 100]);
    i = j;
  }
  return out;
}

/** Fade the samples just before `at` out and the samples from `at` in, in place. */
export function fadeAround(pcm: Int16Array, at: number, before = true, after = true, len = FADE) {
  for (let k = 0; k < len; k++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * k) / len); // 0 -> 1
    if (before && at - 1 - k >= 0 && at - 1 - k < pcm.length) pcm[at - 1 - k] = Math.round(pcm[at - 1 - k]! * g);
    if (after && at + k < pcm.length) pcm[at + k] = Math.round(pcm[at + k]! * g);
  }
}

/**
 * `pcm` without the stretches `cuts` (in seconds; each must be measured silence),
 * every join faded. `map` carries a time in `pcm` to the new audio; `joins` are
 * the new audio's edits, in seconds.
 */
export function cutOut(pcm: Int16Array, cuts: [number, number][]) {
  const sorted = [...cuts].sort((x, y) => x[0] - y[0]);
  const map = (t: number) => {
    let d = 0;
    for (const [a, b] of sorted) { if (t >= b) d += b - a; else if (t > a) d += t - a; }
    return t - d;
  };
  const parts: Int16Array[] = [];
  let prev = 0;
  for (const [a, b] of sorted) { parts.push(pcm.subarray(Math.round(prev * SR), Math.round(a * SR))); prev = b; }
  parts.push(pcm.subarray(Math.round(prev * SR)));
  const out = new Int16Array(parts.reduce((s, p) => s + p.length, 0));
  const joins: number[] = [];
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    if (at) { joins.push(at / SR); fadeAround(out, at); }
    at += p.length;
  }
  return { pcm: out, joins, map };
}

/**
 * Make `from`..`to` seconds digital silence, in place, fading out over the 5 ms
 * before it and in over the 5 ms after it, so no edge is made. Call it only where
 * the 5 ms on each side are silent, and the fades are inaudible.
 */
export function silence(pcm: Int16Array, from: number, to: number) {
  const a = Math.max(0, Math.round(from * SR)), b = Math.min(pcm.length, Math.round(to * SR));
  if (b <= a) return;
  pcm.fill(0, a, b);
  fadeAround(pcm, a, true, false);
  fadeAround(pcm, b, false, true);
}

/**
 * A stretch of sound, in seconds: its loudest 10 ms, how long it is heard, how
 * long it is heard as voice (VOICE_LOW), and its share of energy under 1 kHz.
 */
export type Sound = { start: number; end: number; peak: number; heard: number; voiced: number; low: number };
/** Heard in a pause: AUDIBLE_FOR at or above EDGE, or as loud as speech even briefly. */
export const isHeard = (s: Sound) => s.heard >= AUDIBLE_FOR - 1e-9 || s.peak >= SPEECH;
/**
 * Noise rather than voice: hiss, a breath, a click, the burst of a consonant.
 * Any word has a vowel or a voiced consonant heard for AUDIBLE_FOR, or (a blip
 * shorter than that) carries a tenth of its energy low; noise has neither.
 */
export const isNoise = (s: Sound) => s.voiced < AUDIBLE_FOR - 1e-9 && s.low < VOICE_LOW;

/** The share of a 10 ms window's energy under about 1 kHz (two one-pole low-passes). */
function lowShare(pcm: Int16Array, w: number) {
  const a = 1 - Math.exp((-2 * Math.PI * 1000) / SR);
  let y1 = 0, y2 = 0, low = 0, all = 0;
  for (let k = w * HOP; k < Math.min(pcm.length, (w + 1) * HOP); k++) {
    const x = pcm[k]!;
    y1 += a * (x - y1); y2 += a * (y1 - y2);
    low += y2 * y2; all += x * x;
  }
  return all ? low / all : 0;
}
/** The share of energy under about 1 kHz from `from` to `to` seconds, each 10 ms weighted by its energy. */
export function lowEnergy(pcm: Int16Array, from: number, to: number) {
  let weight = 0, low = 0;
  for (let w = Math.max(0, Math.round(from * 100)); w < Math.min(Math.floor(pcm.length / HOP), Math.round(to * 100)); w++) {
    let e = 0;
    for (let k = w * HOP; k < (w + 1) * HOP; k++) e += pcm[k]! * pcm[k]!;
    weight += e; low += e * lowShare(pcm, w);
  }
  return weight ? low / weight : 0;
}

/** Every stretch of sound at or above FLOOR, split by each silent 10 ms window. */
export function sounds(pcm: Int16Array, env = envelope(pcm)): Sound[] {
  const out: Sound[] = [];
  for (let i = 0; i < env.length; ) {
    if (env[i]! < FLOOR) { i++; continue; }
    let j = i, peak = 0, heard = 0, voiced = 0;
    while (j < env.length && env[j]! >= FLOOR) {
      peak = Math.max(peak, env[j]!);
      if (env[j]! >= EDGE) { heard++; if (lowShare(pcm, j) >= VOICE_LOW) voiced++; }
      j++;
    }
    out.push({ start: i / 100, end: j / 100, peak, heard: heard / 100, voiced: voiced / 100, low: lowEnergy(pcm, i / 100, j / 100) });
    i = j;
  }
  return out;
}

const rms = (pcm: Int16Array, a: number, b: number) => {
  a = Math.max(0, a); b = Math.min(pcm.length, b);
  let s = 0;
  for (let i = a; i < b; i++) s += (pcm[i]! / 32768) ** 2;
  return b > a ? Math.sqrt(s / (b - a)) : 0;
};
export const stamp = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;
export const dB = (x: number) => `${Math.round(20 * Math.log10(Math.max(x, 1e-9)))} dBFS`;

/**
 * Problems in a finished narration. `edits` are the seconds where we joined
 * audio; each must sit in silence: 20 ms on each side, or `within` when the
 * edit was made in a shorter silence on purpose (a loose "s" joined back to its
 * word, strays.ts). The scan for hard edges needs no list: it finds every place
 * digital silence meets sound, which is what a bad cut leaves.
 */
export function audioProblems(pcm: Int16Array, edits: { at: number; what: string; within?: number }[] = []) {
  const out: string[] = [];
  for (const e of edits) {
    const w = Math.round(SR * (e.within ?? 0.02));
    const i = Math.round(e.at * SR), level = rms(pcm, i - w, i + w);
    if (level >= EDGE) out.push(`${stamp(e.at)} ${e.what} is not in silence (level ${level.toFixed(4)})`);
  }
  // A click is a step: sound at full level right at the edge of digital silence.
  // 2.5 ms is inside any fade we apply, so a faded edge passes and a bare cut does not.
  const min = Math.round(SR * 0.002), side = Math.round(SR * 0.0025);
  for (let i = 0; i < pcm.length; ) {
    if (pcm[i] !== 0) { i++; continue; }
    let j = i;
    while (j < pcm.length && pcm[j] === 0) j++;
    if (j - i >= min) {
      const a = i > 0 ? rms(pcm, i - side, i) : 0, b = j < pcm.length ? rms(pcm, j, j + side) : 0;
      if (a >= EDGE) out.push(`${stamp(i / SR)} sound stops dead (level ${a.toFixed(4)})`);
      if (b >= EDGE) out.push(`${stamp(j / SR)} sound starts dead (level ${b.toFixed(4)})`);
    }
    i = j;
  }
  for (let i = 0, run = 0; i < pcm.length; i++) {
    run = pcm[i] === 32767 || pcm[i] === -32768 ? run + 1 : 0;
    if (run === 3) out.push(`${stamp(i / SR)} clips`);
  }
  return out;
}

/**
 * Lone sounds in pauses, found without word timings: a short burst of noise
 * (heard for less than LONE_HEARD, never as loud as speech) with silence on both
 * sides and no speech within LONE_REACH on one side, or digital silence right
 * next to it. A stray breath, click or hiss looks like this, and so does the
 * detached "s" of a word or the released "t" before a pause: listen there.
 * A spoken word is voiced or as loud as speech, so it is never listed.
 */
export const LONE_HEARD = 0.1;
const LONE_REACH = 0.25;
export function loneSounds(pcm: Int16Array): Sound[] {
  const env = envelope(pcm), all = sounds(pcm, env);
  const speech = all.filter((s) => !isNoise(s) || s.peak >= SPEECH || s.heard >= LONE_HEARD);
  const digital = (t: number) => {
    const i = Math.round(t * SR), side = Math.round(SR * 0.05);
    for (let k = Math.max(0, i - side); k < Math.min(pcm.length, i + side) - 440; k++) {
      let z = true;
      for (let m = k; m < k + 441 && z; m++) z = pcm[m] === 0;
      if (z) return true;
    }
    return false;
  };
  return all.filter((s) => {
    if (!isHeard(s) || !isNoise(s) || s.peak >= SPEECH || s.heard >= LONE_HEARD) return false;
    const before = speech.filter((x) => x.end <= s.start).at(-1), after = speech.find((x) => x.start >= s.end);
    const gapBefore = before ? s.start - before.end : Infinity, gapAfter = after ? after.start - s.end : Infinity;
    return Math.min(gapBefore, gapAfter) >= 0.03 && (Math.max(gapBefore, gapAfter) >= LONE_REACH || digital(s.start) || digital(s.end));
  });
}

export function readWav(path: string) {
  const b = readFileSync(path);
  let p = 12;
  while (p < b.length - 8) {
    const id = b.toString("ascii", p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === "fmt ") {
      if (b.readUInt16LE(p + 8) !== 1 || b.readUInt16LE(p + 10) !== 1 || b.readUInt32LE(p + 12) !== SR || b.readUInt16LE(p + 22) !== 16)
        throw new Error(`${path}: expected 16-bit mono PCM at ${SR} Hz`);
    }
    if (id === "data") return new Int16Array(b.buffer.slice(b.byteOffset + p + 8, b.byteOffset + p + 8 + size));
    p += 8 + size + (size & 1);
  }
  throw new Error(`${path}: no audio data`);
}

if (process.argv[1]?.endsWith("audio.ts")) {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: npx tsx film/audio.ts <narration.wav>");
  const pcm = readWav(path);
  const found = audioProblems(pcm);
  const lone = loneSounds(pcm).map((s) =>
    `${stamp(s.start)} suspicious: a lone sound in a pause, ${Math.round((s.end - s.start) * 1000)} ms, peak ${dB(s.peak)}, heard ${Math.round(s.heard * 1000)} ms`);
  console.log(found.length || lone.length ? [...found, ...lone].join("\n") : "clean");
  if (found.length || lone.length) process.exitCode = 1;
}
