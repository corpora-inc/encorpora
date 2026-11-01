import type { GlossaryLexicon, TermId } from "./types";

/** Word matching shared by the server linker (every glossary form) and the
 * client (one payload's lexicon). It imports no glossary data, so a client
 * bundle carries only the words its payload sent. */

/** Curly apostrophes read as straight ones, without moving any index. */
export const normalizeForm = (s: string) => s.replace(/’/g, "'");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One pattern for a set of lowercase forms: longest first, so "unit rate"
 * wins over "rate" at the same position. A word boundary treats hyphens and
 * apostrophes as part of a word, so "negative" is not found in
 * "non-negative". */
export function formPattern(forms: Iterable<string>): RegExp {
  const sorted = [...new Set([...forms].map(normalizeForm))].sort(
    (a, b) => b.length - a.length || (a < b ? -1 : 1),
  );
  // An empty set matches nothing.
  if (!sorted.length) return /(?!)/gu;
  return new RegExp(
    `(?<![\\p{L}\\p{N}'-])(?:${sorted.map(escape).join("|")})(?![\\p{L}\\p{N}'-])`,
    "giu",
  );
}

/** Every form the pattern finds in one prose run (no formulas), in order,
 * lowercased. */
export function scanForms(
  prose: string,
  pattern: RegExp,
): { start: number; end: number; form: string }[] {
  pattern.lastIndex = 0;
  // A prose run that starts with a hyphen continues a formula ("$y$-intercept"):
  // the hyphen there is a boundary.
  const text = normalizeForm(prose).replace(/^-/, " ");
  return [...text.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    form: match[0].toLowerCase(),
  }));
}

export type ProsePiece = { text: string; id?: TermId };

const patterns = new WeakMap<GlossaryLexicon, RegExp>();
/** One prose run split into plain text and terms, as the server's linker
 * would split it. The lexicon names every form the server's linker matched
 * in this payload's texts, with the entry it means or null for an ordinary
 * word, so matching only those forms reproduces its result exactly. */
export function linkProse(
  prose: string,
  lexicon: GlossaryLexicon,
): ProsePiece[] {
  let pattern = patterns.get(lexicon);
  if (!pattern) {
    pattern = formPattern(Object.keys(lexicon));
    patterns.set(lexicon, pattern);
  }
  const out: ProsePiece[] = [];
  let at = 0;
  for (const { start, end, form } of scanForms(prose, pattern)) {
    const id = lexicon[form];
    if (!id) continue;
    if (start > at) out.push({ text: prose.slice(at, start) });
    out.push({ text: prose.slice(start, end), id });
    at = end;
  }
  if (at < prose.length) out.push({ text: prose.slice(at) });
  return out;
}
