/**
 * Synthesized voice for the audio tests, at the narration's speaking level
 * (`even`: about -21 dBFS while speaking). Levels are the 10 ms RMS peak of each part,
 * in dBFS. A take is built left to right: `say` a voiced word, `hiss` a burst of
 * noise (a stray, a loose "s", the release of a "t"), `breathe` a breath, `rest`
 * silence with room tone under it.
 */
import { SR } from "../audio";

const amp = (db: number) => 10 ** (db / 20) * 32768;

/** A seeded generator, so every run hears the same noise. */
function noise(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
}

export class Voice {
  private parts: Float64Array[] = [];
  private rand = noise(7);
  /** Seconds written so far. */
  t = 0;
  /** A voiced word: four harmonics of 200 Hz under a smooth swell. */
  say(dur: number, db = -18) {
    const n = Math.round(dur * SR), out = new Float64Array(n), a = amp(db) / 0.679;
    for (let i = 0; i < n; i++) {
      const env = Math.sin((Math.PI * i) / n) ** 0.5, x = (2 * Math.PI * 200 * i) / SR;
      out[i] = a * env * (Math.sin(x) + 0.6 * Math.sin(2 * x) + 0.4 * Math.sin(3 * x) + 0.2 * Math.sin(4 * x)) / 1.3;
    }
    return this.push(out);
  }
  /** Noise above about 3 kHz (white noise differenced twice): hiss, a breath, a consonant's burst. */
  hiss(dur: number, db = -36) {
    const n = Math.round(dur * SR), raw = Array.from({ length: n + 2 }, this.rand), out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = (raw[i + 2]! - 2 * raw[i + 1]! + raw[i]!) / 2.45;
    const a = amp(db) / 0.577;
    for (let i = 0; i < n; i++) out[i]! *= a * Math.sin((Math.PI * i) / n) ** 0.5;
    return this.push(out);
  }
  /** White noise: a breath, with more of its energy low than a hiss has. */
  breathe(dur: number, db = -38) {
    const n = Math.round(dur * SR), out = new Float64Array(n), a = amp(db) / 0.577;
    for (let i = 0; i < n; i++) out[i] = a * this.rand() * Math.sin((Math.PI * i) / n) ** 0.5;
    return this.push(out);
  }
  /** Silence with room tone 30 dB under the floor. */
  rest(dur: number) {
    const n = Math.round(dur * SR), out = new Float64Array(n), a = amp(-80);
    for (let i = 0; i < n; i++) out[i] = a * this.rand();
    return this.push(out);
  }
  private push(p: Float64Array) {
    this.parts.push(p);
    this.t += p.length / SR;
    return this;
  }
  pcm() {
    const n = this.parts.reduce((s, p) => s + p.length, 0), out = new Int16Array(n);
    let at = 0;
    for (const p of this.parts) { for (let i = 0; i < p.length; i++) out[at + i] = Math.max(-32768, Math.min(32767, Math.round(p[i]!))); at += p.length; }
    return out;
  }
}

/** Digital silence around a take, as the narration has between takes. */
export function inSilence(pcm: Int16Array, before = 0.45, after = 0.45) {
  const out = new Int16Array(Math.round(before * SR) + pcm.length + Math.round(after * SR));
  out.set(pcm, Math.round(before * SR));
  return out;
}
