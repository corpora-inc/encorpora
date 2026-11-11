import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useMemo } from "react";
import { formatDay } from "../../../../schools/calendar";
import type {
  AttentionItem,
  ClassUsage,
  OverviewResponse,
  SchoolUsage,
} from "../../../../schools/org-contracts";
import { Button, buttonClass } from "../../../ui/Button";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { EmptyState } from "../../../ui/EmptyState";
import { Segmented } from "../../../ui/Segmented";
import { Loading } from "../../../ui/Loading";
import { currentSession, orgOptions } from "../api";
import { fullDay, number } from "../classes/teacher-shared";
import { OrgFrame } from "../OrgFrame";
import { classPath, orgPath } from "../paths";
import { TrendChart, type TrendMeasure } from "./charts";
import { StandingCurves } from "../standing/StandingCurves";
import { withInterval } from "../standing/format";
import { RuleNote } from "../RuleNote";
import { compareClassNames } from "../sort";
import { summarize } from "../../../../schools/practice-stats";
import { measureOf, MEASURES } from "../practice/heat";
import { DoseResponse, type DoseDots } from "./DoseResponse";
import { overviewOptions, practiceOptions } from "./org-api";
import { PracticeMap } from "./PracticeMap";
import styles from "./Org.module.css";

const DAY = 86_400_000;
const dayAt = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** "Quarter 2, week 3 of 9", when the term is a real one. */
function termLine(view: OverviewResponse) {
  const { term, today } = view;
  const weeks = Math.max(
    1,
    Math.ceil((dayAt(term.endsOn) - dayAt(term.startsOn) + DAY) / (7 * DAY)),
  );
  const week = Math.min(
    weeks,
    Math.floor((dayAt(today) - dayAt(term.startsOn)) / (7 * DAY)) + 1,
  );
  return term.name === "Last 12 weeks"
    ? ""
    : `${term.name}, week ${week} of ${weeks}`;
}
const growthWords = (growth: number | null) =>
  growth === null
    ? "—"
    : growth >= 0.05
      ? `+${growth.toFixed(1)}`
      : growth <= -0.05
        ? `−${Math.abs(growth).toFixed(1)}`
        : "0.0";

function ActiveCell({
  active,
  students,
}: {
  active: number;
  students: number;
}) {
  const share = students ? (active / students) * 100 : 0;
  return (
    <span className={styles.activeCell}>
      <span className={styles.activeTrack} aria-hidden="true">
        <span className={styles.activeFill} style={{ width: `${share}%` }} />
      </span>
      <span className={styles.activeWords}>
        {number(active)} of {number(students)}
      </span>
    </span>
  );
}

type Usage = {
  name: string;
  students: number;
  active: number;
  minutes: number;
  growth: number | null;
  growthLow: number | null;
  growthHigh: number | null;
  placed: number;
};
/** Growth with where its median sits: "+0.3 (−0.1 to +0.7)". */
const growthFull = (row: Usage) =>
  row.growth === null || row.growthLow === null || row.growthHigh === null
    ? growthWords(row.growth)
    : withInterval({
        median: row.growth,
        low: row.growthLow,
        high: row.growthHigh,
      });
function GrowthCell({ row }: { row: Usage }) {
  const full = growthFull(row);
  const split = full.indexOf(" (");
  return split === -1 ? (
    <span title={growthTip(row)}>{full}</span>
  ) : (
    <span title={growthTip(row)} className={styles.growthCell}>
      {full.slice(0, split)}
      <span>{full.slice(split)}</span>
    </span>
  );
}
const growthTip = (row: Usage) =>
  row.placed
    ? `Median of ${number(row.placed)} placed ${row.placed === 1 ? "student" : "students"}`
    : "No placed students yet";
const usageColumns = <Row extends Usage>(): DataGridColumn<Row>[] => [
  {
    id: "students",
    header: "Students",
    width: 88,
    align: "end",
    firstSort: "descending",
    compare: (a, b) => a.students - b.students,
    cell: (row) => number(row.students),
  },
  {
    id: "active",
    header: "Practiced this week",
    width: 170,
    firstSort: "descending",
    compare: (a, b) =>
      a.active / Math.max(1, a.students) - b.active / Math.max(1, b.students),
    cell: (row) => <ActiveCell active={row.active} students={row.students} />,
    cellLabel: (row) => `${row.active} of ${row.students}`,
  },
  {
    id: "minutes",
    header: "Minutes",
    width: 88,
    align: "end",
    firstSort: "descending",
    compare: (a, b) => a.minutes - b.minutes,
    cell: (row) => number(row.minutes),
  },
  {
    id: "growth",
    header: "Growth this term",
    width: 176,
    align: "end",
    firstSort: "descending",
    compare: (a, b) => (a.growth ?? -99) - (b.growth ?? -99),
    cell: (row) => <GrowthCell row={row} />,
    cellLabel: (row) => `${growthFull(row)}. ${growthTip(row)}`,
  },
];

