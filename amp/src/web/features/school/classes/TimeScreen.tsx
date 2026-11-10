import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  timePeriods,
  type TimePeriod,
  type TimeResponse,
} from "../../../../schools/teacher-contracts";
import { Button } from "../../../ui/Button";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { Segmented } from "../../../ui/Segmented";
import { Sheet } from "../../../ui/Sheet";
import { StatRow, StatTile } from "../../../ui/StatTile";
import { Toast } from "../../../ui/Toast";
import { currentSession, orgOptions } from "../api";
import { useStaffSession } from "./api";
import { ClassFrame } from "./ClassFrame";
import { TimeDetail } from "./ProgressRecord";
import {
  downloadTime,
  failureMessage,
  studentTimeOptions,
  timeOptions,
  type Place,
} from "./teacher-api";
import {
  buttonClass,
  classUrl,
  dayRange,
  fullDay,
  LoadFailed,
  number,
  parseSort,
  shortDay,
  studentUrl,
  TipZone,
  useClassSearch,
} from "./teacher-shared";
import styles from "./Teacher.module.css";

type Row = TimeResponse["students"][number];
const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "4 weeks" },
  { value: "term", label: "Term" },
];
const DAY = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);

/** Up to six weeks, a column a day, grouped by week; past that, a column a week. */
const MOST_DAYS = 42;
const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY,
  ) + 1;
type Column = { from: string; to: string; label: string };
const weekdayName = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
const isMonday = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).getUTCDay() === 1;
function columnsOf(data: TimeResponse): {
  columns: Column[];
  days: boolean;
} {
  const { from, to } = data.range;
  if (data.period === "week") {
    const week = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(data.weeks[0]!, index);
      return { from: day, to: day, label: weekdayName(day) };
    });
    return { columns: week, days: true };
  }
  const count = daysBetween(from, to);
  if (count <= MOST_DAYS) {
    const days = Array.from({ length: count }, (_, index) => {
      const day = addDays(from, index);
      return {
        from: day,
        to: day,
        label: isMonday(day) || index === 0 ? shortDay(day) : "",
      };
    });
    return { columns: days, days: true };
  }
  const weeks = data.weeks.map((week, index, all) => ({
    from: week,
    to: addDays(week, 6),
    label:
      index === 0 || week.slice(5, 7) !== all[index - 1]!.slice(5, 7)
        ? shortDay(week)
        : "",
  }));
  return { columns: weeks, days: false };
}
/** Five steps of one hue, darker for more, measured against what a good week or
 * day looks like. Zero is its own, emptier mark. */
function bin(minutes: number, full: number) {
  if (minutes <= 0) return 0;
  return Math.min(5, Math.ceil((minutes / full) * 5));
}
const minutesIn = (row: Row, column: Column) =>
  row.days
    .filter((entry) => entry.day >= column.from && entry.day <= column.to)
    .reduce((sum, entry) => sum + entry.minutes, 0);

function Heat({
  row,
  columns,
  full,
  isDay,
}: {
  row: Row;
  columns: Column[];
  full: number;
  isDay: boolean;
}) {
  return (
    <span
      className={styles.heatStrip}
      style={{ "--heat-columns": columns.length } as CSSProperties}
    >
      {columns.map((column) => {
        const minutes = minutesIn(row, column);
        return (
          <span
            key={column.from}
            className={styles.heatCell}
            data-bin={bin(minutes, full)}
            data-monday={(isDay && isMonday(column.from)) || undefined}
            data-tip={`${row.first}, ${isDay ? fullDay(column.from) : `week of ${shortDay(column.from)}`}: ${Math.round(minutes)} active minutes`}
          />
        );
      })}
    </span>
  );
}

function Legend({ full, isDay }: { full: number; isDay: boolean }) {
  return (
    <div className={styles.heatLegend} aria-hidden="true">
      <span>Active minutes {isDay ? "a day" : "a week"}</span>
      <span className={styles.heatLegendScale}>
        <span>0</span>
        {[0, 1, 2, 3, 4, 5].map((step) => (
          <span key={step} className={styles.heatCell} data-bin={step} />
        ))}
        <span>{Math.round(full)}+</span>
      </span>
    </div>
  );
}

/** Four made-up weeks of one learner, for the empty state: what the grid of
 * days looks like once there's work. */
const EXAMPLE_DAYS = [
  0, 3, 4, 0, 2, 0, 0, 4, 5, 3, 0, 4, 0, 0, 2, 4, 5, 5, 3, 0, 0, 5, 4, 0, 5, 3,
  0, 0,
];
function ExampleTime() {
  return (
    <div className={styles.exampleTime}>
      <div className={styles.heatCardTop}>
        <span className={styles.exampleName}>A learner</span>
        <span className={styles.heatTotal}>312 min</span>
      </div>
      <span
        className={styles.heatStrip}
        style={{ "--heat-columns": EXAMPLE_DAYS.length } as CSSProperties}
      >
        {EXAMPLE_DAYS.map((step, index) => (
          <span
            key={index}
            className={styles.heatCell}
            data-bin={step}
            data-monday={index % 7 === 0 || undefined}
          />
        ))}
      </span>
      <Legend full={20} isDay />
    </div>
  );
}

