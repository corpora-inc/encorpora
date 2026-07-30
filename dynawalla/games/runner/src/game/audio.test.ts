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

import { Audio, ENGINE, engineAt } from "./audio.ts";

/* -------------------------------------------------------------------------- */
/* A fake AudioContext, so the GRAPH is under test and not just the record.    */
/* -------------------------------------------------------------------------- */

/**
 * Enough of Web Audio to build VOLTA's graph and read it back.
 *
 * Without this, every assertion below is a claim about a frozen object literal:
 * `ENGINE.detuneCents > 0` passes perfectly well on a `buildEngine` that never
 * applies the detune, and nothing at all covered the shimmer LFO — an oscillator
 * connected to an AudioParam *adds* to that param's value, and a `GainNode`
 * arrives with `gain` already at 1, so getting either wrong is silent and loud.
 */
type FakeParam = { value: number; readonly inputs: FakeNode[] } & Record<string, unknown>;
type FakeNode = {
  kind: string;
  type?: string;
  outputs: (FakeNode | FakeParam)[];
  started: boolean;
  stopped: boolean;
  [k: string]: unknown;
};

function makeFakeContext(): { ctx: unknown; nodes: FakeNode[] } {
  const nodes: FakeNode[] = [];
  const param = (v: number): FakeParam => {
    const p: FakeParam = {
      value: v,
      inputs: [],
      setValueAtTime() {
        return p;
      },
      linearRampToValueAtTime() {
        return p;
      },
      exponentialRampToValueAtTime() {
        return p;
      },
      setTargetAtTime(target: number) {
        p.value = target;
        return p;
      },
      cancelScheduledValues() {
        return p;
      },
      setValueCurveAtTime() {
        return p;
      },
    };
    return p;
  };
  const node = (kind: string, extra: Record<string, unknown> = {}): FakeNode => {
    const n: FakeNode = {
      kind,
      outputs: [],
      started: false,
      stopped: false,
      connect(dest: FakeNode | FakeParam) {
        n.outputs.push(dest);
        if (dest && Array.isArray((dest as FakeParam).inputs)) (dest as FakeParam).inputs.push(n);
        return dest;
      },
      disconnect() {},
      start() {
        n.started = true;
      },
      stop() {
        n.stopped = true;
      },
      ...extra,
    };
    nodes.push(n);
    return n;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    state: "running",
    destination: node("destination"),
    createGain: () => node("gain", { gain: param(1) }),
    createOscillator: () =>
      node("osc", { type: "sine", frequency: param(440), detune: param(0) }),
    createBiquadFilter: () =>
      node("biquad", { type: "lowpass", frequency: param(350), Q: param(1), gain: param(0) }),
    createDelay: () => node("delay", { delayTime: param(0) }),
    createWaveShaper: () => node("shaper", { curve: null, oversample: "none" }),
    createDynamicsCompressor: () =>
      node("comp", {
        threshold: param(-24),
        knee: param(30),
        ratio: param(12),
        attack: param(0.003),
        release: param(0.25),
      }),
    createBufferSource: () => node("bufsrc", { buffer: null, loop: false }),
    createBuffer: (_c: number, len: number) => ({
      length: len,
      getChannelData: () => new Float32Array(len),
    }),
    resume: () => Promise.resolve(),
    suspend: () => Promise.resolve(),
    close: () => Promise.resolve(),
  };
  return { ctx, nodes };
}

/** Build the real graph against the fake, and hand back every node in it. */
function buildGraph(): { audio: Audio; nodes: FakeNode[] } {
  const { ctx, nodes } = makeFakeContext();
  const g = globalThis as unknown as { window?: unknown };
  const hadWindow = "window" in g;
  const prev = g.window;
  g.window = { AudioContext: function (this: unknown) { return ctx; } };
  try {
    const audio = new Audio();
    audio.start();
    return { audio, nodes };
  } finally {
    if (hadWindow) g.window = prev;
    else delete g.window;
  }
}

const oscs = (nodes: FakeNode[]): FakeNode[] => nodes.filter((n) => n.kind === "osc");

