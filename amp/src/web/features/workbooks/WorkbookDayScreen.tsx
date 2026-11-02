import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { AuthSession } from "../../auth";
import { sessionOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { Chips } from "../../ui/Chips";
import { Segmented } from "../../ui/Segmented";
import { Toast } from "../../ui/Toast";
import {
  workbookAreaNames,
  type WorkbookChoicesInput,
  type WorkbookPaper,
  type WorkbookSummary,
} from "../../../workbook/contracts";
import {
  anotherWorkbook,
  downloadWorkbook,
  workbookAreasOptions,
  workbookHistoryOptions,
  workbookOptions,
  workbooksKey,
  type WorkbookMinutes,
} from "./api";
import {
  choicesLabel,
  choicesSearch,
  dateLabel,
  defaultPaper,
  isDate,
  localDate,
  sameChoices,
  searchChoices,
  sectionNames,
  workbookMessage,
  type WorkbookSearch,
} from "./model";
import { WorkbookFrame, type WorkbookLearner } from "./WorkbookFrame";
import { WorkbookList } from "./WorkbookList";
import styles from "./Workbooks.module.css";

export function WorkbookDayScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const { learnerId, date } = useParams({ strict: false }) as {
    learnerId: string;
    date: string;
  };
  if (!session) return <Navigate to="/sign-in" replace />;
  if (!isDate(date))
    return (
      <Navigate
        to="/learners/$learnerId/workbooks"
        params={{ learnerId }}
        replace
      />
    );
  return (
    <WorkbookFrame session={session} learnerId={learnerId}>
      {(learner) =>
        date === localDate() ? (
          <Today session={session} learner={learner} date={date} />
        ) : (
          <PastDay session={session} learner={learner} date={date} />
        )
      }
    </WorkbookFrame>
  );
}

function Head({ learner, date }: { learner: WorkbookLearner; date: string }) {
  return (
    <>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Workbook for {learner.name}</p>
        <Link
          to="/learners/$learnerId/workbooks"
          params={{ learnerId: learner.id }}
          className={styles.textLink}
        >
          Past workbooks
        </Link>
      </div>
      <h1 className={styles.title}>{dateLabel(date)}</h1>
    </>
  );
}