/** One student's days and skills, from a row. */
function DaySheet({
  place,
  period,
  student,
  returnFocus,
  onClose,
}: {
  place: Place;
  period: TimePeriod;
  student: string | undefined;
  returnFocus: string | undefined;
  onClose: () => void;
}) {
  const session = useStaffSession();
  const time = useQuery({
    ...studentTimeOptions(session, place, period, student ?? ""),
    enabled: !!session && !!student,
  });
  const data = student ? time.data : undefined;
  return (
    <Sheet
      tall
      open={!!student}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={data?.student.name ?? "Time"}
      description={
        data ? dayRange(data.range.from, data.range.to) : "Reading the days"
      }
      returnFocus={() =>
        document.querySelector<HTMLElement>(`[data-student="${returnFocus}"]`)
      }
    >
      {time.isError ? (
        <div className={styles.sheetFailed} role="alert">
          <p>These days didn’t load. Check your connection, then try again.</p>
          <Button variant="primary" onClick={() => void time.refetch()}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <Loading>Reading the days</Loading>
      ) : (
        <div className={styles.evidence}>
          <TimeDetail time={data} who={data.student.name} />
          <Link
            to="/$"
            params={{
              _splat: studentUrl(place.org, data.student.id, place.class),
            }}
            className={buttonClass("quiet", "", "start")}
          >
            Open {data.student.first}’s record
          </Link>
        </div>
      )}
    </Sheet>
  );
}

/** Minutes per student over days or weeks, as one grid of one hue: who's working
 * and when reads at a glance, with the numbers a hover away and in the export. */
