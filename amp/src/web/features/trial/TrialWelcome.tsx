import { useState } from "react";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
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

export function TrialWelcome({ onContinue }: { onContinue: () => void }) {
  return (
    <Dialog
      open
      title="Watch AMP adapt"
      onOpenChange={(open) => {
        if (!open) onContinue();
      }}
    >
      <p>
        Try a few problems. Right answers make them harder; mistakes make them
        easier.
      </p>
      <p>
        <strong>Skip</strong> shows the answer without changing your level.
      </p>
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
