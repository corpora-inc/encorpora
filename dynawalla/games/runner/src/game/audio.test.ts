/**
 * The ship's bed, held to the four things the founder asked it to be.
 *
 * "the sound effect of the ship could be better, maybe more space age .. it's
 * sort of static and annoying like 4-bit motorcycle sound .. it could be more
 * magical electrical .. maybe not so loud."
 *
 * Three of those four are measurable without listening, and the fourth — is it
 * magical — is at least falsifiable in one direction: a single oscillator with
 * no detune cannot beat, and a bed that does not beat is a drone. So this asserts
 * the properties that made it a motorcycle, rather than asserting a waveform.
 *
 * There is no `AudioContext` here on purpose. `setDrive` reads every number it
 * writes out of `ENGINE` via `engineAt`, so the curve this file measures is the
 * curve the ship makes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ENGINE, engineAt } from "./audio.ts";

/** The bed exactly as it shipped in 0.3.6, for the "quieter" claim to mean something. */
const SHIPPED = {
  type: "sawtooth",
  q: 7,
  gain: (s: number) => 0.13 + s * 0.11,
  windGain: (s: number) => 0.006 + s * 0.05,
  noiseGain: 0.09,
};

const SPEEDS = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1];

test("the bed is quieter than the one the founder heard, at every speed", () => {
  for (const s of SPEEDS) {
    const now = engineAt(s, true).gain;
    const was = SHIPPED.gain(s);
    assert.ok(now < was, `at speed ${s} the bed is ${now}, and it shipped at ${was}`);
    // Quieter, but still a bed — silence is not the fix and would take the sense
    // of speed with it.
    assert.ok(now > was * 0.4, `at speed ${s} the bed dropped to ${now}, which is a mute`);
  }
  for (const s of SPEEDS) {
    assert.ok(
      engineAt(s, true).windGain < SHIPPED.windGain(s),
      `the wind band is not quieter at speed ${s}`,
    );
  }
  assert.ok(ENGINE.noiseGain < SHIPPED.noiseGain / 2, "the grit is not at least halved");
});

test("it is not a two-stroke: no sawtooth, and no resonant peak to sweep", () => {
  // The two things that made it read as an engine. A sawtooth's harmonics fall
  // off at 1/n and a triangle's at 1/n², which is the entire difference between
  // "motorcycle" and "warm"; and a Q of 7 is a ~17 dB peak being swept by the
  // player's own speed, heard as a whine that follows them.
  assert.notEqual(ENGINE.type, SHIPPED.type);
  assert.equal(ENGINE.type, "triangle");
  assert.ok(ENGINE.q < 1.5, `the body filter is at Q ${ENGINE.q}; anything resonant whines`);
  assert.ok(ENGINE.q >= 0.5, "a Q below 0.5 is a filter doing nothing");
  assert.ok(ENGINE.q < SHIPPED.q / 4);
});

test("it can beat, which is what makes it electrical rather than a drone", () => {
  assert.ok(ENGINE.detuneCents > 0, "a single detune of zero is one oscillator");
  // Wide enough to hear as movement, narrow enough to stay one note. At 58 Hz,
  // 9 cents is a beat every ~3 seconds; a semitone would be a chord.
  assert.ok(ENGINE.detuneCents >= 4 && ENGINE.detuneCents <= 25, `${ENGINE.detuneCents} cents`);
  assert.ok(ENGINE.shimmerGain > 0, "the high partial is muted, so there is no space-age end");
  // ...and the shimmer must stay under the body, or it is a whistle.
  assert.ok(ENGINE.shimmerGain < ENGINE.gain[0] / 3, "the shimmer is louder than a shimmer");
  assert.ok(ENGINE.shimmerLfoHz < 1, "the shimmer flutters rather than breathes");
});

test("speed still opens the bed, in every axis, monotonically", () => {
  // The fix must not have flattened the thing that sells velocity.
  let prev = engineAt(0, true);
  for (const s of SPEEDS.slice(1)) {
    const now = engineAt(s, true);
    assert.ok(now.gain > prev.gain, `gain did not rise by ${s}`);
    assert.ok(now.cutoff > prev.cutoff, `cutoff did not open by ${s}`);
    assert.ok(now.hz > prev.hz, `pitch did not rise by ${s}`);
    assert.ok(now.windGain > prev.windGain, `wind did not rise by ${s}`);
    prev = now;
  }
  // A real range, not a rounding error: the ship at speed must be audibly a
  // different machine from the ship at rest.
  assert.ok(engineAt(1, true).cutoff > engineAt(0, true).cutoff * 3);
  assert.ok(engineAt(1, true).gain > engineAt(0, true).gain * 1.5);
});

test("dying drops the bed to almost nothing and takes the wind with it", () => {
  const dead = engineAt(1, false);
  assert.equal(dead.windGain, 0);
  assert.ok(dead.gain < engineAt(0, true).gain / 4, "the bed is still running after a crash");
  assert.ok(dead.gain > 0, "the bed cut out entirely, which reads as a bug not a crash");
});

test("the sub stays a sub and the fundamental stays out of the harsh band", () => {
  // 2-4 kHz is where the ear is most sensitive and where the old bed had a
  // resonant peak parked at full speed. The fundamental never goes near it.
  assert.ok(engineAt(1, true).hz < 120, "the fundamental climbed into the midrange");
  for (const s of SPEEDS) {
    const e = engineAt(s, true);
    assert.ok(e.subHz < e.hz, `at speed ${s} the sub is above the fundamental`);
    assert.ok(e.subHz >= 20, "the sub dropped below hearing and is just cone excursion");
  }
});
