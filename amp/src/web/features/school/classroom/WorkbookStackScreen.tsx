import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  StackSet,
  StackView,
} from "../../../../schools/classroom-contracts";
import { Badge } from "../../../ui/Badge";
import { Button, buttonClass } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { EmptyState } from "../../../ui/EmptyState";
import { Wave } from "../../../ui/Loading";
import { Segmented } from "../../../ui/Segmented";
import { meOptions } from "../../../lib/query";
import { AllowancePause } from "../../continue/AllowancePause";
import { dateLabel, defaultPaper } from "../../workbooks/model";
import { currentSession, orgOptions } from "../api";
import { useStaffSession } from "../classes/api";
import { useClassHost, type ClassHost } from "../classes/host";
import { stackSearchSchema } from "./search";
import { PageHead } from "../parts";
import { invalidateStack, say, stackOptions } from "./api";
import type { StackSearch } from "./search";
import {
  clearStack,
  resumeStack,
  startStack,
  stopStack,
  useStackRun,
  type Tile,
} from "./stack-run";
import styles from "./Stack.module.css";
import { freeWorkbooksUsed, printableStudents } from "./stack-selection";

const dayOf = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    timeZone: "UTC",
  });
const monthDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
function daysBetween(first: string, last: string) {
  const days: string[] = [];
  for (let day = first; day <= last; day = shift(day, 1)) days.push(day);
  return days;
}
const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

