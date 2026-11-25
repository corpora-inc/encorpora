import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { createContext, useContext, useRef, type ReactNode } from "react";
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
import { FitList } from "../../../ui/FitList";
import { ScreenTitle } from "../../../ui/ScreenTitle";
import { Sheet } from "../../../ui/Sheet";
import { StatRow, StatTile } from "../../../ui/StatTile";
import { sessionReportOptions } from "../../live/api";
import {
  helpCount,
  levelText,
  percentText,
  sessionLength,
} from "../../live/format";
import { HelpCounts, HelpKey, helpWords } from "../../live/HelpCounts";
import { StatusMark } from "../../live/StatusMark";
import { STATUS_ORDER, STATUS_WORDS } from "../../live/status-words";
import { classesOptions, currentSession } from "../api";
import { useStaffSession } from "./api";
import { ClassFrame } from "./ClassFrame";
import {
  LoadFailed,
  parseSort,
  useClassView,
  useKeyedSheet,
} from "./teacher-shared";
import styles from "./SessionReport.module.css";

/* A stopped session's report (#2465), for the adult after class and for
   the paper they hand on: when, who was there and what they did, who to
   follow up with first, every student, then the skills worked on. Only
   what the stored report holds: totals and skills per student, never the
   live view's last five answers. Prints on a sheet or two with Cmd+P.

   "Every student" is for scanning: every row is one height at every width,
   whatever the student did. A row names the first skills they met that fit
   its line, then how many more, and opens that student's sheet with all
   of them. On paper every name prints. */

/** From this width "Every student" is the table (its ten columns' own
 * widths, so it never scrolls sideways); under it, rows of two or three
 * lines. */
const TABLE_FROM = 1100;

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
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** The words a screen gives the report: a class's, a family's. */
export type ReportWords = {
  /** The first column: "Student", "Child". */
  nameHeader: string;
  /** The section's heading: "Every student". */
  every: string;
  /** The table, for assistive technology. */
  everyLabel: string;
  /** The first follow-up group. */
  notSignedIn: string;
  /** The second follow-up group, and its line for each person. */
  noAnswers: string;
  firstSeen: (clock: string) => string;
  /** A count of people: "3 students", "2 children". */
  people: (count: number) => string;
  /** The skills one person each worked on. */
  oneEach: (shared: boolean) => string;
  /** A status's word where the screen says it differently. */
  statusWords?: Partial<Record<LiveStatus, string>>;
};
export const CLASS_REPORT_WORDS: ReportWords = {
  nameHeader: "Student",
  every: "Every student",
  everyLabel: "Every student in the session",
  notSignedIn: "Didn’t sign in",
  noAnswers: "Signed in, no answers",
  firstSeen: (at) => `Signed in ${at}`,
  people: (count) => plural(count, "student"),
  oneEach: (shared) => (shared ? "One student each" : "Each by one student"),
};
/** Opens a person named in the report: the student layer in a class. */
export type ReportLink = (props: {
  personId: string;
  name: string;
  className?: string;
  children: ReactNode;
}) => ReactNode;
const classLink: ReportLink = ({ personId, className, children }) => (
  <EntityLink entity={{ kind: "student", id: personId }} className={className}>
    {children}
  </EntityLink>
);
export type ReportKit = {
  words: ReportWords;
  link: ReportLink;
  /** Whether a person's level is shown (a family's per-child setting);
   * every one by default. */
  levelShown?: (personId: string) => boolean;
};
const KitContext = createContext<ReportKit>({
  words: CLASS_REPORT_WORDS,
  link: classLink,
});

/** How it ended, in a few words. */
const ENDED: Record<
  NonNullable<SessionReport["session"]["endReason"]>,
  string
> = {
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
  fact: (row: ReportRow, words: ReportWords) => string;
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
    fact: (row, words) =>
      row.firstSeenAt ? words.firstSeen(clock(row.firstSeenAt)) : "",
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
  row: Pick<ReportRow, "personId" | "name">;
  className?: string;
  children: ReactNode;
}) => {
  const { link } = useContext(KitContext);
  return link({ personId: row.personId, name: row.name, className, children });
};

/** Opens a student's sheet over the report: the report's, for its rows. */
const OpenContext = createContext<(personId: string) => void>(() => undefined);

/**
 * A student's skills in their row, and the row's own control: the first
 * skills they met that fit its line or two, each name whole, then how many
 * more. It opens the student's sheet, where every one is. A row is the
 * same height whatever is here. On paper every name prints.
 */
function RowSkills({ row, lines }: { row: ReportRow; lines: 1 | 2 }) {
  const open = useContext(OpenContext);
  const titles = row.skills.map((skill) => skill.title);
  return (
    <button
      type="button"
      className={styles.open}
      data-report-open=""
      aria-label={`${row.name}: this session`}
      onClick={() => open(row.personId)}
    >
      {titles.length === 0 ? (
        <span className={styles.noSkills}>—</span>
      ) : (
        <>
          <FitList
            items={titles}
            lines={lines}
            all={(count) => plural(count, "skill")}
            className={styles.skills}
            data-report-skills=""
          />
          <span className={styles.printSkills}>{titles.join(", ")}</span>
        </>
      )}
    </button>
  );
}

