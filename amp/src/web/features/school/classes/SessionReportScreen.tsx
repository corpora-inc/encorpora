import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type {
  LiveStatus,
  ReportRow,
  SessionReport,
  SkillRef,
} from "../../../../schools/live/contracts";
import { AppError } from "../../../lib/AppError";
import { EntityLink } from "../../../nav/links";
import { buttonClass } from "../../../ui/Button";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { EmptyState } from "../../../ui/EmptyState";
import { ScreenTitle } from "../../../ui/ScreenTitle";
import { StatRow, StatTile } from "../../../ui/StatTile";
import { sessionReportOptions } from "../../live/api";
import { helpCount, levelText, percentText } from "../../live/format";
import { HelpCounts, helpWords } from "../../live/HelpCounts";
import { StatusMark } from "../../live/StatusMark";
import { STATUS_ORDER, STATUS_WORDS } from "../../live/status-words";
import { classesOptions, currentSession } from "../api";
import { useStaffSession } from "./api";
import { ClassFrame } from "./ClassFrame";
import { LoadFailed, parseSort, useClassView } from "./teacher-shared";
import styles from "./SessionReport.module.css";

/* A stopped session's report (#2465), for the adult after class and for
   the paper they hand on: when, who was there and what they did, who to
   follow up with first, every student, then the skills worked on. Only
   what the stored report holds: totals and skills per student, never the
   live view's last five answers. Prints on a sheet or two with Cmd+P. */

const clock = (at: string | number) =>
  new Date(at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
/** "10:33", for a range whose day part is plain from the title's line. */
const shortClock = (at: string) =>
  new Date(at)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\s?[AP]M$/, "");
const day = (at: string) =>
  new Date(at).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
const minutesBetween = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** How it ended, in a few words. */
const ENDED: Record<NonNullable<SessionReport["session"]["endReason"]>, string> =
  {
    stopped: "stopped",
    planned_end: "ended on time",
    time_limit: "ended at the four-hour limit",
  };

/** Right answers given with help: right, less those on their own. */
const rightWithHelp = (row: ReportRow) =>
  Math.max(0, row.correct - row.independent);

/** Leaned on help: three or more answers, most of them with help. */
const mostlyHelped = (row: ReportRow) =>
  row.problems >= 3 && row.assisted * 2 > row.problems;

/** Who to follow up with, each student once, in the first group they fit:
 * described by what happened, never by what the child is. */
const FOLLOW_UP: {
  id: string;
  title: string;
  fits: (row: ReportRow) => boolean;
  fact: (row: ReportRow) => string;
}[] = [
  {
    id: "not-signed-in",
    title: "Didn’t sign in",
    fits: (row) => row.status === "not_signed_in",
    fact: () => "",
  },
  {
    id: "no-answers",
    title: "Signed in, no answers",
    fits: (row) => row.problems === 0,
    fact: (row) =>
      row.firstSeenAt ? `Signed in ${clock(row.firstSeenAt)}` : "",
  },
  {
    id: "needed-help",
    title: "Needed help at the end",
    fits: (row) => row.status === "struggling",
    fact: (row) => `${row.correct} of ${row.problems} right`,
  },
  {
    id: "mostly-helped",
    title: "Used help on most answers",
    fits: mostlyHelped,
    fact: (row) => `${row.assisted} of ${row.problems} with help`,
  },
];

export function followUp(rows: readonly ReportRow[]) {
  const placed = new Set<string>();
  return FOLLOW_UP.map((group) => {
    const members = rows.filter(
      (row) => !placed.has(row.personId) && group.fits(row),
    );
    for (const row of members) placed.add(row.personId);
    return { ...group, members };
  }).filter((group) => group.members.length > 0);
}

/** Each skill worked on, by how many students, most first; who ended on it
 * needing help (their last answers were on it). */
export function sessionSkills(rows: readonly ReportRow[]) {
  const bySkill = new Map<
    string,
    { skill: SkillRef; students: ReportRow[]; endedNeedingHelp: number }
  >();
  for (const row of rows)
    for (const skill of row.skills) {
      const entry = bySkill.get(skill.id) ?? {
        skill,
        students: [],
        endedNeedingHelp: 0,
      };
      entry.students.push(row);
      if (row.status === "struggling" && row.skill?.id === skill.id)
        entry.endedNeedingHelp++;
      bySkill.set(skill.id, entry);
    }
  return [...bySkill.values()].sort(
    (a, b) =>
      b.students.length - a.students.length ||
      b.endedNeedingHelp - a.endedNeedingHelp ||
      a.skill.title.localeCompare(b.skill.title),
  );
}

const Student = ({
  row,
  className,
  children,
}: {
  row: Pick<ReportRow, "personId">;
  className?: string;
  children: ReactNode;
}) => (
  <EntityLink
    entity={{ kind: "student", id: row.personId }}
    className={className}
  >
    {children}
  </EntityLink>
);

const statusRank = (status: LiveStatus) => STATUS_ORDER.indexOf(status);
const byName = (a: ReportRow, b: ReportRow) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" });