function DayPicker({
  days,
  today,
  value,
  disabled,
  onChange,
}: {
  days: string[];
  today: string;
  value: string;
  disabled: boolean;
  onChange: (day: string) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  return (
    <div role="radiogroup" aria-label="Date" className={styles.days}>
      {days.map((day, index) => (
        <button
          key={day}
          ref={(node) => {
            refs.current[day] = node;
          }}
          type="button"
          role="radio"
          aria-checked={day === value}
          tabIndex={day === value ? 0 : -1}
          disabled={disabled}
          className={styles.day}
          onClick={() => onChange(day)}
          onKeyDown={(event) => {
            const step =
              event.key === "ArrowRight" || event.key === "ArrowDown"
                ? 1
                : event.key === "ArrowLeft" || event.key === "ArrowUp"
                  ? -1
                  : 0;
            if (!step) return;
            event.preventDefault();
            const next = days[(index + step + days.length) % days.length]!;
            onChange(next);
            refs.current[next]?.focus();
          }}
        >
          <span className={styles.dayName}>
            {day === today ? "Today" : dayOf(day)}
          </span>
          <span className={styles.dayDate}>{monthDay(day)}</span>
        </button>
      ))}
    </div>
  );
}

const statusWord: Record<Tile["state"], string> = {
  waiting: "In line",
  making: "Making",
  retrying: "Making",
  ready: "Ready",
  failed: "Not finished",
  seat: "Needs a seat",
};
function Sheet({ tile, chosen }: { tile?: Tile; chosen: boolean }) {
  const state = tile?.state;
  return (
    <span
      className={styles.sheet}
      data-state={state ?? (chosen ? "chosen" : "left")}
      aria-hidden="true"
    >
      {state === "making" || state === "retrying" ? (
        <Wave />
      ) : state === "ready" || (!state && chosen) ? (
        <svg viewBox="0 0 16 16">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      ) : null}
    </span>
  );
}

/** `.../workbooks`: one click prints a different workbook for each student. */
export function WorkbookStackScreen({
  host: given,
}: { host?: ClassHost } = {}) {
  const host = useClassHost(given);
  const params = host.place;
  const raw = useSearch({ strict: false });
  const search = useMemo(
    () => stackSearchSchema.parse(raw) as StackSearch,
    [raw],
  );
  const navigate = useNavigate();
  const session = useStaffSession();
  const client = useQueryClient();
  const query = useQuery(stackOptions(session, params.class, search.skill));
  // Only the people this host shows: a family's own children.
  const shown = useMemo(
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
  const run = useStackRun(params.class);
  const data = shown;
  const set = (change: Partial<StackSearch>) =>
    void navigate({
      to: ".",
      search: ((previous: StackSearch) => ({
        ...previous,
        ...change,
      })) as never,
      replace: true,
    });
  const busy = run?.status === "running" || run?.status === "merging";
  // A family's class is its children.
  const family =
    useQuery({
      ...orgOptions(currentSession(), params.org),
      refetchOnMount: false,
    }).data?.kind === "family";
  const who = given
    ? (host.words.learner as "student" | "child")
    : family
      ? "child"
      : "student";

  // A print that just finished shows in "Mark" below.
  const status = run?.status;
  useEffect(() => {
    if (status === "done" || status === "paused")
      void invalidateStack(client, session);
  }, [client, session, status]);

  return (
    <host.Frame
      className={data?.class.name}
      loading={query.isPending}
      tab="workbooks"
    >
      <PageHead title="Workbooks" />
      {!data ? (
        <EmptyState
          title="These workbooks didn’t load"
          action={
            <Button variant="primary" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        >
          {say(query.error, "The list couldn’t be read.")}
        </EmptyState>
      ) : !data.students.length ? (
        <EmptyState
          title={
            given
              ? `No ${host.words.learners} here yet`
              : family
                ? "No children in this class yet"
                : "No students in this class yet"
          }
        >
          {given || family
            ? "Add a child, then print a workbook made from their own work."
            : "Add students to the class, then print a workbook for each of them."}
        </EmptyState>
      ) : (
        <Stack
          data={data}
          search={search}
          set={set}
          busy={busy}
          org={params.org}
          classId={params.class}
          session={session}
          who={who}
          href={host.href}
        />
      )}
    </host.Frame>
  );
}

function Stack({
  data,
  search,
  set,
  busy,
  org,
  classId,
  session,
  who,
  href,
}: {
  /** A sibling screen's address in this host. */
  href: (leaf: string) => string;
  /** What the class calls the people in it: "student", or "child". */
  who: "student" | "child";
  data: StackView;
  search: StackSearch;
  set: (change: Partial<StackSearch>) => void;
  busy: boolean;
  org: string;
  classId: string;
  session: ReturnType<typeof useStaffSession>;
}) {
  const run = useStackRun(classId);
  const [parts, setParts] = useState(false);
  const me = useQuery(meOptions(currentSession())).data;
  // A family's own parent continues with AMP; a class or school has no
  // checkout, so its next step is to talk to us.
  const used = data.students.filter(freeWorkbooksUsed);
  // A family's own child continues with AMP; any other class talks to us.
  const family = me?.signedIn && me.familyClass?.classId === classId;
  const child = family
    ? me.learners.find((learner) =>
        used.some((student) => student.name === learner.name),
      )
    : undefined;
  const date =
    search.date && search.date >= data.today && search.date <= data.lastDate
      ? search.date
      : data.today;
  const minutes = search.minutes ?? 45;
  const paper = search.paper ?? defaultPaper();
  const focus = data.focus;
  const skill = focus?.id;
  const onDate = data.recent.filter((entry) => entry.date === date);
  const existing =
    !skill && !search.set
      ? onDate.find((entry) => entry.minutes === minutes && !entry.focus)
      : undefined;
  const newest = Math.max(0, ...onDate.map((entry) => entry.number));
  const number = search.set ?? existing?.number ?? newest + 1;
  const issued = onDate.find(
    (entry) => entry.number === number && entry.minutes === minutes,
  );
  const reprint = !!issued;
  const eligible = useMemo(
    () => printableStudents(data.students, data.recent, date, number, minutes),
    [data.students, data.recent, date, number, minutes],
  );
  // "," is a teacher who cleared everyone; a list with nobody real in it is a bad
  // link, and falls back to the whole class.
  const none = search.students === ",";
  const chosen = useMemo(() => {
    if (none) return [];
    const named = new Set((search.students ?? "").split(",").filter(Boolean));
    const known = eligible.filter((student) => named.has(student.id));
    return known.length ? known : eligible;
  }, [none, search.students, eligible]);
  const chosenIds = useMemo(
    () => new Set(chosen.map((student) => student.id)),
    [chosen],
  );
  const key = [
    date,
    number,
    minutes,
    paper,
    skill ?? "",
    chosen.map((student) => student.id).join(","),
  ].join(":");
  const here = busy || run?.key === key ? run : undefined;
  const status = here?.status;
  const tiles = here?.tiles ?? {};
  const ids = here?.students ?? chosen.map((student) => student.id);
  const ready = ids.filter((id) => tiles[id]?.state === "ready").length;
  const printable = ids.filter((id) => tiles[id]?.state !== "seat").length;
  const left = printable - ready;
  const toggles = !here;

  const toggle = (id: string) => {
    const next = new Set(chosenIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({
      students: !next.size
        ? ","
        : next.size === eligible.length
          ? undefined
          : eligible
              .filter((student) => next.has(student.id))
              .map((student) => student.id)
              .join(","),
    });
  };
  const selected = chosen.length;
  const print = () => {
    if (!session) return;
    set({ set: number });
    startStack(
      session,
      classId,
      key,
      chosen.map((student) => student.id),
      {
        date,
        minutes,
        paper,
        number,
        ...(skill ? { skill } : {}),
      },
    );
  };
  const changeSetting = (change: Partial<StackSearch>) => {
    clearStack(classId);
    set({ set: undefined, ...change });
  };
  const newSet = () => {
    clearStack(classId);
    set({ set: newest + 1 });
  };
  const line = (() => {
    if (!data.pdf) return "Printing isn’t available right now.";
    if (!data.canPrint) return "Your role can see what was printed here.";
    if (status === "running")
      return `Making ${Math.min(ready + 1, printable)} of ${printable}`;
    if (status === "merging")
      return `Joining ${count(printable, "workbook")} into one file`;
    if (status === "done") {
      const pages = here!.files.reduce((sum, file) => sum + file.pages, 0);
      return `${count(ready, "workbook")} ready, ${count(pages, "page")}.`;
    }
    if (status === "paused")
      return here?.note
        ? `${ready} of ${printable} ready. ${here.note}`
        : `Stopped at ${ready} of ${printable}.`;
    if (!eligible.length)
      return `No ${who === "child" ? "child" : "student"} here can get a new workbook.`;
    if (!selected)
      return `Choose at least one ${who === "child" ? "child" : "student"}.`;
    return `About ${minutes} minutes each.${reprint ? " The same ones as last time." : ""}`;
  })();
  const firstFile = here?.files[0];

  return (
    <div className={styles.page}>
      {focus && (
        <p className={styles.focus}>
          Group sheet: each workbook leans on <strong>{focus.title}</strong>.
        </p>
      )}
      <div className={styles.controls}>
        <div className={styles.field}>
          <span className={styles.label}>Date</span>
          <DayPicker
            days={daysBetween(data.today, data.lastDate)}
            today={data.today}
            value={date}
            disabled={busy || !data.canPrint}
            onChange={(day) => changeSetting({ date: day })}
          />
        </div>
        <div className={styles.fieldPair}>
          <div className={styles.field}>
            <span className={styles.label}>Length</span>
            <Segmented<"30" | "45" | "60">
              label="Length"
              compact
              dense
              disabled={busy || !data.canPrint}
              options={[
                { value: "30", label: "30 min" },
                { value: "45", label: "45 min" },
                { value: "60", label: "60 min" },
              ]}
              value={String(minutes) as "30" | "45" | "60"}
              onChange={(value) =>
                changeSetting({ minutes: Number(value) as 30 | 45 | 60 })
              }
            />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Paper</span>
            <Segmented<"letter" | "a4">
              label="Paper"
              compact
              dense
              disabled={busy || !data.canPrint}
              options={[
                { value: "letter", label: "Letter" },
                { value: "a4", label: "A4" },
              ]}
              value={paper}
              onChange={(value) => changeSetting({ paper: value })}
            />
          </div>
        </div>
      </div>
      <section aria-labelledby="stack-students" className={styles.students}>
        <div className={styles.studentsHead}>
          {/* Who gets one: the boxes show it, and Print says how many. */}
          <h2 id="stack-students">
            {who === "child" ? "Children" : "Students"}
          </h2>
          {data.canPrint &&
            (status === "done" ? (
              <Button
                variant="quiet"
                className={styles.allNone}
                onClick={newSet}
              >
                Make a new set
              </Button>
            ) : (
              <Button
                variant="quiet"
                className={styles.allNone}
                style={
                  toggles && eligible.length
                    ? undefined
                    : { visibility: "hidden" }
                }
                onClick={() =>
                  set({
                    students: selected === eligible.length ? "," : undefined,
                  })
                }
              >
                {selected === eligible.length ? "Clear all" : "Choose all"}
              </Button>
            ))}
        </div>
        <ul className={styles.tiles}>
          {data.students.map((student) => {
            const tile = tiles[student.id];
            const on = here
              ? here.students.includes(student.id)
              : chosenIds.has(student.id);
            const seat =
              !eligible.some((entry) => entry.id === student.id) ||
              tile?.state === "seat";
            return (
              <li key={student.id}>
                <button
                  type="button"
                  className={styles.tile}
                  aria-pressed={on && !seat}
                  disabled={!toggles || seat || !data.canPrint}
                  data-state={
                    seat ? "seat" : (tile?.state ?? (on ? "chosen" : "left"))
                  }
                  title={tile?.message}
                  onClick={() => toggle(student.id)}
                >
                  <Sheet tile={tile} chosen={on && !seat} />
                  <span className={styles.tileText}>
                    <span className={styles.tileName}>{student.name}</span>
                    <span className={styles.tileStatus}>
                      {seat
                        ? used.includes(student)
                          ? "Free workbooks used"
                          : statusWord.seat
                        : tile
                          ? tile.state === "ready" && tile.problems
                            ? count(tile.problems, "problem")
                            : statusWord[tile.state]
                          : // The box says whether it prints: no word for it.
                            ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {/* From the class's data on first paint, whatever set is chosen, so
            choosing never moves what follows. */}
        {data.canPrint && used.length > 0 && (
          <AllowancePause
            kind="workbooks"
            compact
            viewer={child ? "parent" : "staff"}
            learner={child ? { id: child.id, name: child.name } : undefined}
          />
        )}
      </section>
      {data.recent.length > 0 && (
        <section aria-labelledby="stack-recent" className={styles.recent}>
          <h2 id="stack-recent">Printed lately</h2>
          <ul>
            {data.recent.map((entry: StackSet) => (
              <li
                key={`${entry.date}:${entry.number}:${entry.minutes}:${entry.focus}`}
              >
                <span className={styles.recentText}>
                  <strong>{dateLabel(entry.date, "short")}</strong>
                  <span>
                    {entry.focus ? "Group sheet, " : ""}
                    {entry.minutes} minutes,{" "}
                    {count(
                      entry.students,
                      who,
                      who === "child" ? "children" : "students",
                    )}
                  </span>
                </span>
                <Badge
                  tone={
                    entry.marked === entry.students
                      ? "success"
                      : entry.marked
                        ? "warning"
                        : "neutral"
                  }
                >
                  {entry.marked === entry.students
                    ? "All marked"
                    : `${entry.marked} of ${entry.students} marked`}
                </Badge>
                <Link
                  to="/$"
                  params={{ _splat: href(`workbooks/${entry.date}`) }}
                  search={{ set: entry.number } as never}
                  className={buttonClass("secondary")}
                >
                  Mark
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerText}>
            <p
              aria-live="polite"
              data-tone={here?.note ? "warning" : undefined}
            >
              {line}
            </p>
          </div>
          {data.pdf && data.canPrint && (
            <>
              <div className={styles.footerSecondary}>
                {status === "running" ? (
                  <Button variant="quiet" onClick={() => stopStack(classId)}>
                    Stop
                  </Button>
                ) : status === "done" &&
                  firstFile &&
                  here!.files.length === 1 ? (
                  <a
                    className={buttonClass("quiet")}
                    href={firstFile.url}
                    download={firstFile.name}
                  >
                    Download
                  </a>
                ) : reprint && !here ? (
                  <Button variant="quiet" onClick={newSet}>
                    Make a new set
                  </Button>
                ) : null}
              </div>
              <div className={styles.footerPrimary}>
                {status === "done" && firstFile ? (
                  here!.files.length > 1 ? (
                    <Button variant="primary" onClick={() => setParts(true)}>
                      Open {here!.files.length} files
                    </Button>
                  ) : (
                    <a
                      className={buttonClass("primary")}
                      href={firstFile.url}
                      target="_blank"
                    >
                      Open {count(ready, "workbook")}
                    </a>
                  )
                ) : status === "paused" ? (
                  <Button
                    variant="primary"
                    onClick={() => session && resumeStack(session, classId)}
                  >
                    {left > 0 ? `Finish ${left} more` : "Try joining again"}
                  </Button>
                ) : status === "running" || status === "merging" ? (
                  <Button variant="primary" aria-busy disabled>
                    Print {count(printable, "workbook")}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    disabled={!selected}
                    onClick={print}
                  >
                    {selected
                      ? `Print ${count(selected, "workbook")}`
                      : "Print workbooks"}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <Dialog
        open={parts}
        onOpenChange={setParts}
        title={`${here?.files.length ?? 0} files, ready to print`}
      >
        <p className={styles.partsIntro}>
          A class this size prints as several files, so each one stays quick to
          open.
        </p>
        <ul className={styles.parts}>
          {here?.files.map((file, index) => (
            <li key={file.name}>
              <span>
                <strong>Part {index + 1}</strong>
                <span>
                  Students {file.first} to {file.last},{" "}
                  {count(file.pages, "page")}
                </span>
              </span>
              <a
                className={buttonClass("secondary")}
                href={file.url}
                target="_blank"
              >
                Open
              </a>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
