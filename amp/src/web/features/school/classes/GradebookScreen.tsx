import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  gradebookColumns,
  type GradebookColumn,
  type GradebookResponse,
  type GradeRow,
  type SuggestionResource,
  type TermResource,
} from "../../../../schools/teacher-contracts";
import type { AuthSession } from "../../../auth";
import { AppError } from "../../../lib/AppError";
import { Badge } from "../../../ui/Badge";
import { Button, buttonClass } from "../../../ui/Button";
import { CheckboxControl } from "../../../ui/Checkbox";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { Dialog } from "../../../ui/Dialog";
import { EmptyState } from "../../../ui/EmptyState";
import { Meter } from "../../../ui/Meter";
import { Segmented } from "../../../ui/Segmented";
import { Sheet } from "../../../ui/Sheet";
import { Stepper } from "../../../ui/Stepper";
import { Toast } from "../../../ui/Toast";
import { currentSession, orgOptions } from "../api";
import { useStaffSession } from "./api";
import { ClassFrame } from "./ClassFrame";
import { EvidenceSheet } from "./EvidenceSheet";
import { FinalField, Suggested } from "./grade-parts";
import {
  downloadGradebook,
  downloadOneRoster,
  failureMessage,
  gradebookOptions,
  useCloseTerm,
  useSetTarget,
  type Place,
} from "./teacher-api";
import {
  classUrl,
  dayRange,
  LoadFailed,
  longDay,
  parseSort,
  useClassSearch,
  uuidOr,
} from "./teacher-shared";
import styles from "./Teacher.module.css";

const COMPONENTS = [
  { id: "course", label: "Course progress" },
  { id: "growth", label: "Growth" },
  { id: "practice", label: "Practice" },
  { id: "retention", label: "Retention" },
] as const;
const COLUMN_LABELS: Record<GradebookColumn, string> = {
  sis: "SIS ID",
  name: "Student name",
  final: "Final grade",
  low: "Suggested low",
  high: "Suggested high",
  course: "Course progress",
  growth: "Growth",
  practice: "Practice",
  retention: "Retention",
  minutes: "Active minutes",
};
const scoreOf = (
  suggestion: SuggestionResource,
  id: (typeof COMPONENTS)[number]["id"],
) => suggestion.components.find((entry) => entry.id === id)?.score ?? null;

/** "Q2" where a term's name allows it: a segment holds a few characters. */
function shortName(name: string) {
  const match = /^(Semester|Trimester|Quarter|Term)\s+(\d+)$/i.exec(name);
  return match ? `${match[1]![0]!.toUpperCase()}${match[2]}` : name;
}

function ExportSheet({
  open,
  onOpenChange,
  session,
  place,
  term,
  onMessage,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AuthSession | null;
  place: Place;
  term: TermResource;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [columns, setColumns] = useState<ReadonlySet<GradebookColumn>>(
    () => new Set(gradebookColumns),
  );
  const [busy, setBusy] = useState<"csv" | "zip" | null>(null);
  const run = (kind: "csv" | "zip") => {
    setBusy(kind);
    (kind === "csv"
      ? downloadGradebook(
          session,
          place,
          term.id,
          gradebookColumns.filter((column) => columns.has(column)),
        )
      : downloadOneRoster(session, place, term.id)
    )
      .then((name) => {
        onMessage(`Downloaded ${name}.`);
        onOpenChange(false);
      })
      .catch((error) =>
        onError(
          failureMessage(
            error,
            "That file didn’t download. Check your connection and try again.",
          ),
        ),
      )
      .finally(() => setBusy(null));
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Export grades"
      description={term.name}
    >
      <div className={styles.exportSheet}>
        <section>
          <h3>Gradebook CSV</h3>
          <p className={styles.exportHint}>
            A column for each thing your gradebook or SIS needs. Blend it with
            the rest of the course grade however your school does.
          </p>
          <div className={styles.columnPicks}>
            {gradebookColumns.map((column) => (
              <label key={column} className={styles.columnPick}>
                <CheckboxControl
                  checked={columns.has(column)}
                  onChange={(event) => {
                    const next = new Set(columns);
                    if (event.target.checked) next.add(column);
                    else next.delete(column);
                    setColumns(next);
                  }}
                />
                <span>{COLUMN_LABELS[column]}</span>
              </label>
            ))}
          </div>
          {columns.size > 0 ? (
            <Button
              variant="primary"
              aria-busy={busy === "csv" || undefined}
              disabled={busy !== null}
              onClick={() => run("csv")}
            >
              Download CSV
            </Button>
          ) : (
            <p className={styles.exportHint}>
              Choose at least one column to download.
            </p>
          )}
        </section>
        <section>
          <h3>OneRoster 1.2</h3>
          <p className={styles.exportHint}>
            A ZIP with lineItems.csv and results.csv, for an SIS that imports
            OneRoster. Only final grades you’ve entered are sent.
          </p>
          <Button
            variant="secondary"
            aria-busy={busy === "zip" || undefined}
            disabled={busy !== null}
            onClick={() => run("zip")}
          >
            Download ZIP
          </Button>
        </section>
      </div>
    </Sheet>
  );
}

/** The one number a teacher sets. Zero is no target, which reads as the class's
 * usual week. Changes settle before they save, so stepping isn't a stream of
 * writes. */
/** Exported for Settings, where a small class sets it. */
export function WeeklyTarget({
  session,
  place,
  book,
  onError,
}: {
  session: AuthSession | null;
  place: Place;
  book: GradebookResponse;
  onError: (message: string) => void;
}) {
  const save = useSetTarget(session, place);
  const stored = book.weeklyTargetMinutes ?? 0;
  const [value, setValue] = useState(stored);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!timer.current && !save.isPending) setValue(stored);
  }, [stored, save.isPending]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (book.targetLocked)
    return (
      <span className={styles.lockedTarget}>
        Weekly target {book.weeklyTargetMinutes} min, set by your school
      </span>
    );
  return (
    <Stepper
      label="Weekly target"
      value={value}
      min={0}
      max={300}
      step={15}
      format={(minutes) => (minutes === 0 ? "Not set" : `${minutes} min`)}
      onChange={(next) => {
        setValue(next);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = undefined;
          save.mutate(next === 0 ? null : next, {
            onError: (error) => {
              setValue(stored);
              onError(
                failureMessage(
                  error,
                  "The weekly target didn’t save. Check your connection and try again.",
                ),
              );
            },
          });
        }, 400);
      }}
    />
  );
}

