import type { ContentFamily } from "./registry/types";
import {
  flatSolidComposeTemplates,
  generateFlatSolidCompose,
} from "../math/flat-solid-compose-practice";
import {
  flatSolidComposeFacetMappings,
  flatSolidComposeLessons,
  flatSolidComposeMethods,
  flatSolidComposePrinciples,
} from "../content/flat-solid-compose-lessons";

/** Flat or solid (K.G.A.3) and composite shapes (1.G.A.2): name, choose and
 * count flat and solid shapes, name what pieces make, choose the pieces
 * that make a shape, and name the solids a composite is built from. */
export const family = {
  id: "flat-solid-compose",
  practice: {
    templates: flatSolidComposeTemplates,
    generate: generateFlatSolidCompose,
    preserveAlgebra: true,
  },
  lessons: flatSolidComposeLessons,
  methods: flatSolidComposeMethods,
  principles: flatSolidComposePrinciples,
  facetMappings: flatSolidComposeFacetMappings,
  archetypeLinks: {
    "flat-or-solid-name": ["shape.name-solid"],
    "pick-flat-or-solid": ["shape.name-solid"],
    "count-flat-or-solid": ["shape.name-solid"],
    "composite-shape-name": ["shape.compose"],
    "composite-which-pieces": ["shape.compose"],
    "composite-which-solids": ["shape.compose"],
  },
} satisfies ContentFamily;
