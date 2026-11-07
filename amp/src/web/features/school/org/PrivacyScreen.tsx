import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AGREEMENT_VERSION,
  agreementPromises,
  agreementTitle,
} from "../../../../schools/agreement";
import { formatDay } from "../../../../schools/calendar";
import type { StudentResource } from "../../../../schools/contracts";
import type { PrivacyResponse } from "../../../../schools/org-contracts";
import { AppError } from "../../../lib/AppError";
import { useLoggedError } from "../../../feedback";
import { Button, buttonClass } from "../../../ui/Button";
import { CheckboxControl } from "../../../ui/Checkbox";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { SearchField } from "../../../ui/SearchField";
import { Sheet } from "../../../ui/Sheet";
import { TextField } from "../../../ui/TextField";
import {
  currentSession,
  fetchStudents,
  orgOptions,
  refreshSchool,
  school,
} from "../api";
import { displayName } from "../ClassesScreen";
import { number } from "../classes/teacher-shared";
import { OrgFrame } from "../OrgFrame";
import { FormNote, PageHead } from "../parts";
import { orgPath } from "../paths";
import { AgreementText } from "../SetupScreen";
import {
  downloadSchoolExport,
  eraseNextBatch,
  privacyOptions,
} from "./org-api";
import styles from "./Org.module.css";

const COLLECTED = [
  "Each student’s name, grade and class. An email address or school ID only if you add one.",
  "How they sign in: a card, class code and pictures, or their school account.",
  "The problems they’re given, their answers, and the time they spend.",
  "What AMP works out from that: skills shown, levels and suggested grades.",
];
const NEVER_COLLECTED =
  "Never a home address, a phone number or a government ID, and no advertising trackers of any kind.";

