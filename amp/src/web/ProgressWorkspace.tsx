import { FocusDialog } from "./PracticeWorkspace";
import {
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  LearnerSkillProgress,
  ProgressSnapshot,
} from "../server/progress";
import type { TemplateMetadata } from "../math/contracts";
import type { Lesson } from "../content/lessons";
import type { BookSummary } from "../books/catalog";
import "./progress-workspace.css";

export type ProgressView = {
  filter: "practiced" | "review" | "explore";
  strand: string;
  page: number;
  skillId: string | null;
};
export const initialProgressView: ProgressView = {
  filter: "practiced",
  strand: "",
  page: 0,
  skillId: null,
};
type Skill = { id: string; title: string; strand: string; gradeBand: string };
const areaNames: Record<string, string> = {
  number: "Numbers",
  operations: "Operations",
  fractions: "Fractions",
  geometry: "Geometry",
  measurement: "Measurement",
  data: "Data",
  algebra: "Algebra",
  modeling: "Mathematical models",
  ratios: "Ratios",
  probability: "Probability",
  functions: "Functions",
  statistics: "Statistics",
  trigonometry: "Trigonometry",
};
const areaName = (name: string) =>
  areaNames[name] ??
  name.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
const title = (skill: Skill) =>
  skill.id === "statistics-mean"
    ? "Mean of a data set"
    : skill.title.toLowerCase().replace(/^./, (c) => c.toUpperCase());
