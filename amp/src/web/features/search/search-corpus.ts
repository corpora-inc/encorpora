import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Lesson } from "../../../content/lessons";
import { lessonFilms } from "../../../content/lesson-films";
import type { GlossaryEntry } from "../../../glossary/types";
import type { TemplateMetadata } from "../../../math/contracts";
import { buildCorpus, type SearchDoc } from "../../../search/corpus";
import { gradeOrder } from "../../BirthYearPrompt";
import { learningCatalog } from "../../learning-transport";

/** The search corpus outside the lessons library: the same catalog, lessons,
 * films and glossary, built once per session. Pathways' search is the one
 * search (docs/design/ia.md). */
type SearchCatalog = {
  templates: TemplateMetadata[];
  lessons: Lesson[];
  skills: {
    id: string;
    title: string;
    description: string;
    gradeBand: string;
    strand: string;
  }[];
};

let glossaryEntries: readonly GlossaryEntry[] | undefined;
let glossaryRequest: Promise<readonly GlossaryEntry[]> | undefined;
function loadSearchGlossary() {
  glossaryRequest ??= import("../../../glossary").then(
    (module) => (glossaryEntries = module.glossary),
    (error: unknown) => {
      glossaryRequest = undefined;
      console.error("Glossary could not be loaded for search", error);
      return [];
    },
  );
  return glossaryRequest;
}

let cache: { key: readonly unknown[]; docs: readonly SearchDoc[] } | undefined;

export function useSearchCorpus(enabled: boolean): readonly SearchDoc[] {
  const catalog = useQuery({
    queryKey: ["search-catalog"],
    queryFn: () => learningCatalog() as Promise<SearchCatalog>,
    staleTime: Infinity,
    enabled,
  }).data;
  const [glossary, setGlossary] = useState(glossaryEntries);
  useEffect(() => {
    if (!enabled || glossary) return;
    let current = true;
    void loadSearchGlossary().then((entries) => {
      if (current) setGlossary(entries);
    });
    return () => {
      current = false;
    };
  }, [enabled, glossary]);
  return useMemo(() => {
    if (!catalog) return [];
    const key = [catalog, glossary];
    if (cache?.key.every((part, i) => part === key[i])) return cache.docs;
    const docs = buildCorpus({
      lessons: catalog.lessons,
      templates: catalog.templates,
      skills: catalog.skills,
      terms: glossary ?? [],
      films: Object.values(lessonFilms),
      bandOrder: gradeOrder,
    });
    cache = { key, docs };
    return docs;
  }, [catalog, glossary]);
}
