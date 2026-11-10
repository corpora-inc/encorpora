import type { GlossarySenses } from "./types";

/** A shared sense map without some forms: for a method or lesson whose own
 * text (or its template's) uses those words in another meaning. Names the
 * exception where it applies instead of listing the form in `noLink` too,
 * which would silently mute the sense (`tests/glossary-contexts.test.ts`). */
export function sensesWithout(
  senses: GlossarySenses,
  ...forms: string[]
): GlossarySenses {
  return Object.fromEntries(
    Object.entries(senses).filter(([form]) => !forms.includes(form)),
  );
}

/** Phrases that share a glossary form but are not that term. The linker
 * keeps the term and skips only these uses (`idiomInsteadOfTerm`). */
export const idiomStoplist = [
  {
    forms: ["line", "lines"],
    particle: "up",
    note: "Phrasal verb, with the object allowed between: line the numbers up. Not the noun in 'the line up the side'.",
  },
  {
    forms: ["point", "points"],
    particles: ["at", "to"],
    note: "Verb when nothing marks a noun: the hand points at 4. Not 'the point at the top' or 'two points at the same height'.",
  },
] as const;

/** A determiner (or a close stand-in) immediately before "line" means the
 * geometry noun, even when "up" follows: "the line up the side". */
const LINE_NOUN_BEFORE = new Set([
  "a",
  "an",
  "the",
  "this",
  "these",
  "those",
  "each",
  "every",
  "another",
  "its",
  "their",
  "his",
  "her",
  "our",
  "my",
  "your",
  "horizontal",
  "vertical",
  "straight",
  "parallel",
  "perpendicular",
  "dashed",
  "dotted",
  "slanted",
  "diagonal",
  "curved",
]);

/** The object of "line ___ up" starts with one of these. */
const LINE_OBJECT_START = new Set([
  "a",
  "an",
  "the",
  "this",
  "these",
  "those",
  "them",
  "it",
  "him",
  "her",
  "some",
  "all",
  "both",
  "each",
  "every",
  "my",
  "your",
  "our",
  "their",
  "its",
  "his",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
]);

/** A finite verb between "line" and "up" means "up" belongs to that verb:
 * "line AB goes up", not "line the numbers up". */
const LINE_INTERVENING_VERB = new Set([
  "goes",
  "go",
  "is",
  "are",
  "was",
  "were",
  "be",
  "points",
  "point",
  "runs",
  "run",
  "moves",
  "move",
  "extends",
  "extend",
  "continues",
  "continue",
  "slopes",
  "rises",
  "rise",
  "heads",
  "passes",
  "travels",
  "climbs",
  "falls",
  "drops",
  "turns",
  "crosses",
  "meets",
  "reaches",
  "stays",
  "keeps",
  "comes",
  "come",
  "gets",
  "get",
  "has",
  "have",
  "will",
  "would",
  "can",
  "could",
  "should",
  "may",
  "might",
  "going",
]);

/** The word before "point(s)" when it is the noun, not the verb "points at". */
const POINT_NOUN_BEFORE = new Set([
  "a",
  "an",
  "the",
  "this",
  "that",
  "these",
  "those",
  "each",
  "every",
  "another",
  "any",
  "its",
  "their",
  "his",
  "her",
  "our",
  "my",
  "your",
  "both",
  "all",
  "some",
  "many",
  "several",
  "few",
  "no",
  "which",
  "whose",
  "either",
  "neither",
  "such",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "of",
  "between",
  "from",
  "with",
  "for",
  "on",
  "in",
  "through",
  "about",
  "among",
  "into",
  "onto",
  "over",
  "under",
  "near",
  "around",
  "across",
  "along",
  "without",
  "within",
  "beside",
  "after",
  "before",
  "above",
  "below",
  "lowest",
  "highest",
  "middle",
  "outside",
  "inside",
  "graphed",
  "labeled",
  "labelled",
  "lettered",
  "marked",
  "lattice",
  "decimal",
  "first",
  "second",
  "third",
  "fourth",
  "last",
  "different",
  "external",
  "extra",
  "grid",
  "halfway",
  "intersection",
  "known",
  "named",
  "new",
  "placed",
  "plotting",
  "plotted",
  "polar",
  "same",
  "shaded",
  "shared",
  "single",
  "spaced",
  "starting",
  "stated",
  "turning",
  "corresponding",
  "ordered",
  "integer",
  "distinct",
  "other",
  "only",
  "whole",
  "given",
  "missing",
  "data",
  "sample",
  "coordinate",
  "critical",
  "original",
  "top",
  "bottom",
]);

const wordBefore = (text: string, start: number) => {
  const match = text.slice(0, start).match(/([\p{L}\p{N}']+)\s*$/u);
  return match ? match[1]!.toLowerCase() : null;
};

const nounMarked = (previous: string | null, markers: Set<string>) => {
  if (!previous) return false;
  if (/^\d+$/.test(previous)) return true;
  if (previous.endsWith("'s") || previous.endsWith("s'")) return true;
  return markers.has(previous);
};

/** True when this match is an everyday verb, so it must not open the
 * geometry card. `start`/`end` index `prose` the same way `scanForms` does. */
export function idiomInsteadOfTerm(
  prose: string,
  start: number,
  end: number,
  form: string,
): boolean {
  const text = prose.replace(/’/g, "'").replace(/^-/, " ");
  const key = form.toLowerCase();
  const rest = text.slice(end);
  if (key === "line" || key === "lines") {
    if (/^\s+up\b/iu.test(rest))
      return !nounMarked(wordBefore(text, start), LINE_NOUN_BEFORE);
    const between = rest.match(
      /^(?:\s+[\p{L}\p{N}'-]{1,24}){1,5}(?=\s+up\b)/iu,
    );
    if (!between) return false;
    const words = between[0].toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
    if (!words.length || words.some((word) => LINE_INTERVENING_VERB.has(word)))
      return false;
    const first = words[0]!.replace(/'s$/, "");
    return LINE_OBJECT_START.has(first) || /^\d+$/.test(first);
  }
  if (key === "point" || key === "points") {
    if (!/^\s+(?:at|to)\b/iu.test(rest)) return false;
    return !nounMarked(wordBefore(text, start), POINT_NOUN_BEFORE);
  }
  return false;
}
