import {
  statementBlanksFacetMappings,
  statementBlanksLessons,
  statementBlanksMethods,
  statementBlanksPrinciples,
} from "../content/statement-blanks-lessons";
import {
  statementBlanksGenerate,
  statementBlanksTemplates,
} from "../math/statement-blanks-practice";
import type { ContentFamily } from "./registry/types";

/** Match tables and sentences that classify, name or compare
 * (multi-part-choice-v1). */
export const family = {
  id: "statement-blanks",
  practice: {
    templates: statementBlanksTemplates,
    generate: statementBlanksGenerate,
    preserveAlgebra: true,
  },
  lessons: statementBlanksLessons,
  methods: statementBlanksMethods,
  principles: statementBlanksPrinciples,
  facetMappings: statementBlanksFacetMappings,
  archetypeLinks: {
    "fixed-variable-expense-table": ["finance.fixed-variable-expense"],
    "pythagorean-sort-table": ["triangle.pythagorean"],
    "congruence-claims-table": ["transformation.invariants"],
    "equivalent-expressions-table": ["expression.polynomial"],
    "gross-net-sentence": ["money.budget"],
    "coordinate-terms-slots": ["coordinate.first-quadrant"],
    "point-on-axis-sentence": ["coordinate.first-quadrant"],
    "times-as-many-blanks": ["whole.multiplicative-comparison"],
    "compare-fractions-reason-blanks": ["fractions.compare"],
    "inequality-number-blanks": ["rational.order-absolute"],
  },
} satisfies ContentFamily;
