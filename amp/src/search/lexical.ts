/**
 * The lexical half of search: an inverted index (MiniSearch) over the
 * corpus with prefix and typo tolerance, field boosts (a title outweighs a
 * description), standards codes as whole terms, and the curated synonyms.
 * It is deterministic and runs anywhere: the browser searches with it while
 * the API is slow or unreachable, and the API blends it with the vector half.
 */
import MiniSearch, { type SearchResult } from "minisearch";
import type { SearchDoc } from "./corpus";
import { synonymKeys, synonyms } from "./synonyms";

/** Lowercase, without accents. */
export const fold = (text: string) =>
  text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

const stopwords = new Set(
  (
    "a an the and or of to in on for with by at from is are be been was were " +
    "how do does did i me my what which who why when where it its this that " +
    "these those can could you your we our us about into as if then than so " +
    "not no yes find learn help need want please show way get some any there " +
    "here should would will just like"
  ).split(" "),
);

/** A light English stemmer: plurals only, the same on both sides. */
export function stem(word: string) {
  if (word.length <= 3 || /\d/.test(word)) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** A standards code typed or stored whole: `4.NF.B.3`, `HSA.REI.B.4`. */
const CODE = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;

/** Words of free text, folded. */
export const words = (text: string) =>
  fold(text)
    .split(/[^a-z0-9.]+/)
    .flatMap((token) =>
      CODE.test(token) ? [token] : token.split(".").filter(Boolean),
    );

/** A query word or a document word as the index stores it, or null when it
 * carries no meaning for search. */
export function term(word: string): string | null {
  if (!word || stopwords.has(word)) return null;
  return CODE.test(word) ? word : stem(word);
}

/** The query's meaningful words, then the synonym words it implies. */
export function parseQuery(query: string) {
  const folded = ` ${words(query).join(" ")} `;
  const own = words(query)
    .map(term)
    .filter((t): t is string => !!t);
  const expansions = new Set<string>();
  let rest = folded;
  for (const key of synonymKeys)
    if (rest.includes(` ${key} `)) {
      for (const word of words(synonyms[key]!)) {
        const t = term(word);
        if (t && !own.includes(t)) expansions.add(t);
      }
      rest = rest.replace(` ${key} `, " ");
    }
  return { own, expansions: [...expansions], folded: folded.trim() };
}

export type LexicalHit = {
  id: string;
  score: number;
  /** Document words the query matched, as stored (stems), for highlighting. */
  terms: string[];
};

export type LexicalIndex = ReturnType<typeof createLexicalIndex>;

const FIELDS = ["title", "names", "codes", "snippet", "body"] as const;
const BOOST = { title: 4, names: 2, codes: 3, snippet: 1.5, body: 1 };

/** The index, filled at once (the API, scripts and tests). */
export function createLexicalIndex(docs: readonly SearchDoc[]) {
  const { index, searcher } = emptyIndex(docs);
  index.addAll(docs as SearchDoc[]);
  return searcher;
}

/** The index, filled in small chunks that yield to the page between them
 * (the browser: a library that opens never waits for its search index). */
export async function loadLexicalIndex(docs: readonly SearchDoc[]) {
  const { index, searcher } = emptyIndex(docs);
  await index.addAllAsync(docs as SearchDoc[], { chunkSize: 100 });
  return searcher;
}

function emptyIndex(docs: readonly SearchDoc[]) {
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const index = new MiniSearch<SearchDoc>({
    fields: [...FIELDS],
    storeFields: [],
    extractField: (doc, field) =>
      field === "codes" || field === "names"
        ? doc[field].join(field === "codes" ? " " : ". ")
        : String(doc[field as keyof SearchDoc] ?? ""),
    tokenize: (text, field) =>
      field === "codes" ? fold(text).split(/\s+/).filter(Boolean) : words(text),
    processTerm: (word) => term(word),
    searchOptions: { tokenize: words, processTerm: (word) => term(word) },
  });
  const titles = new Map(
    docs.map((doc) => [doc.id, ` ${words(doc.title).join(" ")} `]),
  );

  /** Ranked hits for a query, best first. `strand` limits to one math area
   * (glossary terms, which have none, always stay). */
  function search(
    query: string,
    { strand = "", limit = 200 }: { strand?: string; limit?: number } = {},
  ): LexicalHit[] {
    const { own, expansions, folded } = parseQuery(query);
    if (!own.length && !expansions.length) return [];
    const last = own[own.length - 1];
    const options = {
      boost: BOOST,
      combineWith: "OR" as const,
      // The word being typed is a prefix; finished words may have a typo.
      prefix: (t: string) => t === last && t.length >= 2,
      fuzzy: (t: string) =>
        CODE.test(t) ? false : t.length >= 7 ? 2 : t.length >= 4 ? 1 : false,
      maxFuzzy: 2,
      weights: { fuzzy: 0.35, prefix: 0.6 },
      filter: (result: SearchResult) => {
        const doc = byId.get(result.id as string)!;
        if (strand && doc.strand && doc.strand !== strand) return false;
        // A math word is found by its name, not by a word its definition
        // happens to use.
        return (
          doc.kind !== "term" ||
          Object.values(result.match).some((fields) =>
            fields.some((field) => field === "title" || field === "names"),
          )
        );
      },
    };
    const ownSet = new Set(own);
    const results = index.search(
      {
        combineWith: "OR",
        queries: [
          ...(own.length ? [{ ...options, queries: own }] : []),
          ...(expansions.length
            ? [
                {
                  ...options,
                  queries: expansions,
                  prefix: false,
                  fuzzy: false,
                  boostTerm: () => 0.45,
                },
              ]
            : []),
        ],
      } as never,
      options,
    );
    const phrase = folded.length >= 4 ? ` ${folded}` : "";
    return results
      .map((result) => {
        const matched = result.queryTerms.filter((t) => ownSet.has(t)).length;
        // Coordination: a document that matches more of what was typed
        // ranks above one that matches a single word many times.
        let score =
          result.score * ((1 + matched) / (1 + Math.max(1, own.length)));
        const title = titles.get(result.id as string)!;
        if (phrase && title.includes(phrase)) score *= 1.6;
        if (phrase && title.startsWith(phrase)) score *= 1.25;
        return {
          id: result.id as string,
          score,
          terms: [...new Set(result.terms)],
        };
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
  return { index, searcher: { search, docs: byId } };
}

/** Character ranges of `text` to mark: words whose stored form is one of
 * the matched `terms`. */
export function highlights(
  text: string,
  terms: readonly string[],
): [number, number][] {
  if (!terms.length) return [];
  const wanted = new Set(terms);
  const ranges: [number, number][] = [];
  const word = /[\p{L}\p{N}]+/gu;
  for (let match = word.exec(text); match; match = word.exec(text)) {
    const t = term(fold(match[0]));
    if (t && wanted.has(t))
      ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}
