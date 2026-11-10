import { useEffect, useRef, useState } from "react";
import { AppError } from "../../lib/AppError";
import { defaultPaper } from "../workbooks/model";
import { AllowancePause, type PauseViewer } from "../continue/AllowancePause";
import {
  allowanceEnded,
  downloadPublication,
  type PublicationKind,
} from "./publications";
import styles from "./LessonPrint.module.css";

/** Where a print control sits: the reader's top bar, or the download list
 * after the lesson. A failure shows beside the control that caused it. */
type Place = "bar" | "list";
type Key = `${Place}:${PublicationKind}`;

/**
 * Printing a lesson hands over its typeset PDF, never a browser print of the
 * page. One state for the reader's controls: which downloads are running,
 * and the latest failure, shown next to its control. A 402 for spent free
 * problems is not a failure: the reader shows the allowance pause instead.
 */
export function useLessonPrint({
  learnerId,
  lessonId,
  token,
  keep,
  onAllowanceEnded,
}: {
  learnerId: string;
  lessonId: string;
  token: string;
  /** False once the person signed out: a late file is not saved. */
  keep: () => boolean;
  onAllowanceEnded: () => void;
}) {
  const [pending, setPending] = useState<ReadonlySet<Key>>(new Set());
  const [failure, setFailure] = useState<{
    key: Key;
    message: string;
  } | null>(null);
  // Another lesson or learner starts clean; a late answer for the last one
  // changes nothing on this one.
  const showing = useRef(0);
  useEffect(() => {
    showing.current++;
    setPending(new Set());
    setFailure(null);
  }, [learnerId, lessonId]);
  async function print(place: Place, kind: PublicationKind) {
    const key: Key = `${place}:${kind}`;
    if (pending.has(key)) return;
    const shown = showing.current;
    setPending((now) => new Set(now).add(key));
    setFailure((now) => (now?.key === key ? null : now));
    try {
      await downloadPublication({
        token,
        learnerId,
        lessonId,
        kind,
        paper: defaultPaper(),
        keep,
      });
    } catch (error) {
      if (shown !== showing.current) return;
      if (allowanceEnded(error)) {
        setFailure(null);
        onAllowanceEnded();
        return;
      }
      setFailure({
        key,
        message:
          error instanceof AppError
            ? error.message
            : "The PDF didn't download. Try again.",
      });
    } finally {
      if (shown === showing.current)
        setPending((now) => {
          const next = new Set(now);
          next.delete(key);
          return next;
        });
    }
  }
  return {
    busy: (place: Place, kind: PublicationKind) =>
      pending.has(`${place}:${kind}`),
    failure: (place: Place, kind?: PublicationKind) =>
      failure &&
      failure.key.startsWith(`${place}:`) &&
      (!kind || failure.key === `${place}:${kind}`)
        ? failure.message
        : "",
    dismiss: () => setFailure(null),
    print,
  };
}
export type LessonPrint = ReturnType<typeof useLessonPrint>;

/** "Print lesson" in the reader's top bar: downloads the lesson's PDF. A
 * failure floats under it, over the page, so nothing below moves. */
export function PrintLessonButton({ print }: { print: LessonPrint }) {
  const message = print.failure("bar", "lesson");
  return (
    <span className={styles.anchor}>
      <button
        className="text-button"
        data-print-lesson
        aria-busy={print.busy("bar", "lesson")}
        aria-describedby={message ? "print-lesson-failure" : undefined}
        onClick={() => void print.print("bar", "lesson")}
      >
        Print lesson
      </button>
      {message && (
        <span className={styles.callout} role="alert" id="print-lesson-failure">
          <span>{message}</span>
          <button
            className={styles.dismiss}
            aria-label="Dismiss message"
            onClick={print.dismiss}
          >
            ×
          </button>
        </span>
      )}
    </span>
  );
}

const kinds: { kind: PublicationKind; label: string }[] = [
  { kind: "lesson", label: "Download lesson PDF" },
  { kind: "workbook", label: "Download workbook PDF" },
  { kind: "solutions", label: "Download solutions PDF" },
];

/** The lesson's PDFs after the lesson. With the free problems spent, the
 * pause takes their place: no download that would be refused. */
export function LessonDownloads({
  print,
  paused,
  viewer,
  learner,
}: {
  print: LessonPrint;
  paused: boolean;
  viewer: PauseViewer;
  learner: { id: string; name: string };
}) {
  const message = print.failure("list");
  return (
    <section
      className="reader-downloads"
      aria-label="Download and print"
      data-lesson-downloads
    >
      <h3>Download &amp; print</h3>
      {paused ? (
        <AllowancePause
          kind="problems"
          compact
          viewer={viewer}
          learner={learner}
        />
      ) : (
        <>
          <div className="downloads">
            {kinds.map(({ kind, label }) => (
              <button
                className="secondary"
                key={kind}
                data-publication={kind}
                aria-busy={print.busy("list", kind)}
                onClick={() => void print.print("list", kind)}
              >
                {label}
              </button>
            ))}
          </div>
          {message && (
            <p className={styles.failure} role="alert">
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