/**
 * One student under the table's width: the name and how they ended, percent
 * of problems, level and the help they opened, then their skills on one
 * line. Two
 * lines on a tablet, three on a phone, always; the whole row opens their
 * sheet, and the name opens the student, as everywhere.
 */
function RowCard({ row }: { row: ReportRow }) {
  const { words, levelShown } = useContext(KitContext);
  const level =
    row.level !== null && (levelShown?.(row.personId) ?? true)
      ? levelText(row.level)
      : null;
  return (
    <div className={styles.rowCard} data-report-card={row.personId}>
      <div className={styles.rowTop}>
        <Student row={row} className={`${styles.student} ${styles.rowWho}`}>
          <StatusMark status={row.status} decorative />
          <span className={styles.name}>{row.name}</span>
        </Student>
        <span
          className={`${styles.statusWord} ${styles.rowStatus}`}
          data-status={row.status}
        >
          {words.statusWords?.[row.status] ?? STATUS_WORDS[row.status].word}
        </span>
      </div>
      <div className={styles.rowFigures}>
        {/* One line: the level drops out whole where a phone has no room
            for it beside the percent (the sheet has it). */}
        <span className={styles.rowScore}>
          <span
            className={styles.rowFigure}
            aria-label={
              row.problems > 0
                ? `${percentText(row.correct, row.problems)} correct of ${plural(row.problems, "problem")}`
                : "No problems"
            }
          >
            {row.problems > 0 ? (
              <>
                <strong>{percentText(row.correct, row.problems)}</strong>
                <span className={styles.rowOf}> of {row.problems}</span>
              </>
            ) : (
              <span className={styles.rowOf}>—</span>
            )}
          </span>
          {level && (
            <span className={`${styles.rowFigure} ${styles.rowOf}`}>
              {" · "}
              {level}
            </span>
          )}
        </span>
        <span className={styles.rowHelp}>
          <HelpCounts help={row} />
        </span>
      </div>
      <div className={styles.rowSkills}>
        <RowSkills row={row} lines={1} />
      </div>
    </div>
  );
}

/**
 * One student's part of the session, in a sheet over the report (in
 * history state: Back, the cross and Escape close it alike): every figure
 * the table has, under the table's own names, and every skill they met,
 * each opening the skill.
 */
