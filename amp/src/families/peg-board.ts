import type { ContentFamily } from "./registry/types";
import {
  generatePegBoard,
  pegBoardTemplates,
} from "../math/peg-board-practice";
import {
  pegBoardLesson,
  pegBoardMethod,
  pegBoardPrinciple,
} from "../content/peg-board-lessons";

export const family = {
  id: "peg-board",
  practice: {
    templates: pegBoardTemplates,
    generate: generatePegBoard,
    preserveAlgebra: true,
  },
  lessons: [pegBoardLesson],
  methods: Object.fromEntries(
    pegBoardTemplates.map((t) => [t.id, pegBoardMethod]),
  ),
  principles: Object.fromEntries(
    pegBoardTemplates.map((t) => [t.id, pegBoardPrinciple]),
  ),
  facetMappings: pegBoardTemplates.map((t) => ({
    templateId: t.id,
    facetId: "build-and-draw-shapes.core",
    extent: "partial" as const,
    rationale:
      "Builds and draws closed straight-sided shapes on pegs, including named shapes, given side/corner counts and copies. Freehand drawing and physical models are not assessed.",
  })),
} satisfies ContentFamily;
