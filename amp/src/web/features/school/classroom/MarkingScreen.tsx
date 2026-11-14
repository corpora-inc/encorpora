import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { create } from "zustand";
import type {
  MarkedProblem,
  MarksView,
  PaperMark,
} from "../../../../schools/classroom-contracts";
import { Avatar } from "../../../ui/Avatar";
import { Button, buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Segmented } from "../../../ui/Segmented";
import { Toast } from "../../../ui/Toast";
import { dateLabel, sectionNames } from "../../workbooks/model";
import { useStaffSession } from "../classes/api";
import { useClassHost, type ClassHost } from "../classes/host";
import { marksSearchSchema } from "./search";
import { PageHead } from "../parts";
import { invalidateStack, marksOptions, saveMarks, say } from "./api";
import type { MarksSearch } from "./search";
import styles from "./Marking.module.css";

/** Marks waiting to be saved, kept across screens in this tab. Saved marks are
 * part of a student's record and don't change, so a slip is fixed here, first. */
type Drafts = Record<string, Record<number, PaperMark>>;
const useDrafts = create<{
  sheets: Record<string, Drafts>;
  change: (
    sheet: string,
    student: string,
    drafts: Record<number, PaperMark>,
  ) => void;
}>((set) => ({
  sheets: {},
  change: (sheet, student, drafts) =>
    set((store) => ({
      sheets: {
        ...store.sheets,
        [sheet]: { ...store.sheets[sheet], [student]: drafts },
      },
    })),
}));
const EMPTY: Drafts = {};

const PHONE = "(max-width: 719px)";
const usePhone = () =>
  useSyncExternalStore(
    (changed) => {
      const media = matchMedia(PHONE);
      media.addEventListener("change", changed);
      return () => media.removeEventListener("change", changed);
    },
    () => matchMedia(PHONE).matches,
  );

const markWord: Record<PaperMark, string> = {
  right: "Right",
  "not-yet": "Not yet",
};
type Student = MarksView["students"][number];
/** What this host calls the people whose sheets these are. */
const Who = createContext({ learner: "student", learners: "students" });
const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** `.../workbooks/$date`: who got what, entered by hand from the printed sheets.
 * A printed QR code opens this on its own student. */
