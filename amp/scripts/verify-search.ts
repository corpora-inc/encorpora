/**
 * The image's search works offline: the vendored model loads, every
 * document has its precomputed vector, a question with no shared words
 * finds its lessons, and a query stays fast (p95 budget 50 ms).
 * The API image build runs this with no network.
 *
 *   npx tsx scripts/verify-search.ts
 */
import assert from "node:assert/strict";
import { loadSemanticSearch } from "../src/server/search";

const warnings: string[] = [];
const search = await loadSemanticSearch(undefined, {
  log: {
    info: () => {},
    warn: (message: string) => warnings.push(message),
    error: (message: string) => warnings.push(message),
  },
});
assert.ok(
  search.semantic,
  `the search model did not load: ${warnings.join("; ")}`,
);
assert.deepEqual(warnings, [], "every document has a current vector");
const pizza = await search.search("how do I split a pizza fairly");
assert.ok(
  pizza
    .slice(0, 10)
    .some((hit) =>
      /half|halves|share|equal|part/i.test(search.docs.get(hit.id)!.title),
    ),
  `pizza finds equal shares: ${pizza
    .slice(0, 5)
    .map((hit) => hit.id)
    .join(", ")}`,
);
const queries = [
  "numbers and",
  "times tables",
  "how do i share cookies",
  "slope of a line",
  "what is a prime number",
];
const times: number[] = [];
for (let i = 0; i < 100; i++) {
  // A new query each time: the embedding cache must not hide the cost.
  const query = `${queries[i % queries.length]} ${i}`;
  const started = performance.now();
  await search.search(query);
  times.push(performance.now() - started);
}
times.sort((a, b) => a - b);
const p50 = times[49]!,
  p95 = times[94]!;
console.log(
  `search: p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms over 100 new queries, ${search.docs.size} documents`,
);
// The budget is 50 ms (measured about 5 ms on an idle machine). The image
// build fails only far past it, so a busy build host cannot block a deploy.
if (p95 >= 50)
  console.warn(`search p95 ${p95.toFixed(1)} ms is over its 50 ms budget`);
assert.ok(
  p95 < 250,
  `search p95 ${p95.toFixed(1)} ms: the model is not running as built`,
);
await search.close();
