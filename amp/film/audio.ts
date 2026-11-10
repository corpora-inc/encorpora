/**
 * Clean narration edits, guaranteed.
 *
 * The voice comes as one take per shot. To add a pause, or to shorten a long
 * silence, we cut the take. A cut is only allowed where the take is measured
 * silent, every cut gets a short fade, and the finished narration is checked:
 * every edit must sit in silence, and no stretch of digital silence may meet
 * sound abruptly. A narration that fails is never rendered.
 *
 * Run on any WAV to scan it:   npx tsx film/audio.ts narration.wav
 */
import { readFileSync } from "node:fs";

export const SR = 44100;
/** RMS of a 10 ms window below this is silence, where a cut may go: about -49 dBFS. */
export const FLOOR = 0.0035;
/**
 * An edit or an edge of digital silence louder than this is a fault: about -42 dBFS,
 * 21 dB under speech. A cut into a word measures -35 dBFS or louder. The gap
 * between FLOOR and EDGE keeps room tone near the floor from raising false alarms.
 */
export const EDGE = 0.008;
const HOP = SR / 100;
const FADE = Math.round(SR * 0.005);
/** Fade at the very start and end of a take. */
export const TAKE_FADE = Math.round(SR * 0.02);

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

const rms = (pcm: Int16Array, a: number, b: number) => {
  a = Math.max(0, a); b = Math.min(pcm.length, b);
  let s = 0;
  for (let i = a; i < b; i++) s += (pcm[i]! / 32768) ** 2;
  return b > a ? Math.sqrt(s / (b - a)) : 0;
};
const stamp = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;

/**
 * Problems in a finished narration. `edits` are the seconds where we joined
 * audio; each must sit in silence. The scan for hard edges needs no list: it
 * finds every place digital silence meets sound, which is what a bad cut leaves.
 */
export function audioProblems(pcm: Int16Array, edits: { at: number; what: string }[] = []) {
  const out: string[] = [];
  const w = Math.round(SR * 0.02);
  for (const e of edits) {
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
  const found = audioProblems(readWav(path));
  console.log(found.length ? found.join("\n") : "clean");
  if (found.length) process.exitCode = 1;
}