function Today({
  session,
  learner,
  date,
}: {
  session: AuthSession;
  learner: WorkbookLearner;
  date: string;
}) {
  const search = useSearch({ strict: false }) as WorkbookSearch;
  const navigate = useNavigate();
  const client = useQueryClient();
  const minutes = search.minutes ?? 45;
  const paper = search.paper ?? defaultPaper();
  const choices = searchChoices(search);
  const history = useQuery(workbookHistoryOptions(session, learner.id, date));
  const areas = useQuery(workbookAreasOptions(session, learner.id));
  const latest = history.data?.workbooks.length
    ? Math.max(...history.data.workbooks.map((w) => w.number))
    : 1;
  const number = search.number ?? (history.isSuccess ? latest : undefined);
  const workbook = useQuery({
    ...workbookOptions(session, learner.id, {
      date,
      number: number ?? 1,
      minutes,
      paper,
      choices,
    }),
    enabled: number !== undefined,
    placeholderData: keepPreviousData,
    // A stored workbook never changes; there is nothing to refetch.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const current = workbook.isPlaceholderData ? undefined : workbook.data;
  // A stored workbook keeps the choices it was made with: the URL follows
  // it, so the controls always show what this workbook is.
  useEffect(() => {
    if (!current || sameChoices(current.choices, choices)) return;
    client.setQueryData(
      workbookOptions(session, learner.id, {
        date,
        number: current.number,
        minutes,
        paper,
        choices: current.choices,
      }).queryKey,
      current,
    );
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, ...choicesSearch(current.choices) }),
      replace: true,
    });
  }, [current?.id]);
  // A workbook made here joins the day's history.
  useEffect(() => {
    if (
      current &&
      history.data &&
      !history.data.workbooks.some(
        (w) => w.id === current.id && w.paper === current.paper,
      )
    )
      void client.invalidateQueries({
        queryKey: [...workbooksKey(session, learner.id), "history"],
      });
  }, [current?.id, current?.paper, history.data]);
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);
  // A failed history load means no PDF flag: the printable copy still works.
  const ready = !!current && (!!history.data || !!history.error);
  // Roll another, or change a choice: the next workbook for today, made
  // with these choices. Each is its own URL, so Back returns to the last.
  const another = useMutation({
    mutationFn: (next: WorkbookChoicesInput) =>
      anotherWorkbook(session, learner.id, {
        date,
        minutes,
        paper,
        choices: next,
      }),
    onSuccess: (made) => {
      client.setQueryData(
        workbookOptions(session, learner.id, {
          date,
          number: made.number,
          minutes,
          paper,
          choices: made.choices,
        }).queryKey,
        made,
      );
      void client.invalidateQueries({
        queryKey: [...workbooksKey(session, learner.id), "history"],
      });
      void navigate({
        to: ".",
        search: (prev) => ({
          ...prev,
          number: made.number,
          ...choicesSearch(made.choices),
        }),
      });
    },
    onError: (error) =>
      setMessage(
        workbookMessage(error, "Another workbook couldn't be made. Try again."),
      ),
  });
  const roll = (next: WorkbookChoicesInput) => {
    setMessage("");
    another.mutate(next);
  };
  const choosing = !current || another.isPending;
  // The areas row fades at an end only while there is more to scroll there.
  const areasRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = areasRow.current;
    if (!row) return;
    const edges = () => {
      row.dataset.start = String(row.scrollLeft <= 1);
      row.dataset.end = String(
        row.scrollLeft + row.clientWidth >= row.scrollWidth - 1,
      );
    };
    edges();
    row.addEventListener("scroll", edges, { passive: true });
    const observer = new ResizeObserver(edges);
    observer.observe(row);
    if (row.firstElementChild) observer.observe(row.firstElementChild);
    return () => {
      row.removeEventListener("scroll", edges);
      observer.disconnect();
    };
  }, [areas.data]);
  const areaName = (id: string) => workbookAreaNames[id] ?? id;
  const set = (change: {
    minutes?: WorkbookMinutes;
    paper?: WorkbookPaper;
  }) => {
    setMessage("");
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, number, ...change }),
      replace: true,
    });
  };
  async function download() {
    if (!current) return;
    setMessage("");
    setDownloading(true);
    try {
      await downloadWorkbook(
        session,
        learner.id,
        current,
        paper,
        history.data?.pdf ?? false,
      );
    } catch (error) {
      setMessage(
        workbookMessage(error, "The workbook didn't download. Try again."),
      );
    } finally {
      setDownloading(false);
    }
  }
  const loadError = history.error ?? workbook.error;
  return (
    <>
      <Head learner={learner} date={date} />
      {/* The actions come first: never under the toast, always in reach. */}
      <div className={styles.actions} data-workbook-actions>
        <Button
          variant="primary"
          className={styles.download}
          disabled={!ready || downloading}
          aria-busy={downloading || (!ready && !loadError)}
          onClick={() => void download()}
        >
          {(ready || loadError) && !downloading
            ? "Download workbook"
            : "Preparing…"}
        </Button>
        <Button
          variant="secondary"
          className={styles.another}
          disabled={!current || another.isPending}
          aria-busy={another.isPending}
          onClick={() => roll(choices)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.dice}>
            <rect x="2.5" y="2.5" width="15" height="15" rx="3.5" />
            <circle cx="7" cy="7" r="1.3" />
            <circle cx="13" cy="13" r="1.3" />
            <circle cx="10" cy="10" r="1.3" />
          </svg>
          {another.isPending ? "Rolling…" : "Roll another"}
        </Button>
      </div>
      <div className={styles.controls}>
        <Segmented<"30" | "45" | "60">
          compact
          label="Length"
          value={String(minutes) as "30" | "45" | "60"}
          onChange={(value) =>
            set({ minutes: Number(value) as WorkbookMinutes })
          }
          options={[
            { value: "30", label: "30 min", detail: "Lighter" },
            { value: "45", label: "45 min", detail: "Typical" },
            { value: "60", label: "60 min", detail: "Longer" },
          ]}
        />
        <Segmented<WorkbookPaper>
          compact
          label="Paper size"
          value={paper}
          onChange={(value) => set({ paper: value })}
          options={[
            { value: "letter", label: "Letter", detail: "US, Canada" },
            { value: "a4", label: "A4", detail: "Most countries" },
          ]}
        />
        <div className={styles.choice}>
          <span className={styles.choiceLabel} aria-hidden="true">
            Level
          </span>
          <Segmented<WorkbookChoicesInput["lean"]>
            compact
            label="Level"
            value={choices.lean}
            disabled={choosing}
            onChange={(lean) => roll({ ...choices, lean })}
            options={[
              { value: "easier", label: "Easier" },
              { value: "level", label: "At level" },
              { value: "stretch", label: "Harder" },
            ]}
          />
        </div>
        <div className={styles.choice}>
          <span className={styles.choiceLabel} aria-hidden="true">
            Today&apos;s idea
          </span>
          <Segmented<"lesson" | "problems">
            compact
            label="Today's idea"
            value={choices.lesson ? "lesson" : "problems"}
            disabled={choosing}
            onChange={(value) =>
              roll({ ...choices, lesson: value === "lesson" })
            }
            options={[
              { value: "lesson", label: "Include" },
              { value: "problems", label: "Leave out" },
            ]}
          />
        </div>
      </div>
      {/* One row that scrolls sideways: however many areas a learner has,
          nothing below it moves when they load. */}
      <div className={styles.choice}>
        <span className={styles.choiceLabel} aria-hidden="true">
          Areas
        </span>
        <div className={styles.areas} ref={areasRow}>
          <Chips<string>
            label="Areas"
            disabled={choosing}
            value={choices.areas.length ? choices.areas : ["mixed"]}
            onChange={(next) => {
              const picked = next.filter((v) => v !== "mixed");
              const mixed =
                !picked.length ||
                (next.includes("mixed") && choices.areas.length > 0);
              roll({ ...choices, areas: mixed ? [] : picked });
            }}
            options={[
              { value: "mixed", label: "Mixed (recommended)" },
              ...(areas.data?.areas ?? []).map((a) => ({
                value: a.id,
                label: a.label,
              })),
            ]}
          />
        </div>
      </div>
      {/* An action that fails says so in the shared toast, over the page. */}
      <Toast message={message} onDismiss={() => setMessage("")} />
      <Contents
        workbook={workbook.data}
        stale={!current}
        learnerId={learner.id}
        areaName={areaName}
        failure={
          loadError && !workbook.data
            ? {
                text: workbookMessage(
                  loadError,
                  "Today's workbook couldn't be prepared. Try again.",
                ),
                retry: () => {
                  // Focus stays in the card the retry replaces.
                  document
                    .querySelector<HTMLElement>("[data-workbook-contents]")
                    ?.focus();
                  void history.refetch();
                  void workbook.refetch();
                },
              }
            : undefined
        }
      />
    </>
  );
}

