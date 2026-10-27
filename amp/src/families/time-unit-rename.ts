import type { ContentFamily } from "./registry/types";
import {
  timeUnitRenameGenerate,
  timeUnitRenameTemplates,
} from "../math/time-unit-rename-practice";
import {
  timeUnitRenameFacetMappings,
  timeUnitRenameLessons,
  timeUnitRenameMethods,
  timeUnitRenamePrinciples,
} from "../content/time-unit-rename-lessons";

export const family = {
  id: "time-unit-rename",
  practice: {
    templates: timeUnitRenameTemplates,
    generate: timeUnitRenameGenerate,
    preserveAlgebra: true,
  },
  lessons: timeUnitRenameLessons,
  methods: timeUnitRenameMethods,
  principles: timeUnitRenamePrinciples,
  facetMappings: timeUnitRenameFacetMappings,
  archetypeLinks: { "rename-time-units": ["time.rename-units"] },
  connections: [
    {
      from: "unit-conversion",
      to: "elapsed-time",
      kind: "application",
      explanation:
        "An elapsed time that crosses an hour is simpler when the hours are renamed as minutes: the same renaming of larger units as smaller ones lets the minutes be added and subtracted.",
      templateIds: ["clock-elapsed-minutes"],
    },
  ],
} satisfies ContentFamily;
