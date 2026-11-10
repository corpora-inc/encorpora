/**
 * Lesson search in the browser. Results come at once from the lexical index
 * built here from the catalog and glossary (src/search/lexical.ts); after a
 * short pause the API's blend with nearest neighbours replaces them
 * (`GET /api/v1/search`). Offline, or when the API fails, the lexical
 * results stay, and the failure is logged.
 */
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { blend } from "../../search/blend";
import {
  groupOf,
  type SearchDoc,
  type SearchGroupId,
  type SearchKind,
} from "../../search/corpus";
import { createLexicalIndex } from "../../search/lexical";
import { request } from "./api";

const resultSchema = z.object({
  id: z.string(),
  kind: z.enum(["lesson", "type", "film", "skill", "term"]),
  target: z.string(),
  title: z.string(),
  snippet: z.string(),
  band: z.string(),
  strand: z.string(),
  codes: z.array(z.string()),
  terms: z.array(z.string()),
});
const responseSchema = z.object({
  semantic: z.boolean(),
  results: z.array(resultSchema),
});
export type SearchResult = z.infer<typeof resultSchema> & {
  group: SearchGroupId;
};

/** Wait this long after typing pauses before asking the API. */
const REMOTE_AFTER_MS = 150;
const remembered = new Map<string, SearchResult[]>();

const view = (doc: SearchDoc, terms: string[]): SearchResult => ({
  id: doc.id,
  kind: doc.kind,
  group: groupOf(doc.kind),
  target: doc.target,
  title: doc.title,
  snippet: doc.snippet,
  band: doc.band,
  strand: doc.strand,
  codes: doc.codes.slice(0, 3),
  terms,
});

export function useLessonSearch(
  docs: readonly SearchDoc[],
  query: string,
  strand: string,
) {
  const index = useMemo(() => createLexicalIndex(docs), [docs]);
  const local = useMemo(
    () =>
      query
        ? blend(index.search(query, { strand }), []).map((hit) =>
            view(index.docs.get(hit.id)!, hit.terms),
          )
        : [],
    [index, query, strand],
  );
  const key = `${strand}\u0000${query}`;
  const [remote, setRemote] = useState<{
    key: string;
    results: SearchResult[];
  } | null>(null);
  const [waiting, setWaiting] = useState("");
  useEffect(() => {
    if (query.length < 2) return;
    const known = remembered.get(key);
    if (known) {
      setRemote({ key, results: known });
      return;
    }
    const controller = new AbortController();
    setWaiting(key);
    const timer = setTimeout(() => {
      const search = new URLSearchParams({ q: query });
      if (strand) search.set("strand", strand);
      request(`/search?${search}`, responseSchema, {
        signal: controller.signal,
      })
        .then(({ results }) => {
          const shown = results.map((result) => ({
            ...result,
            group: groupOf(result.kind as SearchKind),
          }));
          remembered.set(key, shown);
          if (remembered.size > 200)
            remembered.delete(remembered.keys().next().value!);
          setRemote({ key, results: shown });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          // The lexical results already shown stay; say why in the log.
          console.error("Lesson search is answering from this device", error);
        })
        .finally(() => {
          if (!controller.signal.aborted)
            setWaiting((current) => (current === key ? "" : current));
        });
    }, REMOTE_AFTER_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, query, strand]);
  const results = remote?.key === key ? remote.results : local;
  return { results, pending: waiting === key };
}
