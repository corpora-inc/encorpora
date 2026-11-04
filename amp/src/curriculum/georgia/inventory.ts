import type {
  ReconciledTask,
  SourceInventory,
  SourceRequirement,
} from "../source-reconciliation";
import { georgiaCase, georgiaSources } from "./sources";
import type { GeorgiaRow } from "./types";

export interface GeorgiaBand {
  id: string;
  grade: string;
  rows: readonly GeorgiaRow[];
  expectedIds: readonly string[];
  limitations: readonly string[];
}

const commonLimitations = [
  "Identifier inventory covers the 30 grade-4 expectations and the one 4.MP content standard. The eight cluster statements and the eight 4.MP child elements are not separate rows. This is not a certification of Georgia coverage.",
  "Summaries are original and the CASE package controls meaning. A linked template is partial practice. coverageComplete stays false.",
  "Item practice does not assess drawing, collecting data, or a free written explanation. An other-grade link names a template whose skill is not grade 4 and is not served as grade 4 practice.",
  "The source hash identifies the CASE package retrieved on the retrieval date.",
];

const task = (row: GeorgiaRow): ReconciledTask => {
  const [id, locator, summary, , status, templateIds, skillIds, limitation] =
    row;
  return {
    id: `ga-${id}`,
    description: summary,
    requirementIds: [id],
    skillIds: [...skillIds],
    templateIds: [...templateIds],
    disposition: status === "related" ? "related-practice" : "missing-family",
    limitations: limitation,
    evidence: [
      {
        sourceId: georgiaCase,
        locator,
        observation:
          "Expectation text compared with the linked templates. Related practice is partial.",
      },
    ],
  };
};

export const georgiaInventory = (band: GeorgiaBand): SourceInventory => ({
  id: band.id,
  targetId: "US.GA",
  grade: band.grade,
  sources: georgiaSources,
  expectedRequirementIds: band.expectedIds,
  requirements: band.rows.map(
    ([id, locator, summary, scope, status]): SourceRequirement => ({
      id,
      sourceId: georgiaCase,
      locator,
      description: summary,
      scope,
      ...(status === "unreviewed" ? { crossCutting: true } : {}),
    }),
  ),
  tasks: band.rows.filter((r) => r[4] !== "unreviewed").map(task),
  limitations: [...commonLimitations, ...band.limitations],
});
