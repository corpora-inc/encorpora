import { CheckboxControl } from "../../ui/Checkbox";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  practiceSettingsOptions,
  type PracticeIntent,
  type PracticeScope,
} from "./practice-settings";
import { levelName } from "../../../learning/practice-profiles";
import styles from "./PracticeControls.module.css";
import settings from "./DrawerSettings.module.css";

/** What the drawer says about the practice on view: never the practice
 * bar, which stays the learner's (nothing there to distract them). */
export type Practicing = {
  /** Whose practice it is; left out where the drawer already names them
   * (a student's "Signed in as"). */
  name?: string;
  /** The address's filter, named ("Fractions", a skill): null is none. */
  filter: string | null;
  /** A skill's title, for the practice settings' focus. */
  skillTitle: (skillId: string) => string | undefined;
  /** The learner's estimated level, once answers measure it. */
  level: number | null;
};

/** Lives only in the navigation sheet; the open problem gains no extra copy. */
export function PracticeControls({
  practicing,
  scope,
  problemId,
  apply,
  busy,
  close,
  together = true,
  reset,
}: {
  practicing?: Practicing;
  scope: PracticeScope;
  problemId?: string;
  apply: (change: PracticeIntent) => Promise<void>;
  busy: boolean;
  close?: () => void;
  /** "Working together" is a grown-up helping a child; an adult practicing
   * on their own isn't offered it (unless it is already on). */
  together?: boolean;
  /** "Reset practice level" (ResetPracticeLevel), where whoever is signed
   * in may reset it: never a child's own session, whose grown-up or school
   * manages the level. */
  reset?: ReactNode;
}) {
  const state = useQuery(practiceSettingsOptions(scope));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(change: PracticeIntent) {
    setError("");
    setSaving(true);
    try {
      await apply(change);
      if (change.kind !== "together") close?.();
    } catch (failure) {
      console.error("AMP couldn’t change practice", {
        change: change.kind,
        error: failure,
      });
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
  const focus = state.data?.focusSkillId;
  // Mixed, or the area or skill it is held to (the address's, else a focus).
  const problems =
    practicing?.filter ??
    (focus ? (practicing?.skillTitle(focus) ?? null) : null) ??
    "Mixed";
  // A grown-up may hide grade levels from the screens the child sees.
  const level =
    practicing?.level != null && state.data?.gradeLevelShown !== false
      ? levelName(practicing.level)
      : null;
  return (
    <fieldset className={settings.section} disabled={busy || saving}>
      <legend>Practice</legend>
      {practicing && (
        <dl className={styles.practicing} data-practicing>
          {practicing.name && (
            <div>
              <dt>Who</dt>
              <dd>{practicing.name}</dd>
            </div>
          )}
          <div>
            <dt>Problems</dt>
            <dd>{problems}</dd>
          </div>
          {level && (
            <div>
              <dt>Level</dt>
              <dd>{level}</dd>
            </div>
          )}
        </dl>
      )}
      {state.isError ? (
        <p className={settings.error} role="alert">
          Practice settings could not load.{" "}
          <button type="button" onClick={() => void state.refetch()}>
            Retry
          </button>
        </p>
      ) : !together && !state.data?.workingTogether ? null : (
        <label className={settings.toggle}>
          <span className={settings.toggleText}>Working together</span>
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
          Helped answers count as practice, not assessment.
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
      {reset}
      {error && (
        <p className={settings.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
