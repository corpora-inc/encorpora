import { fractionPracticeBindings } from "../content/fraction-practice-coverage.js";
import { fractionFieldGuide } from "../../books/fraction-field-guide/book.js";
import { fractionBookAlignments } from "../../books/fraction-field-guide/alignments.js";
import type { FractionBook } from "../../books/fraction-field-guide/schema.js";
export type BookSummary = Pick<
  FractionBook,
  "id" | "version" | "title" | "subtitle" | "audience" | "description"
> & { pages: number; skills: string[]; templates: string[] };
export const books = [
  {
    content: fractionFieldGuide,
    alignments: fractionBookAlignments,
    bindings: fractionPracticeBindings,
  },
] as const;
export const bookSummaries: BookSummary[] = books.map(
  ({ content, alignments, bindings }) => ({
    id: content.id,
    version: content.version,
    title: content.title,
    subtitle: content.subtitle,
    audience: content.audience,
    description: content.description,
    pages: content.pages.length,
    skills: [
      ...new Set([
        ...alignments.map((entry) => entry.skillId),
        ...bindings.map((entry) => entry.skillId),
      ]),
    ],
    templates: bindings.map((entry) => entry.templateId),
  }),
);
export function bookFor(id: string) {
  return books.find((entry) => entry.content.id === id);
}
