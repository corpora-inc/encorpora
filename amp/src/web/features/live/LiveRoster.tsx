import { useMemo, useRef, useState, type ReactNode } from "react";
import type {
  LiveRow,
  LiveRules,
  LiveSignal,
  LiveStatus,
} from "../../../schools/live/contracts";
import {
  isAnswering,
  LIVE_RULES,
  liveStatus,
} from "../../../schools/live/status";
import {
  DataGrid,
  type DataGridColumn,
  type GridSort,
} from "../../ui/DataGrid";
import { Menu, MenuItem } from "../../ui/Menu";
import { Segmented } from "../../ui/Segmented";
import { FitText } from "../../ui/FitText";
import { Changed } from "./Changed";
import {
  agoText,
  agoWords,
  lastActive,
  levelText,
  percentText,
} from "./format";
import { HelpCounts, HelpKey, helpWords } from "./HelpCounts";
import { useLiveLayout, type LiveLayout } from "./layout";
import { RecentAnswers, recentWords } from "./RecentAnswers";
import { RosterRow, type StudentLink } from "./RosterRow";
import { SIGNAL_WORDS, SignalGlyph } from "./SignalGlyph";
import {
  nextSort,
  signalsByPerson,
  sortedIds,
  type LiveSort,
  type LiveSortKey,
  type SortContext,
} from "./sort";
import { StatusMark } from "./StatusMark";
import { STATUS_WORDS } from "./status-words";
import styles from "./LiveRoster.module.css";

export type { StudentLink } from "./RosterRow";

/** Each student's status now, from their row and the session's start. */
export function liveStatuses(
  rows: readonly LiveRow[],
  at: { now: number; startedAt: string },
  rules: LiveRules = LIVE_RULES,
): Map<string, LiveStatus> {
  return new Map(rows.map((row) => [row.personId, liveStatus(row, at, rules)]));
}

/** How many are answering now: an answer or help of theirs in the last two
 * minutes (`isAnswering`). Being here with nothing done yet is not: a
 * student who just signed in, before Start or after, isn't counted. */
export const answeringNow = (
  rows: readonly LiveRow[],
  at: { now: number; startedAt: string },
  rules: LiveRules = LIVE_RULES,
) => rows.filter((row) => isAnswering(row, at, rules)).length;

/** How many are here now: everyone but "not signed in". It turns with the
 * clock, as the statuses do (seen in the last ten minutes). */
export const hereNow = (statuses: ReadonlyMap<string, LiveStatus>) =>
  [...statuses.values()].filter((status) => status !== "not_signed_in").length;

const collator = new Intl.Collator("en", { sensitivity: "base" });

/**
 * The order the adult last chose, held still. It is taken when the sort
 * changes (or its `version` does) and kept while the numbers change; a
 * student who arrives later joins at the end, one who leaves drops out.
 */
function useFrozenOrder(
  rows: readonly LiveRow[],
  sort: LiveSort,
  context: SortContext,
) {
  const stamp = `${sort.key}:${sort.direction}:${sort.version}`;
  const [frozen, setFrozen] = useState(() => ({
    stamp,
    ids: sortedIds(rows, sort, context),
  }));
  let held = frozen;
  if (frozen.stamp !== stamp || (frozen.ids.length === 0 && rows.length > 0)) {
    held = { stamp, ids: sortedIds(rows, sort, context) };
    setFrozen(held);
  }
  const ids = held.ids;
  return useMemo(() => {
    const byId = new Map(rows.map((row) => [row.personId, row]));
    const known = new Set(ids);
    return [
      ...ids.flatMap((id) => byId.get(id) ?? []),
      ...rows
        .filter((row) => !known.has(row.personId))
        .sort((a, b) => collator.compare(a.name, b.name)),
    ];
  }, [rows, ids]);
}

/** Words for the sort control, each with its direction. */
const SORT_LABELS: Record<LiveSortKey, string> = {
  attention: "Needs you",
  name: "Name",
  problems: "Problems",
  correct: "Correct",
  level: "Level",
};
const sortItem = (key: LiveSortKey, direction: LiveSort["direction"]) => {
  const descending = direction === "descending";
  switch (key) {
    case "attention":
      return "Needs you first";
    case "name":
      return descending ? "Name, Z to A" : "Name, A to Z";
    case "problems":
      return descending ? "Most problems first" : "Fewest problems first";
    case "correct":
      return descending ? "Highest correct first" : "Lowest correct first";
    case "level":
      return descending ? "Highest level first" : "Lowest level first";
  }
};