export function TimeScreen() {
  const place = useParams({ from: "/school/$org/classes/$class/time" });
  const session = useStaffSession();
  const [search, set] = useClassSearch();
  const period =
    timePeriods.find((entry) => entry === search.period) ?? "month";
  const time = useQuery(timeOptions(session, place, period));
  const family =
    useQuery({
      ...orgOptions(currentSession(), place.org),
      refetchOnMount: false,
    }).data?.kind === "family";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const data = time.data;
  const student =
    typeof search.student === "string" &&
    data?.students.some((row) => row.id === search.student)
      ? search.student
      : undefined;
  const lastOpen = useRef(student);
  if (student) lastOpen.current = student;
  const { columns, days: isDay } = data
    ? columnsOf(data)
    : { columns: [], days: false };
  const target = data?.weeklyTargetMinutes ?? 60;
  // A good day is about a third of a good week.
  const full = isDay ? Math.max(5, Math.round(target / 3)) : target;
  const gridColumns = useMemo<DataGridColumn<Row>[]>(
    () => [
      {
        id: "student",
        header: family ? "Child" : "Student",
        width: 160,
        compare: (a, b) => a.name.localeCompare(b.name, "en"),
        cell: (row) => (
          <button
            type="button"
            className={styles.student}
            data-student={row.id}
            onClick={() => set({ student: row.id })}
          >
            <span>{row.name}</span>
          </button>
        ),
      },
      {
        id: "minutes",
        header: "Minutes",
        width: 72,
        firstSort: "descending",
        align: "end",
        compare: (a, b) => a.minutes - b.minutes,
        cell: (row) => (
          <span className={styles.heatTotal}>{number(row.minutes)}</span>
        ),
      },
      {
        id: "days",
        header: isDay ? "Day by day" : "Week by week",
        headerDetail: (
          <span
            className={styles.heatTicks}
            style={{ "--heat-columns": columns.length } as CSSProperties}
          >
            {columns.map((column) => (
              <span
                key={column.from}
                data-monday={(isDay && isMonday(column.from)) || undefined}
              >
                {column.label}
              </span>
            ))}
          </span>
        ),
        width: Math.max(420, columns.length * 14),
        cell: (row) => (
          <Heat row={row} columns={columns} full={full} isDay={isDay} />
        ),
        cellLabel: (row) => `${row.name}: ${row.minutes} active minutes`,
      },
    ],
    // Cells follow this response's rows and columns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, family],
  );
  const totalMinutes = (data?.students ?? []).reduce(
    (sum, row) => sum + row.minutes,
    0,
  );
  const working = (data?.students ?? []).filter((row) => row.minutes > 0);
  const weeks = data
    ? Math.max(1, daysBetween(data.range.from, data.range.to) / 7)
    : 1;
  const perStudent = working.length
    ? Math.round(totalMinutes / working.length / weeks)
    : 0;
  const largestSkill = Math.max(
    1,
    ...(data?.skills ?? []).map((s) => s.minutes),
  );
  return (
    <ClassFrame
      org={place.org}
      classId={place.class}
      className={data?.class.name}
      loading={time.isPending}
      tab="time"
    >
      {!data ? (
        <LoadFailed
          what="The time report"
          onRetry={() => void time.refetch()}
        />
      ) : (
        <div className={styles.gradePage} aria-busy={time.isFetching}>
          <div className={styles.gradeHead}>
            <div className={styles.gradeTitle}>
              <h1>Time</h1>
              <p>{dayRange(data.range.from, data.range.to)}</p>
            </div>
            <div className={styles.gradeControls}>
              <div className={styles.period}>
                <Segmented<TimePeriod>
                  compact
                  dense
                  label="Period"
                  value={period}
                  options={PERIODS}
                  onChange={(value) => set({ period: value })}
                />
              </div>
              {/* Nothing to export yet: the export holds its place unseen. */}
              <div
                className={styles.export}
                style={{
                  visibility:
                    data.students.length === 0 ||
                    data.students.every((row) => row.minutes === 0)
                      ? "hidden"
                      : undefined,
                }}
              >
                <Button
                  variant="secondary"
                  aria-busy={busy || undefined}
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    downloadTime(session, place, period)
                      .then((name) => setMessage(`Downloaded ${name}.`))
                      .catch((failure) =>
                        setError(
                          failureMessage(
                            failure,
                            "That file didn’t download. Check your connection and try again.",
                          ),
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Export
                </Button>
              </div>
            </div>
          </div>
          {data.students.length === 0 || totalMinutes === 0 ? (
            <div className={styles.gradeEmpty}>
              <EmptyState
                title={
                  period === "week"
                    ? "No practice time this week yet"
                    : "No practice time yet"
                }
                example={<ExampleTime />}
                action={
                  <Link
                    to="/$"
                    params={{
                      _splat: classUrl(
                        place.org,
                        place.class,
                        family ? "today" : "start",
                      ),
                    }}
                    className={buttonClass("primary")}
                  >
                    {family ? "Back to Today" : "Start class"}
                  </Link>
                }
              >
                {family
                  ? "Each child’s active minutes appear here day by day as they practice, with the skills the time went to."
                  : "Each student’s active minutes appear here day by day as they work, with the skills the time went to."}
              </EmptyState>
            </div>
          ) : (
            <>
              <div className={styles.timeFacts}>
                <StatRow>
                  <StatTile
                    value={number(totalMinutes)}
                    label="active minutes"
                  />
                  <StatTile
                    value={`${working.length} of ${data.students.length}`}
                    label={family ? "children practiced" : "students working"}
                  />
                  <StatTile
                    value={number(perStudent)}
                    label="minutes a week each"
                  />
                </StatRow>
                <Legend full={full} isDay={isDay} />
              </div>
              <TipZone>
                <DataGrid
                  label="Active minutes by student"
                  columns={gridColumns}
                  rows={data.students}
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
                  rules={false}
                  cardLayout="list"
                  cardsSort={data.students.length > 6}
                  cardEstimate={92}
                  card={(row) => (
                    <div className={styles.heatCard}>
                      <div className={styles.heatCardTop}>
                        <button
                          type="button"
                          className={styles.student}
                          data-student={row.id}
                          onClick={() => set({ student: row.id })}
                        >
                          <span>{row.name}</span>
                        </button>
                        <span className={styles.heatTotal}>
                          {number(row.minutes)} min
                        </span>
                      </div>
                      <Heat
                        row={row}
                        columns={columns}
                        full={full}
                        isDay={isDay}
                      />
                    </div>
                  )}
                />
              </TipZone>
              {data.skills.some((skill) => skill.minutes > 0) && (
                <section className={styles.timeSkills}>
                  <h2>Where the time went</h2>
                  <ul className={styles.skillBars}>
                    {data.skills
                      .filter((skill) => skill.minutes > 0)
                      .map((skill) => (
                        <li key={skill.skillId}>
                          <span className={styles.skillName}>
                            {skill.title}
                          </span>
                          <span className={styles.skillValue}>
                            {number(skill.minutes)} min
                          </span>
                          <span className={styles.skillTrack}>
                            <span
                              className={styles.skillFill}
                              style={{
                                width: `${(skill.minutes / largestSkill) * 100}%`,
                              }}
                            />
                          </span>
                        </li>
                      ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      )}
      <DaySheet
        place={place}
        period={period}
        student={student}
        returnFocus={lastOpen.current}
        onClose={() => set({ student: undefined })}
      />
      <Toast tone="status" message={message} onDismiss={() => setMessage("")} />
      <Toast message={error} onDismiss={() => setError("")} />
    </ClassFrame>
  );
}
