import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ENDPOINT, Endpointer } from "./endpoint.ts";
import { VOCAB_PROMPT } from "./prompt.ts";
import { pickVoice } from "./voices.ts";
import { cleanTranscript } from "./transcript.ts";

const run = (levels: [number, number][]) => {
  const e = new Endpointer();
  let last = "listening";
  for (const [t, rms] of levels) {
    last = e.push(t, rms);
    if (last !== "listening") return { last, t };
  }
  return { last, t: levels.at(-1)![0] };
};
const series = (fromMs: number, toMs: number, rms: number) => Array.from({ length: Math.floor((toMs - fromMs) / 125) }, (_, i) => [fromMs + i * 125, rms] as [number, number]);

test("a question in crane noise ends one pause after the last speech", () => {
  const noise = 0.05;
  const r = run([...series(0, 500, noise), ...series(500, 3500, 0.2), ...series(3500, 9000, noise)]);
  assert.equal(r.last, "done");
  // Readings arrive every 125 ms: the first one at least a pause after the last speech (3375 ms).
  assert.equal(r.t, Math.ceil((3375 + ENDPOINT.pauseMs) / 125) * 125, `ended at ${r.t}`);
});

test("a short pause inside the question does not end it", () => {
  const r = run([...series(0, 500, 0.01), ...series(500, 2000, 0.2), ...series(2000, 2700, 0.01), ...series(2700, 4000, 0.2), ...series(4000, 8000, 0.01)]);
  assert.equal(r.last, "done");
  // Last speech reading is at 3825 ms: the end is one full pause after it, never inside the 700 ms gap.
  assert.equal(r.t, Math.ceil((3825 + ENDPOINT.pauseMs) / 125) * 125, `ended at ${r.t}`);
});

test("speech at 5 dB SNR over the engine is still heard (about 1.8x the floor)", () => {
  const e = new Endpointer();
  for (const [t, rms] of series(0, 500, 0.05)) e.push(t, rms);
  for (const [t] of series(500, 2500, 0)) e.push(t, 0.09);
  assert.equal(e.speechHeard, true);
});

test("a dead first buffer does not set the floor to zero", () => {
  // One silent startup buffer, then cab noise at 0.06 with no speech: never 'speech', so it ends at idle, not at the cap.
  const r = run([[0, 0], ...series(125, 500, 0.06), ...series(500, 21000, 0.06)]);
  assert.equal(r.last, "done");
  assert.equal(r.t, ENDPOINT.idleMs, `ended at ${r.t}`);
});

test("nothing said ends at idle (and is still transcribed); a long question stops at the cap", () => {
  assert.deepEqual(run(series(0, 9000, 0.05)), { last: "done", t: ENDPOINT.idleMs });
  const long = run([...series(0, 500, 0.01), ...series(500, 30000, 0.3)]);
  assert.equal(long.last, "done");
  assert.ok(long.t >= ENDPOINT.maxMs && long.t < ENDPOINT.maxMs + 250);
});

test("steady engine noise is not mistaken for speech", () => {
  // Noise wobbling 40% around its level stays under 1.5x its median.
  const wobble = Array.from({ length: 64 }, (_, i) => [i * 125, 0.05 * (1 + 0.4 * Math.sin(i))] as [number, number]);
  const e = new Endpointer();
  for (const [t, rms] of wobble) e.push(t, rms);
  assert.equal(e.speechHeard, false);
});

test("read-aloud picks the best offline voice for the language", () => {
  const voices = [
    { id: "a", language: "en-US", quality: "default" },
    { id: "b", language: "en-GB", quality: "enhanced" },
    { id: "c", language: "en-US", quality: "very_high", networkRequired: true },
    { id: "d", language: "en-US", quality: "high", name: "Ava (Premium)" },
    { id: "e", language: "es-ES", quality: "enhanced" },
    { id: "f", language: "en-US", quality: "premium", name: "Zoe" },
  ];
  assert.equal(pickVoice(voices, "en-US")!.id, "f", "iOS premium beats enhanced");
  assert.equal(pickVoice(voices.filter((v) => v.id !== "f"), "en-US")!.id, "b", "enhanced beats high");
  assert.equal(pickVoice(voices.filter((v) => v.id !== "b" && v.id !== "f"), "en-US")!.id, "d", "never a network voice");
  assert.equal(pickVoice([{ id: "x", language: "en_US" }, { id: "y", language: "en-US" }], "en-US")!.id, "x");
  assert.equal(pickVoice(voices, "de"), null);
});

test("the app primes whisper with exactly the prompt the model was measured with", () => {
  const measured = readFileSync(fileURLToPath(new URL("../../voice-eval/prompt.txt", import.meta.url)), "utf8").trim();
  assert.equal(VOCAB_PROMPT, measured);
});

test("sound markers and stock noise phrases are not questions", () => {
  assert.equal(cleanTranscript(" [BLANK_AUDIO] "), "");
  assert.equal(cleanTranscript("(engine running) Thank you."), "");
  assert.equal(cleanTranscript("you"), "");
  assert.equal(cleanTranscript("[Music] What does Table A say for 500 kV?"), "What does Table A say for 500 kV?");
  assert.equal(cleanTranscript("Thank you, what's the clearance?"), "Thank you, what's the clearance?");
});
