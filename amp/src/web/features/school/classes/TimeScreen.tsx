import { EntityLink } from "../../../nav/links";
import { ScreenTitle } from "../../../ui/ScreenTitle";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  timePeriods,
  type TimePeriod,
  type TimeResponse,
} from "../../../../schools/teacher-contracts";
import { Button } from "../../../ui/Button";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { EmptyState } from "../../../ui/EmptyState";
import { InfoPopover } from "../../../ui/InfoPopover";
import { Loading } from "../../../ui/Loading";
import { Segmented } from "../../../ui/Segmented";
import { Sheet } from "../../../ui/Sheet";
import { StatRow, StatTile } from "../../../ui/StatTile";
import { Toast } from "../../../ui/Toast";
import { summarize } from "../../../../schools/practice-stats";
import { currentSession, orgOptions } from "../api";
import {
  HeatCell,
  HeatLegend,
  measureOf,
  MEASURES,
  StatsLine,
  unitWord,
  type HeatMeasure,
} from "../practice/heat";
import { useStaffSession } from "./api";
import { useClassHost, wholeClass, type ClassHost } from "./host";
import { TimeDetail } from "./ProgressRecord";
import { HelpUsed } from "./HelpUsed";
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
  // The term is students by weeks: the heat map's grain.
  if (data.period !== "term" && count <= MOST_DAYS) {
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
const isWeekend = (iso: string) =>
  [0, 6].includes(new Date(`${iso}T12:00:00Z`).getUTCDay());
const amountIn = (row: Row, column: Column, measure: HeatMeasure) =>
  row.days
    .filter((entry) => entry.day >= column.from && entry.day <= column.to)
    .reduce(
      (sum, entry) =>
        sum + (measure === "minutes" ? entry.minutes : entry.problems),
      0,
    );
/** Each student's weekly amounts over the range, zero weeks included, while
 * they were on the roster. */
function weeklyAmounts(data: TimeResponse, measure: HeatMeasure) {
  return data.students.map((row) =>
    data.weeks
      .filter(
        (week) =>
          addDays(week, 6) >= (row.from ?? data.range.from) &&
          week <= (row.to ?? data.range.to),
      )
      .map((week) =>
        amountIn(row, { from: week, to: addDays(week, 6), label: "" }, measure),
      ),
  );
}

/** A student's row of cells, cold to hot against the weekly target (a day:
 * a fifth of it). A weekend day with no work is left blank, not cold; a day
 * still to come or before they joined is no reading at all. */
function Heat({
  row,
  columns,
  midpoint,
  isDay,
  measure,
  today,
  current,
}: {
  row: Row;
  columns: Column[];
  midpoint: number | null;
  isDay: boolean;
  measure: HeatMeasure;
  today: string;
  current: string;
}) {
  return (
    <span
      className={styles.heatStrip}
      style={{ "--heat-columns": columns.length } as CSSProperties}
    >
      {columns.map((column) => {
        const amount = amountIn(row, column, measure);
        const when = isDay
          ? fullDay(column.from)
          : `week of ${shortDay(column.from)}`;
        const future = column.from > today;
        const before =
          (row.from && column.to < row.from) ||
          (row.to && column.from > row.to);
        const off = isDay && isWeekend(column.from) && amount === 0;
        const scale =
          midpoint === null ? null : isDay ? midpoint / 5 : midpoint;
        return (
          <HeatCell
            key={column.from}
            value={future || before || off ? null : amount}
            future={future || off}
            current={!isDay && column.from === current}
            midpoint={scale}
            tip={
              future
                ? { title: `${row.first} · ${when}`, note: "Still to come" }
                : before
                  ? {
                      title: `${row.first} · ${when}`,
                      note: "Not in this class",
                    }
                  : {
                      title: `${row.first} · ${when}${!isDay && column.from === current ? ", so far" : ""}`,
                      figure: String(Math.round(amount)),
                      unit: unitWord(measure, Math.round(amount)),
                      ...(scale
                        ? {
                            share: {
                              done: Math.min(amount, scale),
                              of: scale,
                              label: `${measure === "minutes" ? "Target" : "Midpoint"}: ${Math.round(scale)} ${unitWord(measure, Math.round(scale))}`,
                            },
                          }
                        : {}),
                    }
            }
            style={
              isDay && isMonday(column.from)
                ? { marginInlineStart: 3 }
                : undefined
            }
          />
        );
      })}
    </span>
  );
}

/** Four made-up weeks of one learner, for the empty state: what the grid
 * looks like once there's work. Positions on the scale, -1 to 1. */
const EXAMPLE_WEEKS = [
  0.2, 0.6, 0.9, 1.1, 1.0, 0.5, 1.4, 1.2, 0.8, 1.6, 1.3, 1.1,
];
function ExampleTime() {
  return (
    <div className={styles.exampleTime}>
      <div className={styles.heatCardTop}>
        <span className={styles.exampleName}>A learner</span>
        <span className={styles.heatTotal}>612 min</span>
      </div>
      <span
        className={styles.heatStrip}
        style={{ "--heat-columns": EXAMPLE_WEEKS.length } as CSSProperties}
      >
        {EXAMPLE_WEEKS.map((share, index) => (
          <HeatCell key={index} value={share * 60} midpoint={60} />
        ))}
      </span>
      <HeatLegend
        caption="Active minutes a week"
        midpoint={60}
        midpointWord="target"
      />
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
  record,
}: {
  place: Place;
  period: TimePeriod;
  student: string | undefined;
  /** The person's own page in this host, if it has one (a family's child
   * page): their record opens there. */
  record?: (person: string) => string | null;
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
          {record?.(data.student.id) ? (
            <Link
              to="/$"
              params={{ _splat: record(data.student.id)! }}
              className={buttonClass("quiet", "", "start")}
            >
              Open {data.student.first}’s page
            </Link>
          ) : (
            <EntityLink
              entity={{ kind: "student", id: data.student.id }}
              className={buttonClass("quiet", "", "start")}
            >
              Open {data.student.first}’s record
            </EntityLink>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Minutes per student over days or weeks, as one grid of one hue: who's working
 * and when reads at a glance, with the numbers a hover away and in the export. */
export function TimeScreen({ host: given }: { host?: ClassHost } = {}) {
  // The class's own Time, or a host's (a family's own children, in its
  // words): the same range, measure, day sheet and export.
  const host = useClassHost(given);
  const place = host.place;
  const session = useStaffSession();
  const [search, set, close] = useClassSearch();
  const period = timePeriods.find((entry) => entry === search.period) ?? "term";
  const measure = measureOf(search.chart);
  const time = useQuery(timeOptions(session, place, period));
  // A host's people only, and their totals recomputed from them: never a
  // class total with someone else's minutes in it.
  const family = !!given && given.words.learner !== "student";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const raw = time.data;
  const data = useMemo(
    () =>
      raw && host.keep
        ? { ...raw, students: raw.students.filter((row) => host.keep!(row.id)) }
        : raw,
    [raw, host.keep],
  );
  // What reads the whole class (where its time went, help used) and its
  // export: only where this page shows the whole class.
  const whole = wholeClass(
    host,
    data?.students.length ?? 0,
    raw?.students.length ?? 0,
  );
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
  // Problems have no target: their midpoint is the class's median
  // student-week with any problems in these weeks.
  const weekly = useMemo(
    () => (data ? weeklyAmounts(data, measure) : []),
    [data, measure],
  );
  const problemWeeks = useMemo(
    () =>
      data
        ? weeklyAmounts(data, "problems")
            .flat()
            .filter((value) => value > 0)
        : [],
    [data],
  );
  const problemsMidpoint = problemWeeks.length
    ? Math.max(1, Math.round(summarize(problemWeeks)!.median))
    : null;
  const midpoint = measure === "minutes" ? target : problemsMidpoint;
  const today = data?.range.to ?? "";
  const current = data?.weeks.at(-1) ?? "";
  // Each student's mean a week over the range: the distribution beside the
  // map.
  const perStudent = summarize(
    weekly.flatMap((weeks) =>
      weeks.length
        ? [weeks.reduce((sum, value) => sum + value, 0) / weeks.length]
        : [],
    ),
  );
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
        header: measure === "minutes" ? "Minutes" : "Problems",
        width: 80,
        firstSort: "descending",
        align: "end",
        compare: (a, b) =>
          measure === "minutes"
            ? a.minutes - b.minutes
            : a.problems - b.problems,
        cell: (row) => (
          <span className={styles.heatTotal}>
            {number(measure === "minutes" ? row.minutes : row.problems)}
          </span>
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
          <Heat
            row={row}
            columns={columns}
            midpoint={midpoint}
            isDay={isDay}
            measure={measure}
            today={today}
            current={current}
          />
        ),
        cellLabel: (row) =>
          measure === "minutes"
            ? `${row.name}: ${row.minutes} active minutes`
            : `${row.name}: ${row.problems} problems`,
      },
    ],
    // Cells follow this response's rows and columns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, family, measure, midpoint],
  );
  const totalMinutes = (data?.students ?? []).reduce(
    (sum, row) => sum + row.minutes,
    0,
  );
  const working = (data?.students ?? []).filter((row) => row.minutes > 0);
  const facts = data && (
    <StatRow>
      <StatTile value={number(totalMinutes)} label="active minutes" />
      <StatTile
        value={`${working.length} of ${data.students.length}`}
        label={
          family ? "children with active time" : "students with active time"
        }
      />
    </StatRow>
  );
  const largestSkill = Math.max(
    1,
    ...(data?.skills ?? []).map((s) => s.minutes),
  );
  return (
    <host.Frame
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
              <ScreenTitle>Time</ScreenTitle>
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
                    !whole ||
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
                      _splat: family
                        ? host.href("today")
                        : classUrl(place.org, place.class, "start"),
                    }}
                    className={buttonClass("primary")}
                  >
                    {family ? "Back to Today" : "Start class"}
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className={styles.timeFacts}>
                {perStudent ? (
                  // The spread per student is a tap away from the totals.
                  <InfoPopover
                    title={`Per ${family ? "child" : "student"}, the numbers`}
                    details={
                      <StatsLine
                        label={`${measure === "minutes" ? "Active minutes" : "Problems"} a week per ${family ? "child" : "student"}`}
                        {...perStudent}
                      />
                    }
                  >
                    {facts}
                  </InfoPopover>
                ) : (
                  facts
                )}
              </div>
              <div className={styles.timeScale}>
                {midpoint !== null && (
                  <HeatLegend
                    caption={
                      measure === "minutes"
                        ? `Active minutes ${isDay ? "a day" : "a week"}`
                        : `Problems ${isDay ? "a day" : "a week"}`
                    }
                    midpoint={isDay ? midpoint / 5 : midpoint}
                    midpointWord={measure === "minutes" ? "target" : "median"}
                    empty={data.students.some(
                      (row) => (row.from ?? data.range.from) > data.range.from,
                    )}
                  />
                )}
                <div className={styles.measure}>
                  <Segmented<HeatMeasure>
                    compact
                    dense
                    label="Show"
                    value={measure}
                    options={MEASURES}
                    onChange={(value) =>
                      set(
                        {
                          chart: value === "problems" ? "problems" : undefined,
                        },
                        { replace: true },
                      )
                    }
                  />
                </div>
              </div>
              <TipZone>
                <DataGrid
                  label={`Active minutes by ${family ? "child" : "student"}`}
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
                          {measure === "minutes"
                            ? `${number(row.minutes)} min`
                            : `${number(row.problems)} problems`}
                        </span>
                      </div>
                      <Heat
                        row={row}
                        columns={columns}
                        midpoint={midpoint}
                        isDay={isDay}
                        measure={measure}
                        today={today}
                        current={current}
                      />
                    </div>
                  )}
                />
              </TipZone>
              {whole && data.skills.some((skill) => skill.minutes > 0) && (
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
              {whole && (
                <HelpUsed weeks={data.help} className={styles.timeSkills} />
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
        onClose={() => close("student")}
        record={host.record}
      />
      <Toast tone="status" message={message} onDismiss={() => setMessage("")} />
      <Toast message={error} onDismiss={() => setError("")} />
    </host.Frame>
  );
}
