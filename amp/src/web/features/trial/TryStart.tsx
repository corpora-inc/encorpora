import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BirthYearPrompt } from "../../BirthYearPrompt";
import { AppError } from "../../lib/AppError";
import { FrameBrand, frameCard, PageFrame } from "../../ui/PageFrame";
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
      <TrialFailure
        centered
        error={session.error}
        retry={() => session.refetch()}
      />
    );
  if (session.isPending) return <TrialSkeleton centered />;
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
    <PageFrame centered>
      <Toast message={error} onDismiss={() => setError("")} />
      <BirthYearPrompt
        embedded={{
          containerClassName: styles.introContainer,
          className: `${frameCard} ${styles.start} ${styles.intro}`,
          header: <FrameBrand expanded />,
          footer: (
            <p className={styles.introNote}>
              Free practice · No account needed
            </p>
          ),
        }}
        name="the learner"
        title="Your math pathways start here"
        description="Choose your birth year, and we’ll find your starting point—then adapt as you learn."
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
