import { historicalEquationTemplates } from "./equation-practice";
import { historicalFloridaGapTemplates } from "./florida-gaps-practice";
import { historicalTrueEquationTemplate } from "./operation-sentence-practice";
import { historicalEqualFactorTemplate } from "./multiselect-number-practice";
import { historicalMcasEquationTemplate } from "./mcas-gap-practice";
import type { TemplateMetadata } from "./contracts";

/** Saved instances retain their original content, skill and difficulty metadata.
 * These families are available for replay and lessons, never new selection. */
export const historicalTemplates: readonly TemplateMetadata[] = [
  ...historicalEquationTemplates,
  ...historicalFloridaGapTemplates,
  historicalTrueEquationTemplate,
  historicalEqualFactorTemplate,
  historicalMcasEquationTemplate,
];

/** A current lesson for a retired family; this does not rewrite its evidence. */
export const templateReplacements: Readonly<Record<string, string>> = {
  "inequality-from-context": "inequality-context-bound",
  "fl-equation-truth-mult-div": "multiplication-division-equation-truth",
  "fl-equation-truth-whole": "whole-number-equation-truth",
  "true-equation-choice": "whole-number-equality-choice",
  "equal-factor-equations-select": "equal-factor-truth-select",
  "mcas-true-fact-equations": "fact-equation-truth-select",
};
