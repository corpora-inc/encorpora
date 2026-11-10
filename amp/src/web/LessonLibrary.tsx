import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useAppRoute } from "./app-routes";
import type { TemplateMetadata } from "../math/contracts";
import type { Lesson } from "../content/lessons";
import type { GlossaryEntry } from "../glossary/types";
import { gradeOrder, strandNames } from "./BirthYearPrompt";
import {
  CurriculumDetailsControl,
  useCurriculumDetails,
} from "./features/curriculum/CurriculumDetails";
import { bandLabel } from "./features/pathways/model";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { Loading } from "./ui/Loading";
import { MathText } from "./MathText";
import {
  attachTerms,
  buildLibrary,
  visibleIds,
  type LibraryItem,
} from "./lib/lesson-library";
import { useUrlSearchText } from "./lib/url-search-text";
import { lessonFilms } from "../content/lesson-films";
import { buildCorpus, type SearchDoc } from "../search/corpus";
import { useLessonSearch, type SearchResult } from "./lib/lesson-search";
import {
  resultKeys,
  SearchResults,
  type SearchActions,
} from "./features/search/SearchResults";
import styles from "./LessonLibrary.module.css";

export type LibrarySkillRow = {
  id: string;
  gradeBand: string;
  strand: string;
  title?: string;
  description?: string;
};

// Glossary terms are part of the search index. They load with the catalog
// (the placeholder below asks for them), so the first results of a search
// already include its math words: nothing is inserted above them later.
let glossaryEntries: readonly GlossaryEntry[] | undefined;
let glossaryRequest: Promise<readonly GlossaryEntry[]> | undefined;
/** Fetches the search glossary once; the app asks with the catalog. */
export function loadGlossary() {
  glossaryRequest ??= import("../glossary").then(
    (module) => (glossaryEntries = module.glossary),
    (error: unknown) => {
      // Titles and summaries still search; the next visit asks again.
      glossaryRequest = undefined;
      console.error("Glossary could not be loaded for search", error);
      return [];
    },
  );
  return glossaryRequest;
}

// The search corpus, built once per catalog and glossary (they keep their
// identity for the session), so returning to Lessons is instant.
let corpusCache:
  { key: readonly unknown[]; docs: readonly SearchDoc[] } | undefined;
function searchCorpus(
  references: readonly Lesson[],
  templates: readonly TemplateMetadata[],
  skills: readonly LibrarySkillRow[],
  glossary: readonly GlossaryEntry[],
) {
  const key = [references, templates, skills, glossary];
  if (corpusCache?.key.every((part, i) => part === key[i]))
    return corpusCache.docs;
  const docs = buildCorpus({
    lessons: references,
    templates,
    skills,
    terms: glossary,
    films: Object.values(lessonFilms),
    bandOrder: gradeOrder,
  });
  corpusCache = { key, docs };
  return docs;
}

type LibraryProps = {
  templates: readonly TemplateMetadata[];
  skills: readonly LibrarySkillRow[];
  references: readonly Lesson[];
  openReference: (lesson: Lesson, trigger: HTMLElement) => void;
  openTopic: (templateId: string) => void;
};

/**
 * `/lessons`: every reference lesson and every problem type's short lesson,
 * grouped by curriculum band, filtered by math area and found by instant
 * search. The query and area live in the URL (`?q=`, `?strand=`), so
 * refresh, Back and a shared link restore the same results. The field owns
 * its text while typing and the URL follows after a pause, so a keystroke
 * never waits on the router. Rows stay mounted and are hidden, not removed,
 * and each row re-renders only when its own visibility changes.
 * The library opens once its whole index (catalog and glossary) is here.
 */
export function LessonLibrary(props: LibraryProps) {
  const [glossary, setGlossary] = useState(glossaryEntries);
  useEffect(() => {
    if (glossary) return;
    let current = true;
    void loadGlossary().then((entries) => {
      if (current) setGlossary(entries);
    });
    return () => {
      current = false;
    };
  }, [glossary]);
  return glossary ? (
    <Library {...props} glossary={glossary} />
  ) : (
    <LessonLibraryPlaceholder />
  );
}

/**
 * Lessons before its catalog: the title, the search row and the count line
 * in the places the library paints them, so nothing moves when it lands. A
 * failed catalog says so in the search row's place, with Try again.
 */
