import { fractionFieldGuide } from "../../books/fraction-field-guide/book.js";
import { fractionBookAlignments } from "../../books/fraction-field-guide/alignments.js";
import type { FractionBook } from "../../books/fraction-field-guide/schema.js";
export type BookSummary = Pick<
  FractionBook,
  "id" | "version" | "title" | "subtitle" | "audience" | "description"
> & { pages: number; skills: string[] };
export const books = [
  { content: fractionFieldGuide, alignments: fractionBookAlignments },
] as const;
export const bookSummaries: BookSummary[] = books.map(
  ({ content, alignments }) => ({
    id: content.id,
    version: content.version,
    title: content.title,
    subtitle: content.subtitle,
    audience: content.audience,
    description: content.description,
    pages: content.pages.length,
    skills: [...new Set(alignments.map((entry) => entry.skillId))],
  }),
);
export function bookFor(id: string) {
  return books.find((entry) => entry.content.id === id);
}
