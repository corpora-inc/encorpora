import assert from "node:assert/strict";
import test from "node:test";
import { renderBook } from "../src/publishing/book.js";
import { validateBook } from "../src/publishing/validate.js";
import type { MathBook } from "../src/publishing/schema.js";
const sample: MathBook = {
  id: "presentation-fixture",
  version: "1.0.0",
  title: "Count Together",
  subtitle: "Make and explain",
  audience: "Early learners with a partner",
  description: "A typesetting fixture",
  pages: [
    {
      id: "build",
      kind: "lesson",
      eyebrow: "BUILD",
      title: "Make seven",
      blocks: [{ kind: "text", text: "Show seven in your own way." }],
    },
    {
      id: "adult",
      kind: "guide",
      eyebrow: "FOR YOUR PARTNER",
      title: "Listen to the reasoning",
      blocks: [
        {
          kind: "text",
          text: "Invite a different arrangement without adding or removing counters.",
        },
      ],
    },
  ],
};
test("early-number styling is opt-in and preserves adult page identity", () => {
  const ordinary = renderBook(sample);
  assert.doesNotMatch(ordinary, /early-number-page/);
  const early = renderBook({ ...sample, presentation: "early-number" });
  assert.match(early, /class="book-page lesson early-number-page"/);
  assert.match(early, /class="book-page guide early-number-page"/);
  assert.match(early, /:not\(\.guide\):not\(\.solutions\)/);
  assert.match(early, /Show seven in your own way/);
});
test("unknown presentation profiles fail publication validation", () => {
  assert.throws(
    () =>
      validateBook({
        ...sample,
        presentation: "unknown",
      } as unknown as MathBook),
    /Unknown book presentation/,
  );
});