function columns(): DataGridColumn<ReportRow>[] {
  return [
    {
      id: "student",
      header: "Student",
      width: 160,
      compare: byName,
      cell: (row) => (
        <Student row={row} className={styles.student}>
          <StatusMark status={row.status} decorative />
          <span className={styles.name}>{row.name}</span>
        </Student>
      ),
    },
    {
      id: "status",
      header: "At the end",
      width: 104,
      compare: (a, b) => statusRank(a.status) - statusRank(b.status),
      cell: (row) => (
        <span className={styles.statusWord} data-status={row.status}>
          {STATUS_WORDS[row.status].word}
        </span>
      ),
    },
    {
      id: "problems",
      header: "Problems",
      width: 76,
      align: "end",
      firstSort: "descending",
      compare: (a, b) => a.problems - b.problems,
      cell: (row) => row.problems,
    },
    {
      id: "correct",
      header: "Correct",
      width: 72,
      align: "end",
      firstSort: "descending",
      compare: (a, b) =>
        (a.problems ? a.correct / a.problems : -1) -
        (b.problems ? b.correct / b.problems : -1),
      cell: (row) => percentText(row.correct, row.problems),
    },
    {
      id: "independent",
      header: "On their own",
      width: 92,
      align: "end",
      firstSort: "descending",
      compare: (a, b) => a.independent - b.independent,
      cell: (row) => row.independent,
    },
    {
      id: "helped",
      header: "Right with help",
      width: 100,
      align: "end",
      firstSort: "descending",
      compare: (a, b) => rightWithHelp(a) - rightWithHelp(b),
      cell: (row) => rightWithHelp(row),
    },
    {
      id: "help",
      header: "Help opened",
      width: 148,
      firstSort: "descending",
      compare: (a, b) => helpCount(a) - helpCount(b),
      cell: (row) => <HelpCounts help={row} />,
      cellLabel: (row) => helpWords(row),
    },
    {
      id: "skills",
      header: "Skills",
      width: 150,
      firstSort: "descending",
      compare: (a, b) => a.skills.length - b.skills.length,
      cell: (row) =>
        row.skills.length === 0 ? (
          "—"
        ) : (
          <span className={styles.skills}>
            {row.skills.map((skill, index) => (
              <span key={skill.id}>
                {index > 0 && ", "}
                <EntityLink
                  entity={{ kind: "skill", id: skill.id }}
                  className={styles.skillLink}
                >
                  {skill.title}
                </EntityLink>
              </span>
            ))}
          </span>
        ),
      cellLabel: (row) =>
        row.skills.length
          ? row.skills.map((skill) => skill.title).join(", ")
          : "No skills",
    },
    {
      id: "level",
      header: "Level",
      width: 56,
      align: "end",
      firstSort: "descending",
      compare: (a, b) => (a.level ?? -1) - (b.level ?? -1),
      cell: (row) => levelText(row.level),
    },
    {
      id: "answered",
      header: "Answering",
      width: 104,
      align: "end",
      compare: (a, b) =>
        Date.parse(a.firstAnswerAt ?? "9999") -
        Date.parse(b.firstAnswerAt ?? "9999"),
      cell: (row) =>
        row.firstAnswerAt && row.lastAnswerAt
          ? `${shortClock(row.firstAnswerAt)}–${shortClock(row.lastAnswerAt)}`
          : "—",
      cellLabel: (row) =>
        row.firstAnswerAt && row.lastAnswerAt
          ? `First answer ${clock(row.firstAnswerAt)}, last ${clock(row.lastAnswerAt)}`
          : "No answers",
    },
  ];
}

/** The class's session at `…/classes/<class>/sessions/<session>`, its
 * report loaded with the route. A session still running has no report
 * yet: the live view is on Today. */
export function SessionReportScreen() {
  const params = useParams({
    from: "/school/$org/classes/$class/sessions/$session",
  });
  const place = { org: params.org, class: params.class };
  const session = useStaffSession();
  const report = useQuery({
    ...sessionReportOptions(session, place, params.session),
    retry: (count, error) =>
      !(error instanceof AppError && (error.status ?? 500) < 500) &&
      count < 2,
  });
  const className = useQuery({
    ...classesOptions(currentSession(), place.org),
    refetchOnMount: false,
  }).data?.find((entry) => entry.id === place.class)?.name;
  const open =
    report.error instanceof AppError && report.error.code === "session_open";
  const missing =
    report.error instanceof AppError && report.error.status === 404;
  return (
    <ClassFrame
      org={place.org}
      classId={place.class}
      loading={report.isPending}
      tab="time"
    >
      {report.data ? (
        <Report report={report.data} className={className} />
      ) : open ? (
        <EmptyState
          title="This session is still running"
          action={
            <Link
              to="/school/$org/classes/$class/today"
              params={place}
              className={buttonClass("primary")}
            >
              Watch it live
            </Link>
          }
        >
          Its report is ready when it stops.
        </EmptyState>
      ) : missing ? (
        <EmptyState
          title="This session isn’t here"
          action={
            <Link
              to="/school/$org/classes/$class/time"
              params={place}
              className={buttonClass("primary")}
            >
              See the class’s sessions
            </Link>
          }
        />
      ) : (
        <LoadFailed
          what="The session’s report"
          onRetry={() => void report.refetch()}
        />
      )}
    </ClassFrame>
  );
}

