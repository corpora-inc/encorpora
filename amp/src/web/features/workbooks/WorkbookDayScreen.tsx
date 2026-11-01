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
import { useEffect, useState } from "react";
import type { AuthSession } from "../../auth";
import { sessionOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";
import type {
  WorkbookPaper,
  WorkbookSummary,
} from "../../../workbook/contracts";
import {
  anotherWorkbook,
  downloadWorkbook,
  workbookHistoryOptions,
  workbookOptions,
  workbooksKey,
  type WorkbookMinutes,
} from "./api";
import {
  dateLabel,
  defaultPaper,
  isDate,
  localDate,
  sectionNames,
  workbookMessage,
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
        <p className={styles.eyebrow}>{learner.name} · Daily workbook</p>
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
  const search = useSearch({ strict: false }) as {
    minutes?: WorkbookMinutes;
    paper?: WorkbookPaper;
    number?: number;
  };
  const navigate = useNavigate();
  const client = useQueryClient();
  const minutes = search.minutes ?? 45;
  const paper = search.paper ?? defaultPaper();
  const history = useQuery(workbookHistoryOptions(session, learner.id, date));
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
    }),
    enabled: number !== undefined,
    placeholderData: keepPreviousData,
  });
  const current = workbook.isPlaceholderData ? undefined : workbook.data;
  // A workbook made here joins the day's history.
  useEffect(() => {
    if (
      current &&
      history.data &&
      !history.data.workbooks.some((w) => w.id === current.id)
    )
      void client.invalidateQueries({
        queryKey: [...workbooksKey(session, learner.id), "history"],
      });
  }, [current?.id, history.data]);
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);
  const another = useMutation({
    mutationFn: () =>
      anotherWorkbook(session, learner.id, { date, minutes, paper }),
    onSuccess: (made) => {
      client.setQueryData(
        workbookOptions(session, learner.id, {
          date,
          number: made.number,
          minutes,
          paper,
        }).queryKey,
        made,
      );
      void client.invalidateQueries({
        queryKey: [...workbooksKey(session, learner.id), "history"],
      });
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, number: made.number }),
      });
    },
    onError: (error) =>
      setMessage(
        workbookMessage(error, "Another workbook couldn't be made. Try again."),
      ),
  });
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
      await downloadWorkbook(session, learner.id, current, paper);
    } catch (error) {
      setMessage(
        workbookMessage(error, "The workbook didn't download. Try again."),
      );
    } finally {
      setDownloading(false);
    }
  }
  const loadError = history.error ?? workbook.error;
  const shown = message
    ? message
    : loadError
      ? workbookMessage(
          loadError,
          "Today's workbook couldn't be prepared. Try again.",
        )
      : "";
  return (
    <>
      <Head learner={learner} date={date} />
      <div className={styles.controls}>
        <Segmented<"30" | "45" | "60">
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
          label="Paper size"
          value={paper}
          onChange={(value) => set({ paper: value })}
          options={[
            { value: "letter", label: "Letter", detail: "US, Canada" },
            { value: "a4", label: "A4", detail: "Most countries" },
          ]}
        />
      </div>
      <div className={styles.actions} data-workbook-actions>
        <Button
          variant="primary"
          className={styles.download}
          disabled={!current || downloading}
          aria-busy={downloading || !current}
          onClick={() => void download()}
        >
          {downloading
            ? "Preparing…"
            : current
              ? "Download workbook"
              : "Preparing…"}
        </Button>
        <Button
          variant="secondary"
          className={styles.another}
          disabled={!current || another.isPending}
          onClick={() => {
            setMessage("");
            another.mutate();
          }}
        >
          {another.isPending ? "Making…" : "Another one"}
        </Button>
      </div>
      <p
        className={styles.message}
        role={shown ? "alert" : undefined}
        aria-live="polite"
      >
        {shown}
        {loadError && !message && (
          <button
            type="button"
            className={styles.retry}
            onClick={() => {
              void history.refetch();
              void workbook.refetch();
            }}
          >
            Try again
          </button>
        )}
      </p>
      <Contents workbook={workbook.data} stale={!current} />
    </>
  );
}

function Contents({
  workbook,
  stale,
}: {
  workbook?: WorkbookSummary;
  stale: boolean;
}) {
  return (
    <div
      className={`${styles.contents} ${stale ? styles.stale : ""}`}
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
            minutes · {workbook.problems} problems · answer key included
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
        </>
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
