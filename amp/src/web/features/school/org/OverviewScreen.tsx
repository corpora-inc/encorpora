import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
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
import { Loading } from "../../../ui/Loading";
import { StatRow, StatTile } from "../../../ui/StatTile";
import { currentSession, orgOptions } from "../api";
import { fullDay, number } from "../classes/teacher-shared";
import { OrgFrame } from "../OrgFrame";
import { classPath, orgPath } from "../paths";
import { StandingChart, TrendChart } from "./charts";
import { overviewOptions } from "./org-api";
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
};
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
    header: "Active this week",
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
    width: 104,
    align: "end",
    firstSort: "descending",
    compare: (a, b) => (a.growth ?? -99) - (b.growth ?? -99),
    cell: (row) => growthWords(row.growth),
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
        <span>{growthWords(row.growth)} grades</span>
      </span>
    </Link>
  );
}

function ClassTable({ orgId, rows }: { orgId: string; rows: ClassUsage[] }) {
  const navigate = useNavigate();
  const columns = useMemo<DataGridColumn<ClassUsage>[]>(
    () => [
      {
        id: "name",
        header: "Class",
        width: 190,
        compare: (a, b) => a.name.localeCompare(b.name, "en"),
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
            row.teachers.join(", ")
          ) : (
            <span className={styles.none}>No teacher</span>
          ),
      },
      ...usageColumns<ClassUsage>(),
    ],
    [orgId],
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
          detail={row.teachers.join(", ") || "No teacher"}
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
        compare: (a, b) => a.name.localeCompare(b.name, "en"),
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
            <h1>
              Good {view.partOfDay}
              {view.personName ? `, ${view.personName}` : ""}.
            </h1>
            <p>
              {fullDay(view.today)}
              {termLine(view) ? `. ${termLine(view)}.` : "."}
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
                  aria-labelledby="overview-attention"
                  className={styles.sideColumn}
                >
                  <h2 id="overview-attention" className={styles.sectionTitle}>
                    Needs attention
                  </h2>
                  <Attention items={view.attention} />
                </section>
                <div className={styles.mainColumn}>
                  <section aria-labelledby="overview-trend">
                    <h2 id="overview-trend" className={styles.sectionTitle}>
                      Weekly active minutes
                      {view.term.name === "Last 12 weeks"
                        ? ", last 12 weeks"
                        : `, ${view.term.name}`}
                    </h2>
                    <TrendChart weeks={view.trend} today={view.today} />
                  </section>
                  <section aria-labelledby="overview-standing">
                    <h2 id="overview-standing" className={styles.sectionTitle}>
                      Where students stand against grade level
                    </h2>
                    <StandingChart standing={view.standing} />
                    <div className={styles.standingFacts}>
                      <StatRow label="Students by standing">
                        <StatTile
                          value={number(view.standing.at)}
                          label="at grade level"
                        />
                        <StatTile
                          value={number(view.standing.ahead)}
                          label="ahead"
                        />
                        <StatTile
                          value={number(view.standing.behind)}
                          label="behind"
                        />
                        {view.standing.unplaced > 0 && (
                          <StatTile
                            value={number(view.standing.unplaced)}
                            label="not placed yet"
                          />
                        )}
                      </StatRow>
                    </div>
                  </section>
                </div>
              </div>
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
                  <ClassTable orgId={orgId} rows={view.classes} />
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
                  Growth is the middle student’s grades gained this term.
                </p>
              </section>
            </>
          )}
        </div>
      )}
    </OrgFrame>
  );
}
