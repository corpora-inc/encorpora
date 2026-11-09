import type { ContentFamily } from "./registry/types";
import {
  generateKBuildRepresent,
  kBuildRepresentTemplates,
} from "../math/k-build-represent-practice";
import {
  kBuildRepresentFacetMappings,
  kBuildRepresentLessons,
  kBuildRepresentMethods,
  kBuildRepresentPrinciples,
} from "../content/k-build-represent-lessons";

/** Kindergarten building and representing: stick-and-ball models and shape
 * drawings (K.G.B.5), and pictures, stories and number sentences of joining
 * and taking away (K.OA.A.1). */
export const family = {
  id: "k-build-represent",
  practice: {
    templates: kBuildRepresentTemplates,
    generate: generateKBuildRepresent,
    preserveAlgebra: true,
  },
  lessons: kBuildRepresentLessons,
  methods: kBuildRepresentMethods,
  principles: kBuildRepresentPrinciples,
  facetMappings: kBuildRepresentFacetMappings,
  connections: [
    {
      from: "build-and-draw-shapes",
      to: "shape-attributes",
      kind: "extension",
      explanation:
        "Building a shape with sticks and clay balls shows the parts that make it that shape: straight sides, corners, and an outline that closes. Shape attributes name those parts and sort shapes by them.",
      templateIds: ["sticks-and-balls-needed"],
    },
    {
      from: "represent-join-separate",
      to: "addition-stories",
      kind: "extension",
      explanation:
        "Reading a picture of joining or taking away as a number sentence is the first step. Addition stories ask for the number sentence of a longer story, including stories that compare two groups.",
      templateIds: ["picture-to-number-sentence"],
    },
  ],
} satisfies ContentFamily;