export type LiveRosterProps = {
  /** Every student in the session, as the snapshot and stream send them. */
  rows: readonly LiveRow[];
  /** The running session's start (`LiveSession.startedAt`). */
  startedAt: string;
  /** The clock statuses are judged by (re-derives "quiet" between updates). */
  now: number;
  rules?: LiveRules;
  /** Open requests, shown beside the name and first in "Needs you". */
  signals?: readonly LiveSignal[];
  /** The adult's chosen order, kept in the screen's view store. */
  sort: LiveSort;
  onSortChange: (sort: LiveSort) => void;
  /** Show levels (the adult sees them unless the screen says otherwise). */
  showGradeNumbers: boolean;
  /** Opens a student (EntityLink with the student entity). */
  link?: StudentLink;
  /** Names the roster for assistive technology ("Students in this session"). */
  label: string;
  /** The first column's heading: "Student", "Child". */
  nameHeader: string;
  /** On a desktop the grid fills its parent's height and scrolls inside
   * it (CockpitFrame gives it one); this styles that box. */
  className?: string;
  /** A short list (a family's one to four children): the rows of a
   * tablet at any width, never the grid, and no sort: they keep the order
   * of the list given. */
  short?: boolean;
  /** Words a screen says in place of a status's own ("Not signed in":
   * "Not started" for a family). */
  statusWords?: Partial<Record<LiveStatus, string>>;
  /** Levels per row, where one screen shows some and not others (a child
   * whose grade level is switched off): wins over `showGradeNumbers`. */
  levelShown?: (personId: string) => boolean;
  /** A phone's row has no Help column: what a screen puts at the end of the
   * name's line in its place, in a fixed width of its own (a family's help
   * marks). Not drawn on a tablet or a desktop. It stands in for the Help
   * column, so the key to the help drawings shows above the rows with it. */
  phoneAside?: (row: LiveRow) => ReactNode;
};

/**
 * Every student in a live session, in the order the adult chose: rows of
 * 64 px on a phone (mark, name over skill · level · last active, problems,
 * percent, last five answers), 56 px on a tablet (adding help and last
 * active), and a dense grid of 44 px rows on a desktop. Rows never reorder
 * by themselves: numbers change in place, in tabular figures, with a brief
 * tint where one just changed.
 *
 * The skill's name gets the room the figures don't need and is never cut
 * inside a word (ui/FitText): one line in a row, up to two in the grid,
 * and where it still doesn't fit, a tap shows all of it.
 */
export function LiveRoster(props: LiveRosterProps) {
  const root = useRef<HTMLDivElement>(null);
  const measured = useLiveLayout(root);
  const layout: LiveLayout =
    props.short && measured === "desktop" ? "tablet" : measured;
  const { rows, now, startedAt, rules = LIVE_RULES, signals = [] } = props;
  const statuses = useMemo(
    () => liveStatuses(rows, { now, startedAt }, rules),
    [rows, now, startedAt, rules],
  );
  const bySignal = useMemo(() => signalsByPerson(signals), [signals]);
  const ordered = useFrozenOrder(rows, props.sort, {
    statuses,
    signals: bySignal,
  });
  const view: RosterView = {
    ...props,
    layout,
    ordered,
    statuses,
    bySignal,
  };
  return (
    <div
      ref={root}
      className={`${styles.roster} ${props.className ?? ""}`}
      data-layout={layout}
      data-live-roster=""
    >
      {layout === "desktop" ? <Grid {...view} /> : <List {...view} />}
    </div>
  );
}

type RosterView = LiveRosterProps & {
  layout: LiveLayout;
  ordered: LiveRow[];
  statuses: Map<string, LiveStatus>;
  bySignal: Map<string, LiveSignal[]>;
};

/** The open requests beside a name: a hand, a picture card. */
function Requests({ signals }: { signals: readonly LiveSignal[] | undefined }) {
  if (!signals?.length) return null;
  return (
    <span
      className={styles.requests}
      role="img"
      aria-label={signals.map((s) => SIGNAL_WORDS[s.kind].what).join(", ")}
    >
      {signals.map((signal) => (
        <SignalGlyph key={signal.id} kind={signal.kind} />
      ))}
    </span>
  );
}