export function reviewSuggested(
  skill: LearnerSkillProgress,
  asOf: string,
): boolean {
  return (
    skill.attempts > 0 &&
    skill.reviewDueAt !== null &&
    Date.parse(skill.reviewDueAt) <= Date.parse(asOf)
  );
}
function outcomeLabel(observation: LearnerSkillProgress["recent"][number]) {
  return observation.assisted
    ? observation.correct
      ? "Correct with help"
      : "Used help; try again"
    : observation.correct
      ? "Correct independently"
      : "Try again";
}
function Observations({ skill }: { skill: LearnerSkillProgress }) {
  return (
    <span
      className="progress-observations"
      role="list"
      aria-label="Recent answers, earliest to latest"
    >
      {skill.recent.map((observation, index) => (
        <span
          role="listitem"
          key={index}
          className={
            observation.assisted
              ? "supported"
              : observation.correct
                ? "independent"
                : "revisit"
          }
          aria-label={`${outcomeLabel(observation)}, ${new Date(observation.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
          title={outcomeLabel(observation)}
        >
          <span aria-hidden="true">
            {observation.assisted ? "◇" : observation.correct ? "✓" : "↻"}
          </span>
        </span>
      ))}
    </span>
  );
}
function nextStep(skill: LearnerSkillProgress, asOf: string) {
  if (!skill.attempts)
    return {
      title: "A new idea to explore",
      text: "Try an example, then return to your varied mix.",
    };
  const last = skill.recent.at(-1);
  if (last?.assisted)
    return {
      title: "Try a fresh example",
      text: "Use the lesson if it helps, then try a fresh example on your own.",
    };
  if (last && !last.correct)
    return {
      title: "Another way into the idea",
      text: "Read the lesson for a different approach, then try a fresh example.",
    };
  if (reviewSuggested(skill, asOf))
    return {
      title: "A good time to revisit",
      text: "You solved this before. Try recalling it after a break.",
    };
  return {
    title: "Keep a mix of ideas",
    text:
      skill.independentOccasions >= 2
        ? "You recalled this after a break. It will return in your mix."
        : "You solved this independently. It will return in your mix.",
  };
}
export function ProgressWorkspace({
  snapshot,
  skills,
  templates,
  lessons,
  books,
  view,
  setView,
  busy,
  loading,
  error,
  onRetry,
  onPractice,
  onLesson,
  onBook,
}: {
  snapshot: ProgressSnapshot | null;
  skills: Skill[];
  templates: TemplateMetadata[];
  lessons: Lesson[];
  books: BookSummary[];
  view: ProgressView;
  setView: Dispatch<SetStateAction<ProgressView>>;
  busy: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onPractice: (templateId?: string) => void;
  onLesson: (lesson: Lesson, skillId: string) => void;
  onBook: (bookId: string, trigger: HTMLElement) => void;
}) {
  const typeMeasure = useRef<HTMLSpanElement>(null);
  const infoTrigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const [capacity, setCapacity] = useState(2);
  const [largeText, setLargeText] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const returnSkill = useRef<string | null>(null);
  useLayoutEffect(() => {
    const target = typeMeasure.current;
    if (!target) return;
    const measure = () =>
      setLargeText(target.getBoundingClientRect().width >= 24);
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const target = list.current;
    if (!target) return;
    const measure = () => {
      const font = Number.parseFloat(getComputedStyle(target).fontSize) || 16;
      const grid = target.querySelector(".progress-cards");
      const columns = grid
        ? getComputedStyle(grid).gridTemplateColumns.split(" ").length
        : 1;
      setCapacity(
        largeText
          ? 1
          : Math.max(
              1,
              Math.min(3, Math.floor(target.clientHeight / (9.5 * font))),
            ) * columns,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    measure();
    return () => observer.disconnect();
  }, [view.skillId, !!snapshot, largeText]);
  const entries = (snapshot?.skills ?? []).flatMap((evidence) => {
    const definition = skills.find((skill) => skill.id === evidence.skillId);
    return definition ? [{ evidence, definition }] : [];
  });
  const practiced = entries.filter(({ evidence }) => evidence.attempts > 0),
    review = entries.filter(({ evidence }) =>
      reviewSuggested(evidence, snapshot!.asOf),
    );
  const areas = [
    ...new Set(entries.map(({ definition }) => definition.strand)),
  ].sort((a, b) => areaName(a).localeCompare(areaName(b)));
  const filtered = entries
    .filter(
      ({ evidence, definition }) =>
        (!view.strand || definition.strand === view.strand) &&
        (view.filter === "explore"
          ? evidence.attempts === 0
          : view.filter === "review"
            ? reviewSuggested(evidence, snapshot!.asOf)
            : evidence.attempts > 0),
    )
    .sort((a, b) => {
      if (view.filter === "review")
        return (
          Date.parse(a.evidence.reviewDueAt!) -
            Date.parse(b.evidence.reviewDueAt!) ||
          title(a.definition).localeCompare(title(b.definition))
        );
      if (view.filter === "practiced")
        return (
          Date.parse(b.evidence.lastPracticedAt!) -
            Date.parse(a.evidence.lastPracticedAt!) ||
          title(a.definition).localeCompare(title(b.definition))
        );
      return title(a.definition).localeCompare(title(b.definition));
    });
  const pages = Math.max(1, Math.ceil(filtered.length / capacity)),
    page = Math.min(view.page, pages - 1);
  useLayoutEffect(() => {
    if (view.skillId) {
      heading.current?.focus({ preventScroll: true });
      return;
    }
    const skillId = returnSkill.current;
    if (!skillId) return;
    const index = filtered.findIndex(
      ({ definition }) => definition.id === skillId,
    );
    const destination = Math.max(0, Math.floor(index / capacity));
    if (destination !== page) {
      setView((old) => ({ ...old, page: destination }));
      return;
    }
    const frame = requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-progress-skill="${CSS.escape(skillId)}"]`,
        )
        ?.focus({ preventScroll: true });
      returnSkill.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [view.skillId, capacity, page, filtered.length]);
  const selected = entries.find(
    ({ definition }) => definition.id === view.skillId,
  );
  const template = selected
    ? templates.find((t) => t.skillId === selected.definition.id)
    : undefined;
  const book = selected
    ? books.find((b) => b.skills.includes(selected.definition.id))
    : undefined;
  const lesson = selected
    ? lessons.find((l) =>
        l.templateIds.some((id) =>
          templates.some(
            (t) => t.id === id && t.skillId === selected.definition.id,
          ),
        ),
      )
    : undefined;
  const step = selected ? nextStep(selected.evidence, snapshot!.asOf) : null;
  const back = () => {
    returnSkill.current = view.skillId;
    setView((old) => ({ ...old, skillId: null }));
  };
  return (
    <main
      className={`progress-workspace${largeText ? " large-text" : ""}`}
      aria-label="Learning progress"
      aria-busy={loading}
    >
      <span
        ref={typeMeasure}
        className="progress-type-measure"
        aria-hidden="true"
      />
      <section className="progress-surface">
        {error && (
          <div className="progress-load-error" role="alert">
            <p>
              {error}
              {snapshot && (
                <small>
                  Showing history from{" "}
                  {new Date(snapshot.asOf).toLocaleString()}.
                </small>
              )}
            </p>
            <button className="secondary" onClick={onRetry} disabled={loading}>
              Try again
            </button>
          </div>
        )}
        {selected ? (
          <>
            <header className="progress-detail-heading">
              <button className="text-button" onClick={back}>
                ← All ideas
              </button>
              <button
                ref={infoTrigger}
                className="secondary progress-info"
                aria-label="About practice history"
                onClick={() => setInfoOpen(true)}
              >
                ⓘ
              </button>
            </header>
            <div className="progress-detail-content">
              <h1 ref={heading} tabIndex={-1}>
                {title(selected.definition)}
              </h1>
              <div className="progress-counts">
                <div>
                  <strong>{selected.evidence.attempts}</strong>
                  <span>problems tried</span>
                </div>
                <div>
                  <strong>{selected.evidence.independentCorrect}</strong>
                  <span>correct independently</span>
                </div>
              </div>
              {selected.evidence.recent.length > 0 && (
                <section className="progress-recent">
                  <div className="progress-recent-line">
                    <span>Latest {selected.evidence.recent.length}</span>
                    <Observations skill={selected.evidence} />
                  </div>
                  <p className="progress-key">
                    <span>✓ Independent</span>
                    <span>◇ Help</span>
                    <span>↻ Retry</span>
                  </p>
                </section>
              )}
              <section className="progress-next-step">
                <h2>{step!.title}</h2>
                <p>{step!.text}</p>
              </section>
            </div>
            <footer className="progress-detail-actions">
              {template && (
                <button disabled={busy} onClick={() => onPractice(template.id)}>
                  Try one problem
                </button>
              )}
              {book ? (
                <button
                  className="secondary"
                  data-book-id={book.id}
                  disabled={busy}
                  onClick={(event) => onBook(book.id, event.currentTarget)}
                >
                  Open related book
                </button>
              ) : lesson ? (
                <button
                  className="secondary"
                  data-progress-lesson={selected.definition.id}
                  disabled={busy}
                  onClick={() => onLesson(lesson, selected.definition.id)}
                >
                  Read the lesson
                </button>
              ) : null}
              <small>One focused problem, then back to your mix.</small>
            </footer>
          </>
        ) : (
          <>
            <header className="progress-heading">
              <div>
                <p className="eyebrow">A PICTURE OF YOUR PRACTICE</p>
                <h1>Your progress</h1>
                <p>
                  {snapshot
                    ? practiced.length
                      ? `${practiced.length} ideas practiced · ${practiced.reduce((sum, { evidence }) => sum + evidence.attempts, 0)} problems tried`
                      : "Every new idea starts somewhere."
                    : "Gathering your practice history…"}
                </p>
              </div>
              <button
                className="secondary progress-mix"
                disabled={busy || loading}
                onClick={() => onPractice()}
              >
                Start a mix <span aria-hidden="true">↗</span>
              </button>
            </header>
            {snapshot && (
              <div className="progress-controls">
                <label>
                  <span className="sr-only">Math area</span>
                  <select
                    aria-label="Math area"
                    value={view.strand}
                    onChange={(e) =>
                      setView({ ...view, strand: e.target.value, page: 0 })
                    }
                  >
                    <option value="">Every math area</option>
                    {areas.map((area) => (
                      <option key={area} value={area}>
                        {areaName(area)}
                      </option>
                    ))}
                  </select>
                </label>
                <div
                  className="progress-filters"
                  aria-label="Practice evidence"
                >
                  {(
                    [
                      ["practiced", "Practiced"],
                      [
                        "review",
                        `Review${review.length ? ` · ${review.length}` : ""}`,
                      ],
                      ["explore", "Explore"],
                    ] as const
                  ).map(([filter, label]) => (
                    <button
                      key={filter}
                      aria-pressed={view.filter === filter}
                      onClick={() => setView({ ...view, filter, page: 0 })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="progress-card-stage" ref={list}>
              {!snapshot ? (
                <div className="progress-empty">
                  <div className="progress-path" aria-hidden="true">
                    · · ·
                  </div>
                  <h2>
                    {loading
                      ? "Finding your starting point"
                      : "Your history is unavailable"}
                  </h2>
                  <p>
                    {loading
                      ? "Your recorded practice will appear here."
                      : "Try loading it again to see your ideas."}
                  </p>
                </div>
              ) : filtered.length ? (
                <div className="progress-cards">
                  {filtered
                    .slice(page * capacity, (page + 1) * capacity)
                    .map(({ evidence, definition }) => (
                      <button
                        className="progress-skill-card"
                        data-progress-skill={definition.id}
                        key={definition.id}
                        onClick={() =>
                          setView({ ...view, page, skillId: definition.id })
                        }
                      >
                        <span className="progress-card-area">
                          {areaName(definition.strand)}
                        </span>
                        <span className="progress-card-title">
                          {title(definition)}
                          <span aria-hidden="true">↗</span>
                        </span>
                        <span className="progress-card-evidence">
                          {evidence.attempts
                            ? `${evidence.attempts} tried · ${evidence.independentCorrect} correct independently`
                            : "No practice recorded yet"}
                        </span>
                        <span className="progress-card-bottom">
                          <Observations skill={evidence} />
                          <span>
                            {!evidence.attempts
                              ? "Explore the idea"
                              : reviewSuggested(evidence, snapshot.asOf)
                                ? "Revisit this idea"
                                : "See your practice"}
                          </span>
                        </span>
                      </button>
                    ))}
                </div>
              ) : (
                <div className="progress-empty">
                  <svg viewBox="0 0 180 70" aria-hidden="true">
                    <path d="M15 55 Q45 55 60 35 T110 30 T165 10" />
                    <path d="M15 55 Q65 62 95 45 T165 50" />
                    <circle cx="15" cy="55" r="6" />
                    <circle cx="95" cy="45" r="5" />
                    <circle cx="165" cy="10" r="5" />
                  </svg>
                  <h2>
                    {view.filter === "review"
                      ? "Room for something different"
                      : view.filter === "explore"
                        ? "You’ve tried these ideas"
                        : "Let curiosity lead"}
                  </h2>
                  <p>
                    {view.filter === "review"
                      ? "No review is suggested here right now. Your mix can introduce another idea."
                      : view.filter === "explore"
                        ? "Choose another area or revisit an idea you’ve practiced."
                        : "Your practice will build this picture. Start with a varied mix of ideas."}
                  </p>
                </div>
              )}
            </div>
            <footer className="progress-page-controls">
              <button
                className="secondary"
                aria-label="Previous ideas"
                disabled={page === 0 || !filtered.length}
                onClick={() => setView({ ...view, page: page - 1 })}
              >
                ←
              </button>
              <span aria-live="polite">
                {filtered.length
                  ? `${page * capacity + 1}–${Math.min((page + 1) * capacity, filtered.length)} of ${filtered.length} ideas`
                  : "Practice grows at your pace"}
              </span>
              <button
                className="secondary"
                aria-label="Next ideas"
                disabled={page === pages - 1 || !filtered.length}
                onClick={() => setView({ ...view, page: page + 1 })}
              >
                →
              </button>
            </footer>
          </>
        )}
      </section>
      {infoOpen && (
        <FocusDialog
          title="Reading your practice"
          returnFocus={infoTrigger.current}
          close={() => setInfoOpen(false)}
        >
          <p>
            These observations describe the problems you have tried. They do not
            measure a whole grade or certify mastery.
          </p>
          <p>
            ✓ means correct independently. ◇ means help was used, whether or not
            the answer was correct. ↻ means another try may help.
          </p>
          <p>
            Recent answers run from earliest to latest. Several correct answers
            in one sitting are useful practice; successful recall after a break
            also informs when an idea returns to your mix.
          </p>
          {selected?.evidence.reviewDueAt && (
            <p>
              Next review suggested:{" "}
              <strong>
                {new Date(selected.evidence.reviewDueAt).toLocaleString()}
              </strong>
              . A suggestion is not a deadline or a sign that you have
              forgotten.
            </p>
          )}
          {snapshot && (
            <p>History updated {new Date(snapshot.asOf).toLocaleString()}.</p>
          )}
          <button onClick={() => setInfoOpen(false)}>Back to your idea</button>
        </FocusDialog>
      )}
    </main>
  );
}
