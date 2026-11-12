import { describe, expect, it } from "vitest";
import { audioProblems, cutOut, EDGE, envelope, even, loneSounds, loudness, silence, SPEAKING_LUFS, SR } from "./audio";
import { inSilence, Voice } from "./fixtures/voice-signals";

/** The loudest 2.5 ms (RMS) touching any stretch of digital silence: what the edge scan measures. */
function edgeLevel(pcm: Int16Array) {
  const side = Math.round(SR * 0.0025), rms = (a: number, b: number) => {
    let s = 0;
    for (let i = Math.max(0, a); i < Math.min(pcm.length, b); i++) s += (pcm[i]! / 32768) ** 2;
    return Math.sqrt(s / Math.max(1, b - a));
  };
  let worst = 0;
  for (let i = 0; i < pcm.length; ) {
    if (pcm[i] !== 0) { i++; continue; }
    let j = i;
    while (j < pcm.length && pcm[j] === 0) j++;
    if (j - i >= SR * 0.002) worst = Math.max(worst, i > 0 ? rms(i - side, i) : 0, j < pcm.length ? rms(j, j + side) : 0);
    i = j;
  }
  return worst;
}

const dB = (x: number) => 20 * Math.log10(x);
/** Steady tones (`[Hz, amplitude]`), at `level` dBFS RMS. */
function tones(parts: [number, number][], level = -24, dur = 2) {
  const x = new Float64Array(Math.round(dur * SR));
  for (let i = 0; i < x.length; i++) for (const [f, a] of parts) x[i]! += a * Math.sin((2 * Math.PI * f * i) / SR);
  const g = (10 ** (level / 20) * 32768) / Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
  return Int16Array.from(x, (v) => Math.round(v * g));
}
/** Plain RMS over the speaking windows, in dBFS: what takes were once matched by, at -21. */
function plain(pcm: Int16Array) {
  const loud = [...envelope(pcm)].filter((v) => v > 0.02);
  return dB(Math.sqrt(loud.reduce((s, v) => s + v * v, 0) / loud.length));
}
const peak = (pcm: Int16Array) => dB(pcm.reduce((m, v) => Math.max(m, Math.abs(v)), 0) / 32768);
/** Eight words with short gaps and a longer pause after every fourth: the rhythm of a spoken line. */
function line() {
  const v = new Voice().rest(0.2);
  for (let i = 0; i < 8; i++) v.say(0.3 + (i % 3) * 0.08).rest(i % 4 === 3 ? 0.48 : 0.16);
  return v.rest(0.2).pcm();
}

describe("one loudness for every take", () => {
  it("brings a bright voice and a dull one to the same loudness, not the same RMS", () => {
    // the same RMS going in; the bright take has strong sound at 3 kHz, where the ear is keen
    const dull = tones([[200, 1], [400, 0.6]]), bright = tones([[200, 1], [400, 0.6], [3000, 0.8]]);
    expect(Math.abs(plain(dull) - plain(bright))).toBeLessThan(0.05);
    const louder = loudness(bright) - loudness(dull);
    expect(louder).toBeGreaterThan(1.5);
    const d = even(dull), b = even(bright);
    expect(Math.abs(loudness(d) - loudness(b))).toBeLessThan(0.2);
    expect(Math.abs(loudness(d) - SPEAKING_LUFS)).toBeLessThan(0.1);
    // the bright take is turned down by what the weighting hears in it
    expect(plain(d) - plain(b)).toBeGreaterThan(louder - 0.2);
    expect(plain(d) - plain(b)).toBeLessThan(louder + 0.2);
    expect(peak(d)).toBeLessThan(-1);
    expect(peak(b)).toBeLessThan(-1);
  });

  it("gives a take the same level however loud it arrives", () => {
    // the voices arrive 8 dB apart; a fixed speaking gate would count more of the loud one
    const loud = line(), quiet = Int16Array.from(loud, (v) => Math.round(v * 0.4));
    expect(loudness(loud) - loudness(quiet)).toBeCloseTo(7.96, 1);
    const a = even(loud), b = even(quiet);
    expect(Math.abs(loudness(a) - SPEAKING_LUFS)).toBeLessThan(0.05);
    expect(Math.abs(loudness(a) - loudness(b))).toBeLessThan(0.05);
    expect(Math.abs(peak(a) - peak(b))).toBeLessThan(0.05);
  });

  it("keeps a spoken line near the level plain RMS gave it: -21 dBFS while speaking", () => {
    expect(Math.abs(plain(even(line())) - -21)).toBeLessThan(0.5);
  });

  it("measures a take shorter than one 400 ms block whole", () => {
    const word = tones([[200, 1], [400, 0.6]], -24, 0.25);
    expect(loudness(word)).toBeCloseTo(loudness(tones([[200, 1], [400, 0.6]])), 1);
    expect(Math.abs(loudness(even(word)) - SPEAKING_LUFS)).toBeLessThan(0.1);
  });

  it("keeps peaks under -1 dBFS, and leaves a take with nothing to hear alone", () => {
    // quiet speech with one loud click: reaching the loudness would clip it
    const peaky = tones([[200, 1], [400, 0.6]], -30);
    peaky.fill(30000, SR, SR + 4);
    expect(peak(even(peaky))).toBeLessThan(-1);
    expect(peak(even(peaky))).toBeGreaterThan(-1.1);
    expect(loudness(even(peaky))).toBeLessThan(SPEAKING_LUFS - 3);
    const room = new Voice().rest(1).pcm();
    expect(loudness(room)).toBe(-Infinity);
    expect([...even(room)]).toEqual([...room]);
    expect(loudness(new Int16Array(0))).toBe(-Infinity);
    expect(even(new Int16Array(0))).toHaveLength(0);
  });
});