test("the graph the ship actually builds carries the detuned pair", () => {
  // The claim `ENGINE.detuneCents > 0` cannot make on its own: that buildEngine
  // applies it, to two oscillators, in opposite directions, on the same note.
  const { nodes } = buildGraph();
  const body = oscs(nodes).filter(
    (o) => o.type === ENGINE.type && (o.detune as FakeParam).value !== 0,
  );
  assert.equal(body.length, 2, `expected two detuned ${ENGINE.type} oscillators`);
  const cents = body.map((o) => (o.detune as FakeParam).value).sort((a, b) => a - b);
  assert.deepEqual(cents, [-ENGINE.detuneCents / 2, ENGINE.detuneCents / 2]);
  assert.equal((body[0].frequency as FakeParam).value, (body[1].frequency as FakeParam).value);
  assert.equal((body[0].frequency as FakeParam).value, ENGINE.hz[0]);
  for (const o of body) assert.ok(o.started, "a body oscillator was never started");
  // No sawtooth anywhere in the bed. This is the assertion that would have
  // caught a revert of the waveform in the graph rather than in the record.
  assert.ok(
    !oscs(nodes).some((o) => o.type === "sawtooth"),
    "a sawtooth is back in the graph",
  );
});

test("the body filter in the graph is the un-resonant one", () => {
  const { nodes } = buildGraph();
  const lowpass = nodes.filter(
    (n) => n.kind === "biquad" && n.type === "lowpass" && (n.Q as FakeParam).value === ENGINE.q,
  );
  assert.equal(lowpass.length, 1, `no lowpass at Q ${ENGINE.q} in the graph`);
  assert.equal((lowpass[0].frequency as FakeParam).value, ENGINE.cutoffHz[0]);
  assert.ok(
    !nodes.some((n) => n.kind === "biquad" && (n.Q as FakeParam).value >= 4),
    "a filter with a sweepable resonant peak is back in the bed",
  );
});

test("the shimmer LFO offsets its gain rather than replacing it", () => {
  // An oscillator connected to an AudioParam ADDS to the param's intrinsic
  // value. So the depth must be half the swing and the intrinsic value the other
  // half, or the shimmer either clips negative (inverting the partial every
  // cycle) or sits at a DC offset of 1 — which is the whole partial at full
  // volume, permanently.
  const { nodes } = buildGraph();
  const lfo = oscs(nodes).find(
    (o) => (o.frequency as FakeParam).value === ENGINE.shimmerLfoHz,
  );
  assert.ok(lfo, "there is no shimmer LFO in the graph");
  const depth = lfo.outputs[0] as FakeNode;
  assert.equal(depth.kind, "gain", "the LFO is wired straight at something, with no depth");
  assert.equal((depth.gain as FakeParam).value, ENGINE.shimmerGain / 2);
  const target = depth.outputs[0] as FakeParam;
  assert.ok(target && Array.isArray(target.inputs), "the LFO depth is not connected to a param");
  assert.equal(target.value, ENGINE.shimmerGain / 2, "the shimmer's intrinsic gain is not the offset");
  // Therefore the partial swings 0..shimmerGain and never goes negative.
  assert.ok(target.value - (depth.gain as FakeParam).value >= 0, "the shimmer inverts");
  assert.ok(
    target.value + (depth.gain as FakeParam).value <= ENGINE.shimmerGain + 1e-9,
    "the shimmer overshoots its own budget",
  );
});

test("nothing in the bed sums past the headroom the master expects", () => {
  // Every static gain that meets `engGain`, at once. The old bed reached ~0.216
  // at full speed; this must be materially under that and must not be able to
  // clip the stage it feeds.
  const worst =
    (ENGINE.bodyGain + ENGINE.noiseGain + ENGINE.subGain + ENGINE.shimmerGain) *
    ENGINE.gain[1];
  assert.ok(worst < 0.216, `the bed peaks at ${worst.toFixed(3)}, which is not quieter`);
  assert.ok(worst < 1, "the bed alone can clip");
});

test("every oscillator the bed starts is also stopped on dispose", () => {
  const { audio, nodes } = buildGraph();
  const started = oscs(nodes).filter((o) => o.started);
  assert.ok(started.length >= 4, `only ${started.length} oscillators started`);
  audio.dispose();
  for (const o of started) {
    assert.ok(o.stopped, "an oscillator survives dispose and keeps running after unmount");
  }
});

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