function Report({
  report,
  className,
}: {
  report: SessionReport;
  className: string | undefined;
}) {
  const [view, set] = useClassView();
  const { session, rows, totals } = report;
  const endedAt = session.endedAt ?? session.endsAt;
  const minutes = minutesBetween(session.startedAt, endedAt);
  const groups = followUp(rows);
  const skills = sessionSkills(rows);
  const shared = skills.filter((entry) => entry.students.length > 1);
  const single = skills.filter((entry) => entry.students.length === 1);
  const help = helpCount(totals);
  const sort = parseSort(view.sort) ?? {
    column: "status",
    direction: "ascending" as const,
  };
  return (
    <article className={styles.page} data-session-report={session.id}>
      {/* A div, not a header: the app's print sheet drops headers. */}
      <div className={styles.head}>
        {className && <p className={styles.printOnly}>{className}</p>}
        <ScreenTitle>{`Session on ${day(session.startedAt)}`}</ScreenTitle>
        <p className={styles.when}>
          {clock(session.startedAt)} to {clock(endedAt)} ·{" "}
          {minutes < 1 ? "under a minute" : plural(minutes, "minute")}
          {session.endReason ? ` · ${ENDED[session.endReason]}` : ""}
        </p>
      </div>

      <StatRow label="The session">
        <StatTile
          label="Here"
          value={
            <>
              {totals.present}
              <span className={styles.of}> of {totals.students}</span>
            </>
          }
        />
        <StatTile label="Problems" value={totals.problems} />
        <StatTile
          label="Correct"
          value={percentText(totals.correct, totals.problems)}
        />
        <StatTile label="On their own" value={totals.independent} />
        <StatTile label="Help opened" value={help} />
      </StatRow>

      {groups.length > 0 && (
        <section className={styles.section} aria-labelledby="follow-up">
          <h2 id="follow-up">Follow up first</h2>
          <ul className={styles.groups}>
            {groups.map((group) => (
              <li key={group.id} className={styles.group} data-group={group.id}>
                <h3>
                  {group.title}
                  <span className={styles.count}>{group.members.length}</span>
                </h3>
                <ul className={styles.people}>
                  {group.members.map((row) => {
                    const fact = group.fact(row);
                    return (
                      <li key={row.personId}>
                        <Student row={row} className={styles.person}>
                          {row.name}
                        </Student>
                        {fact && <span className={styles.fact}>{fact}</span>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby="every-student">
        <h2 id="every-student">Every student</h2>
        <DataGrid
          label="Every student in the session"
          columns={columns()}
          rows={rows}
          rowKey={(row) => row.personId}
          sort={sort}
          onSortChange={(next) =>
            set({ sort: `${next.column}:${next.direction}` })
          }
          cardLayout="list"
          cardsSort={rows.length > 6}
          className={styles.grid}
        />
      </section>

      {skills.length > 0 && (
        <section className={styles.section} aria-labelledby="skills">
          <h2 id="skills">Skills in this session</h2>
          {shared.length > 0 && (
            <ul className={styles.skillList}>
              {shared.map((entry) => (
                <li key={entry.skill.id} className={styles.skillRow}>
                  <EntityLink
                    entity={{ kind: "skill", id: entry.skill.id }}
                    className={styles.skillTitle}
                  >
                    {entry.skill.title}
                  </EntityLink>
                  <span className={styles.skillCount}>
                    {plural(entry.students.length, "student")}
                    {entry.endedNeedingHelp > 0 && (
                      <span className={styles.skillHelp}>
                        {" "}
                        · {entry.endedNeedingHelp} needed help on it at the
                        end
                      </span>
                    )}
                  </span>
                  <span className={styles.skillWho}>
                    {entry.students.map((row, index) => (
                      <span key={row.personId}>
                        {index > 0 && ", "}
                        <Student row={row} className={styles.person}>
                          {row.name}
                        </Student>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {/* A skill one student worked on: one line each, in columns, so
              a long session still prints on a sheet or two. */}
          {single.length > 0 && (
            <div className={styles.singles}>
              <h3>{shared.length > 0 ? "One student each" : "Each by one student"}</h3>
              <ul className={styles.singleList}>
                {single.map((entry) => {
                  const row = entry.students[0]!;
                  return (
                    <li key={entry.skill.id}>
                      <EntityLink
                        entity={{ kind: "skill", id: entry.skill.id }}
                        className={styles.skillLink}
                      >
                        {entry.skill.title}
                      </EntityLink>
                      <span className={styles.singleWho}>
                        {" "}
                        ·{" "}
                        <Student row={row} className={styles.person}>
                          {row.name}
                        </Student>
                        {entry.endedNeedingHelp > 0 && " · needed help at the end"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}
    </article>
  );
}
