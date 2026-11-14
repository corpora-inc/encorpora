import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { AuthSession } from "../../auth";
import { sessionOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Sheet } from "../../ui/Sheet";
import { TextField } from "../../ui/TextField";
import { awaitingResults, workbookByCode, workbookHistoryOptions } from "./api";
import { canMakeWorkbook, localDate, workbookMessage } from "./model";
import { AllowancePause } from "../continue/AllowancePause";
import { WorkbookFrame, whose, type WorkbookLearner } from "./WorkbookFrame";
import { WorkbookList } from "./WorkbookList";
import styles from "./Workbooks.module.css";

export function WorkbookHistoryScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const { learnerId } = useParams({ strict: false }) as { learnerId: string };
  if (!session) return <Navigate to="/sign-in" replace />;
  return (
    <WorkbookFrame session={session} learnerId={learnerId}>
      {(learner) => <WorkbookHistory session={session} learner={learner} />}
    </WorkbookFrame>
  );
}

/** A learner's workbooks: today's as the one primary action, the ones made
 * before as a list, and results by code as a quiet second action while a
 * workbook still waits for them. With none made yet, the list's place says
 * so and holds the one way to make the first. On the adult's own practice
 * it speaks to them and never names them. */
export function WorkbookHistory({
  session,
  learner,
}: {
  session: AuthSession;
  learner: WorkbookLearner;
}) {
  const history = useQuery(workbookHistoryOptions(session, learner.id));
  const [entering, setEntering] = useState(false);
  const who = whose(learner);
  const canMake = canMakeWorkbook(learner);
  const workbooks = history.data?.workbooks;
  const none = workbooks?.length === 0;
  const today = (label: string) => (
    <Link
      to="/learners/$learnerId/workbooks/$date"
      params={{ learnerId: learner.id, date: localDate() }}
      className={buttonClass("primary", styles.today)}
    >
      <PlusIcon />
      {label}
    </Link>
  );
  return (
    <>
      <header className={styles.listHead}>
        <div className={styles.listTitle}>
          {who.label && <p className={styles.learnerLabel}>{who.label}</p>}
          <h1 className={styles.title}>
            {who.own ? "Your workbooks" : "Workbooks"}
          </h1>
          <p className={styles.lede}>
            {who.own
              ? "Printable practice chosen from your progress, with an answer key."
              : `Printable practice chosen from ${learner.name}’s progress, with an answer key.`}
          </p>
        </div>
        {/* The actions land with the list: the first workbook is made from
            the empty list's own button, and results by code are offered only
            while a workbook waits for them. */}
        {!none && (
          <div className={styles.listActions}>
            {workbooks && awaitingResults(workbooks) && (
              <Button
                variant="secondary"
                onClick={() => setEntering(true)}
                data-results-code
              >
                Enter results with a code
              </Button>
            )}
            {canMake &&
              (workbooks || history.error ? (
                today("Today’s workbook")
              ) : (
                <span
                  className={`${styles.actionSkeleton} amp-skeleton`}
                  aria-hidden="true"
                >
                  <span />
                </span>
              ))}
          </div>
        )}
      </header>
      {!canMake && (
        <AllowancePause
          kind="workbooks"
          compact
          viewer={learner.pauseViewer}
          learner={learner}
        />
      )}
      {none ? (
        <div className={styles.empty}>
          <EmptyState
            title="No workbooks yet"
            action={canMake ? today("Make a workbook") : undefined}
          >
            {who.own
              ? "Each one you make is kept here, ready to print again."
              : `Each one you make for ${learner.name} is kept here, ready to print again.`}
          </EmptyState>
        </div>
      ) : (
        <section className={styles.past} aria-labelledby="past-workbooks">
          <h2 id="past-workbooks" className={styles.sectionTitle}>
            Past workbooks
          </h2>
          <WorkbookList
            session={session}
            learnerId={learner.id}
            query={history}
          />
        </section>
      )}
      <Sheet
        open={entering}
        onOpenChange={setEntering}
        title="Enter results"
        description="Type the code printed on the workbook’s pages."
      >
        <CodeEntry session={session} learnerId={learner.id} />
      </Sheet>
    </>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.buttonIcon}>
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  );
}

/** Opens a printed workbook's results by the code on its pages. */
function CodeEntry({
  session,
  learnerId,
}: {
  session: AuthSession;
  learnerId: string;
}) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  async function open(event: FormEvent) {
    event.preventDefault();
    if (clean.length !== 8) {
      setError("Enter the 8-character code printed on the workbook.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const found = await workbookByCode(session, learnerId, clean);
      if (!found) {
        setError("No workbook has that code. Check it against the printout.");
        return;
      }
      await navigate({
        to: "/learners/$learnerId/workbooks/$workbookId/results",
        params: { learnerId, workbookId: found.id },
      });
    } catch (failure) {
      console.error("A workbook code wasn't checked", failure);
      setError(
        workbookMessage(failure, "That code couldn't be checked. Try again."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={styles.codeForm} onSubmit={(event) => void open(event)}>
      <TextField
        label="Workbook code"
        placeholder="ABCD-EFGH"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={12}
        value={code}
        error={error}
        onChange={(event) => {
          setCode(event.target.value);
          setError("");
        }}
      />
      <Button
        variant="primary"
        type="submit"
        className={styles.codeButton}
        disabled={busy || !clean}
        aria-busy={busy}
      >
        Open results
      </Button>
    </form>
  );
}
