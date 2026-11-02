import type { GradeBand } from "../curriculum/types";
import { gradeBandOrder } from "../content/lesson-text";
import { glossaryFigure } from "./figures";
import { glossaryEntry } from "./index";
import {
  entryContext,
  glossaryLexicon,
  termsIn,
  type LinkContext,
} from "./link";
import type {
  GlossaryCard,
  GlossaryEntry,
  GlossaryPayload,
  MethodTerm,
  TermId,
} from "./types";

/** The entries a set of texts uses, in first-use order, then every entry
 * reachable through `uses`, so a client can drill down without another
 * request. `extra` adds ids named outside the texts (a method's terms). */
export function glossaryFor(
  texts: readonly string[],
  context: LinkContext = {},
  extra: readonly TermId[] = [],
  band?: GradeBand,
): GlossaryEntry[] {
  const ids: TermId[] = [];
  const add = (id: TermId) => {
    if (!ids.includes(id)) ids.push(id);
  };
  for (const text of texts)
    termsIn(text, context)
      .filter((id) => linksOnScreen(id, band))
      .forEach(add);
  extra.forEach(add);
  // Breadth-first: a term's own words follow it.
  for (let i = 0; i < ids.length; i++) glossaryEntry(ids[i]!).uses.forEach(add);
  return ids.map(glossaryEntry);
}

const cards = new Map<TermId, GlossaryCard>();
/** The wire card for an entry: its figure built, and the lexicon its own
 * definition and example link with. Cards are built once and never mutated. */
export function glossaryCard(entry: GlossaryEntry): GlossaryCard {
  const cached = cards.get(entry.id);
  if (cached) return cached;
  const lexicon = glossaryLexicon(
    [entry.plain, entry.example ?? ""],
    entryContext(entry),
  );
  const card: GlossaryCard = {
    id: entry.id,
    term: entry.term,
    plain: entry.plain,
    ...(entry.example ? { example: entry.example } : {}),
    ...(entry.figure ? { figure: glossaryFigure(entry.figure) } : {}),
    uses: [...entry.uses],
    ...(Object.keys(lexicon).length ? { lexicon } : {}),
  };
  cards.set(entry.id, card);
  return card;
}

/** Words first met in kindergarten to grade 2 count as known from grade 3
 * on (the plain-language gate's rule, `content/plain-language-check.ts`): a
 * screen for grade 3 or later does not link them, so a page links only the
 * words it is teaching. They stay one tap away inside definitions, which
 * link every word they use. */
const KNOWN_FROM = gradeBandOrder.indexOf("3");
export function linksOnScreen(id: TermId, band?: GradeBand) {
  return (
    band === undefined ||
    gradeBandOrder.indexOf(band) < KNOWN_FROM ||
    gradeBandOrder.indexOf(glossaryEntry(id).band) >= KNOWN_FROM
  );
}

/** A payload's term cards: the entries its texts use and everything they
 * reach through `uses`, with the lexicon that links the texts. `band` is the
 * screen's grade band; words it already knows are not linked. */
export function glossaryPayload(
  texts: readonly string[],
  context: LinkContext = {},
  extra: readonly TermId[] = [],
  band?: GradeBand,
): Required<GlossaryPayload> {
  const lexicon = glossaryLexicon(texts, context);
  // A known word stays in the lexicon as an ordinary word, so it still
  // blocks a shorter form inside it, exactly as the server reads it.
  for (const [form, id] of Object.entries(lexicon))
    if (id && !linksOnScreen(id, band)) lexicon[form] = null;
  return {
    glossary: glossaryFor(texts, context, extra, band).map(glossaryCard),
    glossaryLexicon: lexicon,
  };
}

export const methodTermId = (term: MethodTerm): TermId =>
  typeof term === "string" ? term : term[0];

/** A method's terms as the lesson lists them: the glossary's word, its plain
 * definition and example, then the method's own note. A term listed twice is
 * shown once, with both notes. */
export function methodTermDefinitions(
  terms: readonly MethodTerm[],
): { id: TermId; term: string; meaning: string }[] {
  const out: { id: TermId; term: string; meaning: string }[] = [];
  for (const item of terms) {
    const entry = glossaryEntry(methodTermId(item));
    const note = typeof item === "string" ? "" : item[1];
    const seen = out.find((t) => t.id === entry.id);
    if (seen) {
      if (note && !seen.meaning.includes(note)) seen.meaning += ` ${note}`;
      continue;
    }
    out.push({
      id: entry.id,
      term: entry.term,
      meaning: [entry.plain, entry.example, note].filter(Boolean).join(" "),
    });
  }
  return out;
}
