import { useSuspenseQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { AdultStart } from "../../../learning/starting-point";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { sessionOptions } from "../../lib/query";
import { Button } from "../../ui/Button";
import { FrameBrand, frameCard, PageFrame } from "../../ui/PageFrame";
import { Segmented } from "../../ui/Segmented";
import { Toast } from "../../ui/Toast";
import { useStartOwnPractice } from "./api";
import { adultStartOptions } from "./start-options";
import styles from "../onboarding/Start.module.css";

/** `/me/start`: an adult who teaches, or whose child practices, chooses where
 * to begin, then goes straight into practice. */
export function OwnStartScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  return session ? <StartCard session={session} /> : <Navigate to="/sign-in" />;
}

function StartCard({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const [choice, setChoice] = useState<AdultStart | null>(null);
  const start = useStartOwnPractice(session);
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
        <h1>Where do you want to begin?</h1>
        <p>
          Practice adjusts to you from your first answer, so any start works.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!choice || start.isPending) return;
            start.mutate(choice, {
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
          <Segmented
            stacked
            label="Where to begin"
            options={adultStartOptions}
            value={choice}
            onChange={(value) => {
              start.reset();
              setChoice(value);
            }}
            disabled={start.isPending}
          />
          <Button
            variant="primary"
            disabled={!choice}
            aria-busy={start.isPending || undefined}
          >
            Start practicing
          </Button>
        </form>
      </section>
    </PageFrame>
  );
}
