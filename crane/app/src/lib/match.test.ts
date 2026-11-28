import { test } from "node:test";
import assert from "node:assert/strict";
import { teachableMatches, type Teachable } from "./match.ts";
import { tokens } from "../engine/text.ts";

const items: Teachable[] = [
  { key: "topic:signals", kind: "topic", title: "Signals", to: "/learn/topic/signals" },
  { key: "topic:power-lines", kind: "topic", title: "Power lines", to: "/learn/topic/power-lines" },
  { key: "lesson:signal-person", kind: "lesson", title: "When you need a signal person", to: "/learn/lesson/signal-person", topic: "signals" },
  { key: "tool:signals", kind: "tool", title: "Hand signals", to: "/tools/signals", names: ["hand signal chart", "signal"] },
  { key: "signal:stop", kind: "signal", title: "Stop", to: "/tools/signals/stop" },
  { key: "term:tagline", kind: "term", title: "Tagline", to: "/learn/glossary/tagline" },
];
const keys = (q: string) => teachableMatches(items, tokens(q)).map((x) => x.key);

test("a signal query finds the Signals topic, its lesson and the chart, topic first", () => {
  for (const q of ["signaling", "signalling", "hand signals"]) {
    const k = keys(q);
    assert.equal(k[0], "topic:signals", q);
    assert.ok(k.includes("lesson:signal-person"), q);
    assert.ok(k.includes("tool:signals"), q);
    assert.ok(!k.includes("topic:power-lines"), q);
  }
});

test("a name must be at least half covered, and nothing matches nothing", () => {
  assert.deepEqual(keys("stop"), ["signal:stop"]);
  assert.deepEqual(keys("xyzzy"), []);
  assert.deepEqual(teachableMatches(items, []), []);
  assert.ok(keys("power").includes("topic:power-lines"));
});
