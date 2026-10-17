import type {
  BookBlock,
  FractionBook,
} from "../../books/fraction-field-guide/schema.js";
export type ReadingFrame = {
  pageId: string;
  blockIndex: number;
  step?: number;
  block: BookBlock;
};
/** Worked examples reveal a decision at a time; their prompt stays beside each
 * step. All other authored blocks retain their original order and identity. */
export function readingFrames(book: FractionBook): ReadingFrame[] {
  return book.pages
    .filter((page) => page.kind !== "solutions")
    .flatMap((page) =>
      page.blocks.flatMap((block, blockIndex): ReadingFrame[] =>
        block.kind === "worked"
          ? Array.from({ length: block.steps.length + 1 }, (_, step) => ({
              pageId: page.id,
              blockIndex,
              step,
              block,
            }))
          : [{ pageId: page.id, blockIndex, block }],
      ),
    );
}
