import type { ContentFamily } from "./registry/types";
import {
  patternRuleGenerate,
  patternRuleTemplates,
} from "../math/pattern-rule-practice";
import {
  patternRuleFacetMappings,
  patternRuleLessons,
  patternRuleMethods,
  patternRulePrinciples,
} from "../content/pattern-rule-lessons";

export const family = {
  id: "pattern-rule",
  practice: {
    templates: patternRuleTemplates,
    generate: patternRuleGenerate,
    preserveAlgebra: true,
  },
  lessons: patternRuleLessons,
  methods: patternRuleMethods,
  principles: patternRulePrinciples,
  facetMappings: patternRuleFacetMappings,
  archetypeLinks: {
    "pattern-rule-choice": ["pattern.rule"],
    "pattern-term-unknown-rule": ["pattern.rule"],
  },
} satisfies ContentFamily;
