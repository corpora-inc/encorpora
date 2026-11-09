import type {
  GeneratedProblem,
  ResponseCapability,
  TemplateMetadata,
} from "./contracts";
import {
  generatePlaceClause,
  placeClauseFamilies,
} from "./clause-place-value-practice";
import {
  generateTransformationClause,
  transformationClauseFamilies,
} from "./clause-transformation-practice";
import { chooseAxes, defineAxis, versionGatedAxes } from "./variation/axes";
import { random } from "./clause-support";

export const clauseFamilies = {
  ...placeClauseFamilies,
  ...transformationClauseFamilies,
};
const capabilities: Record<string, ResponseCapability[]> = {
  "tens-ones-model": ["multi-part-choice-v1"],
  "two-digit-symbol": ["multi-part-choice-v1"],
  "ten-more-or-less": ["multi-part-choice-v1"],
  "subtract-whole-tens": ["multi-part-choice-v1"],
  "place-value-digit": ["multi-part-choice-v1"],
  "expanded-form-missing": ["multi-part-choice-v1"],
  "three-digit-symbol": ["multi-part-choice-v1"],
  "measurement-line-fraction-story": ["figure-choice-v1"],
  "compare-decimals-symbol-blanks": [
    "multi-part-choice-v1",
    "single-choice-v1",
  ],
  "multiply-power-of-ten": ["multi-part-choice-v1"],
  "compare-decimals-thousandths": ["multi-part-choice-v1"],
  "decimal-area-model": ["multi-part-choice-v1"],
  "multidigit-decimal-product": ["structured-work-v1"],
  "multidigit-decimal-quotient": ["structured-work-v1"],
  "multidigit-decimal-sum": ["structured-work-v1"],
  "teen-frame-compose": ["single-choice-v1", "multi-part-choice-v1"],
  "similarity-by-transformation": ["single-choice-v1", "multi-select-v1"],
  "transformation-rule-slots": ["multi-part-choice-v1", "structured-work-v1"],
  "dilation-measure": ["structured-work-v1"],
};

/** Catalog revision only. Original generator metadata stays untouched so
 * stored versions reproduce their old bytes and random streams. */
export function clauseMetadata(meta: TemplateMetadata): TemplateMetadata {
  if (!clauseFamilies[meta.id]) return meta;
  const needs = [
    ...new Set([
      ...(meta.requiredResponseCapability
        ? [meta.requiredResponseCapability]
        : []),
      ...(capabilities[meta.id] ?? []),
    ]),
  ];
  return {
    ...meta,
    version: meta.version + 1,
    reprintsFrom: meta.reprintsFrom ?? meta.version,
    ...(needs.length
      ? {
          requiredResponseCapability: needs[0],
          requiredResponseCapabilities: needs,
        }
      : {}),
  };
}

export function buildClause(
  meta: TemplateMetadata,
  seed: string,
  family: string,
): GeneratedProblem {
  const c = { meta, seed, family, r: random(`${meta.id}:${family}`, seed) };
  return placeClauseFamilies[meta.id]
    ? generatePlaceClause(c)
    : generateTransformationClause(c);
}

/** Existing entrypoints share the new draw; print-only case functions keep
 * their legacy surfaces. Version-gated axes leave stored problems unchanged. */
export function withClauseVariants(
  templates: readonly TemplateMetadata[],
  legacy: (id: string, seed: string) => GeneratedProblem,
) {
  return (id: string, seed: string): GeneratedProblem => {
    if (typeof seed !== "string" || !seed.length || seed.length > 128)
      throw new Error("Seed must contain 1–128 characters");
    const families = clauseFamilies[id],
      base = templates.find((t) => t.id === id);
    if (!families || !base) return legacy(id, seed);
    const meta = clauseMetadata(base),
      values = ["legacy", ...families.map((s) => s.slice(0, 31))];
    const selected = chooseAxes(id, seed, {
      clause: defineAxis("clause", values, {
        legacy: "legacy",
        weights: [2, ...families.map(() => 3)],
        since: meta.version,
        needs: Object.fromEntries(
          values.slice(1).map((v) => [v, "scenes-v1" as const]),
        ),
      }),
    }).clause;
    const gated = versionGatedAxes().some((a) => a.id === "clause");
    if (gated) return legacy(id, seed);
    const hardened =
      id === "continue-count-to-120" || id === "mental-ten-hundred";
    if (selected === "legacy" && !hardened) {
      return legacy(id, seed);
    }
    return buildClause(
      meta,
      seed,
      hardened ? families[0]! : families[values.indexOf(selected) - 1]!,
    );
  };
}