function Contents({
  workbook,
  stale,
  learnerId,
  areaName,
  failure,
}: {
  workbook?: WorkbookSummary;
  stale: boolean;
  learnerId: string;
  areaName: (id: string) => string;
  /** A load that failed: said in the card's reserved space, with a retry. */
  failure?: { text: string; retry: () => void };
}) {
  return (
    <div
      className={`${styles.contents} ${stale && !failure ? styles.stale : ""}`}
      data-workbook-contents
      tabIndex={-1}
      aria-label="Workbook contents"
    >
      {workbook ? (
        <>
          <div className={styles.contentsHead}>
            <h2>No. {workbook.number}</h2>
            <span className={styles.code} aria-label="Workbook code">
              {workbook.code}
            </span>
          </div>
          <p className={styles.summary}>
            About {Math.max(5, Math.round(workbook.estimatedMinutes / 5) * 5)}{" "}
            minutes · {workbook.problems}{" "}
            {workbook.problems === 1 ? "problem" : "problems"} · answer key
            included
          </p>
          <p className={styles.choiceLine}>
            {choicesLabel(workbook.choices, areaName) || "Mixed, at level"}
          </p>
          <ol className={styles.sections}>
            {workbook.sections.map((section) => (
              <li key={section.kind}>
                <span className={styles.sectionName}>
                  {sectionNames[section.kind]}
                  {section.title && (
                    <span className={styles.sectionTitle}>{section.title}</span>
                  )}
                </span>
                <span className={styles.count}>{section.problems}</span>
              </li>
            ))}
          </ol>
          <Link
            to="/learners/$learnerId/workbooks/$workbookId/results"
            params={{ learnerId, workbookId: workbook.id }}
            className={styles.resultsLink}
          >
            Enter results
          </Link>
        </>
      ) : failure ? (
        <div className={styles.failure} role="alert">
          <p>{failure.text}</p>
          <button
            type="button"
            className={styles.retry}
            onClick={failure.retry}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className={styles.skeleton} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

function PastDay({
  session,
  learner,
  date,
}: {
  session: AuthSession;
  learner: WorkbookLearner;
  date: string;
}) {
  const history = useQuery(workbookHistoryOptions(session, learner.id, date));
  return (
    <>
      <Head learner={learner} date={date} />
      {history.data && !history.data.workbooks.length ? (
        <div className={styles.notice}>
          <p>No workbook was made on this day.</p>
          <Link
            to="/learners/$learnerId/workbooks/$date"
            params={{ learnerId: learner.id, date: localDate() }}
            className={buttonClass("primary")}
          >
            Open today's workbook
          </Link>
        </div>
      ) : (
        <WorkbookList
          session={session}
          learnerId={learner.id}
          query={history}
          showDates={false}
        />
      )}
    </>
  );
}
