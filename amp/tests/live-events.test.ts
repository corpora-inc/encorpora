import test from "node:test";
import assert from "node:assert/strict";
import { classChanges, type ClassEvent } from "../src/schools/live/events.js";

const event = (id: string, extra: Partial<ClassEvent>): ClassEvent => ({
  id,
  classId: "class-1",
  sessionId: null,
  personId: null,
  kind: "answer",
  at: "2026-11-24T10:00:00.000Z",
  ...extra,
});

test("a settings row changes nothing on a teacher's live view, and is seen once", () => {
  const seen = new Set<string>();
  const events = [
    // "Allow Colorful" for the whole class, and for one child.
    event("1", { kind: "settings" }),
    event("2", { kind: "settings", personId: "ivy" }),
  ];
  assert.deepEqual(classChanges(events, seen), []);
  assert.deepEqual([...seen], ["1", "2"]);
  // Beside an answer, only the answer is the view's news.
  assert.deepEqual(
    classChanges(
      [
        ...events,
        event("3", { kind: "settings", classId: "class-2" }),
        event("4", { kind: "answer", personId: "jon", sessionId: "s" }),
      ],
      seen,
    ),
    [
      {
        classId: "class-1",
        personIds: ["jon"],
        session: false,
        signals: false,
      },
    ],
  );
});
