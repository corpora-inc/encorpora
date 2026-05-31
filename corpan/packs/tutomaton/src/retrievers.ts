/**
 * Static retriever registry.
 *
 * The pack ships as a single IIFE bundle (vite lib mode), so per-language
 * retrievers CANNOT be loaded with a runtime `import()` — there is no module
 * graph to resolve at runtime, the source is uncompiled TS, and the specifier
 * would resolve against the host's game-proxy origin (→ 404). Instead we bundle
 * every language's retriever statically here; vite inlines the code AND any data
 * JSON they import (e.g. es/data/core_vocab.json). Retriever code is tiny (KB);
 * only the per-language sqlite (queried via hostApi.queryPackDb) and the
 * prompt/module files stay external and lazily fetched.
 *
 * Contract every language retriever module must satisfy:
 *   retrieve(text, queryFn): Promise<RetrievalResult>
 *   resolveTheme(key, queryFn): Promise<string | null>
 *
 * Adding a language = author its module + add one import line here.
 */

import type { QueryFn, RetrievalResult } from "./languageManager"

export type RetrieverModule = {
  retrieve: (text: string, queryFn: QueryFn) => Promise<RetrievalResult>
  resolveTheme: (key: string, queryFn: QueryFn) => Promise<string | null>
}

import * as es from "../languages/es/retrieval/retriever"
import * as zh from "../languages/zh/retrieval/retriever"

/**
 * Code-bundled retrievers, keyed by language code. The cast is safe: each
 * module's `retrieve`/`resolveTheme` match the contract structurally (es returns
 * RagResult, a superset of RetrievalResult; zh returns the same shape).
 */
export const RETRIEVERS: Record<string, RetrieverModule> = {
  es: es as unknown as RetrieverModule,
  zh: zh as unknown as RetrieverModule,
}
