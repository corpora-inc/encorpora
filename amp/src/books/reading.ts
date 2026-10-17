import type {
  BookBlock,
  FractionBook,
} from "../../books/fraction-field-guide/schema.js";
export type ReadingFrame = {
  pageId: string;
  blockIndex: number;
  step?: number;
  block: BookBlock;
  fragment?: number;
};
/** Context examples start with one question frame; the full question remains
 * available in a dialog from each reasoning step. Equation examples keep their
 * expression beside each step. */
/** Split long prose at sentence boundaries while retaining every word. */
export function readingParagraphs(text: string, maximumLength = 180): string[] {
  const sentences = Array.from(
    new Intl.Segmenter("en", { granularity: "sentence" }).segment(text),
    (part) => part.segment,
  );
  const chunks: string[] = [];
  for (const sentence of sentences) {
    const value = sentence.trim();
    const last = chunks.at(-1);
    if (last && last.length + value.length + 1 <= maximumLength)
      chunks[chunks.length - 1] = `${last} ${value}`;
    else chunks.push(value);
  }
  return chunks;
}
export function readingFrames(book: FractionBook): ReadingFrame[] {
  return book.pages
    .filter((page) => page.kind !== "solutions")
    .flatMap((page) =>
      page.blocks.flatMap((block, blockIndex): ReadingFrame[] =>
        block.kind === "worked"
          ? Array.from(
              {
                length:
                  block.steps.length +
                  (block.promptPresentation === "context" ? 2 : 1),
              },
              (_, step) => ({
                pageId: page.id,
                blockIndex,
                step: step - (block.promptPresentation === "context" ? 1 : 0),
                block,
              }),
            )
          : block.kind === "text" || block.kind === "callout"
            ? readingParagraphs(
                block.text,
                book.presentation === "early-number" ? 140 : 180,
              ).map((text, fragment) => ({
                pageId: page.id,
                blockIndex,
                fragment,
                block: { ...block, text },
              }))
            : [{ pageId: page.id, blockIndex, block }],
      ),
    );
}
