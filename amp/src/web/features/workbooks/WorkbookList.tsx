import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { AuthSession } from "../../auth";
import { Button, buttonClass } from "../../ui/Button";
import { Toast } from "../../ui/Toast";
import {
  workbookAreaNames,
  type WorkbookSummary,
} from "../../../workbook/contracts";
import { downloadWorkbook } from "./api";
import { choicesLabel, choicesSearch, workbookMessage } from "./model";
import styles from "./Workbooks.module.css";

const areaName = (id: string) => workbookAreaNames[id] ?? id;
const dateParts = (date: string) => {
  const at = new Date(`${date}T12:00:00Z`);
  const part = (options: Intl.DateTimeFormatOptions) =>
    at.toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
  return {
    month: part({ month: "short" }),
    day: part({ day: "numeric" }),
    weekday: part({ weekday: "long" }),
    full: part({
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
};

/** Stored workbooks, newest first: each one's day as a calendar tile, what
 * is in it, and its two actions, results and download. */
export function WorkbookList({
  session,
  learnerId,
  query,
}: {
  session: AuthSession;
  learnerId: string;
  query: UseQueryResult<{ workbooks: WorkbookSummary[]; pdf: boolean }>;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function download(workbook: WorkbookSummary) {
    setMessage("");
    setDownloading(workbook.id);
    try {
      await downloadWorkbook(
        session,
        learnerId,
        workbook,
        workbook.paper,
        query.data?.pdf ?? false,
      );
    } catch (error) {
      console.error("A workbook didn't download", error);
      setMessage(
        workbookMessage(error, "The workbook didn't download. Try again."),
      );
    } finally {
      setDownloading(null);
    }
  }
  // Only a read that failed for good (after quiet retries) or took too
  // long says so; until then the list waits as its skeleton.
  if (query.error && !query.data)
    return (
      <div className={styles.emptyPanel} role="alert">
        <p>
          {workbookMessage(
            query.error,
            "Couldn’t load the workbooks. Try again in a moment.",
          )}
        </p>
        <button
          type="button"
          className={styles.retry}
          aria-busy={query.isFetching || undefined}
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Try again
        </button>
      </div>
    );
  return (
    <>
      {/* A failed download says so over the page, never moving the list. */}
      <Toast message={message} onDismiss={() => setMessage("")} />
      {query.data ? (
        <ul className={styles.list} aria-label="Workbooks">
          {query.data.workbooks.map((workbook) => {
            const date = dateParts(workbook.date);
            const choices = choicesLabel(workbook.choices, areaName);
            // Every result entered: the results are there to read.
            const entered =
              workbook.entered !== undefined &&
              workbook.entered >= workbook.problems;
            return (
              <li key={workbook.id} className={styles.row}>
                <span className={styles.tile} aria-hidden="true">
                  <span className={styles.tileMonth}>{date.month}</span>
                  <span className={styles.tileDay}>{date.day}</span>
                </span>
                <div className={styles.rowText}>
                  <Link
                    to="/learners/$learnerId/workbooks/$date"
                    params={{ learnerId, date: workbook.date }}
                    search={{
                      number: workbook.number,
                      minutes: workbook.minutes,
                      paper: workbook.paper,
                      ...choicesSearch(workbook.choices),
                    }}
                    className={styles.rowTitle}
                    aria-label={`${date.full}, workbook number ${workbook.number}`}
                  >
                    {date.weekday}
                    <span className={styles.rowNumber}>
                      No.&nbsp;{workbook.number}
                    </span>
                  </Link>
                  <span className={styles.rowMeta}>
                    {workbook.minutes} min · {workbook.problems}{" "}
                    {workbook.problems === 1 ? "problem" : "problems"}
                    {choices ? ` · ${choices}` : ""}
                  </span>
                  <span className={styles.rowCode}>{workbook.code}</span>
                </div>
                <div className={styles.rowActions}>
                  <Link
                    to="/learners/$learnerId/workbooks/$workbookId/results"
                    params={{ learnerId, workbookId: workbook.id }}
                    className={buttonClass("quiet", styles.rowButton)}
                    aria-label={`${entered ? "See" : "Enter"} results for workbook ${workbook.code}`}
                  >
                    {entered ? "See results" : "Enter results"}
                  </Link>
                  <Button
                    variant="secondary"
                    className={styles.rowButton}
                    disabled={downloading !== null}
                    aria-busy={downloading === workbook.id}
                    aria-label={`Download workbook ${workbook.code}`}
                    onClick={() => void download(workbook)}
                  >
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                      className={styles.buttonIcon}
                    >
                      <path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12" />
                    </svg>
                    Download
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        // Each row's place, with its shine (ui/loading.css), until the
        // list lands in the same space.
        <div
          className={`${styles.list} ${styles.listSkeleton} amp-skeleton`}
          aria-hidden="true"
        >
          {[0, 1, 2].map((key) => (
            <span key={key} className={styles.row} />
          ))}
        </div>
      )}
    </>
  );
}
