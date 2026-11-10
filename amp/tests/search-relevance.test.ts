import assert from "node:assert/strict";
import test from "node:test";
import { sourceCorpus } from "../src/search/source-corpus";
import {
  createLexicalIndex,
  highlights,
  parseQuery,
  term,
  words,
} from "../src/search/lexical";
import { relevanceSet } from "../src/search/relevance-set";
import { synonyms } from "../src/search/synonyms";
import { blend, groupTops, NEIGHBOUR_FLOOR } from "../src/search/blend";

const docs = sourceCorpus();
const index = createLexicalIndex(docs);

test("every expected document in the relevance set exists", () => {
  const ids = new Set(docs.map((doc) => doc.id));
  const missing = relevanceSet.flatMap(({ query, expect }) =>
    expect.filter((id) => !ids.has(id)).map((id) => `${query}: ${id}`),
  );
  assert.deepEqual(missing, []);
});

test("lexical search finds the relevance set's answers in its top three", () => {
  // Results are shown grouped (Lessons, Skills, Glossary): a hit is an
  // expected document among the first three of its group. Measured 30 of 32
  // when written (the library filter it replaced: 15). The floor leaves room
  // for new lessons, not for a broken index.
  let hits = 0;
  const misses: string[] = [];
  for (const { query, expect } of relevanceSet) {
    const top = groupTops(index.search(query).map((hit) => hit.id));
    if (top.some((id) => expect.includes(id))) hits++;
    else misses.push(`${query} → ${top.join(", ")}`);
  }
  assert.ok(
    hits >= 26,
    `hit@3 ${hits}/${relevanceSet.length}; misses:\n${misses.join("\n")}`,
  );
});

test("the founder's partial query and typos still find lessons", () => {
  assert.ok(
    groupTops(index.search("numbers and").map((hit) => hit.id)).includes(
      "lesson:signed-numbers",
    ),
  );
  assert.ok(
    index
      .search("hypotenuze")
      .slice(0, 5)
      .some((hit) => hit.id === "term:hypotenuse"),
  );
  assert.deepEqual(index.search("zzzq"), []);
  assert.deepEqual(index.search("the and of"), []);
});

test("a standards code finds its documents, by prefix while typed", () => {
  const coded = (query: string) =>
    index
      .search(query)
      .slice(0, 5)
      .every((hit) =>
        docs
          .find((d) => d.id === hit.id)!
          .codes.some((c) => c.toLowerCase().startsWith(query.toLowerCase())),
      );
  assert.ok(coded("4.NF.B.3"));
  assert.ok(coded("4.NF"));
});

test("an area filter keeps that area and every glossary term", () => {
  const hits = index.search("fraction", { strand: "geometry" });
  assert.ok(hits.length > 0);
  for (const hit of hits) {
    const doc = docs.find((d) => d.id === hit.id)!;
    assert.ok(!doc.strand || doc.strand === "geometry", doc.id);
  }
});

test("every synonym leads to words the catalog uses", () => {
  const vocabulary = new Set(
    docs.flatMap((doc) =>
      words([doc.title, doc.snippet, doc.body, ...doc.names].join(" ")).map(
        (word) => term(word),
      ),
    ),
  );
  const unknown = Object.entries(synonyms).flatMap(([key, expansion]) =>
    words(expansion)
      .map(term)
      .filter((t): t is string => !!t && !vocabulary.has(t))
      .map((t) => `${key} → ${t}`),
  );
  assert.deepEqual(unknown, []);
  assert.deepEqual(parseQuery("PEMDAS").expansions, ["order", "operation"]);
});

test("matched words are marked where they appear", () => {
  const text = "Fractions on a number line";
  const marked = highlights(text, ["fraction", "line"]).map(([a, b]) =>
    text.slice(a, b),
  );
  assert.deepEqual(marked, ["Fractions", "line"]);
});

test("the blend ranks agreement first and ignores weak neighbours", () => {
  const ranked = blend(
    [
      { id: "lesson:a", score: 10, terms: ["slope"] },
      { id: "lesson:b", score: 9, terms: ["slope"] },
    ],
    [
      { id: "lesson:b", similarity: 0.7 },
      { id: "lesson:c", similarity: 0.6 },
      { id: "lesson:d", similarity: NEIGHBOUR_FLOOR - 0.01 },
    ],
  );
  assert.deepEqual(
    ranked.map((hit) => hit.id),
    ["lesson:b", "lesson:a", "lesson:c"],
  );
  assert.deepEqual(blend([], [{ id: "lesson:x", similarity: 0.2 }]), []);
});