function UsageCard({
  to,
  name,
  detail,
  row,
}: {
  to: string;
  name: string;
  detail: string;
  row: Usage;
}) {
  return (
    <Link to="/$" params={{ _splat: to }} className={styles.usageCard}>
      <span className={styles.usageName}>
        <strong>{name}</strong>
        <span>{detail}</span>
      </span>
      <span className={styles.usageFacts}>
        <ActiveCell active={row.active} students={row.students} />
        <span>{number(row.minutes)} min</span>
        <span>
          <GrowthCell row={row} /> grades
        </span>
      </span>
    </Link>
  );
}

/** Teachers by name, with the person reading it as "You". */
const teacherNames = (teachers: readonly string[], self: string | null) =>
  teachers.map((name) => (self && name === self ? "You" : name)).join(", ");

function ClassTable({
  orgId,
  rows,
  self,
}: {
  orgId: string;
  rows: ClassUsage[];
  self: string | null;
}) {
  const navigate = useNavigate();
  const columns = useMemo<DataGridColumn<ClassUsage>[]>(
    () => [
      {
        id: "name",
        header: "Class",
        width: 190,
        compare: (a, b) => compareClassNames(a.name, b.name),
        cell: (row) => (
          <Link
            to="/$"
            params={{ _splat: classPath(orgId, row.id) }}
            className={styles.rowLink}
          >
            {row.name}
          </Link>
        ),
      },
      {
        id: "teacher",
        header: "Teacher",
        width: 150,
        compare: (a, b) =>
          (a.teachers[0] ?? "").localeCompare(b.teachers[0] ?? "", "en"),
        cell: (row) =>
          row.teachers.length ? (
            teacherNames(row.teachers, self)
          ) : (
            <span className={styles.none}>No teacher</span>
          ),
      },
      ...usageColumns<ClassUsage>(),
    ],
    [orgId, self],
  );
  return (
    <DataGrid
      label="Classes"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      rowHeight={52}
      defaultSort={{ column: "name", direction: "ascending" }}
      onRowActivate={(row) =>
        void navigate({
          to: "/$",
          params: { _splat: classPath(orgId, row.id) },
        })
      }
      cardLayout="row"
      cardEstimate={92}
      card={(row) => (
        <UsageCard
          to={classPath(orgId, row.id)}
          name={row.name}
          detail={teacherNames(row.teachers, self) || "No teacher"}
          row={row}
        />
      )}
    />
  );
}

export function SchoolTable({ rows }: { rows: SchoolUsage[] }) {
  const navigate = useNavigate();
  const columns = useMemo<DataGridColumn<SchoolUsage>[]>(
    () => [
      {
        id: "name",
        header: "School",
        width: 230,
        compare: (a, b) => compareClassNames(a.name, b.name),
        cell: (row) => (
          <Link
            to="/$"
            params={{ _splat: orgPath(row.id) }}
            className={styles.rowLink}
          >
            {row.name}
          </Link>
        ),
      },
      {
        id: "classes",
        header: "Classes",
        width: 76,
        align: "end",
        firstSort: "descending",
        compare: (a, b) => a.classes - b.classes,
        cell: (row) => number(row.classes),
      },
      ...usageColumns<SchoolUsage>(),
    ],
    [],
  );
  return (
    <DataGrid
      label="Schools"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      rowHeight={52}
      defaultSort={{ column: "name", direction: "ascending" }}
      onRowActivate={(row) =>
        void navigate({ to: "/$", params: { _splat: orgPath(row.id) } })
      }
      cardLayout="row"
      cardEstimate={92}
      card={(row) => (
        <UsageCard
          to={orgPath(row.id)}
          name={row.name}
          detail={`${number(row.classes)} ${row.classes === 1 ? "class" : "classes"}`}
          row={row}
        />
      )}
    />
  );
}

