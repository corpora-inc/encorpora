import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { initialLevel } from "../../../learning/frontier";
import { gradeName } from "../../../learning/level-check";
import type { PracticeSettings } from "../../../learning/practice-settings";
import { learnerWhere } from "../../lib/learner-where";
import { learnerFrontierOptions } from "../../lib/learning-view";
import { invalidateAccount } from "../../lib/query";
import { forSession, useSessionOrNull } from "../../lib/session";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Loading } from "../../ui/Loading";
import { usePracticeAdjustment } from "./practice-settings";
import styles from "./PracticeControls.module.css";
import settings from "./DrawerSettings.module.css";

/** The learner whose practice level starts again. */
export type ResetLearner = {
  id: string;
  name: string;
  /** A child's: where a reset starts them again. An adult's own practice
   * and a practice profile have none. */
  birthYear?: number | null;
};

/**
 * Where a learner's practice level is now, and where a reset returns it:
 * the same estimate the child's page, Pathways and practice read
 * (`/frontier`, lib/learner-where.ts), and the grade their birth year
 * starts them at (`initialLevel`).
 */
export function usePracticeLevel(learner: ResetLearner) {
  const session = useSessionOrNull();
  const frontier = useQuery(
    forSession(session, (signedIn) =>
      learnerFrontierOptions(signedIn, learner.id),
    ),
  );
  useEffect(() => {
    if (frontier.isError)
      console.error("The practice level didn’t load", frontier.error);
  }, [frontier.isError, frontier.error]);
  const where = learnerWhere(frontier.data?.overall);
  return {
    /** "Grade 8"; null before any answer since the last reset. */
    now: where?.bestName ?? null,
    /** Read: whether `now` is known. */
    known: !!session && frontier.isSuccess,
    /** The level couldn't be read (a reset still works). */
    failed: frontier.isError,
    startsAt:
      learner.birthYear != null
        ? gradeName(initialLevel({ birthYear: learner.birthYear }))
        : null,
  };
}

/**
 * Starting a learner's practice level again (`kind: "reset"` on
 * `/learners/:id/practice-state`). The server allows it only to the
 * account holder of a family's child (or an adult for their own practice):
 * never a second parent, a school or a child's own session. On success
 * every view of the level reads the account's one store again.
 */
export function useResetPracticeLevel(
  learnerId: string,
  onReset?: (saved: PracticeSettings) => Promise<void> | void,
) {
  const session = useSessionOrNull();
  const adjust = usePracticeAdjustment({
    identity: session?.accountId ?? "guest",
    learnerId,
    token: session?.token,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function reset() {
    setError("");
    setSaving(true);
    let saved: PracticeSettings | null;
    try {
      saved = await adjust.change({ kind: "reset" });
    } catch (failure) {
      console.error("AMP couldn’t reset the practice level", failure);
      setError(
        failure instanceof Error && failure.message
          ? failure.message
          : "The level wasn’t reset. Try again.",
      );
      setSaving(false);
      return false;
    }
    // Reset: what follows never says it wasn't. The child's page, Pathways,
    // Today and practice all read the level from the account's store; a
    // failed read there says so where it shows.
    try {
      if (saved) {
        if (session) await invalidateAccount(session.accountId);
        await onReset?.(saved);
      }
    } catch (failure) {
      console.error("After a practice-level reset", failure);
    } finally {
      setSaving(false);
    }
    return !!saved;
  }
  return { reset, saving, error };
}

const RESET_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4 9.4" />
    <path d="M4 4.5v4.9h4.9" />
  </svg>
);

/**
 * "Reset practice level" and its confirmation: the level now, where it
 * starts again, and that XP and skill history stay. Composed in practice's
 * menu (`look="menu"`) and in a child's settings (`look="row"`, the parent's
 * row with the level and a Reset button).
 */
export function ResetPracticeLevel({
  learner,
  look,
  resetFrom,
  own = false,
  disabled = false,
  onReset,
  rowClass,
}: {
  learner: ResetLearner;
  look: "menu" | "row";
  /** Where a reset starts again, said in the confirmation; by default the
   * learner's birth year. */
  resetFrom?: string;
  /** Said to the learner practicing ("Your XP"), not about them. */
  own?: boolean;
  disabled?: boolean;
  /** After the level is reset and the store refreshed. */
  onReset?: (saved: PracticeSettings) => Promise<void> | void;
  /** The row's own layout, from the screen that holds it. */
  rowClass?: {
    row: string;
    text: string;
    action: string;
  };
}) {
  const level = usePracticeLevel(learner);
  const { reset, saving, error } = useResetPracticeLevel(learner.id, onReset);
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);
  const now: ReactNode = level.failed ? (
    "Didn’t load"
  ) : !level.known ? (
    <Loading inline>{null}</Loading>
  ) : (
    (level.now ?? "Not measured yet")
  );
  const whose = own ? "Your" : `${learner.name}’s`;
  const from =
    resetFrom ??
    (learner.birthYear != null
      ? `Practice starts again from ${learner.name}’s birth year.`
      : "Practice starts again from where it began.");
  const dialog = (
    <Dialog
      aboveNavigation
      open={open}
      title="Reset practice level?"
      onOpenChange={(next) => {
        if (!saving) setOpen(next);
      }}
    >
      <dl className={styles.levels} data-reset-levels="">
        <div>
          <dt>Now</dt>
          <dd data-reset-now="">{now}</dd>
        </div>
        {level.startsAt && (
          <div>
            <dt>Starts again at</dt>
            <dd data-reset-start="">{level.startsAt}</dd>
          </div>
        )}
      </dl>
      <p>
        {from} {whose} XP and skill history stay.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <Button
          variant="secondary"
          disabled={saving}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={saving}
          aria-busy={saving || undefined}
          onClick={() =>
            void reset().then((done) => {
              if (done) setOpen(false);
            })
          }
        >
          Reset level
        </Button>
      </div>
    </Dialog>
  );
  if (look === "menu")
    return (
      <>
        <button
          type="button"
          className={settings.action}
          disabled={disabled || saving}
          onClick={show}
        >
          {RESET_ICON}
          Reset practice level
        </button>
        {dialog}
      </>
    );
  return (
    <div className={rowClass?.row} data-reset-level={learner.id}>
      <div className={rowClass?.text}>
        <dt>Practice level</dt>
        <dd data-reset-row-now="">
          {level.known && !level.now ? "Not measured yet" : <>Now: {now}</>}
          {level.startsAt && <> · resets to {level.startsAt}</>}
        </dd>
      </div>
      <div className={rowClass?.action}>
        <Button
          variant="secondary"
          disabled={disabled || saving}
          aria-label={`Reset ${learner.name}’s practice level`}
          onClick={show}
        >
          Reset
        </Button>
      </div>
      {dialog}
    </div>
  );
}
