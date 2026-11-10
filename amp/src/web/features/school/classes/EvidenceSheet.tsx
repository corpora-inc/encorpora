import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { WorkItem } from "../../../../schools/teacher-contracts";
import type { AuthSession } from "../../../auth";
import { AppError } from "../../../lib/AppError";
import { Button } from "../../../ui/Button";
import { Loading } from "../../../ui/Loading";
import { Meter } from "../../../ui/Meter";
import { Sheet } from "../../../ui/Sheet";
import { FinalField, Suggested } from "./grade-parts";
import { evidenceOptions, type Place } from "./teacher-api";
import {
  buttonClass,
  classUrl,
  shortDay,
  studentUrl,
  WorkList,
} from "./teacher-shared";
import styles from "./Teacher.module.css";

/** "Why a B?" in one click: each component in a sentence with its number, the
 * objectives with their dates, and the actual problems. */
export function EvidenceSheet({
  place,
  session,
  term,
  student,
  returnFocus,
  onClose,
  onError,
  onSaved,
}: {
  place: Place;
  session: AuthSession | null;
  term: string;
  student: string | undefined;
  /** The row this opened from, for when the sheet came from a shared link. */
  returnFocus: string | undefined;
  onClose: () => void;
  onError: (message: string) => void;
  onSaved: (message: string) => void;
}) {
  const evidence = useQuery({
    ...evidenceOptions(session, place, term, student ?? ""),
    enabled: !!session && !!student,
  });
  const data = student ? evidence.data : undefined;
  // A shared link to someone who isn't in this term: back to the term.
  const gone =
    evidence.error instanceof AppError && evidence.error.status === 404;
  useEffect(() => {
    if (gone && student) onClose();
    // `onClose` changes each render; this is about the failure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone, student]);
  return (
    <Sheet
      tall
      open={!!student}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={data?.student.name ?? "Evidence"}
      description={
        data ? `${data.class.name}, ${data.term.name}` : "Reading the evidence"
      }
      returnFocus={() =>
        document.querySelector<HTMLElement>(`[data-student="${returnFocus}"]`)
      }
    >
      {evidence.isError ? (
        <div className={styles.sheetFailed} role="alert">
          <p>
            This evidence didn’t load. Check your connection, then try again.
          </p>
          <Button variant="primary" onClick={() => void evidence.refetch()}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <Loading>Reading the evidence</Loading>
      ) : (
        <div className={styles.evidence}>
          <div className={styles.verdict}>
            <div className={styles.verdictPart}>
              <div className={styles.fieldLabel}>Suggested</div>
              <div className={styles.verdictValue}>
                <Suggested suggestion={data.suggestion} />
              </div>
            </div>
            <div className={styles.verdictFinal}>
              <div className={styles.fieldLabel} aria-hidden="true">
                Final
              </div>
              <FinalField
                session={session}
                place={place}
                student={data.student}
                term={term}
                final={data.final}
                editable={data.canEdit}
                onError={onError}
                onSaved={onSaved}
              />
            </div>
          </div>
          {(data.joined || data.left) && (
            <p className={styles.enrollmentNote}>
              {data.joined
                ? `Counted from ${shortDay(data.joined)}, when ${data.student.first} joined. `
                : ""}
              {data.left ? `Counted up to ${shortDay(data.left)}.` : ""}
            </p>
          )}
          <section>
            <h3>{data.question}</h3>
            <dl className={styles.lines}>
              {data.lines.map((line) => (
                <div key={line.id} className={styles.line}>
                  <dt>{line.label}</dt>
                  <dd className={styles.lineMeter}>
                    {line.score === null ? (
                      <span className={styles.noScore}>—</span>
                    ) : (
                      <Meter value={line.score} label={line.label} />
                    )}
                  </dd>
                  <dd className={styles.lineText}>{line.sentence}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3>Objectives gained</h3>
            {data.objectives.length === 0 ? (
              <p className={styles.quietLine}>
                None yet this term. An objective counts once{" "}
                {data.student.first} gets it right without help, more than once.
              </p>
            ) : (
              <ul className={styles.objectives}>
                {data.objectives.map((objective) => (
                  <li key={objective.skillId} data-strand={objective.strand}>
                    <span className={styles.when}>
                      {shortDay(objective.day)}
                    </span>
                    <span className={styles.strandDot} aria-hidden="true" />
                    <span>{objective.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <EvidenceWork
            key={`${term}:${student}`}
            first={data.work}
            next={data.nextOffset}
            session={session}
            place={place}
            term={term}
            student={data.student.id}
          />
          <div className={styles.sheetLinks}>
            <Link
              to="/$"
              params={{
                _splat: studentUrl(place.org, data.student.id, place.class),
              }}
              className={buttonClass("quiet", "", "start")}
            >
              Open {data.student.first}’s record
            </Link>
            <Link
              to="/$"
              params={{
                _splat: classUrl(place.org, place.class, "report-cards"),
              }}
              search={{ term, student: data.student.id } as never}
              className={buttonClass("quiet")}
            >
              Report card
            </Link>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** The problems, a page at a time: what's on screen stays put as more arrive. */
function EvidenceWork({
  first,
  next,
  session,
  place,
  term,
  student,
}: {
  first: readonly WorkItem[];
  next: number | null;
  session: AuthSession | null;
  place: Place;
  term: string;
  student: string;
}) {
  const client = useQueryClient();
  const [more, setMore] = useState<readonly WorkItem[]>([]);
  const [offset, setOffset] = useState(next);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const shown = [...first, ...more];
  const load = () => {
    if (offset === null) return;
    setBusy(true);
    setFailed(false);
    client
      .fetchQuery(evidenceOptions(session, place, term, student, offset))
      .then((page) => {
        setMore((work) => [...work, ...page.work]);
        setOffset(page.nextOffset);
      })
      .catch((error) => {
        console.error("More problems didn’t load", error);
        setFailed(true);
      })
      .finally(() => setBusy(false));
  };
  return (
    // The problems as the student saw them: their own words, not ours.
    <section data-evidence-problems="">
      <h3>Problems</h3>
      {shown.length === 0 ? (
        <p className={styles.quietLine}>No problems in this term yet.</p>
      ) : (
        <WorkList work={shown} />
      )}
      {offset !== null && (
        <div className={styles.moreWork}>
          <Button
            variant="quiet"
            align="start"
            aria-busy={busy || undefined}
            onClick={load}
          >
            {failed ? "Those didn’t load. Try again" : "Show more problems"}
          </Button>
        </div>
      )}
    </section>
  );
}