export function MarkingScreen({ host: given }: { host?: ClassHost } = {}) {
  const host = useClassHost(given);
  const { date = "" } = useParams({ strict: false }) as { date?: string };
  const params = { ...host.place, date };
  const raw = useSearch({ strict: false });
  const search = useMemo(
    () => marksSearchSchema.parse(raw) as MarksSearch,
    [raw],
  );
  const session = useStaffSession();
  const query = useQuery(
    marksOptions(session, params.class, params.date, search.set),
  );
  const navigate = useNavigate();
  // Only the people this host shows: a family's own children.
  const data = useMemo(
    () =>
      query.data && host.keep
        ? {
            ...query.data,
            students: query.data.students.filter((student) =>
              host.keep!(student.id),
            ),
          }
        : query.data,
    // The host is the screen's for its life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data],
  );
  return (
    <Who.Provider value={host.words}>
      <host.Frame
        className={data?.class.name}
        loading={query.isPending}
        tab="workbooks"
      >
        <PageHead
          title={dateLabel(params.date)}
          detail={
            data?.set
              ? "Tap a problem for right or not yet, then save. Saved marks stay as they are."
              : "Mark the workbooks printed for this day."
          }
        />
        {!data ? (
          <EmptyState
            title="These workbooks didn’t load"
            action={
              <Button variant="primary" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          >
            {say(query.error, "The sheets couldn’t be read.")}
          </EmptyState>
        ) : data.set === null ? (
          <EmptyState
            title="Nothing printed for this day"
            action={
              <Link
                to="/$"
                params={{ _splat: host.href("workbooks") }}
                search={{}}
                className={buttonClass("primary")}
              >
                Print workbooks
              </Link>
            }
          >
            Print a set first, and its sheets show here to mark.
          </EmptyState>
        ) : (
          <Marks
            key={`${params.class}:${params.date}:${data.set}`}
            data={data}
            search={search}
            classId={params.class}
            date={params.date}
            session={session}
            setSearch={(change, replace = false) =>
              void navigate({
                to: ".",
                search: ((previous: MarksSearch) => ({
                  ...previous,
                  ...change,
                })) as never,
                replace,
              })
            }
          />
        )}
      </host.Frame>
    </Who.Provider>
  );
}

function Marks({
  data,
  search,
  classId,
  date,
  session,
  setSearch,
}: {
  data: MarksView;
  search: MarksSearch;
  classId: string;
  date: string;
  session: ReturnType<typeof useStaffSession>;
  setSearch: (change: Partial<MarksSearch>, replace?: boolean) => void;
}) {
  const who = useContext(Who);
  const client = useQueryClient();
  const phone = usePhone();
  const sheet = `${classId}:${date}:${data.set}`;
  const drafts = useDrafts((store) => store.sheets[sheet] ?? EMPTY);
  const change = useDrafts((store) => store.change);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const set = (student: string, n: number, mark: PaperMark | null) => {
    if (!data.canMark) return;
    const next = { ...drafts[student] };
    if (mark) next[n] = mark;
    else delete next[n];
    change(sheet, student, next);
    setStatus("");
  };
  const allRight = (student: Student) => {
    if (!data.canMark || !student.workbook) return;
    const next = { ...drafts[student.id] };
    for (const problem of student.workbook.problems)
      if (!problem.mark) next[problem.n] ??= "right";
    change(sheet, student.id, next);
    setStatus("");
  };
  const waiting = data.students.flatMap((student) => {
    if (!student.workbook || student.workbook.stale) return [];
    const open = new Map(
      student.workbook.problems.map((problem) => [problem.n, problem.mark]),
    );
    const entries = Object.entries(drafts[student.id] ?? {})
      .map(([n, mark]) => ({ n: Number(n), mark }))
      .filter(({ n }) => open.has(n) && !open.get(n));
    return entries.length ? [{ student, entries }] : [];
  });
  const total = waiting.reduce((sum, row) => sum + row.entries.length, 0);
  useEffect(() => {
    if (!total) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [total]);

  /** Each sheet saves on its own, so one failure keeps only its own marks. */
  const save = async () => {
    setSaving(true);
    setError("");
    const queue = [...waiting];
    let saved = 0;
    let sheets = 0;
    const failures: unknown[] = [];
    const queryKey = marksOptions(session, classId, date, data.set!).queryKey;
    const queryKeyDefault = marksOptions(
      session,
      classId,
      date,
      search.set,
    ).queryKey;
    const merge = (id: string, problems: MarkedProblem[]) => {
      const update = (current: MarksView | undefined) =>
        current && {
          ...current,
          students: current.students.map((student) =>
            student.id === id && student.workbook
              ? { ...student, workbook: { ...student.workbook, problems } }
              : student,
          ),
        };
      client.setQueryData(queryKey, update);
      client.setQueryData(queryKeyDefault, update);
    };
    await Promise.all(
      [0, 1].map(async () => {
        for (;;) {
          const row = queue.shift();
          if (!row) return;
          try {
            const result = await saveMarks(
              session,
              classId,
              row.student.id,
              row.student.workbook!.id,
              row.entries,
            );
            merge(row.student.id, result.problems);
            change(sheet, row.student.id, {});
            saved += row.entries.length;
            sheets += 1;
          } catch (failure) {
            failures.push(failure);
          }
        }
      }),
    );
    setSaving(false);
    void invalidateStack(client, session);
    if (failures.length) {
      setError(
        `${count(failures.length, "sheet")} didn’t save, and their marks are still here. ${say(failures[0], "Save again when you’re ready.")}`,
      );
    } else {
      setStatus(
        `Saved ${count(saved, "mark")} for ${count(sheets, who.learner, who.learners)}. Progress is updated.`,
      );
    }
  };

  const sets = data.sets;
  const current = phone
    ? (data.students.find((student) => student.id === search.student) ??
      data.students.find(
        (student) =>
          student.workbook?.problems.some((problem) => !problem.mark) ?? false,
      ) ??
      data.students[0]!)
    : null;
  return (
    <div className={styles.page}>
      {sets.length > 1 && (
        <div className={styles.setPicker}>
          <Segmented
            label="Which printed set"
            compact
            dense
            options={sets.map((entry) => ({
              value: String(entry.number),
              label: `Set ${entry.number}`,
            }))}
            value={String(data.set)}
            onChange={(value) =>
              setSearch({ set: Number(value), student: undefined }, true)
            }
          />
        </div>
      )}
      {current ? (
        <PhoneSheet
          student={current}
          students={data.students}
          drafts={drafts[current.id] ?? {}}
          canMark={data.canMark}
          onMark={(n, mark) => set(current.id, n, mark)}
          onAllRight={() => allRight(current)}
          onStudent={(id) => setSearch({ student: id })}
        />
      ) : (
        <MarkGrid
          students={data.students}
          drafts={drafts}
          canMark={data.canMark}
          focusStudent={search.student}
          onMark={set}
          onAllRight={allRight}
        />
      )}
      {data.canMark && (
        <div className={styles.footer}>
          <div className={styles.footerInner}>
            <p aria-live="polite" className={styles.footerText}>
              {status ||
                (total
                  ? `${count(total, "mark")} for ${count(waiting.length, who.learner, who.learners)} not saved yet.`
                  : "Nothing waiting to save.")}
            </p>
            <Button
              variant="primary"
              className={styles.save}
              disabled={!total || saving}
              aria-busy={saving}
              onClick={() => void save()}
            >
              {total ? `Save ${count(total, "mark")}` : "Save marks"}
            </Button>
          </div>
        </div>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </div>
  );
}

const glyph = (mark: PaperMark | null) =>
  mark === "right" ? (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  ) : mark === "not-yet" ? (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 8h8" />
    </svg>
  ) : null;

const summary = (
  problems: readonly MarkedProblem[],
  drafts: Record<number, PaperMark>,
) => {
  let right = 0;
  let notYet = 0;
  for (const problem of problems) {
    const mark = problem.mark ?? drafts[problem.n];
    if (mark === "right") right += 1;
    if (mark === "not-yet") notYet += 1;
  }
  return { right, notYet, open: problems.length - right - notYet };
};
const summaryText = (
  problems: readonly MarkedProblem[],
  drafts: Record<number, PaperMark>,
) => {
  const { right, notYet, open } = summary(problems, drafts);
  if (!right && !notYet) return count(problems.length, "problem");
  return open
    ? `${right + notYet} of ${problems.length} marked`
    : `${right} right, ${notYet} not yet`;
};

/** Students down, problems across, each cell a toggle. Arrow keys move, R and N
 * mark and step on, Space cycles, Delete clears, A marks the row's rest right. */
function MarkGrid({
  students,
  drafts,
  canMark,
  focusStudent,
  onMark,
  onAllRight,
}: {
  students: Student[];
  drafts: Drafts;
  canMark: boolean;
  focusStudent?: string;
  onMark: (student: string, n: number, mark: PaperMark | null) => void;
  onAllRight: (student: Student) => void;
}) {
  const who = useContext(Who);
  const columns = useMemo(
    () =>
      Math.max(
        0,
        ...students.map((student) => student.workbook?.problems.length ?? 0),
      ),
    [students],
  );
  const rows = useMemo(
    () =>
      students.filter((student) => student.workbook && !student.workbook.stale),
    [students],
  );
  const start = Math.max(
    0,
    rows.findIndex((row) => row.id === focusStudent),
  );
  const [at, setAt] = useState({ row: start, col: 0 });
  const cell = (row: number, col: number) =>
    document.querySelector<HTMLElement>(`[data-cell="${row}:${col}"]`);
  // A scanned sheet opens on its own row.
  useEffect(() => {
    if (focusStudent) cell(start, 0)?.scrollIntoView({ block: "center" });
  }, [focusStudent, start]);
  const go = (row: number, col: number) => {
    const nextRow = Math.max(0, Math.min(rows.length - 1, row));
    const max = (rows[nextRow]?.workbook?.problems.length ?? 1) - 1;
    const nextCol = Math.max(0, Math.min(max, col));
    setAt({ row: nextRow, col: nextCol });
    cell(nextRow, nextCol)?.focus();
  };
  const onKey = (
    event: KeyboardEvent,
    student: Student,
    problem: MarkedProblem,
    row: number,
    col: number,
  ) => {
    const draft = drafts[student.id]?.[problem.n] ?? null;
    const place = (mark: PaperMark | null) => {
      if (!problem.mark) onMark(student.id, problem.n, mark);
    };
    const key = event.key.toLowerCase();
    const moves: Record<string, [number, number]> = {
      arrowright: [row, col + 1],
      arrowleft: [row, col - 1],
      arrowdown: [row + 1, col],
      arrowup: [row - 1, col],
      home: [row, 0],
      end: [row, columns - 1],
    };
    if (moves[key]) {
      event.preventDefault();
      go(...moves[key]!);
    } else if (key === "r" || key === "1") {
      event.preventDefault();
      place("right");
      go(row, col + 1);
    } else if (key === "n" || key === "0" || key === "2") {
      event.preventDefault();
      place("not-yet");
      go(row, col + 1);
    } else if (key === "backspace" || key === "delete") {
      event.preventDefault();
      place(null);
    } else if (key === "a") {
      event.preventDefault();
      onAllRight(student);
    } else if (key === " " || key === "enter") {
      event.preventDefault();
      place(draft === null ? "right" : draft === "right" ? "not-yet" : null);
    }
  };
  return (
    <>
      <div className={styles.legend} aria-hidden={!canMark}>
        <span className={styles.legendItem}>
          <span
            className={styles.cellMark}
            data-mark="right"
            data-state="draft"
          >
            {glyph("right")}
          </span>
          Right
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.cellMark}
            data-mark="not-yet"
            data-state="draft"
          >
            {glyph("not-yet")}
          </span>
          Not yet
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.cellMark}
            data-mark="right"
            data-state="saved"
          >
            {glyph("right")}
          </span>
          Saved
        </span>
        <span className={styles.keys}>
          Keys: <kbd>R</kbd> right, <kbd>N</kbd> not yet, arrows move,{" "}
          <kbd>A</kbd> marks the rest right
        </span>
      </div>
      <div
        className={styles.grid}
        role="grid"
        aria-label={`Marks by ${who.learner} and problem`}
        tabIndex={-1}
        style={{ "--columns": columns } as never}
      >
        <div role="row" className={styles.headRow}>
          <div role="columnheader" className={styles.corner}>
            Student
          </div>
          {Array.from({ length: columns }, (_, index) => (
            <div key={index} role="columnheader" className={styles.number}>
              {index + 1}
            </div>
          ))}
        </div>
        {students.map((student) => {
          const row = rows.indexOf(student);
          const problems = student.workbook?.problems ?? [];
          const own = drafts[student.id] ?? {};
          const open = problems.some(
            (problem) => !problem.mark && !own[problem.n],
          );
          return (
            <div
              key={student.id}
              role="row"
              className={styles.row}
              data-current={focusStudent === student.id || undefined}
            >
              <div role="rowheader" className={styles.name}>
                <Avatar name={student.name} size="small" />
                <span className={styles.nameText}>
                  <span className={styles.nameLine}>{student.name}</span>
                  <span className={styles.nameDetail}>
                    {!student.workbook
                      ? "No workbook"
                      : student.workbook.stale
                        ? "Problems changed"
                        : summaryText(problems, own)}
                  </span>
                </span>
                {canMark && student.workbook && !student.workbook.stale && (
                  <button
                    type="button"
                    className={styles.allRight}
                    disabled={!open}
                    aria-label={`All right for ${student.name}`}
                    onClick={() => onAllRight(student)}
                  >
                    All right
                  </button>
                )}
              </div>
              {Array.from({ length: columns }, (_, col) => {
                const problem = problems[col];
                if (!problem || student.workbook?.stale)
                  return (
                    <div key={col} role="gridcell" className={styles.gap} />
                  );
                const mark = problem.mark ?? own[problem.n] ?? null;
                const label = `${student.name}, problem ${problem.n}, ${problem.label}: ${mark ? markWord[mark] : "not marked"}${problem.mark ? ", saved" : ""}`;
                return (
                  <div key={col} role="gridcell" className={styles.cellWrap}>
                    <button
                      type="button"
                      className={styles.cell}
                      data-cell={`${row}:${col}`}
                      aria-label={label}
                      title={`${problem.n}. ${problem.label}`}
                      tabIndex={row === at.row && col === at.col ? 0 : -1}
                      aria-disabled={!!problem.mark || !canMark || undefined}
                      onFocus={() => setAt({ row, col })}
                      onClick={() => {
                        if (problem.mark || !canMark) return;
                        const draft = own[problem.n] ?? null;
                        onMark(
                          student.id,
                          problem.n,
                          draft === null
                            ? "right"
                            : draft === "right"
                              ? "not-yet"
                              : null,
                        );
                      }}
                      onKeyDown={(event) =>
                        onKey(event, student, problem, row, col)
                      }
                    >
                      <span
                        className={styles.cellMark}
                        data-mark={mark ?? "none"}
                        data-state={problem.mark ? "saved" : "draft"}
                      >
                        {glyph(mark)}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** On a phone, one student at a time, with each problem named. */
function PhoneSheet({
  student,
  students,
  drafts,
  canMark,
  onMark,
  onAllRight,
  onStudent,
}: {
  student: Student;
  students: Student[];
  drafts: Record<number, PaperMark>;
  canMark: boolean;
  onMark: (n: number, mark: PaperMark | null) => void;
  onAllRight: () => void;
  onStudent: (id: string) => void;
}) {
  const who = useContext(Who);
  const index = students.indexOf(student);
  const previous = students[index - 1];
  const next = students[index + 1];
  const problems = student.workbook?.problems ?? [];
  const open = problems.some((problem) => !problem.mark && !drafts[problem.n]);
  return (
    <div className={styles.phone}>
      <div className={styles.phoneHead}>
        <Button
          variant="secondary"
          className={styles.phoneStep}
          aria-label={
            previous ? `Back to ${previous.name}` : `First ${who.learner}`
          }
          disabled={!previous}
          onClick={() => previous && onStudent(previous.id)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
        </Button>
        <div className={styles.phoneWho}>
          <strong>{student.name}</strong>
          <span>
            Student {index + 1} of {students.length}
          </span>
        </div>
        <Button
          variant="secondary"
          className={styles.phoneStep}
          aria-label={next ? `On to ${next.name}` : `Last ${who.learner}`}
          disabled={!next}
          onClick={() => next && onStudent(next.id)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </Button>
      </div>
      {!student.workbook ? (
        <p className={styles.phoneNone}>
          No workbook for this student in this set.
        </p>
      ) : student.workbook.stale ? (
        <p className={styles.phoneNone}>
          Some of these problems have changed since this sheet was printed.
          Print a new set for this student.
        </p>
      ) : (
        <>
          <div className={styles.phoneSummary}>
            <span>{summaryText(problems, drafts)}</span>
            {canMark && (
              <Button variant="secondary" disabled={!open} onClick={onAllRight}>
                All right
              </Button>
            )}
          </div>
          <ol className={styles.phoneRows}>
            {problems.map((problem) => {
              const draft = drafts[problem.n] ?? null;
              return (
                <li key={problem.n} className={styles.phoneRow}>
                  <span className={styles.phoneNumber}>{problem.n}</span>
                  <span className={styles.phoneLabel}>
                    <span>{problem.label}</span>
                    <small>{sectionNames[problem.section]}</small>
                  </span>
                  {problem.mark ? (
                    <span
                      className={styles.phoneSaved}
                      data-mark={problem.mark}
                    >
                      {markWord[problem.mark]}
                    </span>
                  ) : (
                    <span
                      className={styles.phonePick}
                      role="group"
                      aria-label={`Problem ${problem.n}`}
                    >
                      {(["right", "not-yet"] as const).map((mark) => (
                        <button
                          key={mark}
                          type="button"
                          aria-pressed={draft === mark}
                          aria-label={`${markWord[mark]}, problem ${problem.n}`}
                          disabled={!canMark}
                          data-mark={mark}
                          onClick={() =>
                            onMark(problem.n, draft === mark ? null : mark)
                          }
                        >
                          {glyph(mark)}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
