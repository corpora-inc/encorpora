import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { AuthSession } from "../../auth";
import { sessionOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { workbookByCode, workbookHistoryOptions } from "./api";
import { localDate, workbookMessage } from "./model";
import { WorkbookFrame, type WorkbookLearner } from "./WorkbookFrame";
import { WorkbookList } from "./WorkbookList";
import styles from "./Workbooks.module.css";

export function WorkbookHistoryScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const { learnerId } = useParams({ strict: false }) as { learnerId: string };
  if (!session) return <Navigate to="/sign-in" replace />;
  return (
    <WorkbookFrame session={session} learnerId={learnerId}>
      {(learner) => <History session={session} learner={learner} />}
    </WorkbookFrame>
  );
}

function History({
  session,
  learner,
}: {
  session: AuthSession;
  learner: WorkbookLearner;
}) {
  const history = useQuery(workbookHistoryOptions(session, learner.id));
  return (
    <>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{learner.name} · Daily workbooks</p>
      </div>
      <h1 className={styles.title}>Workbooks</h1>
      <p className={styles.lede}>
        A new workbook every day, chosen from {learner.name}'s practice: a
        warm-up, today's idea, practice, review and a challenge, with an answer
        key.
      </p>
      <Link
        to="/learners/$learnerId/workbooks/$date"
        params={{ learnerId: learner.id, date: localDate() }}
        className={buttonClass("primary", styles.today)}
      >
        Today's workbook
      </Link>
      <CodeEntry session={session} learnerId={learner.id} />
      {history.data && !history.data.workbooks.length ? (
        <p className={styles.empty}>Workbooks you make appear here.</p>
      ) : (
        <WorkbookList
          session={session}
          learnerId={learner.id}
          query={history}
        />
      )}
    </>
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
        label="Enter results with the workbook code"
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
        variant="secondary"
        type="submit"
        className={styles.codeButton}
        disabled={busy || !clean}
        aria-busy={busy}
      >
        {busy ? "Opening…" : "Open"}
      </Button>
    </form>
  );
}
