import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import type { SignedInMe } from "../../../../account/contracts";
import { studentGrantResource } from "../../../../schools/contracts";
import { request } from "../../../lib/api";
import { AppError } from "../../../lib/AppError";
import { meKey, meOptions, queryClient } from "../../../lib/query";
import { Button, buttonClass } from "../../../ui/Button";
import { Toast } from "../../../ui/Toast";
import { currentSession } from "../api";
import { useFinishSignIn } from "../join/api";
import styles from "./Family.module.css";

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const failures: Record<string, string> = {
  learner_cannot_practice:
    "This child needs access before practicing. Open Family to add it.",
  learner_not_found: "That child isn’t in your class now. Refresh and try again.",
};

/** A family's class (docs/families.md): each child with their own access,
 * and the way to hand this device to one of them. Access is each child's own,
 * so it reads as dates rather than seats. */
export function FamilyPanel({ classId }: { classId: string }) {
  const session = currentSession();
  const me = useQuery(meOptions(session)).data;
  const finish = useFinishSignIn();
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!me?.signedIn || me.familyClass?.classId !== classId) return null;
  const family = me.familyClass;
  const handOver = async (learner: SignedInMe["learners"][number]) => {
    setStarting(learner.id);
    try {
      const grant = await request(
        `/family/learners/${learner.id}/practice-here`,
        studentGrantResource,
        { token: session.token, body: {} },
      );
      await finish(grant, true);
    } catch (failure) {
      console.error("Practice on this device didn’t start", failure);
      setError(
        (failure instanceof AppError && failure.code && failures[failure.code]) ||
          "Practice didn’t start. Try again in a moment.",
      );
      setStarting(null);
    }
  };
  const dismiss = () => {
    // Gone at once; the server keeps it gone on every device.
    queryClient.setQueryData(meKey(session.accountId), {
      ...me,
      familyClass: { ...family, notice: false },
    });
    void request("/family/class-notice/dismiss", z.unknown(), {
      token: session.token,
      body: {},
    }).catch((failure) =>
      console.error("The sign-in note wasn’t dismissed", failure),
    );
  };
  return (
    <section className={styles.family} aria-labelledby="family-children">
      {family.notice && (
        <p className={styles.notice}>
          <span>
            Your children now sign in on their own devices with this class’s
            code and three pictures. On this device, choose who’s practicing.
          </span>
          <button
            type="button"
            className={styles.dismiss}
            aria-label="Dismiss"
            onClick={dismiss}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 4 8 8m0-8-8 8" />
            </svg>
          </button>
        </p>
      )}
      <h2 id="family-children" className={styles.heading}>
        Practice on this device
      </h2>
      <ul className={styles.children}>
        {me.learners.map((learner) => (
          <li key={learner.id} className={styles.child}>
            <span className={styles.who}>
              <span className={styles.name}>{learner.name}</span>
              <span className={styles.access}>
                {learner.entitlement.active && learner.entitlement.endsAt
                  ? `Access through ${DAY.format(new Date(learner.entitlement.endsAt))}`
                  : "No access yet"}
              </span>
            </span>
            {learner.entitlement.active ? (
              <Button
                variant="secondary"
                className={styles.action}
                aria-busy={starting === learner.id || undefined}
                disabled={starting !== null && starting !== learner.id}
                onClick={() => void handOver(learner)}
              >
                Let {learner.name} practice here
              </Button>
            ) : (
              <Link
                to="/$"
                params={{ _splat: "family" }}
                className={`${buttonClass("secondary")} ${styles.action}`}
              >
                Add access
              </Link>
            )}
          </li>
        ))}
      </ul>
      <Toast message={error} onDismiss={() => setError("")} />
    </section>
  );
}