describe("silencing a sound", () => {
  it("leaves no edge at the edge limit or above, where cutting it bare would", () => {
    const make = () => new Voice().rest(0.1).say(0.3).rest(0.2).hiss(0.1, -34).rest(0.3);
    const v = make(), at = 0.6;
    const faded = v.pcm();
    silence(faded, at - 0.005, at + 0.105);
    expect(edgeLevel(inSilence(faded))).toBeLessThan(EDGE);
    expect(audioProblems(inSilence(faded))).toEqual([]);
    // the same stretch zeroed without fades, starting mid-hiss, is a click the scan catches
    const bare = make().pcm();
    bare.fill(0, Math.round((at + 0.05) * SR), Math.round((at + 0.105) * SR));
    expect(edgeLevel(bare)).toBeGreaterThan(EDGE);
    expect(audioProblems(bare).some((p) => /stops dead/.test(p))).toBe(true);
  });
});

describe("cutting silence out", () => {
  it("moves later times back by what was cut and records the joins", () => {
    const pcm = new Voice().rest(0.1).say(0.2).rest(0.3).say(0.2).rest(0.1).pcm();
    const { pcm: out, map, joins } = cutOut(pcm, [[0.35, 0.55]]);
    expect(out.length).toBe(pcm.length - Math.round(0.2 * SR));
    expect(map(0.2)).toBeCloseTo(0.2, 6);
    expect(map(0.7)).toBeCloseTo(0.5, 6);
    expect(map(0.45)).toBeCloseTo(0.35, 6);
    expect(joins).toEqual([0.35]);
    expect(audioProblems(out, joins.map((at) => ({ at, what: "join" })))).toEqual([]);
  });
});

describe("the standalone scan", () => {
  it("lists a lone low hiss next to digital silence, with its time", () => {
    const v = new Voice().rest(0.1).say(0.4).rest(0.2);
    const at = v.t;
    v.hiss(0.09, -36).rest(0.05);
    const lone = loneSounds(inSilence(v.pcm(), 0.5));
    expect(lone).toHaveLength(1);
    expect(lone[0]!.start).toBeCloseTo(0.5 + at, 1);
  });

  it("lists a lone hiss in a long pause inside a take", () => {
    const v = new Voice().rest(0.1).say(0.4).rest(0.17);
    const at = v.t;
    v.hiss(0.09, -38).rest(0.3).say(0.3).rest(0.1);
    expect(loneSounds(v.pcm()).map((s) => +s.start.toFixed(1))).toEqual([+at.toFixed(1)]);
  });

  it("lists nothing for clean speech, or for a short loud word on its own", () => {
    const clean = new Voice().rest(0.2).say(0.3).rest(0.05).say(0.3).rest(0.4).say(0.5).rest(0.3).pcm();
    expect(loneSounds(inSilence(clean))).toEqual([]);
    const short = new Voice().rest(0.3).say(0.15, -15).rest(0.6).pcm();
    expect(loneSounds(inSilence(short))).toEqual([]);
  });

  it("does not list a loud or long hiss: the s of a word after its closure", () => {
    const v = new Voice().rest(0.1).say(0.3).rest(0.09).hiss(0.18, -27).rest(0.3);
    expect(loneSounds(inSilence(v.pcm()))).toEqual([]);
  });
});
