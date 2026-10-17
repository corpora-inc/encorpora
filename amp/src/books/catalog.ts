import { measureBorderCover } from "../../books/measure-border-cover/book.js";
import { measurementAlignments } from "../../books/measure-border-cover/alignments.js";
import { measurementPracticeBindings } from "../../books/measure-border-cover/practice.js";
import { numberBuilders } from "../../books/number-builders/book.js";
import { numberAlignments } from "../../books/number-builders/alignments.js";
import { numberPracticeBindings } from "../../books/number-builders/practice.js";
import { balanceAndChange } from "../../books/balance-and-change/book.js";
import { balanceAlignments } from "../../books/balance-and-change/alignments.js";
import { balancePracticeBindings } from "../../books/balance-and-change/practice.js";
import { equalGroupsWorkshop } from "../../books/equal-groups-workshop/book.js";
import { equalGroupsAlignments } from "../../books/equal-groups-workshop/alignments.js";
import { equalGroupsPracticeBindings } from "../../books/equal-groups-workshop/practice.js";
import { fractionPracticeBindings } from "../content/fraction-practice-coverage.js";
import { fractionFieldGuide } from "../../books/fraction-field-guide/book.js";
import { fractionBookAlignments } from "../../books/fraction-field-guide/alignments.js";
import type { FractionBook } from "../../books/fraction-field-guide/schema.js";
export type BookSummary = Pick<
  FractionBook,
  "id" | "version" | "title" | "subtitle" | "audience" | "description"
> & {
  pages: number;
  skills: string[];
  templates: string[];
  requiredReaderCapabilities: readonly string[];
};
export const books = [
  {
    content: fractionFieldGuide,
    requiredReaderCapabilities: [],
    alignments: fractionBookAlignments,
    bindings: fractionPracticeBindings,
  },
  {
    content: equalGroupsWorkshop,
    requiredReaderCapabilities: [],
    alignments: equalGroupsAlignments,
    bindings: equalGroupsPracticeBindings,
  },
  {
    content: balanceAndChange,
    alignments: balanceAlignments,
    bindings: balancePracticeBindings,
    requiredReaderCapabilities: ["algebra-models-v1"],
  },
  {
    content: numberBuilders,
    alignments: numberAlignments,
    bindings: numberPracticeBindings,
    requiredReaderCapabilities: ["early-number-v1"],
  },
  {
    content: measureBorderCover,
    alignments: measurementAlignments,
    bindings: measurementPracticeBindings,
    requiredReaderCapabilities: ["unit-regions-v1", "algebra-models-v1"],
  },
] as const;
export const bookSummaries: BookSummary[] = books.map(
  ({ content, alignments, bindings, requiredReaderCapabilities }) => ({
    requiredReaderCapabilities,
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