function Attention({ items }: { items: readonly AttentionItem[] }) {
  if (!items.length)
    return <p className={styles.quiet}>Nothing needs you today.</p>;
  return (
    <ul className={styles.attention}>
      {items.map((item) => (
        <li key={item.id}>
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
          {item.rule && <RuleNote>{item.rule}</RuleNote>}
          <Link
            to="/$"
            params={{ _splat: orgPath(item.action.org, item.action.path) }}
            search={(item.action.search ?? {}) as never}
            className={buttonClass("secondary", styles.attentionAction)}
          >
            {item.action.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Seats({
  orgId,
  seats,
}: {
  orgId: string;
  seats: OverviewResponse["seats"];
}) {
  const share = seats.seats
    ? Math.min(100, (seats.used / seats.seats) * 100)
    : 0;
  const ended = !!seats.endsAt && Date.parse(seats.endsAt) <= Date.now();
  return (
    <section aria-labelledby="overview-seats" className={styles.seats}>
      <h2 id="overview-seats">Seats</h2>
      <p className={styles.seatFigure}>
        {number(seats.used)} of {number(seats.seats)} in use
      </p>
      <span className={styles.seatTrack} aria-hidden="true">
        <span className={styles.seatFill} style={{ width: `${share}%` }} />
      </span>
      <div className={styles.seatFoot}>
        <p className={styles.seatDates}>
          {seats.endsAt
            ? `${ended ? "Ended" : seats.evaluation ? "Evaluation, through" : "Through"} ${formatDay(seats.endsAt.slice(0, 10))}`
            : "No license yet"}
          {seats.sharedWith ? `. Shared across ${seats.sharedWith}.` : ""}
        </p>
        <Link
          to="/$"
          params={{ _splat: orgPath(orgId, "license") }}
          className={buttonClass("quiet")}
        >
          See the license
        </Link>
      </div>
    </section>
  );
}

/** The term's practice as data: classes by week, cold to hot against the
 * weekly target, then whether more practice went with more growth. Its own
 * read; until it lands, a block the size of what it will draw. */
function Practice({
  orgId,
  rows,
  measure,
  onMeasure,
  sort,
  dots,
  onDots,
}: {
  orgId: string;
  rows: number;
  measure: TrendMeasure;
  onMeasure: (measure: TrendMeasure) => void;
  sort: unknown;
  dots: DoseDots;
  onDots: (dots: DoseDots) => void;
}) {
  const session = currentSession();
  const practice = useQuery(practiceOptions(session, orgId));
  const data = practice.data;
  if (rows === 0) return null;
  const target =
    summarize(data?.rows.map((row) => row.target) ?? [])?.median ?? 60;
  return (
    <>
      <section aria-labelledby="overview-practice">
        <div className={styles.practiceHead}>
          <h2 id="overview-practice" className={styles.sectionTitle}>
            Practice by week
          </h2>
          <div className={styles.trendToggle}>
            <Segmented
              label="Show"
              options={MEASURES}
              value={measure}
              compact
              dense
              onChange={onMeasure}
            />
          </div>
        </div>
        {data ? (
          <PracticeMap
            data={data}
            orgId={orgId}
            measure={measure}
            sort={sort}
          />
        ) : practice.isError ? (
          <div className={styles.practiceFailed} role="alert">
            <p>The practice map didn’t load. Check your connection, then try again.</p>
            <Button variant="secondary" onClick={() => void practice.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <div
            className={styles.practiceSkeleton}
            style={{ height: 120 + rows * 44 }}
            aria-busy="true"
          />
        )}
      </section>
      <section aria-labelledby="overview-dose">
        <h2 id="overview-dose" className={styles.sectionTitle}>
          Practice and growth
        </h2>
        {data ? (
          <DoseResponse
            data={data}
            dots={dots}
            onDots={onDots}
            target={target}
          />
        ) : (
          !practice.isError && (
            <div
              className={styles.practiceSkeleton}
              style={{ height: 420 }}
              aria-busy="true"
            />
          )
        )}
      </section>
    </>
  );
}

function FirstRun({ orgId, canImport }: { orgId: string; canImport: boolean }) {
  return (
    <EmptyState
      title="Add your students to see this fill in"
      action={
        canImport ? (
          <Link
            to="/$"
            params={{ _splat: orgPath(orgId, "import") }}
            className={buttonClass("primary")}
          >
            Import a roster
          </Link>
        ) : undefined
      }
    >
      {canImport
        ? "A spreadsheet or OneRoster file brings in every class at once."
        : "Your school’s admin adds them, and this fills in from there."}
    </EmptyState>
  );
}

/** A head's morning read, or a superintendent's: the week in a sentence, how the
 * term is going, where students stand, what needs them, and every class or school
 * with how it's using AMP. A district's is the same screen rolled up. */
export function OverviewScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const session = currentSession();
  const overview = useQuery(overviewOptions(session, orgId));
  const org = useQuery(orgOptions(session, orgId)).data;
  const canImport = org?.can?.includes("roster.import") === true;
  const view = overview.data;
  const district = view ? view.org.kind !== "school" : false;
  const search = useSearch({ strict: false }) as {
    chart?: unknown;
    rows?: unknown;
    dot?: unknown;
  };
  const measure: TrendMeasure = measureOf(search.chart);
  const dots: DoseDots = search.dot === "classes" ? "classes" : "students";
  const navigate = useNavigate();
  const setSearch = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: ".",
      replace: true,
      resetScroll: false,
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        ...patch,
      })) as never,
    });
  const setMeasure = (next: TrendMeasure) =>
    setSearch({ chart: next === "problems" ? "problems" : undefined });
  const placed = [...(view?.classes ?? []), ...(view?.schools ?? [])].reduce(
    (sum, row) => sum + row.placed,
    0,
  );
  return (
    <OrgFrame orgId={orgId} nav="overview" title="Overview">
      {overview.isPending ? (
        <Loading />
      ) : !view ? (
        <EmptyState
          title="This overview didn’t load"
          action={
            <Button variant="primary" onClick={() => void overview.refetch()}>
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      ) : (
        <div className={styles.overview}>
          <header className={styles.greeting}>
            <h1>{view.org.name}</h1>
            <p>
              {fullDay(view.today)}
              {termLine(view) ? ` · ${termLine(view)}` : ""}
            </p>
          </header>
          {view.week.students === 0 && !district ? (
            <FirstRun orgId={orgId} canImport={canImport} />
          ) : (
            <>
              <div className={styles.read}>
                <div className={styles.lede}>
                  <p className={styles.ledeFigures}>
                    {number(view.week.active)} of {number(view.week.students)}{" "}
                    students practiced this week, for{" "}
                    {number(view.week.minutes)} minutes so far.
                  </p>
                  <p className={styles.ledeLast}>
                    Last week, {number(view.week.lastActive)} students practiced
                    for {number(view.week.lastMinutes)} minutes.
                  </p>
                </div>
                <Seats orgId={orgId} seats={view.seats} />
                <section
                  aria-labelledby="overview-trend"
                  className={styles.trend}
                >
                  <div className={styles.trendHead}>
                    <h2 id="overview-trend" className={styles.sectionTitle}>
                      Weekly practice
                      {view.term.name === "Last 12 weeks"
                        ? ", last 12 weeks"
                        : `, ${view.term.name}`}
                    </h2>
                    <div className={styles.trendToggle}>
                      <Segmented
                        label="Show"
                        options={MEASURES}
                        value={measure}
                        compact
                        dense
                        onChange={setMeasure}
                      />
                    </div>
                  </div>
                  <TrendChart
                    weeks={view.trend}
                    today={view.today}
                    measure={measure}
                  />
                </section>
                {view.attention.length > 0 && (
                  <section
                    aria-labelledby="overview-attention"
                    className={styles.sideColumn}
                  >
                    <h2 id="overview-attention" className={styles.sectionTitle}>
                      Needs attention
                    </h2>
                    <Attention items={view.attention} />
                  </section>
                )}
                <StandingCurves
                  orgId={orgId}
                  sectionClass={styles.standingSection}
                  factsClass={styles.standingFacts}
                  titleClass={styles.sectionTitle}
                />
              </div>
              <Practice
                orgId={orgId}
                rows={(view.classes ?? view.schools ?? []).length}
                measure={measure}
                onMeasure={setMeasure}
                sort={search.rows}
                dots={dots}
                onDots={(next) =>
                  setSearch({ dot: next === "classes" ? "classes" : undefined })
                }
              />
              <section aria-labelledby="overview-usage">
                <h2 id="overview-usage" className={styles.sectionTitle}>
                  {district ? "Schools" : "Classes"}
                </h2>
                {view.schools?.length ? (
                  <SchoolTable rows={view.schools} />
                ) : view.schools ? (
                  <p className={styles.quiet}>
                    No schools yet.{" "}
                    <Link
                      to="/$"
                      params={{ _splat: orgPath(orgId, "schools") }}
                      search={{ add: 1 } as never}
                    >
                      Add a school
                    </Link>
                  </p>
                ) : view.classes?.length ? (
                  <ClassTable
                    orgId={orgId}
                    rows={view.classes}
                    self={view.personName}
                  />
                ) : (
                  <p className={styles.quiet}>
                    No classes yet.{" "}
                    <Link
                      to="/$"
                      params={{ _splat: orgPath(orgId, "classes") }}
                      search={{ add: 1 } as never}
                    >
                      Add a class
                    </Link>
                  </p>
                )}
                <p className={styles.tableNote}>
                  Growth is each {district ? "school" : "class"}’s median change
                  in grade level this term, with its 95% range, from{" "}
                  {number(placed)} placed{" "}
                  {placed === 1 ? "student" : "students"} (20 or more answers).
                  Practiced means at least 5 active minutes or 5 problems this
                  week.
                </p>
              </section>
            </>
          )}
        </div>
      )}
    </OrgFrame>
  );
}
