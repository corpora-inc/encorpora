import {
  ClassList,
  classColumn,
  teacherColumn,
  TeacherNames,
  type ListFigure,
} from "../class-columns";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { formatDay, formatLastDay } from "../../../../schools/calendar";
import type {
  AttentionItem,
  ClassUsage,
  OverviewResponse,
  SchoolUsage,
} from "../../../../schools/org-contracts";
import { Button, buttonClass } from "../../../ui/Button";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { EmptyState } from "../../../ui/EmptyState";
import { InfoPopover } from "../../../ui/InfoPopover";
import { Segmented } from "../../../ui/Segmented";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { currentSession, orgOptions } from "../api";
import {
  FigureTip,
  fullDay,
  number,
  type TipCard,
} from "../classes/teacher-shared";
import { OrgFrame } from "../OrgFrame";
import { classPath, orgPath } from "../paths";
import { TrendChart, type TrendMeasure } from "./charts";
import { StandingCurves } from "../standing/StandingCurves";
import { intervalWords } from "../standing/format";
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

/** Practiced this week: the share of the roster as a bar, then the count.
 * `compact`, on a phone: the count, the bar a hairline under it. */
function ActiveCell({
  active,
  students,
  compact = false,
}: {
  active: number;
  students: number;
  compact?: boolean;
}) {
  const share = students ? (active / students) * 100 : 0;
  return (
    <span className={compact ? styles.activeCompact : styles.activeCell}>
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
/** Growth as its median, "+0.3"; its 95% range and n are a tap away. */
function GrowthCell({ row }: { row: Usage }) {
  if (row.growth === null || !row.placed)
    return <span title="Not settled yet">{growthWords(row.growth)}</span>;
  return <FigureTip tip={growthTip(row)}>{growthWords(row.growth)}</FigureTip>;
}
const growthTip = (row: Usage): TipCard => ({
  title: `${row.name}, growth this term`,
  figure: growthWords(row.growth),
  unit: "grades, median",
  stats: [
    ...(row.growthLow !== null && row.growthHigh !== null
      ? [
          {
            label: "95% range",
            value: intervalWords({ low: row.growthLow, high: row.growthHigh }),
          },
        ]
      : []),
    {
      label: "Settled",
      value: `${number(row.placed)} of ${number(row.students)}`,
    },
  ],
});
const growthLabel = (row: Usage) =>
  row.growth === null || !row.placed
    ? "Not settled yet"
    : `${growthWords(row.growth)} grades${
        row.growthLow !== null && row.growthHigh !== null
          ? `, 95% range ${intervalWords({ low: row.growthLow, high: row.growthHigh })}`
          : ""
      }, from ${number(row.placed)} settled ${row.placed === 1 ? "student" : "students"}`;
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
    width: 132,
    align: "end",
    firstSort: "descending",
    compare: (a, b) => (a.growth ?? -99) - (b.growth ?? -99),
    cell: (row) => <GrowthCell row={row} />,
    cellLabel: growthLabel,
  },
];
/** On a phone: practiced, minutes and growth, each labelled once above. */
const usageFigures = <Row extends Usage>(): ListFigure<Row>[] => [
  {
    column: "active",
    label: "Practiced",
    width: 64,
    cell: (row) => (
      <ActiveCell active={row.active} students={row.students} compact />
    ),
  },
  { column: "minutes", label: "Minutes", width: 52 },
  { column: "growth", label: "Growth", width: 46 },
];

function ClassTable({
  orgId,
  rows,
  self,
}: {
  orgId: string;
  rows: ClassUsage[];
  self: string | null;
}) {
  const columns = useMemo<DataGridColumn<ClassUsage>[]>(
    () => [
      // The same Class and Teacher columns as the Classes tab's list.
      classColumn<ClassUsage>((row) => classPath(orgId, row.id)),
      teacherColumn<ClassUsage>(self),
      ...usageColumns<ClassUsage>(),
    ],
    [orgId, self],
  );
  return (
    <ClassList
      label="Classes"
      columns={columns}
      rows={rows}
      href={(row) => classPath(orgId, row.id)}
      detail={(row) => <TeacherNames teachers={row.teachers} self={self} />}
      figures={usageFigures<ClassUsage>()}
    />
  );
}

