import { describe, expect, it } from "vitest";
import { audioProblems, cutOut, EDGE, loneSounds, silence, SR } from "./audio";
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