export function LessonLibraryPlaceholder({
  retry,
}: {
  /** Present when the catalog failed: requests it again. */
  retry?: () => Promise<unknown>;
}) {
  useEffect(() => void loadGlossary(), []);
  return (
    <section
      className={`lesson-index ${styles.library}`}
      aria-label="Lessons"
      aria-busy={!retry}
    >
      <h1 className={styles.title}>Lessons</h1>
      <div className={styles.body}>
        {retry ? (
          <LessonsUnavailable retry={retry} />
        ) : (
          <>
            <div
              className={`${styles.bar} amp-skeleton`}
              data-placeholder="search"
              aria-hidden="true"
            >
              <span className={styles.searchSlot} />
              <span className={styles.areaSlot} />
            </div>
            <CurriculumDetailsControl />
            <p className={styles.summary} role="status">
              <Loading inline>Opening lessons…</Loading>
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/** The catalog failed: what happened, and the one action that recovers. */
export function LessonsUnavailable({
  retry,
}: {
  retry: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  // Still here after a retry means it failed too: the words say so, and the
  // changed alert is announced again.
  const [again, setAgain] = useState(false);
  return (
    <div className={styles.unavailable}>
      <p role="alert">
        <strong>
          {again ? "Lessons still didn’t load." : "Lessons didn’t load."}
        </strong>{" "}
        Check your connection, then try again.
      </p>
      <Button
        variant="primary"
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void retry().finally(() => {
            setBusy(false);
            setAgain(true);
          });
        }}
      >
        Try again
      </Button>
    </div>
  );
}

function Library({
  glossary,
  ...props
}: LibraryProps & { glossary: readonly GlossaryEntry[] }) {
  const { shown: detailsShown } = useCurriculumDetails();
  const { location, navigate } = useAppRoute();
  const params = new URLSearchParams(location.search);
  const urlQuery = (params.get("q") ?? "").slice(0, 80);
  const strand = strandNames[params.get("strand") ?? ""]
    ? params.get("strand")!
    : "";
  const body = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  // A new filter starts at its results, with the search still pinned. Keeping
  // a deeper offset would leave the summary and first matches under the bar.
  const pinResults = () => {
    const bodyTop = body.current?.getBoundingClientRect().top;
    const controlsTop = controls.current?.getBoundingClientRect().top;
    if (
      bodyTop !== undefined &&
      controlsTop !== undefined &&
      bodyTop < controlsTop
    )
      window.scrollTo({
        // Scroll offsets may be integral even when the heading height is not.
        // Round toward the pinned side of that boundary.
        top: Math.ceil(window.scrollY + bodyTop - controlsTop),
        behavior: "instant",
      });
  };
  // Reads the live URL, not this render's copy: a write can land between a
  // render and the next one.
  const writeUrl = (next: { q: string; strand: string }) => {
    const search = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next))
      if (value) search.set(key, value);
      else search.delete(key);
    navigate(
      { pathname: "/lessons", search: search.toString() },
      // Typing replaces the entry, so Back leaves the library rather than
      // undoing keystrokes; a new area is a step Back can undo.
      { replace: next.strand === strand, resetScroll: false },
    );
  };
  const field = useUrlSearchText(urlQuery, (q) => writeUrl({ q, strand }));
  const text = field.text;
  const query = useDeferredValue(text.trim());
  const base = useMemo(
    () =>
      buildLibrary(props.references, props.templates, props.skills, gradeOrder),
    [props.references, props.templates, props.skills],
  );
  const items = useMemo(() => attachTerms(base, glossary), [base, glossary]);
  // The library below lists by area only. A query shows ranked results in
  // its place (the library stays mounted, hidden), so typing never
  // re-renders the 2,000-odd library rows.
  const shown = useMemo(() => visibleIds(items, "", strand), [items, strand]);
  const docs = useMemo(
    () =>
      searchCorpus(props.references, props.templates, props.skills, glossary),
    [props.references, props.templates, props.skills, glossary],
  );
  const search = useLessonSearch(docs, query, strand);
  const bands = useMemo(() => {
    const byBand = new Map<string, LibraryItem[]>();
    for (const item of items) {
      const list = byBand.get(item.band) ?? [];
      list.push(item);
      byBand.set(item.band, list);
    }
    const rank = (band: string) =>
      gradeOrder.includes(band) ? gradeOrder.indexOf(band) : gradeOrder.length;
    return [...byBand.entries()]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([band, list]) => ({
        band,
        lessons: list
          .filter((item) => item.kind === "lesson")
          .sort((a, b) => a.title.localeCompare(b.title)),
        types: Object.keys(strandNames).map((key) => ({
          strand: key,
          list: list
            .filter((item) => item.kind === "type" && item.strand === key)
            .sort((a, b) => a.title.localeCompare(b.title)),
        })),
      }));
  }, [items]);
  // Sections the parent closed; a new search opens every section again.
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  useEffect(
    // Unchanged when nothing is closed, so a keystroke re-renders no rows.
    () => setClosed((current) => (current.size ? new Set() : current)),
    [strand],
  );
  const lessonById = useMemo(
    () => new Map(props.references.map((lesson) => [lesson.id, lesson])),
    [props.references],
  );
  // Rows keep one handler for the page's life, so a re-render of the page
  // around them never re-renders a row.
  const handlers = useRef(props);
  handlers.current = props;
  const openLesson = useCallback(
    (id: string, trigger: HTMLElement) => {
      const lesson = lessonById.get(id);
      if (lesson) handlers.current.openReference(lesson, trigger);
    },
    [lessonById],
  );
  const openTopic = useCallback(
    (id: string) => handlers.current.openTopic(id),
    [],
  );
  const counts = useMemo(() => {
    let lessons = 0,
      types = 0;
    for (const key of shown)
      if (key.startsWith("lesson:")) lessons++;
      else types++;
    return { lessons, types };
  }, [shown]);
  const { lessons, types } = counts;
  const plural = (n: number, one: string, many: string) =>
    `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
  // The field shows the whole query; the count names a long one shortened,
  // so the line stays within its two reserved lines.
  const named = query.length > 24 ? `${query.slice(0, 23).trimEnd()}…` : query;
  const found = { lessons: 0, skills: 0, glossary: 0 };
  for (const result of search.results) found[result.group]++;
  // Each group holds its best 20; more than that reads "20+".
  const many = (n: number, one: string, more: string) =>
    n >= 20 ? `20+ ${more}` : plural(n, one, more);
  const foundText = [
    found.lessons && many(found.lessons, "lesson", "lessons"),
    found.skills && many(found.skills, "skill", "skills"),
    found.glossary && many(found.glossary, "math word", "math words"),
  ].filter(Boolean) as string[];
  const summary = !query
    ? `${plural(lessons, "lesson", "lessons")} · ${plural(types, "problem type", "problem types")}`
    : foundText.length
      ? `${foundText.length > 1 ? `${foundText.slice(0, -1).join(", ")} and ${foundText[foundText.length - 1]}` : foundText[0]} match “${named}”`
      : search.pending
        ? `Searching for “${named}”…`
        : `Nothing matches “${named}”. Try fewer letters or another word.`;
  const input = useRef<HTMLInputElement>(null);
  const resultList = useRef<HTMLDivElement>(null);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const actions = useMemo<SearchActions>(() => {
    const href = (result: SearchResult) =>
      result.kind === "lesson"
        ? `/lessons/${encodeURIComponent(result.target)}`
        : result.kind === "type"
          ? `/lessons?topic=${encodeURIComponent(result.target)}`
          : result.kind === "film"
            ? `/lessons/${encodeURIComponent(result.target)}/watch?from=${encodeURIComponent(window.location.pathname + window.location.search)}`
            : `/pathways/${encodeURIComponent(result.target)}`;
    return {
      href,
      open: (result, trigger) => {
        if (result.kind === "lesson") openLesson(result.target, trigger);
        else if (result.kind === "type") openTopic(result.target);
        else navigateRef.current(href(result));
      },
    };
  }, [openLesson, openTopic]);
  const suggest = (words: string) => {
    pinResults();
    field.set(words);
    input.current?.focus();
  };
  return (
    <section className={`lesson-index ${styles.library}`} aria-label="Lessons">
      <h1 className={styles.title}>Lessons</h1>
      <div
        ref={body}
        className={styles.body}
        onKeyDown={(event) => resultKeys(event, input, resultList)}
      >
        <div ref={controls} className={styles.bar} role="search">
          <label className={styles.search}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              ref={input}
              type="search"
              className={styles.input}
              aria-label="Search lessons"
              placeholder="Search lessons and math words"
              maxLength={80}
              value={text}
              autoComplete="off"
              enterKeyHint="search"
              onChange={(event) => {
                pinResults();
                field.change(event.target.value);
              }}
              onBlur={field.flush}
              onKeyDown={(event) => {
                if (event.key === "Enter") field.flush();
                if (event.key === "Escape" && text) {
                  event.preventDefault();
                  pinResults();
                  field.set("");
                }
              }}
            />
            <button
              type="button"
              className={styles.clear}
              aria-label="Clear search"
              hidden={!text}
              onClick={(event) => {
                pinResults();
                field.set("");
                event.currentTarget
                  .closest("label")
                  ?.querySelector("input")
                  ?.focus();
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7 7 10 10M17 7 7 17" />
              </svg>
            </button>
          </label>
          <Select
            aria-label="Math area"
            className={styles.area}
            value={strand}
            onValueChange={(value) => {
              pinResults();
              writeUrl({ q: field.carry(), strand: value });
            }}
          >
            <option value="">Every math area</option>
            {Object.entries(strandNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <CurriculumDetailsControl />
        <p className={styles.summary} role="status" aria-live="polite">
          {summary}
        </p>
        {query && (
          <div ref={resultList}>
            <SearchResults
              results={search.results}
              pending={search.pending}
              actions={actions}
            />
            {!search.results.length && !search.pending && (
              <div className={styles.suggestions}>
                <p>Try one of these</p>
                <ul>
                  {[
                    "fractions",
                    "times tables",
                    "order of operations",
                    "area",
                    "slope",
                  ].map((words) => (
                    <li key={words}>
                      <button type="button" onClick={() => suggest(words)}>
                        {words}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <Results
          hidden={!!query}
          bands={bands}
          shown={shown}
          closed={closed}
          setClosed={setClosed}
          detailsShown={detailsShown}
          openLesson={openLesson}
          openTopic={openTopic}
        />
      </div>
    </section>
  );
}

type Band = {
  band: string;
  lessons: LibraryItem[];
  types: { strand: string; list: LibraryItem[] }[];
};

/**
 * The math words and every band's rows. It renders from the deferred query
 * only, so typing re-renders the search bar and nothing else.
 */
const Results = memo(function Results({
  hidden,
  bands,
  shown,
  closed,
  setClosed,
  detailsShown,
  openLesson,
  openTopic,
}: {
  hidden: boolean;
  bands: readonly Band[];
  shown: ReadonlySet<string>;
  closed: ReadonlySet<string>;
  setClosed: Dispatch<SetStateAction<ReadonlySet<string>>>;
  detailsShown: boolean;
  openLesson: (id: string, trigger: HTMLElement) => void;
  openTopic: (id: string) => void;
}) {
  return (
    <div hidden={hidden}>
      {bands.map(({ band, lessons: bandLessons, types: bandTypes }) => {
        const visibleLessons = bandLessons.filter((item) =>
          shown.has(`lesson:${item.id}`),
        ).length;
        const visibleTypes = bandTypes.reduce(
          (sum, group) =>
            sum +
            group.list.filter((item) => shown.has(`type:${item.id}`)).length,
          0,
        );
        const open = !detailsShown || !closed.has(band);
        return (
          <section
            key={band}
            className={styles.band}
            data-band={band}
            hidden={!visibleLessons && !visibleTypes}
          >
            <h2 className={styles.bandHeading} hidden={!detailsShown}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setClosed((current) => {
                    const next = new Set(current);
                    if (open) next.add(band);
                    else next.delete(band);
                    return next;
                  })
                }
              >
                <span>{bandLabel(band)}</span>
                <span className={styles.bandCount}>
                  {visibleLessons + visibleTypes}
                </span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </h2>
            <div className={styles.bandBody} hidden={!open}>
              <ul
                className={styles.lessons}
                aria-label={
                  detailsShown ? `${bandLabel(band)} lessons` : "Lessons"
                }
                hidden={!visibleLessons}
              >
                {bandLessons.map((item) => (
                  <LessonRow
                    key={item.id}
                    item={item}
                    hidden={!shown.has(`lesson:${item.id}`)}
                    open={openLesson}
                  />
                ))}
              </ul>
              <div className={styles.types} hidden={!visibleTypes}>
                <h3>Practice by problem type</h3>
                {bandTypes.map((group) => {
                  const visible = group.list.some((item) =>
                    shown.has(`type:${item.id}`),
                  );
                  return (
                    <ul
                      key={group.strand}
                      className="topic-list"
                      data-strand={group.strand}
                      aria-label={
                        detailsShown
                          ? `${strandNames[group.strand]}, ${bandLabel(band)}`
                          : strandNames[group.strand]
                      }
                      hidden={!visible}
                    >
                      {group.list.map((item) => (
                        <TypeRow
                          key={item.id}
                          item={item}
                          hidden={!shown.has(`type:${item.id}`)}
                          open={openTopic}
                        />
                      ))}
                    </ul>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
});

const LessonRow = memo(function LessonRow({
  item,
  hidden,
  open,
}: {
  item: LibraryItem;
  hidden: boolean;
  open: (id: string, trigger: HTMLElement) => void;
}) {
  return (
    <li hidden={hidden}>
      <button
        type="button"
        data-lesson-id={item.id}
        data-strand={item.strand}
        onClick={(event) => open(item.id, event.currentTarget)}
      >
        <span className={styles.lessonTitle}>
          <MathText text={item.title} />
        </span>
        <span className={styles.lessonSummary}>
          <MathText text={item.summary} />
        </span>
      </button>
    </li>
  );
});

const TypeRow = memo(function TypeRow({
  item,
  hidden,
  open,
}: {
  item: LibraryItem;
  hidden: boolean;
  open: (id: string) => void;
}) {
  return (
    <li hidden={hidden}>
      <button
        type="button"
        data-template={item.id}
        onClick={() => open(item.id)}
      >
        {/* One flex child: text and formulas wrap together as a line, never
            word by word. */}
        <span>
          <MathText text={item.title} />
        </span>
      </button>
    </li>
  );
});
