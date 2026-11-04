import { useState } from "react";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Toast } from "../../ui/Toast";
import { nativeRuntime } from "../../native-runtime";
import type { TrialSession, TrialWorkbooks } from "./api";
import { useAssessmentWorkbook } from "./assessment-workbooks";
import styles from "./Trial.module.css";

import {
  dismissTrialIntroduction,
  trialIntroductionPending,
} from "./introduction";

/** The introduction belongs before practice, never inside the workspace. */
export function useTrialWelcome(learnerId: string) {
  const [pending, setPending] = useState(() =>
    trialIntroductionPending(learnerId),
  );
  return {
    pending,
    dismiss() {
      dismissTrialIntroduction(learnerId);
      setPending(false);
    },
  };
}

export function TrialWelcome({
  onContinue,
  session,
  workbooks,
}: {
  onContinue: () => void;
  session: TrialSession;
  workbooks?: TrialWorkbooks;
}) {
  return (
    <Dialog
      open
      title="Watch AMP adapt"
      onOpenChange={(open) => {
        if (!open) onContinue();
      }}
    >
      <p>
        Start with a few problems. AMP uses the learner’s age as a starting
        point, then adjusts the levels and problems as they answer.
      </p>
      <p>
        <strong>Skip</strong> shows the answer without changing your level.
      </p>
      {!nativeRuntime &&
        workbooks &&
        (workbooks.available > 0 || workbooks.items.length > 0) && (
          <FirstWorkbook session={session} workbooks={workbooks} />
        )}
      <Button
        variant="primary"
        className={styles.welcomeStart}
        onClick={onContinue}
      >
        Start practicing
      </Button>
    </Dialog>
  );
}

/** Keep the introduction open after downloading, with the same workbook on retries. */
function FirstWorkbook({
  session,
  workbooks,
}: {
  session: TrialSession;
  workbooks: TrialWorkbooks;
}) {
  const { busy, message, clear, print } = useAssessmentWorkbook(session);
  const [downloaded, setDownloaded] = useState<Pick<
    TrialWorkbooks["items"][number],
    "id" | "date" | "number"
  > | null>(null);
  return (
    <>
      <p>
        Prefer paper? Download an age-based workbook and print it if you like.
        Future workbooks adapt as the learner answers more problems.
      </p>
      <Button
        variant="secondary"
        className={styles.welcomeStart}
        disabled={!!busy}
        aria-busy={!!busy}
        onClick={async () => {
          const item = await print("first", downloaded ?? workbooks.items[0]);
          if (item) setDownloaded(item);
        }}
      >
        {busy
          ? "Preparing…"
          : downloaded
            ? "Download workbook again"
            : "Download free workbook"}
      </Button>
      <Toast message={message} onDismiss={clear} />
    </>
  );
}