function Agreement({
  orgId,
  orgName,
  data,
  canAccept,
}: {
  orgId: string;
  orgName: string;
  data: PrivacyResponse;
  canAccept: boolean;
}) {
  const session = currentSession();
  const [reading, setReading] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; title?: string }>({});
  const [error, setError] = useState("");
  useLoggedError(error);
  const accepted = data.agreement;
  const accept = async () => {
    const missing = {
      ...(name.trim() ? {} : { name: "Enter your name." }),
      ...(title.trim() ? {} : { title: "Enter your title." }),
    };
    setErrors(missing);
    if (Object.keys(missing).length) return;
    setBusy(true);
    setError("");
    try {
      await school.acceptAgreement(session, orgId, {
        version: AGREEMENT_VERSION,
        signerName: name.trim(),
        signerTitle: title.trim(),
      });
      await refreshSchool(session);
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "That didn’t save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-labelledby="privacy-agreement"
      className={styles.privacySection}
    >
      <h2 id="privacy-agreement" className={styles.sectionTitle}>
        Data agreement
      </h2>
      {accepted ? (
        <p className={styles.signed}>
          Accepted by {accepted.signerName}, {accepted.signerTitle}
          {accepted.signedBy ? `, for ${accepted.signedBy},` : ""} on{" "}
          {formatDay(accepted.acceptedAt.slice(0, 10))}.
        </p>
      ) : (
        <p className={styles.signed}>
          Not accepted yet. Students can’t practice until someone authorized at{" "}
          {orgName} accepts it.
        </p>
      )}
      <ul className={styles.promises}>
        {agreementPromises.map((promise) => (
          <li key={promise.title}>
            <strong>{promise.title}</strong>
            <span>{promise.detail}</span>
          </li>
        ))}
      </ul>
      <Button variant="secondary" onClick={() => setReading(true)}>
        Read the full agreement
      </Button>
      {!accepted && canAccept && (
        <form
          className={styles.acceptForm}
          onSubmit={(event) => {
            event.preventDefault();
            void accept();
          }}
        >
          <TextField
            label="Your name"
            autoComplete="name"
            maxLength={100}
            value={name}
            error={errors.name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label="Your title"
            autoComplete="organization-title"
            placeholder="Head of School"
            maxLength={100}
            value={title}
            error={errors.title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <FormNote error={error} />
          <Button
            variant="primary"
            type="submit"
            aria-busy={busy}
            disabled={busy}
          >
            Accept the agreement
          </Button>
        </form>
      )}
      <Sheet
        open={reading}
        onOpenChange={setReading}
        title={agreementTitle}
        description={`For ${orgName}`}
      >
        <AgreementText />
      </Sheet>
    </section>
  );
}

function ExportSection({ orgId, orgName }: { orgId: string; orgName: string }) {
  const session = currentSession();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useLoggedError(error);
  return (
    <section aria-labelledby="privacy-export" className={styles.privacySection}>
      <h2 id="privacy-export" className={styles.sectionTitle}>
        Export everything
      </h2>
      <p>
        All of {orgName}’s student data as CSV files in one ZIP: the roster,
        enrollments, grades, skills by day, time by day and levels by day. The
        activity log records who exported it.
      </p>
      <FormNote error={error} status={status} />
      <Button
        variant="secondary"
        aria-busy={busy}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          setStatus("");
          void downloadSchoolExport(session, orgId)
            .then((name) => setStatus(`Downloaded ${name}.`))
            .catch((failure) =>
              setError(
                failure instanceof AppError
                  ? failure.message
                  : "The export didn’t download. Try again.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        Export all student data
      </Button>
    </section>
  );
}

type Progress = {
  done: number;
  total: number;
  state: "running" | "failed" | "finished";
};
function ProgressLine({
  progress,
  onResume,
}: {
  progress: Progress;
  onResume: () => void;
}) {
  const share = progress.total
    ? Math.min(100, (progress.done / progress.total) * 100)
    : 100;
  return (
    <div className={styles.progress} role="status" aria-live="polite">
      <p>
        {progress.state === "finished"
          ? `Deleted ${number(progress.done)} ${progress.done === 1 ? "student" : "students"}.`
          : progress.state === "failed"
            ? `Stopped after ${number(progress.done)} of ${number(progress.total)}. Everyone else is untouched, and it picks up where it left off.`
            : `Deleting ${number(progress.done)} of ${number(progress.total)} students.`}
      </p>
      <span className={styles.seatTrack} aria-hidden="true">
        <span className={styles.seatFill} style={{ width: `${share}%` }} />
      </span>
      {progress.state === "failed" && (
        <Button variant="secondary" onClick={onResume}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Finding a few students to delete, by name. Each goes through the same removal
 * the Students screen uses, one at a time from here. */
function DeleteSome({ orgId }: { orgId: string }) {
  const session = currentSession();
  const [typed, setTyped] = useState("");
  const [results, setResults] = useState<StudentResource[]>([]);
  const [chosen, setChosen] = useState<StudentResource[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const queue = useRef<StudentResource[]>([]);
  useEffect(() => {
    const needle = typed.trim();
    if (!needle) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchStudents(session, orgId, needle, 0, controller.signal)
        .then((page) => setResults(page.students.slice(0, 8)))
        .catch((failure) => {
          if ((failure as Error).name !== "AbortError")
            console.error("Student search failed", failure);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typed, orgId, session]);
  const run = async () => {
    setConfirming(false);
    const total = queue.current.length + (progress?.done ?? 0);
    let done = progress?.done ?? 0;
    setProgress({ done, total, state: "running" });
    try {
      while (queue.current.length) {
        await school.removeStudent(session, orgId, queue.current[0]!.id);
        queue.current = queue.current.slice(1);
        done++;
        setProgress({ done, total, state: "running" });
      }
      setProgress({ done, total, state: "finished" });
      setChosen([]);
      setResults([]);
      setTyped("");
      await refreshSchool(session);
    } catch (failure) {
      console.error("A student wasn’t removed", failure);
      setProgress({ done, total, state: "failed" });
      await refreshSchool(session);
    }
  };
  const shown = [
    ...chosen,
    ...results.filter((row) => !chosen.some((entry) => entry.id === row.id)),
  ];
  return (
    <div className={styles.deleteBlock}>
      <h3>One student, or a few</h3>
      <p>
        Removes their learning data and frees their seat. Final grades stay with
        your records.
      </p>
      <SearchField
        label="Find a student to delete"
        placeholder="Name or student ID"
        value={typed}
        onChange={setTyped}
      />
      {shown.length > 0 && (
        <ul className={styles.pickList}>
          {shown.map((row) => (
            <li key={row.id}>
              <label className={styles.classRow}>
                <CheckboxControl
                  checked={chosen.some((entry) => entry.id === row.id)}
                  onChange={(event) =>
                    setChosen((prior) =>
                      event.target.checked
                        ? [...prior, row]
                        : prior.filter((entry) => entry.id !== row.id),
                    )
                  }
                />
                <span className={styles.classWords}>
                  <strong>{displayName(row)}</strong>
                  {row.identifier && <span>ID {row.identifier}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {progress && (
        <ProgressLine progress={progress} onResume={() => void run()} />
      )}
      {chosen.length > 0 && progress?.state !== "running" && (
        <div className={styles.dangerRow}>
          {confirming ? (
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Keep them
              </Button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  queue.current = chosen;
                  setProgress(null);
                  void run();
                }}
              >
                Delete for good
              </button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              Delete {chosen.length}{" "}
              {chosen.length === 1 ? "student" : "students"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Every student's data at this school, gone, a few at a time from this browser,
 * so a dropped connection only pauses it. It needs the school's name typed. */
function DeleteAll({
  orgId,
  orgName,
  data,
}: {
  orgId: string;
  orgName: string;
  data: PrivacyResponse;
}) {
  const session = currentSession();
  const [typed, setTyped] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  useLoggedError(error);
  const matches = typed.trim().toLowerCase() === orgName.trim().toLowerCase();
  const run = async () => {
    setError("");
    let done = progress?.done ?? 0;
    let total = progress?.total ?? data.erasing?.remaining ?? data.students;
    setProgress({ done, total, state: "running" });
    try {
      for (;;) {
        const batch = await eraseNextBatch(session, orgId, typed.trim());
        done += batch.removed;
        total = done + batch.remaining;
        setProgress({ done, total, state: "running" });
        if (batch.remaining === 0 || batch.removed === 0) break;
      }
      setProgress({ done, total, state: "finished" });
      await refreshSchool(session);
    } catch (failure) {
      if (failure instanceof AppError && failure.code === "confirm_mismatch")
        setError("Type the school’s name exactly as it’s shown.");
      else console.error("Deleting student data paused", failure);
      setProgress({ done, total, state: "failed" });
    }
  };
  if (progress)
    return (
      <div className={styles.deleteBlock}>
        <h3>All of {orgName}’s student data</h3>
        <ProgressLine progress={progress} onResume={() => void run()} />
        <FormNote error={error} />
      </div>
    );
  return (
    <div className={styles.deleteBlock}>
      <h3>All of {orgName}’s student data</h3>
      <p>
        Permanently deletes every student’s learning data, final grades and
        school ID here. Students who moved to another school in your district
        keep theirs. It can’t be undone, so export first if you may need it.
      </p>
      {data.erasing && (
        <p className={styles.paused}>
          A deletion started on {formatDay(data.erasing.startedAt.slice(0, 10))}{" "}
          stopped with {number(data.erasing.remaining)} left. Type the name to
          finish it.
        </p>
      )}
      <TextField
        label={`Type ${orgName} to confirm`}
        value={typed}
        autoComplete="off"
        maxLength={200}
        onChange={(event) => setTyped(event.target.value)}
      />
      <button
        type="button"
        className={styles.danger}
        disabled={!matches}
        onClick={() => void run()}
      >
        {data.erasing ? "Finish deleting" : "Delete all student data"}
      </button>
    </div>
  );
}

/** The agreement and who signed it, what's collected in plain words, and the two
 * rights behind them: taking the data out, and deleting it. */
export function PrivacyScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const privacy = useQuery(privacyOptions(session, orgId));
  const data = privacy.data;
  const can = org?.can ?? [];
  const isSchool = org?.kind === "school";
  return (
    <OrgFrame orgId={orgId} nav="privacy" title="Privacy">
      <PageHead
        title="Privacy"
        detail={
          data
            ? `${number(data.students)} ${data.students === 1 ? "student" : "students"} here today`
            : " "
        }
      />
      {privacy.isPending ? (
        <Loading />
      ) : !data || !org ? (
        <EmptyState
          title="Privacy details didn’t load"
          action={
            <Button variant="secondary" onClick={() => void privacy.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className={styles.privacy}>
          <div className={styles.privacyColumn}>
            <Agreement
              orgId={orgId}
              orgName={org.name}
              data={data}
              canAccept={can.includes("setup.write")}
            />
            <section
              aria-labelledby="privacy-collected"
              className={styles.privacySection}
            >
              <h2 id="privacy-collected" className={styles.sectionTitle}>
                What AMP collects
              </h2>
              <ul className={styles.collected}>
                {COLLECTED.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p>{NEVER_COLLECTED}</p>
            </section>
          </div>
          {(can.includes("privacy.export") ||
            can.includes("privacy.delete")) && (
            <div className={styles.privacyColumn}>
              {can.includes("privacy.export") && (
                <ExportSection orgId={orgId} orgName={org.name} />
              )}
              {can.includes("privacy.delete") && (
                <section
                  aria-labelledby="privacy-delete"
                  className={styles.privacySection}
                >
                  <h2 id="privacy-delete" className={styles.sectionTitle}>
                    Delete
                  </h2>
                  <DeleteSome orgId={orgId} />
                  {isSchool ? (
                    <DeleteAll orgId={orgId} orgName={org.name} data={data} />
                  ) : (
                    <div className={styles.deleteBlock}>
                      <h3>A whole school</h3>
                      <p>Open a school to delete all of its student data.</p>
                      <ul className={styles.schoolLinks}>
                        {data.schools.map((entry) => (
                          <li key={entry.id}>
                            <Link
                              to="/$"
                              params={{
                                _splat: orgPath(entry.id, "privacy"),
                              }}
                              className={buttonClass("quiet", "", "start")}
                            >
                              {entry.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </OrgFrame>
  );
}
