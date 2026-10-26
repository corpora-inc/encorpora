import type {
  ReconciledTask,
  SourceInventory,
  SourceRequirement,
} from "../source-reconciliation";
import { floridaBest, floridaSources } from "./sources";
import type { FloridaRow } from "./types";

export interface FloridaBand {
  id: string;
  grade: string;
  rows: readonly FloridaRow[];
  expectedIds: readonly string[];
  crossCutting?: boolean;
  limitations: readonly string[];
}

const commonLimitations = [
  "Identifier inventory covers the benchmarks listed for this band in the July 2025 B.E.S.T. Standards PDF (and, for Algebra 2 and Precalculus Honors, the FLDOE course descriptions); it is not component reconciliation or a certification of Florida coverage.",
  "Summaries are original and the official standards control meaning. Benchmark clarifications bound the demand: a template satisfies a clarified range only where sampled cases fall inside it, and the limitation records each mismatch.",
  "Item practice (number, fraction, single-choice and multi-select responses) does not assess objects, drawings, constructions, discussion, written justification or technology use; related practice is partial and never certifies a benchmark.",
  "Source hashes identify retrieved documents on the retrieval date; the Florida Statewide Assessment blueprints (FAST/B.E.S.T. EOC) are not inventoried here.",
];

const task = (row: FloridaRow): ReconciledTask => {
  const [id, locator, summary, , status, templateIds, skillIds, limitation] =
    row;
  return {
    id: `fl-${id}`,
    description: summary,
    requirementIds: [id],
    skillIds: [...skillIds],
    templateIds: [...templateIds],
    disposition: status === "related" ? "related-practice" : "missing-family",
    limitations: limitation,
    evidence: [
      {
        sourceId: floridaBest,
        locator,
        observation:
          status === "related"
            ? "Benchmark text and clarifications compared with sampled template cases."
            : "Benchmark demand has no matching template in the catalog.",
      },
    ],
  };
};

export const floridaInventory = (band: FloridaBand): SourceInventory => ({
  id: band.id,
  targetId: "US.FL",
  grade: band.grade,
  sources: floridaSources,
  expectedRequirementIds: band.expectedIds,
  requirements: band.rows.map(
    ([id, locator, summary, scope]): SourceRequirement => ({
      id,
      sourceId: floridaBest,
      locator,
      description: summary,
      scope,
      ...(band.crossCutting ? { crossCutting: true } : {}),
    }),
  ),
  tasks: band.rows.filter((r) => r[4] !== "unreviewed").map(task),
  limitations: [...commonLimitations, ...band.limitations],
});
