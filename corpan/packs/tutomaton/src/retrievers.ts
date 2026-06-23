/**
 * Static retriever registry, keyed by SOURCE ID.
 *
 * The pack ships as a single IIFE bundle (vite lib mode), so source retrievers
 * CANNOT be loaded with a runtime `import()` — there is no module graph to
 * resolve at runtime, the source is uncompiled TS, and the specifier would
 * resolve against the host's game-proxy origin (→ 404). Instead we bundle every
 * built-in source's retriever statically here; vite inlines the code AND any
 * data JSON they import (e.g. es/.../core_vocab.json). Retriever code is tiny
 * (KB); only the per-source sqlite (queried via hostApi.queryPackDb) and the
 * per-language prompt files stay external and lazily fetched.
 *
 * Keyed by source id (e.g. `tutomaton-corpus-es-core-v1`), NOT language code —
 * a language can have N sources, and the SourceRegistry resolves each manifest
 * `sources[].id` to its retriever here. Contract every retriever satisfies:
 *   retrieve(text, queryFn): Promise<SourceRetrievalResult>   // OBJECT rows
 *   resolveTheme(key, queryFn): Promise<string | null>
 *
 * Adding a built-in source = author its module + add one import + one entry here
 * (and declare it in `manifest.json` languages[<code>].sources[]).
 *
 * Import paths point at the migrated source-pack layout
 * `languages/<code>/sources/core/retrieval/retriever` (RAG_SOURCES_CONTRACT §11,
 * paired with backend's atomic move). The keys below are source ids.
 */

import type { QueryFn, RetrieverHelpers, SourceRetrievalResult } from "./languageManager"

export type RetrieverModule = {
  retrieve: (text: string, queryFn: QueryFn, helpers?: RetrieverHelpers) => Promise<SourceRetrievalResult>
  resolveTheme: (key: string, queryFn: QueryFn) => Promise<string | null>
}

import * as es from "../languages/es/sources/core/retrieval/retriever"
import * as zh from "../languages/zh/sources/core/retrieval/retriever"
import * as en from "../languages/en/sources/core/retrieval/retriever"
import * as fr from "../languages/fr/sources/core/retrieval/retriever"
import * as de from "../languages/de/sources/core/retrieval/retriever"
import * as ja from "../languages/ja/sources/core/retrieval/retriever"
import * as phraseBridge from "../sources/phrase-bridge/retriever"

/**
 * Built-in source retrievers, keyed by source id. The cast is safe: each
 * module's `retrieve`/`resolveTheme` match the contract structurally.
 *
 * Per-language `core` sources live today (declared in manifest sources[] +
 * present in the databases map): es, zh. en/fr/de/ja retrievers are bundled +
 * ready; switch each on by adding its manifest sources[] entry once its corpus
 * data is verified — no code change here beyond the entry already present below.
 *
 * `tutomaton-phrase-bridge-v1` is a §7 UNIVERSAL source — declared at the pack
 * manifest top level under `universalSources[]`, applies to every target
 * language, receives pattern-A `helpers` carrying phrasePacks + queryPackDb so
 * it can ground tutors in the user's already-installed phrase packs.
 */
export const RETRIEVERS: Record<string, RetrieverModule> = {
  "tutomaton-corpus-es-core-v1": es as unknown as RetrieverModule,
  "tutomaton-corpus-zh-core-v1": zh as unknown as RetrieverModule,
  "tutomaton-corpus-en-core-v1": en as unknown as RetrieverModule,
  "tutomaton-corpus-fr-core-v1": fr as unknown as RetrieverModule,
  "tutomaton-corpus-de-core-v1": de as unknown as RetrieverModule,
  "tutomaton-corpus-ja-core-v1": ja as unknown as RetrieverModule,
  "tutomaton-phrase-bridge-v1": phraseBridge as unknown as RetrieverModule,
}
