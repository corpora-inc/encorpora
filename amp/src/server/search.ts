/**
 * `GET /api/v1/search?q=&strand=`: lexical search blended with nearest
 * neighbours. The query is embedded in-process by the vendored model
 * (src/search/model.ts) and compared with every document's precomputed
 * int8 vector (`npm run build:search`, run by the image build). Nothing is
 * downloaded at runtime. Without the model or the vectors the endpoint
 * still answers, lexically, and says so (`semantic: false`); every failure
 * is logged.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { embeddingText, groupOf, type SearchDoc } from "../search/corpus";
import { createLexicalIndex } from "../search/lexical";
import { blend, NEIGHBOUR_FLOOR } from "../search/blend";
import { loadEmbedder, type Embedder } from "../search/embedder";
import { searchModel } from "../search/model";
import { quantize, readVectors, textHash } from "../search/vectors";
import { sourceCorpus } from "../search/source-corpus";

export type SemanticSearch = Awaited<ReturnType<typeof loadSemanticSearch>>;

/**
 * Loads the corpus, its lexical index, and (when present) the model and the
 * document vectors. Documents whose vectors are missing or stale (a source
 * change without `npm run build:search`) are embedded in the background.
 */
export async function loadSemanticSearch(
  docs: readonly SearchDoc[] = sourceCorpus(),
  { log = console }: { log?: Pick<Console, "info" | "error" | "warn"> } = {},
) {
  const lexical = createLexicalIndex(docs);
  const { dims } = searchModel;
  const vectors = new Int8Array(docs.length * dims);
  const ready = new Uint8Array(docs.length);
  let embedder: Embedder | null = null;
  try {
    embedder = await loadEmbedder();
  } catch (error) {
    log.error(
      `Search model unavailable; search is lexical only: ${(error as Error).message}`,
    );
  }
  if (embedder) {
    try {
      const { meta, data } = await readVectors();
      const row = new Map(meta.docs.map((doc, i) => [doc.id, i]));
      docs.forEach((doc, i) => {
        const at = row.get(doc.id);
        if (at === undefined || meta.docs[at]!.hash !== textHash(doc)) return;
        vectors.set(data.subarray(at * dims, (at + 1) * dims), i * dims);
        ready[i] = 1;
      });
    } catch (error) {
      log.error(
        `Search vectors unavailable; embedding every document: ${(error as Error).message}`,
      );
    }
  }
  const missing = docs.flatMap((_, i) => (ready[i] ? [] : [i]));
  if (embedder && missing.length) {
    log.warn(
      `Search vectors: ${missing.length} of ${docs.length} documents are new or changed; embedding them now`,
    );
    const model = embedder;
    void (async () => {
      for (let start = 0; start < missing.length; start += 16) {
        const batch = missing.slice(start, start + 16);
        const embedded = await model.embed(
          batch.map((i) => embeddingText(docs[i]!)),
        );
        batch.forEach((i, k) => {
          vectors.set(quantize(embedded[k]!), i * dims);
          ready[i] = 1;
        });
        // Yield between batches so requests are never held behind this.
        await new Promise((resolve) => setImmediate(resolve));
      }
    })().catch((error: unknown) =>
      log.error(`Search vectors could not be completed: ${String(error)}`),
    );
  }

  // Recent query embeddings: typing pauses repeat queries often.
  const cache = new Map<string, Float32Array>();
  async function embedQuery(query: string) {
    const key = query.trim().toLowerCase();
    let vector = cache.get(key);
    if (!vector) {
      [vector] = await embedder!.embed([key]);
      cache.set(key, vector!);
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
    }
    return vector!;
  }

  function neighbours(query: Float32Array, strand: string) {
    const found: { id: string; similarity: number }[] = [];
    for (let i = 0; i < docs.length; i++) {
      if (!ready[i]) continue;
      const doc = docs[i]!;
      if (strand && doc.strand && doc.strand !== strand) continue;
      let dot = 0;
      const offset = i * dims;
      for (let d = 0; d < dims; d++) dot += query[d]! * vectors[offset + d]!;
      const similarity = dot / 127;
      if (similarity < NEIGHBOUR_FLOOR) continue;
      found.push({ id: doc.id, similarity });
    }
    return found.sort((a, b) => b.similarity - a.similarity);
  }

  async function search(
    query: string,
    { strand = "", perGroup = 20 }: { strand?: string; perGroup?: number } = {},
  ) {
    const lexicalHits = lexical.search(query, { strand });
    if (!embedder || query.trim().length < 3)
      return blend(lexicalHits, [], perGroup);
    try {
      return blend(
        lexicalHits,
        neighbours(await embedQuery(query), strand),
        perGroup,
      );
    } catch (error) {
      log.error(
        `Search embedding failed; answering lexically: ${String(error)}`,
      );
      return blend(lexicalHits, [], perGroup);
    }
  }
  return {
    search,
    docs: lexical.docs,
    get semantic() {
      return !!embedder;
    },
    close: () => embedder?.close(),
  };
}

const querySchema = z.object({
  q: z.string().trim().min(1).max(100),
  strand: z.string().max(40).optional(),
});

/** Registers the search route. The engine loads in the background; until it
 * is ready the route answers lexically from a corpus built on first use. */
export function registerSearch(app: FastifyInstance) {
  let engine: SemanticSearch | null = null;
  const loading = loadSemanticSearch(undefined, {
    log: {
      info: (message: string) => app.log.info(message),
      warn: (message: string) => app.log.warn(message),
      error: (message: string) => app.log.error(message),
    },
  }).then((loaded) => (engine = loaded));
  loading.catch((error: unknown) =>
    app.log.error({ err: error }, "Search could not be loaded"),
  );
  app.addHook("onClose", async () => {
    await (await loading.catch(() => null))?.close();
  });
  app.get("/api/v1/search", async (request, reply) => {
    const { q, strand = "" } = querySchema.parse(request.query);
    const ready = engine ?? (await loading);
    const started = performance.now();
    const hits = await ready.search(q, { strand });
    const tookMs = Math.round((performance.now() - started) * 10) / 10;
    reply.header("cache-control", "public, max-age=300");
    return {
      query: q,
      semantic: ready.semantic,
      tookMs,
      results: hits.map((hit) => {
        const doc = ready.docs.get(hit.id)!;
        return {
          id: doc.id,
          kind: doc.kind,
          group: groupOf(doc.kind),
          target: doc.target,
          title: doc.title,
          snippet: doc.snippet,
          band: doc.band,
          strand: doc.strand,
          codes: doc.codes.slice(0, 3),
          terms: hit.terms,
          score: Math.round(hit.score * 1000) / 1000,
        };
      }),
    };
  });
}
