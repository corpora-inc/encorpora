import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, multiplierFor, NoteQueue, WINDOWS } from "./judge.ts";

const note = (time: number, lane = 0) => ({
  time,
  beat: time * 2,
  lane,
  div: 1,
  kind: "kick" as const,
  accent: false,
});

test("windows are symmetric and ordered", () => {
  assert.equal(classify(0), "perfect");
  assert.equal(classify(WINDOWS.perfect - 0.001), "perfect");
  assert.equal(classify(-(WINDOWS.perfect - 0.001)), "perfect");
  assert.equal(classify(WINDOWS.perfect + 0.001), "great");
  assert.equal(classify(-(WINDOWS.great + 0.001)), "good");
  assert.equal(classify(WINDOWS.good + 0.001), "miss");
  assert.ok(WINDOWS.perfect < WINDOWS.great && WINDOWS.great < WINDOWS.good);
});

test("a hit takes the nearest unjudged note in its lane, not the first", () => {
  const q = new NoteQueue();
  q.add(note(10.0));
  q.add(note(10.09));
  const r = q.hit(0, 10.08);
  assert.ok(r);
  assert.equal(r.note.time, 10.09);
  assert.equal(r.judgment, "perfect");
  // The near-simultaneous note behind it is still available.
  const r2 = q.hit(0, 10.005);
  assert.ok(r2);
  assert.equal(r2.note.time, 10.0);
});

test("lanes are independent unless the caller asks for any lane", () => {
  const q = new NoteQueue();
  q.add(note(5, 2));
  assert.equal(q.hit(0, 5), null, "lane 0 must not steal lane 2's note");
  const any = q.hit(0, 5, true);
  assert.ok(any);
  assert.equal(any.note.lane, 2);
});

test("a note is never judged twice", () => {
  const q = new NoteQueue();
  q.add(note(3));
  assert.ok(q.hit(0, 3.01));
  assert.equal(q.hit(0, 3.02), null);
});

test("reap misses only what has genuinely passed", () => {
  const q = new NoteQueue();
  q.add(note(1));
  q.add(note(2));
  assert.equal(q.reap(1 + WINDOWS.good - 0.001).length, 0, "still inside the window");
  const missed = q.reap(1 + WINDOWS.good + 0.001);
  assert.equal(missed.length, 1);
  assert.equal(missed[0]!.time, 1);
  assert.equal(q.reap(1.2).length, 0, "a note is only reaped once");
});

test("multiplier steps every ten and caps at eight", () => {
  assert.equal(multiplierFor(0), 1);
  assert.equal(multiplierFor(9), 1);
  assert.equal(multiplierFor(10), 2);
  assert.equal(multiplierFor(69), 7);
  assert.equal(multiplierFor(70), 8);
  assert.equal(multiplierFor(100000), 8);
});

test("prune keeps the queue bounded without dropping live notes", () => {
  const q = new NoteQueue();
  for (let i = 0; i < 400; i++) q.add(note(i * 0.1));
  q.prune(30);
  const live = q.all().filter((n) => n.time > 30 - 1.6);
  assert.equal(q.all().length, live.length);
  assert.ok(q.all().length < 400);
});
