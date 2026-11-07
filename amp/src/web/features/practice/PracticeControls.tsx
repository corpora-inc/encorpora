import { CheckboxControl } from "../../ui/Checkbox";
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
import settings from "./DrawerSettings.module.css";

/** Lives only in the navigation sheet; the open problem gains no extra copy. */
export function PracticeControls({
  scope,
  problemId,
  apply,
  busy,
  close,
  canReset = true,
}: {
  scope: PracticeScope;
  problemId?: string;
  apply: (change: PracticeIntent) => Promise<void>;
  busy: boolean;
  close?: () => void;
  /** False for a school student, whose school manages the practice level. */
  canReset?: boolean;
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
    <fieldset className={settings.section} disabled={busy || saving}>
      <legend>Practice</legend>
      {state.isError ? (
        <p className={settings.error} role="alert">
          Practice settings could not load.{" "}
          <button type="button" onClick={() => void state.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <label className={settings.toggle}>
          <span>Working together</span>
          <CheckboxControl
            disabled={disabled}
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
        <p className={settings.note}>
          Helped answers count as practice, not independent assessment.
        </p>
      )}
      {state.data?.focusSkillId && (
        <button
          type="button"
          className={settings.action}
          disabled={disabled}
          onClick={() => void save({ kind: "focus", skillId: null })}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7h3.2c2.1 0 3.3 1 4.6 3.2l2.4 3.6c1.3 2.2 2.5 3.2 4.6 3.2H21" />
            <path d="M3 17h3.2c1.2 0 2.1-.3 2.9-1" />
            <path d="M14.9 8c.8-.7 1.7-1 2.9-1H21" />
            <path d="m18 4 3 3-3 3M18 14l3 3-3 3" />
          </svg>
          Return to mixed practice
        </button>
      )}
      {canReset && (
        <button
          type="button"
          className={settings.action}
          disabled={disabled}
          onClick={() => {
            setError("");
            setConfirm(true);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4 9.4" />
            <path d="M4 4.5v4.9h4.9" />
          </svg>
          Reset practice level
        </button>
      )}
      {!confirm && error && (
        <p className={settings.error} role="alert">
          {error}
        </p>
      )}
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