/** One made-up line of the gradebook, for the empty state: what a suggested
 * range and its four parts look like once there's work. */
function ExampleGrade() {
  const parts = [
    ["Course progress", 92],
    ["Growth", 100],
    ["Practice", 56],
    ["Retention", 96],
  ] as const;
  return (
    <div className={styles.exampleGrade}>
      <div className={styles.exampleGradeTop}>
        <span className={styles.exampleName}>A student</span>
        <Suggested
          suggestion={{
            status: "ready",
            low: 85,
            high: 90,
            letters: "B to A−",
            components: [],
          }}
        />
      </div>
      <dl className={styles.gradeCardMeters}>
        {parts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <Meter value={value} label={label} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A class's term: a suggested range and four components per student, and a
 * final grade the teacher decides. Every row opens to its evidence. */
export function GradebookScreen() {
  const place = useParams({ from: "/school/$org/classes/$class/gradebook" });
  const session = useStaffSession();
  const [search, set] = useClassSearch();
  const requested = uuidOr(search.term);
  const book = useQuery(gradebookOptions(session, place, requested));
  const family =
    useQuery({
      ...orgOptions(currentSession(), place.org),
      refetchOnMount: false,
    }).data?.kind === "family";
  const close = useCloseTerm(session, place);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [closingHere, setClosing] = useState(false);
  // Settings of a small class opens this with `?close=1`.
  const closing = closingHere || search.close === 1 || search.close === "1";
  const stopClosing = () => {
    setClosing(false);
    if (search.close) set({ close: undefined });
  };
  const [announcement, setAnnouncement] = useState("");
  const data = book.data;
  const term = data?.term ?? null;
  // A shared link to a term that isn't this class's: the class's current term.
  const unknownTerm =
    !!requested && book.error instanceof AppError && book.error.status === 404;
  useEffect(() => {
    if (unknownTerm) set({ term: undefined }, { replace: true });
    // `set` changes each render; this is about the failure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unknownTerm]);
  const open = uuidOr(search.student);
  const editable = !!data?.canEdit && term?.state === "open";
  const rows = data?.students ?? [];
  const entered = rows.filter((row) => row.final).length;
  // Who the sheet showed last, once the URL has already moved on.
  const lastOpen = useRef(open);
  if (open) lastOpen.current = open;

  const final = (row: GradeRow) => (
    <FinalField
      session={session}
      place={place}
      student={row}
      term={term?.id ?? ""}
      final={row.final}
      editable={editable}
      onError={setError}
      onSaved={setAnnouncement}
    />
  );
  const name = (row: GradeRow) => (
    <button
      type="button"
      className={styles.student}
      data-student={row.id}
      onClick={() => set({ student: row.id })}
    >
      <span>{row.name}</span>
    </button>
  );
  const meter = (row: GradeRow, id: (typeof COMPONENTS)[number]["id"]) => {
    const score = scoreOf(row.suggestion, id);
    const label = COMPONENTS.find((entry) => entry.id === id)!.label;
    return score === null ? (
      <span className={styles.noScore} aria-label={`${label}: not yet`}>
        —
      </span>
    ) : (
      <Meter value={score} label={`${label} for ${row.name}`} />
    );
  };
  const columns = useMemo<DataGridColumn<GradeRow>[]>(
    () => [
      {
        id: "student",
        header: family ? "Child" : "Student",
        width: 160,
        compare: (a, b) => a.name.localeCompare(b.name, "en"),
        cell: name,
      },
      {
        id: "suggested",
        header: "Suggested",
        width: 130,
        firstSort: "descending",
        compare: (a, b) => (a.suggestion.low ?? -1) - (b.suggestion.low ?? -1),
        cell: (row) => <Suggested suggestion={row.suggestion} />,
      },
      ...COMPONENTS.map(({ id, label }): DataGridColumn<GradeRow> => ({
        id,
        header: label,
        // Room for "Course progress" and its sort chevron on one line.
        width: 96,
        firstSort: "descending",
        compare: (a, b) =>
          (scoreOf(a.suggestion, id) ?? -1) - (scoreOf(b.suggestion, id) ?? -1),
        cell: (row) => meter(row, id),
      })),
      {
        id: "final",
        header: "Final",
        width: 96,
        cell: final,
      },
    ],
    // Cells read the current row and term; a row only changes with new data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [term?.id, editable, session, place.class, family],
  );
  const card = (row: GradeRow) => (
    <div className={styles.gradeCard}>
      <div className={styles.gradeCardTop}>
        {name(row)}
        <div className={styles.gradeCardFinal}>
          <span aria-hidden="true">Final</span>
          {final(row)}
        </div>
      </div>
      <div className={styles.gradeCardSuggested}>
        <Suggested suggestion={row.suggestion} />
      </div>
      {row.suggestion.status === "ready" && (
        <dl className={styles.gradeCardMeters}>
          {COMPONENTS.map(({ id, label }) => (
            <div key={id}>
              <dt>{label}</dt>
              <dd>{meter(row, id)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
  const missing = rows.length - entered;
  // Nobody has a week's work yet: what a grade will look like, not a table of
  // dashes.
  const waiting =
    rows.length > 0 &&
    rows.every((row) => row.suggestion.status !== "ready" && !row.final);
  return (
    <ClassFrame
      org={place.org}
      classId={place.class}
      className={data?.class.name}
      loading={book.isPending}
      tab="gradebook"
    >
      {!data ? (
        <LoadFailed what="The gradebook" onRetry={() => void book.refetch()} />
      ) : !term ? (
        <EmptyState
          title="This class has no grading periods yet"
          action={
            <Link
              to="/$"
              params={{ _splat: `school/${place.org}/calendar` }}
              className={buttonClass("primary")}
            >
              Open the calendar
            </Link>
          }
        >
          Add the school year and its terms, and suggested ranges appear here.
        </EmptyState>
      ) : (
        <div className={styles.gradePage} aria-busy={book.isFetching}>
          <div className={styles.gradeHead}>
            <div className={styles.gradeTitle}>
              <h1>{term.name} grades</h1>
              <p>{dayRange(term.startsOn, term.endsOn)}</p>
            </div>
            <div className={styles.gradeControls}>
              {data.terms.length > 1 && (
                <div className={styles.term}>
                  <Segmented<string>
                    compact
                    dense
                    label="Term"
                    value={requested ?? term.id}
                    options={data.terms.map((entry) => ({
                      value: entry.id,
                      label: shortName(entry.name),
                    }))}
                    onChange={(value) => set({ term: value })}
                  />
                </div>
              )}
            </div>
          </div>
          {term.state === "upcoming" ? (
            <div className={styles.gradeEmpty}>
              <EmptyState
                title={`${term.name} starts ${longDay(term.startsOn)}`}
              >
                Suggested ranges appear here once students have work in this
                term.
              </EmptyState>
            </div>
          ) : rows.length === 0 ? (
            <div className={styles.gradeEmpty}>
              <EmptyState
                title={
                  family
                    ? "No children in this term"
                    : "No students in this term"
                }
                example={<ExampleGrade />}
                action={
                  <Link
                    to="/$"
                    params={{
                      _splat: family
                        ? "family/learners"
                        : classUrl(place.org, place.class, "settings"),
                    }}
                    search={(family ? {} : { add: 1 }) as never}
                    className={buttonClass("primary")}
                  >
                    {family ? "Add a child" : "Add students"}
                  </Link>
                }
              >
                {family
                  ? "Each child gets a suggested range as they practice."
                  : "Add students and each one gets a suggested range as they work."}
              </EmptyState>
            </div>
          ) : waiting ? (
            <div className={styles.gradeEmpty}>
              <EmptyState
                title="Suggested grades appear after a week of work"
                example={<ExampleGrade />}
                action={
                  <Link
                    to="/$"
                    params={{
                      _splat: classUrl(place.org, place.class, "today"),
                    }}
                    className={buttonClass("primary")}
                  >
                    Back to Today
                  </Link>
                }
              >
                A range comes from course progress, growth, practice and
                retention, and opens to its evidence. You decide every final
                grade.
              </EmptyState>
            </div>
          ) : (
            <>
              <div className={styles.toolbar}>
                <div className={styles.toolbarMain}>
                  {term.state === "closed" ? (
                    <Badge>Closed</Badge>
                  ) : data.canEdit ? (
                    <WeeklyTarget
                      session={session}
                      place={place}
                      book={data}
                      onError={setError}
                    />
                  ) : (
                    <span className={styles.lockedTarget}>
                      {data.weeklyTargetMinutes
                        ? `Weekly target ${data.weeklyTargetMinutes} min`
                        : "No weekly target"}
                    </span>
                  )}
                </div>
                <span className={styles.count}>
                  {term.state === "closed"
                    ? "Grades in a closed term are frozen."
                    : `${entered} of ${rows.length} final grades entered`}
                </span>
                <div className={styles.toolbarActions}>
                  <Button variant="quiet" onClick={() => set({ export: 1 })}>
                    Export
                  </Button>
                  <Link
                    to="/$"
                    params={{
                      _splat: classUrl(place.org, place.class, "report-cards"),
                    }}
                    search={{ term: term.id } as never}
                    className={buttonClass("quiet", "", "start")}
                  >
                    Report cards
                  </Link>
                  {editable && (
                    <Button
                      variant="secondary"
                      onClick={() => setClosing(true)}
                    >
                      Close term
                    </Button>
                  )}
                </div>
              </div>
              <DataGrid
                label={`${term.name} grades`}
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                sort={
                  parseSort(search.sort) ?? {
                    column: "student",
                    direction: "ascending",
                  }
                }
                onSortChange={(next) =>
                  set(
                    { sort: `${next.column}:${next.direction}` },
                    { replace: true },
                  )
                }
                onRowActivate={(row) => set({ student: row.id })}
                rowHeight={52}
                rules={false}
                cardLayout="list"
                cardsSort={rows.length > 6}
                cardEstimate={200}
                card={card}
              />
            </>
          )}
        </div>
      )}
      {term && data && (
        <>
          <EvidenceSheet
            place={place}
            session={session}
            term={term.id}
            student={open}
            returnFocus={lastOpen.current}
            onClose={() => set({ student: undefined })}
            onError={setError}
            onSaved={setAnnouncement}
          />
          <ExportSheet
            open={search.export === 1 || search.export === "1"}
            onOpenChange={(next) => {
              if (!next) set({ export: undefined });
            }}
            session={session}
            place={place}
            term={term}
            onMessage={setMessage}
            onError={setError}
          />
          <Dialog
            open={closing}
            onOpenChange={(next) => {
              if (!next && !close.isPending) stopClosing();
            }}
            title={`Close ${term.name}?`}
          >
            <div className={styles.dialog}>
              <p>
                This freezes every suggested range with the evidence behind it,
                and final grades can no longer change.
                {missing > 0
                  ? ` ${missing === 1 ? "1 student has" : `${missing} students have`} no final grade yet.`
                  : ""}
              </p>
              <div className={styles.dialogActions}>
                <Button
                  variant="secondary"
                  disabled={close.isPending}
                  onClick={stopClosing}
                >
                  Keep it open
                </Button>
                <Button
                  variant="primary"
                  aria-busy={close.isPending || undefined}
                  disabled={close.isPending}
                  onClick={() =>
                    close.mutate(term.id, {
                      onSuccess: () => {
                        stopClosing();
                        setMessage(`${term.name} is closed.`);
                      },
                      onError: (failure) => {
                        stopClosing();
                        setError(
                          failureMessage(
                            failure,
                            "The term didn’t close. Check your connection and try again.",
                          ),
                        );
                      },
                    })
                  }
                >
                  Close {term.name}
                </Button>
              </div>
            </div>
          </Dialog>
        </>
      )}
      <span className={styles.liveRegion} role="status">
        {announcement}
      </span>
      <Toast tone="status" message={message} onDismiss={() => setMessage("")} />
      <Toast message={error} onDismiss={() => setError("")} />
    </ClassFrame>
  );
}