export function SchoolTable({
  rows,
  action,
}: {
  rows: SchoolUsage[];
  /** The list's one action, beside its sort: "Add school". */
  action?: ReactNode;
}) {
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
    <ClassList
      label="Schools"
      columns={columns}
      rows={rows}
      href={(row) => orgPath(row.id)}
      detail={(row) =>
        `${number(row.classes)} ${row.classes === 1 ? "class" : "classes"}`
      }
      figures={usageFigures<SchoolUsage>()}
      action={action}
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
  const zone =
    useQuery(orgOptions(currentSession(), orgId)).data?.timezone ?? "UTC";
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
            ? `${ended ? "Ended" : seats.evaluation ? "Evaluation, through" : "Through"} ${formatLastDay(seats.endsAt, zone)}`
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
  part,
  orgId,
  rows,
  measure,
  sort,
  dots,
  onDots,
}: {
  /** "map": classes by week, under Weekly practice and governed by its
   * toggle. "dose": practice against growth, a section of its own. */
  part: "map" | "dose";
  orgId: string;
  rows: number;
  measure: TrendMeasure;
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
  if (part === "map")
    return (
      <div className={styles.practiceMapBlock}>
        {/* The Weekly practice toggle above governs this map as well. */}
        <h3 id="overview-practice" className={styles.sectionTitle}>
          Practice by week
        </h3>
        {data ? (
          <PracticeMap
            data={data}
            orgId={orgId}
            measure={measure}
            sort={sort}
          />
        ) : practice.isError ? (
          <div className={styles.practiceFailed} role="alert">
            <p>
              The practice map didn’t load. Check your connection, then try
              again.
            </p>
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
      </div>
    );
  return (
    <section aria-labelledby="overview-dose">
      <h2 id="overview-dose" className={styles.sectionTitle}>
        Practice and growth
      </h2>
      {data ? (
        <DoseResponse data={data} dots={dots} onDots={onDots} target={target} />
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
      {canImport ? undefined : "Your school’s admin adds them."}
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
        <LoadingScreen overlay />
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
                  <Practice
                    part="map"
                    orgId={orgId}
                    rows={(view.classes ?? view.schools ?? []).length}
                    measure={measure}
                    sort={search.rows}
                    dots={dots}
                    onDots={() => undefined}
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
                part="dose"
                orgId={orgId}
                rows={(view.classes ?? view.schools ?? []).length}
                measure={measure}
                sort={search.rows}
                dots={dots}
                onDots={(next) =>
                  setSearch({ dot: next === "classes" ? "classes" : undefined })
                }
              />
              <section aria-labelledby="overview-usage">
                {/* How the list's figures are made: a tap away, never a
                    paragraph under the table. */}
                <div className={styles.usageHead}>
                  <InfoPopover
                    title={`${district ? "Schools" : "Classes"}, how the figures are made`}
                    details={
                      <p className={styles.doseDetail}>
                        Growth is each {district ? "school" : "class"}’s median
                        pace of level on the days its uncertainty was at most
                        0.6 grades, across the days the term has run, from{" "}
                        {number(placed)} {placed === 1 ? "student" : "students"}
                        . Each growth figure opens its 95% range; — is not
                        settled yet. Practiced means at least 5 active minutes
                        or 5 problems this week.
                      </p>
                    }
                  >
                    <h2 id="overview-usage" className={styles.usageTitle}>
                      {district ? "Schools" : "Classes"}
                    </h2>
                  </InfoPopover>
                </div>
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
              </section>
            </>
          )}
        </div>
      )}
    </OrgFrame>
  );
}
