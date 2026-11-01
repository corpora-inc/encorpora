import { createContext, useContext } from "react";
import { segments } from "../../content/math-segments";
import { linkProse } from "../../glossary/scan";
import type {
  GlossaryCard,
  GlossaryLexicon,
  TermId,
} from "../../glossary/types";

/** One payload's term cards (a lesson, an explanation, a hint, or a card's
 * own definition) and how its texts link their words. */
export type GlossaryValue = {
  cards: ReadonlyMap<TermId, GlossaryCard>;
  lexicon: GlossaryLexicon;
  /** Opens a term's card; `origin` takes focus back when it closes. */
  open: (id: TermId, origin: HTMLElement) => void;
};
export const GlossaryContext = createContext<GlossaryValue | null>(null);

/** A run of texts (a list of steps, a section) that links only the first
 * use of each term: `first` maps a term to the index of the text that links
 * it. MathText links only inside a block, so prompts, choices and answers
 * stay plain. */
export type GlossaryBlockValue = {
  texts: readonly string[];
  first: ReadonlyMap<TermId, number>;
};
export const GlossaryBlockContext = createContext<GlossaryBlockValue | null>(
  null,
);

export const useGlossary = () => useContext(GlossaryContext);

/** The terms a text links, in order, keeping only those with a card. */
export function termIdsIn(text: string, glossary: GlossaryValue): TermId[] {
  const ids: TermId[] = [];
  for (const segment of segments(text)) {
    if (segment.math) continue;
    for (const piece of linkProse(segment.text, glossary.lexicon))
      if (piece.id && glossary.cards.has(piece.id) && !ids.includes(piece.id))
        ids.push(piece.id);
  }
  return ids;
}

export function blockValue(
  texts: readonly string[],
  glossary: GlossaryValue,
): GlossaryBlockValue {
  const first = new Map<TermId, number>();
  texts.forEach((text, index) => {
    for (const id of termIdsIn(text, glossary))
      if (!first.has(id)) first.set(id, index);
  });
  return { texts, first };
}
