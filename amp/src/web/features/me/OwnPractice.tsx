import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { selectLearner } from "../../learner-store";
import { meOptions } from "../../lib/query";
import { useSession } from "../../lib/session";
import { Button } from "../../ui/Button";
import { useStartOwnPractice } from "./api";
import { OwnStartSetting } from "./OwnStartSetting";
import styles from "./Own.module.css";

/**
 * Your own practice (the IA v2 spec, §5, OwnPracticeStart), in place on a
 * settings hub (family Settings › People, `/account`): start it here (the account's own
 * learner, made now), then where it starts (your birth year) and Practice.
 * Shown when the account has its own practice or may start one.
 */
export function OwnPractice() {
  const session = useSession();
  const data = useQuery(meOptions(session)).data;
  const me = data?.signedIn ? data : null;
  const start = useStartOwnPractice(session);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const own = me?.adultPractice?.learner ?? null;
  const eligible = me?.adultPractice?.eligible === true;
  if (!me || (!own && !eligible)) return null;
  const learner = own
    ? me.family.learners.find((entry) => entry.id === own.id)
    : undefined;
  const practice = (learnerId: string) => {
    selectLearner(learnerId);
    void navigate({ to: "/$", params: { _splat: "practice" } });
  };
  return (
    <section
      className={styles.own}
      aria-labelledby="own-practice"
      data-own-practice=""
    >
      <h3 id="own-practice" className={styles.ownTitle}>
        Your own practice
      </h3>
      {own ? (
        <>
          <OwnStartSetting start={learner?.start} />
          <div>
            <Button variant="secondary" onClick={() => practice(own.id)}>
              Practice
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.ownLine}>
            Practice at your own level, beside your children.
          </p>
          <div>
            <Button
              variant="secondary"
              aria-busy={start.isPending || undefined}
              data-start-own-practice=""
              onClick={() => {
                if (start.isPending) return;
                setError("");
                start.mutate(undefined, {
                  onError: (failure) => {
                    console.error("Own practice didn’t start", failure);
                    setError("Your practice didn’t start. Try again.");
                  },
                });
              }}
            >
              Start your own practice
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className={styles.ownLine}>
          {error}
        </p>
      )}
    </section>
  );
}
