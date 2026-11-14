import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { LoadingScreen } from "../../ui/LoadingScreen";
import { PrintButton } from "../../ui/PrintButton";
import { downloadPdf, paperFormat } from "../../lib/pdf-download";
import { useCloseClick } from "../../nav/links";
import { currentSession } from "../school/api";
import "../school/SchoolFrame.module.css";
import { RecordWeeks, TimeDetail } from "../school/classes/ProgressRecord";
import teacher from "../school/classes/Teacher.module.css";
import { ownPracticeOptions } from "./api";
import styles from "./Own.module.css";

/**
 * `/me/time`: the adult's own time, as a teacher reads a student's. The
 * last six weeks by day, where the time went, and every week of the last
 * twelve, with the printed progress report beside the title. Opened from
 * `/me`'s "This week"; its way back returns there.
 */
export function OwnTimeScreen() {
  const session = currentSession();
  const record = useQuery(ownPracticeOptions(session));
  const back = useCloseClick("/me");
  const data = record.data;
  if (record.isPending)
    return (
      <main className={styles.page} data-dense>
        <LoadingScreen overlay />
      </main>
    );
  return (
    <main className={styles.page} data-dense>
      <div className={styles.stack} data-own-page data-own-time="">
        <header className={styles.head}>
          <Link to="/me" className={styles.backLink} onClick={back}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
            Where you are
          </Link>
          <div className={styles.titleRow}>
            <h1>Time</h1>
            {data && (
              <div className={styles.titleTools}>
                <PrintButton
                  variant="quiet"
                  download={() =>
                    downloadPdf({
                      path: `/me/practice/report.pdf?format=${paperFormat()}`,
                      token: session.token,
                      name: "amp-progress-report.pdf",
                    })
                  }
                >
                  Progress report
                </PrintButton>
              </div>
            )}
          </div>
        </header>
        {!data ? (
          <EmptyState
            title="Your time didn’t load"
            action={
              <Button variant="primary" onClick={() => void record.refetch()}>
                Try again
              </Button>
            }
          >
            Check your connection, then try again.
          </EmptyState>
        ) : (
          <div className={teacher.evidence}>
            <TimeDetail time={data.time} who="Practice" />
            {data.record.weeks.some((week) => week.minutes > 0) && (
              <section>
                <h3>By week</h3>
                <RecordWeeks record={data.record} />
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