/** The line under a name: what needs the adult first, then the skill in
 * the room that is left (whole words, the rest a tap away), the level and,
 * on a phone, when they last did something. A tablet's level always shows;
 * a phone's level and time show when the skill leaves them room. */
function detailLine(
  row: LiveRow,
  status: LiveStatus,
  view: Pick<
    RosterView,
    "now" | "showGradeNumbers" | "layout" | "statusWords" | "levelShown"
  >,
) {
  const word = (at: LiveStatus) =>
    view.statusWords?.[at] ?? STATUS_WORDS[at].word;
  const level = view.levelShown?.(row.personId) ?? view.showGradeNumbers;
  if (status === "not_signed_in")
    return (
      <span className={styles.statusWord} data-status={status}>
        {word(status)}
      </span>
    );
  const phone = view.layout === "phone";
  const after = [
    ...(level && row.level !== null ? [levelText(row.level)] : []),
    ...(phone ? [agoText(lastActive(row), view.now)] : []),
  ];
  // Keyed by what leads it: when the status, skill or level changes, the
  // line is drawn anew rather than its words sliding along (a layout shift
  // to the browser). Only "last active", at its end, changes in place.
  return (
    <span
      key={`${status}|${row.skill?.id ?? row.problems === 0}|${level ? row.level : ""}`}
      className={styles.detailLine}
    >
      {status !== "working" && (
        <span className={styles.statusWord} data-status={status}>
          {word(status)}
          {(row.skill || row.problems === 0 || after.length > 0) && (
            <span className={styles.dot}> · </span>
          )}
        </span>
      )}
      {row.skill ? (
        <FitText
          text={row.skill.title}
          after={after}
          reserve={phone ? 0 : after.length}
          label="Skill"
          className={styles.detailSkill}
        />
      ) : (
        <span className={styles.detailRest}>
          {[...(row.problems === 0 ? ["No answers yet"] : []), ...after].map(
            (part, index) => (
              <span key={index} className={styles.detailFact}>
                <span key={part}>{part}</span>
              </span>
            ),
          )}
        </span>
      )}
    </span>
  );
}

/** A phone's or tablet's sort: a menu on a phone, where five choices
 * don't fit side by side; a segmented control on a tablet. */
function SortControl({
  layout,
  sort,
  onSortChange,
  showGradeNumbers,
}: Pick<RosterView, "layout" | "sort" | "onSortChange" | "showGradeNumbers">) {
  const keys = (Object.keys(SORT_LABELS) as LiveSortKey[]).filter(
    (key) => showGradeNumbers || key !== "level",
  );
  if (layout === "tablet")
    return (
      <div className={styles.segmented}>
        <Segmented
          label="Sort students"
          options={keys.map((key) => ({ value: key, label: SORT_LABELS[key] }))}
          value={sort.key}
          onChange={(key) => onSortChange(nextSort(sort, key))}
          compact
          dense
        />
      </div>
    );
  const choices = keys.flatMap((key): Pick<LiveSort, "key" | "direction">[] =>
    key === "attention"
      ? [{ key, direction: "ascending" as const }]
      : (["ascending", "descending"] as const).map((direction) => ({
          key,
          direction,
        })),
  );
  return (
    <Menu
      align="start"
      aria-label={`Sorted: ${sortItem(sort.key, sort.direction)}`}
      label={sortItem(sort.key, sort.direction)}
    >
      {choices.map((choice) => (
        <MenuItem
          key={`${choice.key}-${choice.direction}`}
          selected={
            choice.key === sort.key && choice.direction === sort.direction
          }
          onSelect={() =>
            onSortChange({ ...choice, version: sort.version + 1 })
          }
        >
          {sortItem(choice.key, choice.direction)}
        </MenuItem>
      ))}
    </Menu>
  );
}

