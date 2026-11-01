import { glossaryFigure } from "./figures";
import { glossaryEntry } from "./index";
import { termsIn, type LinkContext } from "./link";
import type { GlossaryCard, GlossaryEntry, MethodTerm, TermId } from "./types";

/** The entries a set of texts uses, in first-use order, then every entry
 * reachable through `uses`, so a client can drill down without another
 * request. `extra` adds ids named outside the texts (a method's terms). */
export function glossaryFor(
  texts: readonly string[],
  context: LinkContext = {},
  extra: readonly TermId[] = [],
): GlossaryEntry[] {
  const ids: TermId[] = [];
  const add = (id: TermId) => {
    if (!ids.includes(id)) ids.push(id);
  };
  for (const text of texts) termsIn(text, context).forEach(add);
  extra.forEach(add);
  // Breadth-first: a term's own words follow it.
  for (let i = 0; i < ids.length; i++) glossaryEntry(ids[i]!).uses.forEach(add);
  return ids.map(glossaryEntry);
}

export function glossaryCard(entry: GlossaryEntry): GlossaryCard {
  return {
    id: entry.id,
    term: entry.term,
    plain: entry.plain,
    ...(entry.example ? { example: entry.example } : {}),
    ...(entry.figure ? { figure: glossaryFigure(entry.figure) } : {}),
    uses: [...entry.uses],
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
