import type { ContentFamily } from "./registry/types";
import {
  multiselectNumberGenerate,
  multiselectNumberTemplates,
} from "../math/multiselect-number-practice";
import { multiselectNumberContent } from "../content/multiselect-number-lessons";

export const family = {
  id: "multiselect-number",
  practice: {
    templates: multiselectNumberTemplates,
    generate: multiselectNumberGenerate,
    preserveAlgebra: true,
  },
  lessons: multiselectNumberContent.lessons,
  methods: multiselectNumberContent.methods,
  principles: multiselectNumberContent.principles,
  facetMappings: multiselectNumberContent.facetMappings,
  archetypeLinks: {
    "place-value-forms-select": [
      "number.expanded-form-whole",
      "number.number-word-form",
      "place.compare-whole",
      "place.digit-value",
    ],
    "equivalent-fractions-select": ["fractions.equivalent"],
    "fraction-line-names-select": [
      "fractions.number-line",
      "fractions.equivalent",
    ],
    "equivalent-ratios-select": ["ratio.proportion"],
    "rounds-to-select": ["number.inverse-rounding"],
    "compare-to-pi-select": ["number.real-order", "number.approximate-roots"],
    "multiplication-fact-grid-select": ["whole.multiplication-facts"],
    "equal-factor-truth-select": ["equation.truth"],
  },
  connections: [
    {
      from: "fraction-equivalence",
      to: "ratios",
      kind: "extension",
      explanation:
        "Equivalent fractions and equivalent ratios both come from multiplying the two parts by one number. Checking whether a group keeps a ratio uses the same scaling that checks a fraction.",
      templateIds: ["equivalent-ratios-select"],
    },
    {
      from: "decimal-place-value",
      to: "approximate-roots",
      kind: "related",
      explanation:
        "Rounding a decimal to the nearest tenth and reading a square root to the nearest tenth both ask which tenth mark is closest to a value.",
      templateIds: ["root-approximation-select"],
    },
  ],
} satisfies ContentFamily;