function List(view: RosterView) {
  const { layout, ordered, statuses, bySignal, now, sort } = view;
  const tablet = layout === "tablet";
  const sortedBy = (key: LiveSortKey) =>
    sort.key === key ? sort.direction : undefined;
  return (
    <>
      {!view.short && (
        <div className={styles.bar}>
          <SortControl {...view} />
        </div>
      )}
      {/* The key to the help drawings, wherever a row shows them: there
          from the first paint, so it never pushes a row down. */}
      {(tablet || view.phoneAside) && <HelpKey className={styles.helpKey} />}
      <div className={styles.head} aria-hidden="true">
        <span className={styles.headName}>{view.nameHeader}</span>
        <span className={styles.headFacts}>
          <HeadLabel className={styles.colPhone} sorted={sortedBy("correct")}>
            Correct
          </HeadLabel>
          {tablet && (
            <>
              <HeadLabel className={styles.colHelp}>Help</HeadLabel>
              <HeadLabel className={styles.colAgo}>Last active</HeadLabel>
            </>
          )}
        </span>
      </div>
      <ul className={styles.list} aria-label={view.label}>
        {ordered.map((row) => {
          const status = statuses.get(row.personId) ?? "working";
          const ago = lastActive(row);
          return (
            <RosterRow
              key={row.personId}
              personId={row.personId}
              name={row.name}
              density={layout === "tablet" ? "tablet" : "phone"}
              link={view.link}
              mark={
                <StatusMark
                  status={status}
                  word={view.statusWords?.[status]}
                  size={tablet ? "regular" : "large"}
                />
              }
              badge={<Requests signals={bySignal.get(row.personId)} />}
              aside={!tablet && view.phoneAside?.(row)}
              detail={detailLine(row, status, view)}
              facts={
                <>
                  <span className={styles.colPhone}>
                    <span
                      className={styles.score}
                      aria-label={
                        row.problems > 0
                          ? `${percentText(row.correct, row.problems)} correct of ${row.problems} ${row.problems === 1 ? "problem" : "problems"}`
                          : "No problems yet"
                      }
                    >
                      <Changed value={`${row.correct}/${row.problems}`}>
                        {row.problems > 0 ? (
                          <>
                            <strong>
                              {percentText(row.correct, row.problems)}
                            </strong>
                            <span className={styles.of}>
                              {" "}
                              of {row.problems}
                            </span>
                          </>
                        ) : (
                          <span className={styles.of}>—</span>
                        )}
                      </Changed>
                    </span>
                    <RecentAnswers
                      recent={row.recent}
                      answered={row.problems}
                    />
                  </span>
                  {tablet && (
                    <>
                      <span className={styles.colHelp}>
                        {status !== "not_signed_in" && (
                          <HelpCounts help={row} />
                        )}
                      </span>
                      <span
                        className={styles.colAgo}
                        aria-label={`Last active ${agoWords(ago, now)}`}
                      >
                        {/* Right-aligned: a new word is a new node, never
                            one sliding over. */}
                        <span key={agoText(ago, now)}>{agoText(ago, now)}</span>
                      </span>
                    </>
                  )}
                </>
              }
            />
          );
        })}
      </ul>
    </>
  );
}

function HeadLabel({
  className,
  sorted,
  children,
}: {
  className: string;
  sorted?: LiveSort["direction"];
  children: ReactNode;
}) {
  return (
    <span className={`${styles.headLabel} ${className}`} data-sorted={sorted}>
      {children}
      <svg className={styles.chevron} viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3 4.5 6 7.5l3-3" />
      </svg>
    </span>
  );
}

const COLUMN_OF: Partial<Record<LiveSortKey, string>> = {
  attention: "status",
  name: "student",
  problems: "problems",
  correct: "correct",
  level: "level",
};
const KEY_OF: Record<string, LiveSortKey> = {
  status: "attention",
  student: "name",
  problems: "problems",
  correct: "correct",
  level: "level",
};

