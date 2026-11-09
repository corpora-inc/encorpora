import type { TemplateMetadata } from "./contracts";
import { extendProblem } from "./clause-kit";
import { circleClauseExtensions } from "./circle-clauses";
import { geometricClauseExtensions } from "./geometric-proof-clauses";
import { patternClauseExtensions } from "./pattern-function-clauses";

/** Extensions retain their existing type and skill, hence their selection budget.
 * Their own axis leaves the previous generator and its random stream untouched. */
export const clauseExtensions = {
  ...patternClauseExtensions,
  ...circleClauseExtensions,
  ...geometricClauseExtensions,
};
export function withClauseMetadata(meta: TemplateMetadata): TemplateMetadata {
  const extension = clauseExtensions[meta.id];
  return extension
    ? {
        ...meta,
        version: meta.version + 1,
        reprintsFrom: meta.reprintsFrom ?? meta.version,
        requiredResponseCapabilities: [
          ...new Set([
            ...(meta.requiredResponseCapabilities ?? []),
            ...(meta.requiredResponseCapability
              ? [meta.requiredResponseCapability]
              : []),
            ...(extension.capability ? [extension.capability] : []),
            ...([
              "times-table-pattern",
              "story-graph-match",
              "fl-even-odd-classify",
            ].includes(meta.id)
              ? ["single-choice-v1" as const]
              : []),
            ...(meta.id === "dependent-variable-value"
              ? ["multi-part-choice-v1" as const]
              : []),
            ...(meta.id === "compass-straightedge-reasoning"
              ? [
                  "single-choice-v1" as const,
                  "multi-select-v1" as const,
                  "point-plot-v1" as const,
                ]
              : []),
          ]),
        ],
        description: `${meta.description} Also practices ${extension.variants.join(", ").replaceAll("-", " ")}.`,
      }
    : meta;
}
export function clauseProblem(
  meta: TemplateMetadata,
  seed: string,
  force?: string,
) {
  const extension = clauseExtensions[meta.id];
  return extension ? extendProblem(meta, seed, extension, force) : null;
}
