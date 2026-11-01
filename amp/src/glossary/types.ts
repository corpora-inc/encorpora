import type { GradeBand } from "../curriculum/types";
import type { Scene } from "../math/scene/spec";

/** A glossary key: one meaning of one word ("hypotenuse", "range-function"). */
export type TermId = string;

/** A small teaching figure, built in `figures.ts` from scenes-v1 builders. */
export type GlossaryFigure =
  | "right-triangle-parts"
  | "fraction-parts"
  | "number-line-integers"
  | "area-model"
  | "slope-rise-run"
  | "circle-radius-diameter";

/** One meaning of one term, defined once for every lesson that uses it. */
export interface GlossaryEntry {
  id: TermId;
  /** The word as shown: "hypotenuse". */
  term: string;
  /** Words matched in prose, lowercase, including plurals. Empty for a term
   * that is never matched in prose (notation, or a word too common to link). */
  forms: string[];
  /** At most 30 words, in everyday language. Any other glossary term it
   * relies on is listed in `uses`. */
  plain: string;
  /** One concrete case; may use `$…$`. */
  example?: string;
  figure?: GlossaryFigure;
  /** Terms the definition relies on, for drill-down. The graph is acyclic,
   * and a term only relies on terms met in the same or an earlier band. */
  uses: TermId[];
  /** Where learners first meet the term. */
  band: GradeBand;
  /** An everyday word, or one with another mathematical meaning: linked only
   * where a sense map names this entry. */
  autoLink?: false;
  /** Forms in this entry's own text that are ordinary words here ("this
   * means"), never links. */
  noLink?: string[];
}

/** The wire shape a client renders: the definition with its figure built. */
export interface GlossaryCard {
  id: TermId;
  term: string;
  plain: string;
  example?: string;
  figure?: Scene;
  uses: TermId[];
  /** How the definition and example read their words (see
   * `GlossaryLexicon`), so a term inside a definition opens its own card. */
  lexicon?: GlossaryLexicon;
}

/** Every form the server's linker found in a payload's texts: lowercase
 * form → the entry it means there, or null where it is an ordinary word.
 * A client links those texts by matching only these forms. */
export type GlossaryLexicon = Record<string, TermId | null>;

/** What a payload (a lesson, an answer's explanation, a hint) carries for
 * its term cards. Both fields are additive: older clients ignore them. */
export interface GlossaryPayload {
  /** Every entry the texts use, then every entry their definitions use. */
  glossary?: GlossaryCard[];
  glossaryLexicon?: GlossaryLexicon;
}

/** Which entry a word means in one lesson, method or template: lowercase
 * form → id. */
export type GlossarySenses = Record<string, TermId>;

/** A method's term: an id, or an id with a short note that carries context
 * the general definition lacks (this problem's symbols or convention). */
export type MethodTerm = TermId | readonly [TermId, string];
