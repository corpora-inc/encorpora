/**
 * Embeds every search document (src/search/corpus.ts) with the pinned model
 * and writes the int8 vectors the API serves from
 * (`models/search/index`). The image build runs it after fetching the
 * model; run it locally after content changes to skip the API's
 * background embedding. Fetches the model first if it is missing.
 *
 *   npm run build:search
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { embeddingText } from "../src/search/corpus";
import { loadEmbedder } from "../src/search/embedder";
import { modelDir } from "../src/search/model";
import { sourceCorpus } from "../src/search/source-corpus";
import { quantize, writeVectors } from "../src/search/vectors";

const started = performance.now();
if (!existsSync(`${modelDir}/model_quantized.onnx`))
  execFileSync(
    process.execPath,
    [new URL("./fetch-search-model.mjs", import.meta.url).pathname, modelDir],
    { stdio: "inherit" },
  );
const docs = sourceCorpus();
const embedder = await loadEmbedder();
const rows: Parameters<typeof writeVectors>[0] = [];
// Similar lengths batch together, so little of each batch is padding.
const order = [...docs].sort(
  (a, b) => embeddingText(a).length - embeddingText(b).length,
);
for (let start = 0; start < order.length; start += 32) {
  const batch = order.slice(start, start + 32);
  const vectors = await embedder.embed(batch.map(embeddingText));
  batch.forEach((doc, i) => rows.push({ doc, vector: quantize(vectors[i]!) }));
}
await embedder.close();
await writeVectors(rows);
console.log(
  `search index: ${rows.length} documents in ${Math.round(performance.now() - started)} ms`,
);