function Grid(view: RosterView) {
  const { ordered, statuses, bySignal, now, sort, onSortChange } = view;
  const root = useRef<HTMLDivElement>(null);
  // The held order, as a rank the grid sorts by. The grid reverses a
  // descending sort itself, so the rank is given to it ascending.
  const rank = new Map(ordered.map((row, index) => [row.personId, index]));
  const factor = sort.direction === "descending" ? -1 : 1;
  const held = (a: LiveRow, b: LiveRow) =>
    factor * ((rank.get(a.personId) ?? 0) - (rank.get(b.personId) ?? 0));
  // Before a student signs in, their counts are blank, not a wall of zeros.
  const number = (row: LiveRow, value: number) =>
    statuses.get(row.personId) === "not_signed_in" ? null : (
      <span key={value} className={value === 0 ? styles.zero : undefined}>
        <Changed value={value}>{value}</Changed>
      </span>
    );
  const columns: DataGridColumn<LiveRow>[] = [
    {
      id: "student",
      header: view.nameHeader,
      width: 184,
      compare: held,
      cell: (row) => {
        const body = (
          <>
            <StatusMark status={statuses.get(row.personId) ?? "working"} />
            <span className={styles.gridName}>{row.name}</span>
            <Requests signals={bySignal.get(row.personId)} />
          </>
        );
        return (
          <span className={styles.gridStudent} data-live-row={row.personId}>
            {view.link ? (
              view.link({
                personId: row.personId,
                name: row.name,
                className: styles.gridLink,
                children: body,
              })
            ) : (
              <span className={styles.gridLink}>{body}</span>
            )}
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      width: 104,
      compare: held,
      cell: (row) => {
        const status = statuses.get(row.personId) ?? "working";
        return (
          <span className={styles.statusWord} data-status={status}>
            {STATUS_WORDS[status].word}
          </span>
        );
      },
    },
    {
      id: "recent",
      header: "Last 5",
      width: 80,
      cell: (row) => (
        <RecentAnswers recent={row.recent} answered={row.problems} />
      ),
      cellLabel: (row) => recentWords(row.recent),
    },
    {
      id: "problems",
      header: "Problems",
      width: 88,
      align: "end",
      firstSort: "descending",
      compare: held,
      cell: (row) => number(row, row.problems),
    },
    {
      id: "correct",
      header: "Correct",
      width: 80,
      align: "end",
      firstSort: "descending",
      compare: held,
      cell: (row) => (
        <Changed value={percentText(row.correct, row.problems)}>
          {percentText(row.correct, row.problems)}
        </Changed>
      ),
    },
    {
      // The four kinds as the tablet's rows and the report draw them: four
      // word-headed columns took the skill's room for figures of one digit.
      id: "help",
      header: "Help",
      width: 176,
      cell: (row) =>
        statuses.get(row.personId) === "not_signed_in" ? null : (
          <HelpCounts help={row} />
        ),
      cellLabel: (row) => helpWords(row),
    },
    {
      // The name takes the room the figures don't need, on two lines where
      // one won't hold it; what still doesn't fit is a tap away.
      id: "skill",
      header: "Skill",
      width: 120,
      grow: true,
      cell: (row) =>
        row.skill ? (
          <FitText
            key={row.skill.id}
            text={row.skill.title}
            lines={2}
            label="Skill"
            className={styles.skill}
          />
        ) : (
          "—"
        ),
    },
    ...(view.showGradeNumbers
      ? [
          {
            id: "level",
            header: "Level",
            width: 64,
            align: "end",
            firstSort: "descending",
            compare: held,
            cell: (row) => {
              const text = levelText(row.level);
              // Right-aligned, as "Last active" is: a new word ("Gr 8" to
              // "Alg 1") is a new node, never one sliding over.
              return <span key={text}>{text}</span>;
            },
          } satisfies DataGridColumn<LiveRow>,
        ]
      : []),
    {
      id: "active",
      header: "Last active",
      width: 64,
      align: "end",
      cell: (row) => {
        const text = agoText(lastActive(row), now);
        // Right-aligned: a new word is a new node, never one sliding over.
        return <span key={text}>{text}</span>;
      },
      cellLabel: (row) => agoWords(lastActive(row), now),
    },
  ];
  const gridSort: GridSort = {
    column: COLUMN_OF[sort.key] ?? "student",
    direction: sort.direction,
  };
  return (
    <>
      <HelpKey className={styles.helpKey} />
      <div ref={root} className={styles.gridBox}>
        <DataGrid
          label={view.label}
          columns={columns}
          rows={ordered}
          rowKey={(row) => row.personId}
          sort={gridSort}
          onSortChange={(next) => {
            const key = KEY_OF[next.column] ?? "name";
            onSortChange(nextSort(sort, key));
          }}
          onRowActivate={
            view.link
              ? (row) =>
                  root.current
                    ?.querySelector<HTMLElement>(
                      `[data-live-row="${row.personId}"] a, [data-live-row="${row.personId}"] button`,
                    )
                    ?.click()
              : undefined
          }
          cardsBelow={0}
          rowHeight={44}
        />
      </div>
    </>
  );
}
