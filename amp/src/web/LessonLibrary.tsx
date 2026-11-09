import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
  matchingTerms,
  visibleIds,
  type LibraryItem,
} from "./lib/lesson-library";
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
 * refresh, Back and a shared link restore the same results. Rows stay
 * mounted and are hidden, not removed, so filtering never rebuilds the page.
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
  // The field owns its text while typing; the URL follows (replacing the
  // entry, so Back leaves the library rather than undoing keystrokes) and
  // wins when it changes from outside (Back, Forward, a shared link).
  const [text, setText] = useState(urlQuery);
  // Values this field wrote itself. Navigation is asynchronous, so the URL
  // can still show "sl" after "slo" has been typed; an echo of our own write
  // must never overwrite newer typing. Only a value from elsewhere (Back,
  // Forward, a shared link) replaces the field.
  const written = useRef(new Set<string>());
  const body = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (written.current.has(urlQuery)) return;
    setText((current) =>
      current.trim() === urlQuery.trim() ? current : urlQuery,
    );
  }, [urlQuery]);
  const write = (next: { q?: string; strand?: string }) => {
    // A new filter starts at its results, with the search still pinned. Keeping
    // a deeper offset would leave the summary and first matches under the bar.
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
    const search = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(next))
      if (value) search.set(key, value);
      else search.delete(key);
    if ("q" in next) written.current.add(next.q ?? "");
    navigate(
      { pathname: "/lessons", search: search.toString() },
      { replace: "q" in next, resetScroll: false },
    );
  };
  const query = useDeferredValue(text.trim());
  const base = useMemo(
    () =>
      buildLibrary(props.references, props.templates, props.skills, gradeOrder),
    [props.references, props.templates, props.skills],
  );
  const items = useMemo(() => attachTerms(base, glossary), [base, glossary]);
  const shown = useMemo(
    () => visibleIds(items, query, strand),
    [items, query, strand],
  );
  const words = useMemo(
    () => (query ? matchingTerms(glossary, query) : []),
    [glossary, query],
  );
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
  useEffect(() => setClosed(new Set()), [query, strand]);
  const lessonById = useMemo(
    () => new Map(props.references.map((lesson) => [lesson.id, lesson])),
    [props.references],
  );
  const count = (kind: LibraryItem["kind"]) =>
    [...shown].filter((key) => key.startsWith(`${kind}:`)).length;
  const lessons = count("lesson"),
    types = count("type");
  const plural = (n: number, one: string, many: string) =>
    `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
  // The field shows the whole query; the count names a long one shortened,
  // so the line stays within its two reserved lines.
  const named = query.length > 24 ? `${query.slice(0, 23).trimEnd()}…` : query;
  const summary = !query
    ? `${plural(lessons, "lesson", "lessons")} · ${plural(types, "problem type", "problem types")}`
    : lessons + types
      ? `${plural(lessons, "lesson", "lessons")} and ${plural(types, "problem type", "problem types")} match “${named}”`
      : `Nothing matches “${named}”. Try fewer letters or another word.`;
  return (
    <section className={`lesson-index ${styles.library}`} aria-label="Lessons">
      <h1 className={styles.title}>Lessons</h1>
      <div ref={body} className={styles.body}>
        <div ref={controls} className={styles.bar} role="search">
          <label className={styles.search}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              type="search"
              className={styles.input}
              aria-label="Search lessons"
              placeholder="Search lessons and math words"
              maxLength={80}
              value={text}
              autoComplete="off"
              enterKeyHint="search"
              onChange={(event) => {
                setText(event.target.value);
                write({ q: event.target.value.trim() });
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && text) {
                  event.preventDefault();
                  setText("");
                  write({ q: "" });
                }
              }}
            />
            <button
              type="button"
              className={styles.clear}
              aria-label="Clear search"
              hidden={!text}
              onClick={(event) => {
                setText("");
                write({ q: "" });
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
            onValueChange={(value) => write({ strand: value })}
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
        {words.length > 0 && (
          <ul className={styles.words} aria-label="Math words">
            {words.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.term}</strong> <MathText text={entry.plain} />
              </li>
            ))}
          </ul>
        )}
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
                    <li key={item.id} hidden={!shown.has(`lesson:${item.id}`)}>
                      <button
                        type="button"
                        data-lesson-id={item.id}
                        data-strand={item.strand}
                        onClick={(event) => {
                          const lesson = lessonById.get(item.id);
                          if (lesson)
                            props.openReference(lesson, event.currentTarget);
                        }}
                      >
                        <span className={styles.lessonTitle}>
                          <MathText text={item.title} />
                        </span>
                        <span className={styles.lessonSummary}>
                          <MathText text={item.summary} />
                        </span>
                      </button>
                    </li>
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
                          <li
                            key={item.id}
                            hidden={!shown.has(`type:${item.id}`)}
                          >
                            <button
                              type="button"
                              data-template={item.id}
                              onClick={() => props.openTopic(item.id)}
                            >
                              {/* One flex child: text and formulas wrap
                                together as a line, never word by word. */}
                              <span>
                                <MathText text={item.title} />
                              </span>
                            </button>
                          </li>
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
    </section>
  );
}
