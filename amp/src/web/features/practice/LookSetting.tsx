import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Look } from "../../../learning/look";
import { AppError } from "../../lib/AppError";
import { Segmented } from "../../ui/Segmented";
import { Toast } from "../../ui/Toast";
import {
  practiceSettingsOptions,
  usePracticeAdjustment,
  type PracticeScope,
} from "./practice-settings";
import styles from "./LookSetting.module.css";

const OPTIONS: { value: Look; label: string }[] = [
  { value: "calm", label: "Calm" },
  { value: "bold", label: "Colorful" },
];

/**
 * How practice looks for one learner: Calm or Colorful. Shown the same in a
 * child's settings and in the learner's own drawer. Locked by a class, it
 * is disabled and says so in the label row, which is always there, so
 * nothing moves when it loads or changes.
 */
export function LookSetting({
  scope,
  who = "your class",
  flush = false,
}: {
  /** No side inset, for a list whose rows already have none. */
  flush?: boolean;
  scope: PracticeScope;
  /** Whose choice a lock is, in the sentence "Set by …". */
  who?: string;
}) {
  const state = useQuery(practiceSettingsOptions(scope));
  const adjust = usePracticeAdjustment(scope);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (state.isError)
      console.error("The look setting didn’t load", state.error);
  }, [state.isError, state.error]);
  const data = state.data;
  const locked = data?.lookLocked === true;
  const choose = async (look: Look) => {
    setBusy(true);
    try {
      await adjust.change({ kind: "look", look });
    } catch (failure) {
      console.error("The look didn’t save", failure);
      setError(
        failure instanceof AppError && failure.message
          ? failure.message
          : "That change didn’t save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className={`${styles.look} ${flush ? styles.flush : ""}`}
      data-look-setting=""
    >
      <div className={styles.head}>
        <span>Look</span>
        <span className={styles.why}>{locked ? `Set by ${who}` : ""}</span>
      </div>
      <Segmented
        label="Look"
        options={OPTIONS}
        value={data?.effectiveLook ?? null}
        compact
        dense
        disabled={!data || locked || busy}
        onChange={(next) => {
          if (next !== data?.effectiveLook) void choose(next);
        }}
      />
      <Toast message={error} onDismiss={() => setError("")} />
    </div>
  );
}
