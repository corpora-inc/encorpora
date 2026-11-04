import type {
  ReconciledTask,
  SourceInventory,
  SourceRequirement,
} from "../source-reconciliation";
import { arkansasPdf, arkansasSources } from "./sources";
import type { ArkansasRow } from "./types";

export interface ArkansasBand {
  id: string;
  grade: string;
  rows: readonly ArkansasRow[];
  expectedIds: readonly string[];
  limitations: readonly string[];
}

const commonLimitations = [
  "Identifier inventory covers the 34 grade-4 expectations on printed pages 18-20 (4.NPV.1-10, 4.CAR.1-11, 4.GM.1-11, 4.DA.1-2). Grade 4 has no numbered process standard, so none is invented. This is not a certification of Arkansas coverage.",
  "Summaries are original and the 2023 PDF controls meaning. A linked template is partial practice. coverageComplete stays false.",
  "Item practice does not assess drawing or collecting data. An other-grade link names a template whose skill is not grade 4 and is not served as grade 4 practice.",
  "The source hash identifies the PDF retrieved on the retrieval date.",
];

const task = (row: ArkansasRow): ReconciledTask => {
  const [id, locator, summary, , status, templateIds, skillIds, limitation] =
    row;
  return {
    id: `ar-${id}`,
    description: summary,
    requirementIds: [id],
    skillIds: [...skillIds],
    templateIds: [...templateIds],
    disposition: status === "related" ? "related-practice" : "missing-family",
    limitations: limitation,
    evidence: [
      {
        sourceId: arkansasPdf,
        locator,
        observation:
          "Expectation text compared with the linked templates. Related practice is partial.",
      },
    ],
  };
};

export const arkansasInventory = (band: ArkansasBand): SourceInventory => ({
  id: band.id,
  targetId: "US.AR",
  grade: band.grade,
  sources: arkansasSources,
  expectedRequirementIds: band.expectedIds,
  requirements: band.rows.map(
    ([id, locator, summary, scope, status]): SourceRequirement => ({
      id,
      sourceId: arkansasPdf,
      locator,
      description: summary,
      scope,
      ...(status === "unreviewed" ? { crossCutting: true } : {}),
    }),
  ),
  tasks: band.rows.filter((r) => r[4] !== "unreviewed").map(task),
  limitations: [...commonLimitations, ...band.limitations],
});
