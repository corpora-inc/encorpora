/** The comparison pages' content model (`/versus`, `/versus/<slug>`).
 *
 * `catalog.json` is the hub's list. `pages/<slug>.json` is one competitor.
 * AMP's own side (the table's rows, the categories) is `amp.ts`. Check any
 * change with `npm run versus:check` (validate.ts). */
import type { ResearchComponentId } from "../research/report";

/** The hub's groups, in the order it shows them. */
export const versusCategoryIds = [
  "adaptive",
  "school",
  "courses",
  "all-in-one",
  "books",
  "games",
  "tutoring",
  "ai",
] as const;
export type VersusCategory = (typeof versusCategoryIds)[number];

/** The side-by-side table's rows, in the order it shows them. A page shows
 * the rows its `rows` names. */
export const versusRowIds = [
  "price",
  "buyers",
  "range",
  "start",
  "teaching",
  "next",
  "mastery",
  "review",
  "print",
  "adult",
  "reports",
  "evidence",
] as const;
export type VersusRowId = (typeof versusRowIds)[number];

/** One line of the hub: `catalog.json` is a list of these. */
export type VersusCatalogEntry = {
  /** The page's address (`/versus/<slug>`) and its file's name. */
  slug: string;
  name: string;
  category: VersusCategory;
  /** One sentence: why AMP over this one. At most 110 characters. */
  line: string;
};

/** One comparison: `pages/<slug>.json`.
 *
 * Any prose string may cite the page's sources with markers like `[3]` or
 * `[1][4]`: the number is the source's place in `sources`, from 1. */
export type VersusPage = {
  /** Matches the file's name and the catalog. */
  slug: string;
  /** "i-Ready" */
  name: string;
  /** "Curriculum Associates" */
  maker?: string;
  category: VersusCategory;
  /** The day the facts were checked, "2026-11-21"; shown as "Checked
   * November 2026". */
  checked: string;
  /** The words after the name in the page's title ("AMP vs i-Ready: <benefit>
   * | AMP"). Optional: without it the title takes its category's
   * (`amp.ts`). At most 32 characters. */
  benefit?: string;
  /** The search result's description: 110 to 160 characters. */
  description: string;
  /** The lede under the title: one to three sentences. */
  verdict: string;
  /** "What <name> is": one to three fair paragraphs. */
  theirs: string[];
  /** "What <name> does well": two to four short items. */
  credit: string[];
  /** "Why AMP": three to six, each with the research it rests on. */
  reasons: { title: string; body: string; research?: ResearchComponentId[] }[];
  /** "The evidence": paragraphs about theirs, then ours. */
  evidence: { theirs: string[]; ours: string[] };
  /** The competitor's cell for each table row it has. */
  rows: Partial<Record<VersusRowId, string>>;
  /** "Choose <name> if" and "Choose AMP if". */
  fit: { them: string[]; amp: string[] };
  /** Two to five; also the page's FAQ structured data. */
  questions: { question: string; answer: string }[];
  /** Numbered by position, from 1. Every address is https. */
  sources: { title: string; url: string }[];
};
