/**
 * The one search (docs/design/ia.md): the field, the hook and the result
 * actions every screen with a search shares (Pathways, Inventory). Results
 * come from `GET /api/v1/search` (lexical + nearest neighbours), with the
 * device's lexical index answering while the API is on its way
 * (lib/lesson-search.ts). Every screen shows the same groups (Skills,
 * Lessons, Glossary) through `SearchResults`.
 */
import { useRef, type KeyboardEvent, type RefObject } from "react";
import { useLessonSearch, type SearchResult } from "../../lib/lesson-search";
import { shareableHref, useLayers } from "../../nav/links";
import { pushed } from "../../nav/layer-store";
import { SearchField } from "../../ui/SearchField";
import { resultKeys, type SearchActions } from "./SearchResults";
import { useSearchCorpus } from "./search-corpus";
import type { SearchDoc } from "../../../search/corpus";
import styles from "./SiteSearch.module.css";

/** Results for a query, once something is typed. */
export function useSiteSearch(query: string) {
  const text = query.trim();
  const docs = useSearchCorpus(text.length > 0);
  const found = useLessonSearch(docs, text, "");
  return { docs, ...found };
}

/** The skill a result belongs to. An older server's result carries none:
 * this page's own corpus knows every document's. */
export const skillOf = (
  result: SearchResult,
  docs: readonly SearchDoc[] | undefined,
) => result.skill || docs?.find((doc) => doc.id === result.id)?.skill || "";

/**
 * Every result opens its skill where this screen opens skills: as a layer
 * over the screen, through its layer store (nav/layer-store.ts). The link
 * (a new tab, a copied address) opens the screen with that layer on top.
 * A screen that does more as it opens one (Pathways frames it on the map)
 * passes `open`.
 */
export function useSearchActions(
  docs: readonly SearchDoc[],
  open?: (result: SearchResult, skill: string) => void,
): SearchActions {
  const layers = useLayers();
  return {
    href: (result) => {
      const skill = skillOf(result, docs);
      return shareableHref(
        window.location.pathname,
        window.location.search,
        skill ? pushed(layers.stack, { kind: "skill", id: skill }) : layers.stack,
      );
    },
    open: (result) => {
      const skill = skillOf(result, docs);
      if (!skill) return;
      if (open) open(result, skill);
      else layers.open({ kind: "skill", id: skill });
    },
  };
}

/** Arrow keys between the field and the result links (`resultKeys`). */
export function useResultKeys() {
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  return {
    input,
    list,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
      resultKeys(event, input, list),
  };
}

/** The search field: magnifier, clear, the URL following the text. */
export function SiteSearchField({
  field,
  className,
  inputRef,
  onFocus,
  onEscape,
  onKeyDown,
  onChange,
}: {
  field: {
    text: string;
    change: (value: string) => void;
    flush: () => void;
  };
  className?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onFocus?: () => void;
  /** Escape's job (close the results); else Escape clears. */
  onEscape?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Besides changing the text (open the results). */
  onChange?: () => void;
}) {
  return (
    <SearchField
      label="Search"
      placeholder="Search"
      searchbox
      className={`${styles.field} ${className ?? ""}`}
      maxLength={100}
      value={field.text}
      inputRef={inputRef}
      onChange={(value) => {
        onChange?.();
        field.change(value);
      }}
      onFocus={onFocus}
      onBlur={field.flush}
      onEnter={field.flush}
      onEscape={onEscape}
      onKeyDown={onKeyDown}
    />
  );
}