function StudentSheet({
  rows,
  columns,
  id,
  onClose,
  when,
}: {
  rows: readonly ReportRow[];
  columns: readonly DataGridColumn<ReportRow>[];
  id: string | undefined;
  onClose: () => void;
  /** The session, as the report's title says it. */
  when: string;
}) {
  const row = rows.find((entry) => entry.personId === id);
  // What it showed stays while it closes.
  const last = useRef(row);
  if (row) last.current = row;
  const shown = row ?? last.current;
  const column = (name: string) => columns.find((entry) => entry.id === name);
  const facts = columns.filter(
    (entry) => !["student", "skills", "help"].includes(entry.id),
  );
  return (
    <Sheet
      open={!!row}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={shown?.name ?? ""}
      description={when}
    >
      {shown && (
        <div className={styles.sheet} data-report-student={shown.personId}>
          <dl className={styles.sheetFacts}>
            {facts.map((entry) => {
              const value = entry.cell(shown);
              // A level this person's setting keeps off.
              if (value === null) return null;
              return (
                <div key={entry.id}>
                  <dt>{entry.header}</dt>
                  <dd aria-label={entry.cellLabel?.(shown)}>{value}</dd>
                </div>
              );
            })}
            <div data-wide="">
              <dt>{column("help")?.header}</dt>
              <dd>{helpWords(shown)}</dd>
            </div>
          </dl>
          <h3 className={styles.sheetHeading}>
            {column("skills")?.header}
            <span className={styles.count}>{shown.skills.length}</span>
          </h3>
          {shown.skills.length > 0 && (
            <ul
              className={styles.sheetSkills}
              data-report-student-skills=""
              data-total={shown.skills.length}
            >
              {shown.skills.map((skill) => (
                <li key={skill.id}>
                  <EntityLink
                    entity={{ kind: "skill", id: skill.id }}
                    className={styles.skillLink}
                  >
                    {skill.title}
                  </EntityLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

const statusRank = (status: LiveStatus) => STATUS_ORDER.indexOf(status);
const byName = (a: ReportRow, b: ReportRow) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" });

function columns(
  kit: ReportKit,
  rows: readonly ReportRow[],
): DataGridColumn<ReportRow>[] {
  const { words } = kit;
  // Where levels are a per-person setting and none is on, no column.
  const showLevels =
    !kit.levelShown || rows.some((row) => kit.levelShown!(row.personId));
  const word = (status: LiveStatus) =>
    words.statusWords?.[status] ?? STATUS_WORDS[status].word;
  return [
    {
      id: "student",
      header: words.nameHeader,
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
      width: 100,
      compare: (a, b) => statusRank(a.status) - statusRank(b.status),
      cell: (row) => (
        <span className={styles.statusWord} data-status={row.status}>
          {word(row.status)}
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
      width: 80,
      align: "end",
      firstSort: "descending",
      compare: (a, b) => a.independent - b.independent,
      cell: (row) => row.independent,
    },
    {
      id: "helped",
      header: "Right with help",
      width: 92,
      align: "end",
      firstSort: "descending",
      compare: (a, b) => rightWithHelp(a) - rightWithHelp(b),
      cell: (row) => rightWithHelp(row),
    },
    {
      id: "help",
      header: "Help opened",
      // Its four counts (152 px here) and the cell's inset: the skills
      // start clear of them.
      width: 168,
      firstSort: "descending",
      compare: (a, b) => helpCount(a) - helpCount(b),
      cell: (row) => <HelpCounts help={row} />,
      cellLabel: (row) => helpWords(row),
    },
    {
      // The first skills they met that fit the row's two lines, each name
      // whole, then how many more. The row stays one height; it opens all
      // of them (StudentSheet). The column takes the room the figures
      // don't need.
      id: "skills",
      header: "Skills",
      width: 182,
      grow: true,
      firstSort: "descending",
      compare: (a, b) => a.skills.length - b.skills.length,
      cell: (row) => <RowSkills row={row} lines={2} />,
      cellLabel: (row) =>
        row.skills.length
          ? row.skills.map((skill) => skill.title).join(", ")
          : "No skills",
    },
    ...(showLevels
      ? [
          {
            id: "level",
            header: "Level",
            // Its widest word ("Precalc") and the cell's inset.
            width: 74,
            align: "end",
            firstSort: "descending",
            compare: (a, b) => (a.level ?? -1) - (b.level ?? -1),
            cell: (row) =>
              kit.levelShown && !kit.levelShown(row.personId)
                ? null
                : levelText(row.level),
          } satisfies DataGridColumn<ReportRow>,
        ]
      : []),
    {
      id: "answered",
      header: "Answering",
      width: 96,
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
      !(error instanceof AppError && (error.status ?? 500) < 500) && count < 2,
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

/** A stored report: the class's, and a family's (with its own words, its
 * own link for a person and its per-child level setting). */
export function Report({
  report,
  className,
  kit = { words: CLASS_REPORT_WORDS, link: classLink },
}: {
  report: SessionReport;
  className: string | undefined;
  kit?: ReportKit;
}) {
  const { words } = kit;
  const [view, set] = useClassView();
  const { session, rows, totals } = report;
  const endedAt = session.endedAt ?? session.endsAt;
  const groups = followUp(rows);
  const skills = sessionSkills(rows);
  const shared = skills.filter((entry) => entry.students.length > 1);
  const single = skills.filter((entry) => entry.students.length === 1);
  const help = helpCount(totals);
  const sort = parseSort(view.sort) ?? {
    column: "status",
    direction: "ascending" as const,
  };
  const everyColumns = columns(kit, rows);
  const student = useKeyedSheet("session-student");
  const title = `Session on ${day(session.startedAt)}`;
  return (
    <KitContext.Provider value={kit}>
      <OpenContext.Provider value={student.show}>
        <article className={styles.page} data-session-report={session.id}>
          {/* A div, not a header: the app's print sheet drops headers. */}
          <div className={styles.head}>
            {className && <p className={styles.printOnly}>{className}</p>}
            <ScreenTitle>{title}</ScreenTitle>
            <p className={styles.when}>
              {clock(session.startedAt)} to {clock(endedAt)} ·{" "}
              {sessionLength(session.startedAt, endedAt, "long")}
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
                  <li
                    key={group.id}
                    className={styles.group}
                    data-group={group.id}
                  >
                    <h3>
                      {group.id === "not-signed-in"
                        ? words.notSignedIn
                        : group.id === "no-answers"
                          ? words.noAnswers
                          : group.title}
                      <span className={styles.count}>
                        {group.members.length}
                      </span>
                    </h3>
                    <ul className={styles.people}>
                      {group.members.map((row) => {
                        const fact = group.fact(row, words);
                        return (
                          <li key={row.personId}>
                            <Student row={row} className={styles.person}>
                              {row.name}
                            </Student>
                            {fact && (
                              <span className={styles.fact}>{fact}</span>
                            )}
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
            {/* The heading and the key to the help drawings its rows show:
              one line with room, two without; there from the first paint. */}
            <div className={styles.everyHead}>
              <h2 id="every-student">{words.every}</h2>
              <HelpKey className={styles.helpKey} />
            </div>
            <DataGrid
              label={words.everyLabel}
              columns={everyColumns}
              cardsBelow={TABLE_FROM}
              card={(row) => <RowCard row={row} />}
              onRowActivate={(row) => student.show(row.personId)}
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
                        {words.people(entry.students.length)}
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
                  <h3>{words.oneEach(shared.length > 0)}</h3>
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
                            {entry.endedNeedingHelp > 0 &&
                              " · needed help at the end"}
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
        <StudentSheet
          rows={rows}
          columns={everyColumns}
          id={student.id}
          onClose={student.close}
          when={title}
        />
      </OpenContext.Provider>
    </KitContext.Provider>
  );
}
