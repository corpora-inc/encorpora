import type { ContentFamily } from "./registry/types";
import {
  shapeComposerTemplates,
  generateShapeComposer,
} from "../math/shape-composer-practice";
import {
  shapeComposerLesson,
  shapeComposerMethod,
  shapeComposerPrinciple,
} from "../content/shape-composer-lessons";
export const family = {
  id: "shape-composer",
  practice: {
    templates: shapeComposerTemplates,
    generate: generateShapeComposer,
    preserveAlgebra: true,
  },
  lessons: [shapeComposerLesson],
  methods: { "compose-flat-shape": shapeComposerMethod },
  principles: { "compose-flat-shape": shapeComposerPrinciple },
  facetMappings: [
    {
      templateId: "compose-flat-shape",
      facetId: "composite-shapes.core",
      extent: "partial",
      rationale:
        "Exact 2D composition and composition from a joined shape. Solids are covered by the existing recognition problems; 3D placement is not assessed.",
    },
  ],
  archetypeLinks: { "compose-flat-shape": ["shape.compose"] },
} satisfies ContentFamily;
