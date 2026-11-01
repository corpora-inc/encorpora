import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { AuthSession } from "../../auth";
import { Button } from "../../ui/Button";
import type { WorkbookSummary } from "../../../workbook/contracts";
import { downloadWorkbook } from "./api";
import { dateLabel, workbookMessage } from "./model";
import styles from "./Workbooks.module.css";

/** Stored workbooks, newest first, each downloadable again. */
export function WorkbookList({
  session,
  learnerId,
  query,
  showDates = true,
}: {
  session: AuthSession;
  learnerId: string;
  query: UseQueryResult<{ workbooks: WorkbookSummary[] }>;
  showDates?: boolean;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function download(workbook: WorkbookSummary) {
    setMessage("");
    setDownloading(workbook.id);
    try {
      await downloadWorkbook(session, learnerId, workbook, workbook.paper);
    } catch (error) {
      setMessage(
        workbookMessage(error, "The workbook didn't download. Try again."),
      );
    } finally {
      setDownloading(null);
    }
  }
  const error = query.error
    ? workbookMessage(query.error, "Past workbooks didn't load. Try again.")
    : message;
  return (
    <>
      <p
        className={styles.message}
        role={error ? "alert" : undefined}
        aria-live="polite"
      >
        {error}
        {query.error && (
          <button
            type="button"
            className={styles.retry}
            onClick={() => void query.refetch()}
          >
            Try again
          </button>
        )}
      </p>
      {query.data ? (
        <ul className={styles.list} aria-label="Workbooks">
          {query.data.workbooks.map((workbook) => (
            <li key={workbook.id} className={styles.row}>
              <div className={styles.rowText}>
                <Link
                  to="/learners/$learnerId/workbooks/$date"
                  params={{ learnerId, date: workbook.date }}
                  search={{
                    number: workbook.number,
                    minutes: workbook.minutes,
                    paper: workbook.paper,
                  }}
                  className={styles.rowTitle}
                >
                  {showDates
                    ? `${dateLabel(workbook.date, "short")} · No. ${workbook.number}`
                    : `No. ${workbook.number}`}
                </Link>
                <span className={styles.rowMeta}>
                  {workbook.minutes} min · {workbook.problems} problems ·{" "}
                  <span className={styles.code}>{workbook.code}</span>
                </span>
              </div>
              <Button
                variant="secondary"
                className={styles.rowDownload}
                disabled={downloading !== null}
                aria-busy={downloading === workbook.id}
                aria-label={`Download workbook ${workbook.code}`}
                onClick={() => void download(workbook)}
              >
                {downloading === workbook.id ? "Preparing…" : "Download"}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        !query.error && (
          <div className={styles.skeleton} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )
      )}
    </>
  );
}
