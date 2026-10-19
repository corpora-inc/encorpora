import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BirthYearPrompt } from "../../BirthYearPrompt";
import { AppError } from "../../lib/AppError";
import { frameCard, PageFrame } from "../../ui/PageFrame";
import { Toast } from "../../ui/Toast";
import { startTrial, trialSessionOptions } from "./api";
import { track, trackSessionStart } from "./analytics";
import { TrialFailure, TrialSkeleton } from "./TrialFrame";
import styles from "./Trial.module.css";

/** `/try`: a birth year starts anonymous free practice. A trial already
 * started on this device resumes where it left off. */
export function TryStart() {
  const session = useQuery(trialSessionOptions);
  if (session.error)
    return (
      <TrialFailure error={session.error} retry={() => session.refetch()} />
    );
  if (session.isPending) return <TrialSkeleton />;
  if (session.data) return <Navigate to="/try/practice" replace />;
  return <BirthYear />;
}

function BirthYear() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    trackSessionStart();
    track("try_click");
  }, []);
  return (
    <PageFrame>
      <Toast message={error} onDismiss={() => setError("")} />
      <BirthYearPrompt
        embedded={{
          className: `${frameCard} ${styles.start}`,
          header: (
            <p className={styles.eyebrow}>100 free problems · No account</p>
          ),
        }}
        name="the learner"
        title="What year was the learner born?"
        birthYear={null}
        busy={busy}
        saveBirthYear={(year) => {
          setBusy(true);
          setError("");
          void startTrial(year)
            .then(() => navigate({ to: "/try/practice", replace: true }))
            .catch((failure: unknown) => {
              setBusy(false);
              setError(
                failure instanceof AppError
                  ? failure.message
                  : "Free practice could not start. Try again.",
              );
            });
        }}
      />
    </PageFrame>
  );
}
