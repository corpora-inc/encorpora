import { test } from "node:test";
import assert from "node:assert/strict";
import { readingFrames, readingParagraphs } from "../src/books/reading.js";
import { books } from "../src/books/catalog.js";
for (const { content: book } of books)
  test(`${book.id}: reading frames retain all authored prose, worked decisions and task identities`, () => {
    const frames = readingFrames(book);
    for (const page of book.pages.filter((p) => p.kind !== "solutions")) {
      page.blocks.forEach((block, index) => {
        const parts = frames.filter(
          (f) => f.pageId === page.id && f.blockIndex === index,
        );
        if (block.kind === "text" || block.kind === "callout")
          assert.equal(
            parts.map((f) => ("text" in f.block ? f.block.text : "")).join(" "),
            block.text,
          );
        else if (block.kind === "worked")
          assert.deepEqual(
            parts.map((f) => f.step),
            Array.from({ length: block.steps.length + 1 }, (_, i) => i),
          );
        else
          assert.deepEqual(
            parts.map((f) => f.block),
            [block],
          );
      });
    }
    assert.equal(frames.filter((f) => f.block.kind === "solution").length, 0);
  });
test("paragraph boundaries preserve decimal numbers and punctuation", () => {
  for (const text of [
    "Walk 1.5 km. Then walk 2.25 km. How far? Explain!",
    "Compare 3/4 and 5/8; choose a common unit.",
    "A full stop ends this thought.",
  ])
    assert.equal(readingParagraphs(text).join(" "), text);
});
