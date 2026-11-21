/** Citation markers in a comparison's prose: `[3]` points at the page's
 * third source (`#source-3`). One reading for the screen, the static
 * document and the validator. */

export type CitedPart =
  | { text: string }
  /** `after`: this citation follows another directly (`[1][4]`), so the two
   * numbers need a comma between them to read as two. */
  | { cite: number; after: boolean };

const marker = /\[(\d+)\]/g;

/** A prose string as its words and its citations, in order. A citation
 * sits against the word before it: a writer's space before `[3]` is dropped,
 * so the raised number never starts a line or floats after a gap. */
export function citedParts(text: string): CitedPart[] {
  const parts: CitedPart[] = [];
  let at = 0;
  for (const match of text.matchAll(marker)) {
    const words = text.slice(at, match.index).trimEnd();
    if (words) parts.push({ text: words });
    const last = parts.at(-1);
    parts.push({
      cite: Number(match[1]),
      after: !words && !!last && "cite" in last,
    });
    at = match.index + match[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

/** Every source number a prose string cites. */
export function citations(text: string): number[] {
  return [...text.matchAll(marker)].map((match) => Number(match[1]));
}

/** The words alone, for a description or structured data: the markers gone,
 * and no space left before the punctuation they sat against. */
export function withoutCitations(text: string): string {
  return text
    .replace(marker, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** A source's anchor on its page. */
export const sourceAnchor = (number: number) => `source-${number}`;
