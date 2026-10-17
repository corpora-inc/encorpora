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
test("paired print comparisons retain both models and their captions", () => {
  const pair: MathBook = {
    ...sample,
    presentation: "early-number",
    pages: [
      {
        id: "compare",
        kind: "lesson",
        eyebrow: "COMPARE",
        title: "Same amount",
        blocks: [1, 2].map((n) => ({
          kind: "diagram" as const,
          diagram: {
            kind: "strips" as const,
            wholeLabel: "One whole",
            id: `model-${n}`,
            alt: `Model ${n}`,
            caption: `Representation ${n}`,
            rows: [{ label: "One whole", parts: n * 2, shaded: n }],
          },
        })),
      },
    ],
  };
  const early = renderBook(pair);
  assert.equal(early.match(/class="early-model-pair"/g)?.length, 1);
  for (const n of [1, 2])
    assert.equal(
      early.match(new RegExp(`Representation ${n}`, "g"))?.length,
      1,
    );
  assert.doesNotMatch(
    renderBook({ ...pair, presentation: undefined }),
    /class="early-model-pair"/,
  );
});
test("early-reader prose breaks retain every sentence in order", async () => {
  const { readingFrames } = await import("../src/books/reading.js");
  const prose =
    "Use safe household counters or draw small marks. The size of a counter does not change the count. This mat can be copied and reused; learners do not need to cut anything.";
  const book: MathBook = {
    ...sample,
    presentation: "early-number",
    pages: [
      {
        id: "instructions",
        kind: "guide",
        eyebrow: "FOR YOUR PARTNER",
        title: "Build together",
        blocks: [
          {
            kind: "callout",
            title: "For a counting partner",
            tone: "connect",
            text: prose,
          },
        ],
      },
    ],
  };
  const frames = readingFrames(book);
  assert.equal(frames.length, 2);
  assert.equal(
    frames
      .map((frame) => (frame.block.kind === "callout" ? frame.block.text : ""))
      .join(" "),
    prose,
  );
  assert.deepEqual(
    frames.map((frame) => [frame.pageId, frame.blockIndex, frame.fragment]),
    [
      ["instructions", 0, 0],
      ["instructions", 0, 1],
    ],
  );
  assert.equal(readingFrames({ ...book, presentation: undefined }).length, 1);
});
