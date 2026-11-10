import {
  memo,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { segments } from "../../../content/math-segments";
import { searchGroups, type SearchGroupId } from "../../../search/corpus";
import { highlights } from "../../../search/lexical";
import { MathText } from "../../MathText";
import { bandLabel } from "../pathways/model";
import type { SearchResult } from "../../lib/lesson-search";
import styles from "./SearchResults.module.css";

/** Rows each group shows before "Show more". */
const FIRST: Record<SearchGroupId, number> = {
  lessons: 8,
  skills: 4,
  glossary: 3,
};
const KIND_LABEL = {
  lesson: "Lesson",
  type: "Problem type",
  film: "Lesson film",
  skill: "Skill",
  term: "Math word",
} as const;

export type SearchActions = {
  /** The URL a result opens, for its link. */
  href: (result: SearchResult) => string;
  open: (result: SearchResult, trigger: HTMLElement) => void;
};

/** Text with the matched words marked. Formulas render as math, unmarked. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length || segments(text).some((segment) => segment.math))
    return <MathText text={text} />;
  const ranges = highlights(text, terms);
  if (!ranges.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(<mark key={start}>{text.slice(start, end)}</mark>);
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

/** Moves focus through the result links with the arrow keys; Up from the
 * first, or Escape, returns to the search field. */
export function resultKeys(
  event: KeyboardEvent<HTMLElement>,
  input: RefObject<HTMLInputElement | null>,
  list: RefObject<HTMLElement | null>,
) {
  const links = [
    ...(list.current?.querySelectorAll<HTMLElement>("[data-result]") ?? []),
  ];
  const at = links.indexOf(document.activeElement as HTMLElement);
  const fromInput = event.target === input.current;
  let next: HTMLElement | null | undefined;
  if (event.key === "ArrowDown") next = fromInput ? links[0] : links[at + 1];
  else if (event.key === "ArrowUp" && !fromInput)
    next = at <= 0 ? input.current : links[at - 1];
  else if (event.key === "Home" && !fromInput) next = links[0];
  else if (event.key === "End" && !fromInput) next = links[links.length - 1];
  else if (event.key === "Escape" && !fromInput) next = input.current;
  if (!next) return;
  event.preventDefault();
  next.focus();
  next.scrollIntoView({ block: "nearest" });
}

export const SearchResults = memo(function SearchResults({
  results,
  pending,
  actions,
}: {
  results: readonly SearchResult[];
  pending: boolean;
  actions: SearchActions;
}) {
  // Groups opened past their first rows; a new set of results starts closed.
  const [more, setMore] = useState<{
    results: readonly SearchResult[];
    open: ReadonlySet<SearchGroupId>;
  }>({ results, open: new Set() });
  const open: ReadonlySet<SearchGroupId> =
    more.results === results ? more.open : new Set();
  return (
    <div className={styles.results} aria-busy={pending} data-search-results="">
      {searchGroups.map((group) => {
        // A problem type's lesson plays its film, so a film whose problem
        // type is listed rides on that row instead of repeating its title.
        const types = new Set(
          results.filter((r) => r.kind === "type").map((r) => r.target),
        );
        const films = new Set(
          results.filter((r) => r.kind === "film").map((r) => r.target),
        );
        const rows = results.filter(
          (result) =>
            result.group === group.id &&
            !(result.kind === "film" && types.has(result.target)),
        );
        if (!rows.length) return null;
        const shown = open.has(group.id)
          ? rows
          : rows.slice(0, FIRST[group.id]);
        const headingId = `search-group-${group.id}`;
        return (
          <section key={group.id} className={styles.group}>
            <h2 id={headingId} className={styles.heading}>
              {group.label}
            </h2>
            <ul
              className={group.id === "glossary" ? styles.terms : styles.rows}
              aria-labelledby={headingId}
            >
              {shown.map((result) =>
                result.kind === "term" ? (
                  <li key={result.id} className={styles.term}>
                    <strong>
                      <Marked text={result.title} terms={result.terms} />
                    </strong>{" "}
                    <MathText text={result.snippet} />
                  </li>
                ) : (
                  <li key={result.id}>
                    <a
                      className={styles.row}
                      href={actions.href(result)}
                      data-result=""
                      {...(result.kind === "lesson"
                        ? { "data-lesson-id": result.target }
                        : result.kind === "type"
                          ? { "data-template": result.target }
                          : {})}
                      data-strand={result.strand || undefined}
                      onClick={(event) => {
                        // A new tab or window follows the link itself.
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey ||
                          event.button !== 0
                        )
                          return;
                        event.preventDefault();
                        actions.open(result, event.currentTarget);
                      }}
                    >
                      <span className={styles.title}>
                        <Marked text={result.title} terms={result.terms} />
                      </span>
                      {result.snippet && (
                        <span className={styles.snippet}>
                          <Marked text={result.snippet} terms={result.terms} />
                        </span>
                      )}
                      <span className={styles.meta}>
                        {result.strand && (
                          <span
                            className={styles.dot}
                            style={{
                              background: `var(--color-strand-${result.strand}, var(--color-border-strong))`,
                            }}
                            aria-hidden="true"
                          />
                        )}
                        <span>
                          {KIND_LABEL[result.kind]}
                          {result.kind === "type" &&
                            films.has(result.target) &&
                            " · with film"}
                        </span>
                        {result.band && <span>{bandLabel(result.band)}</span>}
                        {result.codes[0] && <span>{result.codes[0]}</span>}
                      </span>
                    </a>
                  </li>
                ),
              )}
            </ul>
            {rows.length > shown.length && (
              <button
                type="button"
                className={styles.more}
                onClick={() =>
                  setMore({
                    results,
                    open: new Set<SearchGroupId>([
                      ...(open as ReadonlySet<SearchGroupId>),
                      group.id,
                    ]),
                  })
                }
              >
                Show {rows.length - shown.length} more{" "}
                {group.id === "lessons"
                  ? "lessons"
                  : group.id === "skills"
                    ? "skills"
                    : "math words"}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
});
