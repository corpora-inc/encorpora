import type { ContentFamily } from "./registry/types";
import {
  generateLinePlotBuild,
  linePlotBuildTemplates,
} from "../math/line-plot-build-practice";
import {
  linePlotBuildLesson,
  linePlotBuildMethod,
  linePlotBuildPrinciple,
} from "../content/line-plot-build-lessons";

export const family = {
  id: "line-plot-build",
  practice: {
    templates: linePlotBuildTemplates,
    generate: generateLinePlotBuild,
    preserveAlgebra: true,
  },
  lessons: [linePlotBuildLesson],
  methods: { "line-plot-build": linePlotBuildMethod },
  principles: { "line-plot-build": linePlotBuildPrinciple },
  facetMappings: [
    {
      templateId: "line-plot-build",
      facetId: "line-plots.core",
      extent: "partial",
      rationale:
        "Constructs the exact count map on consecutive whole numbers from several or repeated measurements, a table, or drawn rulers. Ruler reading assesses measurement reasoning; physical ruler handling is outside the app.",
    },
  ],
} satisfies ContentFamily;
