import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "../../ui/Dialog";
import { Button } from "../../ui/Button";
import {
  practiceSettingsOptions,
  type PracticeIntent,
  type PracticeScope,
} from "./practice-settings";
import styles from "./PracticeControls.module.css";

/** Lives only in the navigation sheet; the open problem gains no extra copy. */
export function PracticeControls({
  scope,
  problemId,
  apply,
  busy,
  close,
}: {
  scope: PracticeScope;
  problemId?: string;
  apply: (change: PracticeIntent) => Promise<void>;
  busy: boolean;
  close?: () => void;
}) {
  const state = useQuery(practiceSettingsOptions(scope));
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(change: PracticeIntent) {
    setError("");
    setSaving(true);
    try {
      await apply(change);
      if (change.kind !== "together") {
        setConfirm(false);
        close?.();
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The change could not be saved. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  const disabled = busy || saving || !state.data;
  return (
    <fieldset className={styles.controls} disabled={busy || saving}>
      <legend>Practice</legend>
      {state.isError ? (
        <p role="alert">
          Practice settings could not load.{" "}
          <button type="button" onClick={() => void state.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <label>
          <span>Working together</span>
          <input
            disabled={disabled}
            type="checkbox"
            checked={state.data?.workingTogether ?? false}
            onChange={(e) =>
              void save({
                kind: "together",
                enabled: e.target.checked,
                ...(problemId ? { problemId } : {}),
              })
            }
          />
        </label>
      )}
      {state.data?.workingTogether && (
        <p className={styles.note}>
          Helped answers count as practice, not independent assessment.
        </p>
      )}
      {state.data?.focusSkillId && (
        <Button
          disabled={disabled}
          variant="quiet"
          onClick={() => void save({ kind: "focus", skillId: null })}
        >
          Return to mixed practice
        </Button>
      )}
      <Button
        disabled={disabled}
        variant="quiet"
        onClick={() => {
          setError("");
          setConfirm(true);
        }}
      >
        Reset practice level
      </Button>
      {!confirm && error && <p role="alert">{error}</p>}
      <Dialog
        aboveNavigation
        open={confirm}
        title="Reset practice level?"
        onOpenChange={(open) => {
          if (!saving) setConfirm(open);
        }}
      >
        <p>
          Start from the learner’s birth year. Keep all XP and skill history.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className={styles.actions}>
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => setConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={saving}
            onClick={() => void save({ kind: "reset" })}
          >
            {saving ? "Resetting…" : "Reset level"}
          </Button>
        </div>
      </Dialog>
    </fieldset>
  );
}
