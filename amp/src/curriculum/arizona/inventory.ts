import type {
  ReconciledTask,
  SourceInventory,
  SourceRequirement,
} from "../source-reconciliation";
import { arizonaGrade4, arizonaSources } from "./sources";
import type { ArizonaRow } from "./types";

export interface ArizonaBand {
  id: string;
  grade: string;
  rows: readonly ArizonaRow[];
  expectedIds: readonly string[];
  limitations: readonly string[];
}

const commonLimitations = [
  "Identifier inventory covers the 29 grade-4 content standards printed in the 2025 file, including 4.OA.C.6, plus 4.MP.1-4.MP.8. Lettered parts of one standard stay on that standard's row. Essential-standard asterisks mark AASA emphasis only; every 2016 standard stays in the inventory. This is not a certification of Arizona coverage.",
  "Summaries are original and the standards file controls meaning. A linked template is partial practice. coverageComplete stays false.",
  "The hashed PDF was not downloaded from azed.gov. That host returned HTTP 403 on 2026-11-04. The bytes are the Internet Archive capture 20260314061525 of the official grade-4 URL.",
  "Item practice does not assess drawing or a free explanation. An other-grade link names a template whose skill is not grade 4 and is not served as grade 4 practice.",
];

const task = (row: ArizonaRow): ReconciledTask => {
  const [id, locator, summary, , status, templateIds, skillIds, limitation] =
    row;
  return {
    id: `az-${id}`,
    description: summary,
    requirementIds: [id],
    skillIds: [...skillIds],
    templateIds: [...templateIds],
    disposition: status === "related" ? "related-practice" : "missing-family",
    limitations: limitation,
    evidence: [
      {
        sourceId: arizonaGrade4,
        locator,
        observation:
          "Standard text in the archived 2025 file compared with the linked templates. Related practice is partial.",
      },
    ],
  };
};

export const arizonaInventory = (band: ArizonaBand): SourceInventory => ({
  id: band.id,
  targetId: "US.AZ",
  grade: band.grade,
  sources: arizonaSources,
  expectedRequirementIds: band.expectedIds,
  requirements: band.rows.map(
    ([id, locator, summary, scope, status]): SourceRequirement => ({
      id,
      sourceId: arizonaGrade4,
      locator,
      description: summary,
      scope,
      ...(status === "unreviewed" ? { crossCutting: true } : {}),
    }),
  ),
  tasks: band.rows.filter((r) => r[4] !== "unreviewed").map(task),
  limitations: [...commonLimitations, ...band.limitations],
});
