import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  adultStartNames,
  ownPracticeAllowed,
  type AdultStart,
} from "../../../learning/starting-point";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { Button, buttonClass } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Toast } from "../../ui/Toast";
import { OwnYearTiles } from "../onboarding/OwnYearTiles";
import { useChangeOwnStart } from "./api";
import pages from "../account/AccountPages.module.css";
import styles from "./Own.module.css";

/**
 * Account → Learners, the adult's own practice: where it starts, and the
 * year they were born, given again to correct it (Q-57). The year sets the
 * start as it did when they began; the learner still keeps no birth year,
 * and every answer stays. Their levels and record are one link away.
 */
export function OwnStartSetting({
  session,
  start,
}: {
  session: AuthSession;
  start: AdultStart | null | undefined;
}) {
  const change = useChangeOwnStart(session);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [saved, setSaved] = useState("");
  const young =
    picked !== null && !ownPracticeAllowed(picked, new Date().getFullYear());
  const failure =
    change.error instanceof AppError
      ? change.error.message
      : change.error
        ? "Your start didn’t change. Check your connection, then try again."
        : "";
  const choose = (year: number) => {
    setPicked(year);
    change.reset();
    if (!ownPracticeAllowed(year, new Date().getFullYear())) return;
    change.mutate(year, {
      onSuccess: ({ start: next }) => {
        setOpen(false);
        setSaved(`Your practice now starts at ${adultStartNames[next]}.`);
      },
      onError: (error) =>
        console.error("The start of own practice did not change", error),
    });
  };
  return (
    <>
      <p className={pages.quietLine} data-own-start={start ?? ""}>
        {start
          ? "Set from the year you were born. Practice adjusts with every answer."
          : "Give the year you were born to set where practice starts. It adjusts with every answer."}
      </p>
      <div className={pages.detailActions}>
        <Link to="/me" className={buttonClass("secondary")}>
          Your levels
        </Link>
        <Button
          variant="secondary"
          data-own-birth-year
          onClick={() => {
            setPicked(null);
            change.reset();
            setOpen(true);
          }}
        >
          Change birth year
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!change.isPending) setOpen(next);
        }}
        title="What year were you born?"
        fullOnPhone
      >
        <div className={styles.yearDialog}>
          <p id="own-year-lede" className={pages.quietLine}>
            Practice starts at the level for your age, then adjusts with every
            answer. Your answers stay.
          </p>
          <OwnYearTiles
            value={picked}
            onChange={choose}
            labelledBy="own-year-lede"
            disabled={change.isPending}
          />
          {/* Reserved: the line under the tiles never moves them. */}
          <p className={styles.yearHint} aria-live="polite">
            {young ? "Own practice starts at 13." : ""}
          </p>
        </div>
      </Dialog>
      <Toast message={failure} onDismiss={() => change.reset()} />
      <Toast message={saved} tone="status" onDismiss={() => setSaved("")} />
    </>
  );
}
