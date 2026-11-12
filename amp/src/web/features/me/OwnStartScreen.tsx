import { useSuspenseQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ownPracticeAllowed } from "../../../learning/starting-point";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { sessionOptions } from "../../lib/query";
import { Button } from "../../ui/Button";
import { FrameBrand, frameCard, PageFrame } from "../../ui/PageFrame";
import { Toast } from "../../ui/Toast";
import { OwnYearTiles } from "../onboarding/OwnYearTiles";
import { useStartOwnPractice } from "./api";
import styles from "../onboarding/Start.module.css";

/** `/me/start`: an adult who teaches, or whose child practices, gives the
 * year they were born and goes straight into practice. The year is always
 * enough: an adult's starts mid-scale and practice finds the level within a
 * few problems. */
export function OwnStartScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  return session ? <StartCard session={session} /> : <Navigate to="/sign-in" />;
}

function StartCard({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const [year, setYear] = useState<number | null>(null);
  const start = useStartOwnPractice(session);
  const young =
    year !== null && !ownPracticeAllowed(year, new Date().getFullYear());
  const failure =
    start.error instanceof AppError
      ? start.error.code === "adult_practice_unavailable"
        ? "Your own practice comes with teaching a class at a school with AMP, or with a child of yours practicing. Neither is active on this account now."
        : start.error.message
      : start.error
        ? "Your practice didn’t start. Check your connection, then try again."
        : "";
  return (
    <PageFrame centered>
      <Toast message={failure} onDismiss={() => start.reset()} takeFocus />
      <section className={`${frameCard} ${styles.step}`}>
        <FrameBrand expanded />
        <h1 id="own-start-year">What year were you born?</h1>
        <p>
          Practice starts at the level for your age, then adjusts with every
          answer.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (year === null || young || start.isPending) return;
            start.mutate(year, {
              onSuccess: () =>
                void navigate({
                  to: "/$",
                  params: { _splat: "practice" },
                  replace: true,
                }),
              onError: (error) =>
                console.error("Own practice did not start", error),
            });
          }}
        >
          <OwnYearTiles
            value={year}
            onChange={(next) => {
              start.reset();
              setYear(next);
            }}
            labelledBy="own-start-year"
            disabled={start.isPending}
          />
          <p className={styles.hint} aria-live="polite">
            {young ? "Own practice starts at 13." : ""}
          </p>
          <Button
            variant="primary"
            disabled={year === null || young}
            aria-busy={start.isPending || undefined}
          >
            Start practicing
          </Button>
        </form>
      </section>
    </PageFrame>
  );
}
