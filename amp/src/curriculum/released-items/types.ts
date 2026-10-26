import type { ResponseCapability } from "../../math/contracts";

/** Released-item coverage ledger types. A ledger labels each item of a bounded,
 * published question set once. Demands are original summaries: never copy
 * question text, answer choices or artwork into a ledger. */
export const responseFormats = [
  "choice",
  "numeric",
  "multi-select",
  "graph/drag",
  "constructed",
  "other",
] as const;
export type ResponseFormat = (typeof responseFormats)[number];
export const itemStatuses = ["covered", "partial", "missing"] as const;
export type ItemStatus = (typeof itemStatuses)[number];
/** AMP response protocols. Templates without a declared capability use the
 * original number/fraction entry protocol, reported here as "numeric". */
export type TemplateResponse = "numeric" | ResponseCapability;
/** Which AMP response protocols can practice an item's response format.
 * Producing a number subsumes choosing it, so numeric entry may serve a choice
 * item whose choices are plain numbers; labelers decide that case. A
 * choice-only template can never fully cover numeric entry. Graph, drag and
 * constructed responses have no AMP protocol yet. */
export const acceptedResponses: Readonly<
  Record<ResponseFormat, readonly TemplateResponse[]>
> = {
  choice: ["single-choice-v1", "numeric"],
  numeric: ["numeric"],
  "multi-select": ["multi-select-v1"],
  "graph/drag": ["point-plot-v1"],
  constructed: [],
  other: [],
};
/** Digital SAT Suite skills (Assessment Framework, Appendix B, SAT column). */
export const satSkills = [
  "sat.alg.linear-equations-one-variable",
  "sat.alg.linear-functions",
  "sat.alg.linear-equations-two-variables",
  "sat.alg.systems-linear-equations",
  "sat.alg.linear-inequalities",
  "sat.adv.nonlinear-functions",
  "sat.adv.nonlinear-equations-systems",
  "sat.adv.equivalent-expressions",
  "sat.psda.ratios-rates-units",
  "sat.psda.percentages",
  "sat.psda.one-variable-data",
  "sat.psda.two-variable-data",
  "sat.psda.probability",
  "sat.psda.inference-margin-of-error",
  "sat.psda.evaluating-statistical-claims",
  "sat.geo.area-volume",
  "sat.geo.lines-angles-triangles",
  "sat.geo.right-triangles-trigonometry",
  "sat.geo.circles",
] as const;
export interface ReleasedSource {
  id: string;
  /** Assessment program, e.g. "SAT" or "MCAS grade 8 mathematics". */
  test: string;
  /** Form or administration, e.g. "Practice Test 10" or "Spring 2025". */
  form: string;
  url: string;
  edition: string;
  retrievedAt: string;
  sha256: string;
  /** Companion documents used while labeling, such as answer explanations. */
  supplements?: readonly { role: string; url: string; sha256: string }[];
  /** True only when every mathematics item of the form is labeled. */
  complete: boolean;
}
export interface ReleasedItem {
  sourceId: string;
  /** Section or module, e.g. "Math module 1". */
  section: string;
  /** Question number (or table locator) and page locator in the source. */
  item: { number: string; page: string };
  responseFormat: ResponseFormat;
  calculator?: "permitted" | "not-permitted";
  /** Standard or skill codes stated by, or classified against, the source's framework. */
  standards: readonly string[];
  archetypeIds: readonly string[];
  /** Original one-line summary; never question text. */
  demand: string;
  status: ItemStatus;
  templateIds: readonly string[];
  limitations: string;
  labeledBy: string;
  labeledAt: string;
}
export interface SourceLedger {
  source: ReleasedSource;
  items: readonly ReleasedItem[];
}
type Common = Pick<ReleasedItem, "labeledBy" | "labeledAt"> &
  Partial<Pick<ReleasedItem, "calculator" | "section">>;
export type LedgerRow = Omit<
  ReleasedItem,
  "sourceId" | "labeledBy" | "labeledAt" | "section"
> &
  Partial<Pick<ReleasedItem, "labeledBy" | "labeledAt" | "section">>;
/** Build one source's ledger, applying shared labeling fields to every row. */
export function defineLedger(
  source: ReleasedSource,
  common: Common,
  rows: readonly LedgerRow[],
): SourceLedger {
  return {
    source,
    items: rows.map((row) => ({
      sourceId: source.id,
      ...common,
      ...row,
      section: row.section ?? common.section ?? "",
    })),
  };
}
