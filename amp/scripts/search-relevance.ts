/**
 * The search relevance set (src/search/relevance-set.ts), scored three ways:
 * the library filter that shipped before this search, the lexical index
 * alone, and the blend with nearest neighbours (when the model and vectors
 * are built: `npm run build:search`). Prints hit@3 for each.
 *
 *   npx tsx scripts/search-relevance.ts [--verbose]
 */
import { sourceCorpus } from "../src/search/source-corpus";
import { createLexicalIndex } from "../src/search/lexical";
import { relevanceSet } from "../src/search/relevance-set";
import {
  attachTerms,
  buildLibrary,
  matchingTerms,
  visibleIds,
} from "../src/web/lib/lesson-library";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import { lessons } from "../src/content/lessons";
import { glossary } from "../src/glossary";
import { bands } from "../src/web/features/pathways/model";
import { strandNames } from "../src/web/BirthYearPrompt";
import { loadSemanticSearch } from "../src/server/search";
import { groupTops } from "../src/search/blend";

const verbose = process.argv.includes("--verbose");
const docs = sourceCorpus();
const lexical = createLexicalIndex(docs);

/** The old library's first three rows: its math words, then rows in band,
 * then title (lessons) and area (problem types) order. */
const library = attachTerms(
  buildLibrary(lessons, templates, skills, bands),
  glossary,
);
function before(query: string) {
  const shown = visibleIds(library, query, "");
  const rank = (band: string) => bands.indexOf(band);
  const strands = Object.keys(strandNames);
  const rows = library
    .filter((item) => shown.has(`${item.kind}:${item.id}`))
    .sort(
      (a, b) =>
        rank(a.band) - rank(b.band) ||
        (a.kind === b.kind ? 0 : a.kind === "lesson" ? -1 : 1) ||
        (a.kind === "type"
          ? strands.indexOf(a.strand) - strands.indexOf(b.strand)
          : 0) ||
        a.title.localeCompare(b.title),
    )
    .map((item) => `${item.kind}:${item.id}`);
  return [
    ...matchingTerms(glossary, query).map((entry) => `term:${entry.id}`),
    ...rows,
  ];
}

const semantic = await loadSemanticSearch(docs).catch((error: unknown) => {
  console.error("Semantic search unavailable:", (error as Error).message);
  return null;
});
const engines: [string, (q: string) => Promise<string[]> | string[]][] = [
  ["before (library filter)", before],
  ["lexical", (q) => lexical.search(q).map((hit) => hit.id)],
];
if (semantic)
  engines.push([
    "blended (lexical + nearest neighbour)",
    async (q) => (await semantic.search(q)).map((hit) => hit.id),
  ]);
// A hit: an expected document among the first three of its group, as the
// grouped results show them; the overall top three is reported beside it.
for (const [name, run] of engines) {
  let grouped = 0,
    overall = 0;
  const misses: string[] = [];
  for (const { query, expect } of relevanceSet) {
    const ranked = await run(query);
    const tops = groupTops(ranked);
    if (ranked.slice(0, 3).some((id) => expect.includes(id))) overall++;
    if (tops.some((id) => expect.includes(id))) grouped++;
    else misses.push(`  ✗ ${query} → ${tops.join(", ") || "(nothing)"}`);
  }
  const pct = (n: number) => Math.round((100 * n) / relevanceSet.length);
  console.log(
    `${name}: ${grouped}/${relevanceSet.length} (${pct(grouped)}%) hit@3 by group; ${overall}/${relevanceSet.length} (${pct(overall)}%) overall`,
  );
  if (verbose && misses.length) console.log(misses.join("\n"));
}
semantic?.close();
