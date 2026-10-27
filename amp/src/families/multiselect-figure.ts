import type { ContentFamily } from "./registry/types";
import {
  multiselectFigureGenerate,
  multiselectFigureTemplates,
} from "../math/multiselect-figure-practice";
import { multiselectFigureContent } from "../content/multiselect-figure-lessons";

export const family = {
  id: "multiselect-figure",
  practice: {
    templates: multiselectFigureTemplates,
    generate: multiselectFigureGenerate,
    preserveAlgebra: true,
  },
  lessons: multiselectFigureContent.lessons,
  methods: multiselectFigureContent.methods,
  principles: multiselectFigureContent.principles,
  facetMappings: multiselectFigureContent.facetMappings,
  archetypeLinks: {
    "shape-sides-select": ["shape.parallel-perpendicular-sides", "line.terms"],
    "polygon-sides-select": ["shape.attributes"],
    "line-pair-select": ["line.terms"],
    "angle-kind-select": ["angle.classify"],
    "symmetry-lines-select": ["shape.symmetry"],
    "protractor-angles-select": ["angle.measure"],
    "prism-volume-select": ["measure.volume"],
    "solid-figure-select": ["shape.solid-properties"],
    "stem-leaf-match-select": ["data.stem-leaf-read"],
  },
  connections: [
    {
      from: "lines-symmetry",
      to: "angle-measure",
      kind: "extension",
      explanation:
        "Telling acute, right and obtuse angles by comparing with a square corner comes before measuring them. A protractor reading then puts a number on the same comparison.",
      templateIds: ["protractor-angles-select"],
    },
  ],
} satisfies ContentFamily;
