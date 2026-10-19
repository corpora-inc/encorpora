import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { BirthYearPrompt } from "../../BirthYearPrompt";
import { useLearnerStore } from "../../learner-store";
import { storedTrial } from "../../lib/pending-trial";
import { Button, buttonClass } from "../../ui/Button";
import { frameCard } from "../../ui/PageFrame";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { useClaimEnrollment } from "../billing";
import { useCreateLearner } from "./api";
import { Progress } from "./Progress";
import { useDraft } from "./state";
import styles from "./Start.module.css";

/**
 * Learner name, then birth year. A paid, unassigned enrollment is claimed for
 * the new learner; a learner saved before a failed claim is never duplicated.
 */
export function LearnerSteps({
  session,
  me,
}: {
  session: AuthSession;
  me: SignedInMe;
}) {
  const navigate = useNavigate(),
    location = useLocation();
  const draft = useDraft(),
    mine = draft.owner === session.accountId;
  const name = mine ? draft.name : "";
  const create = useCreateLearner(session);
  const claim = useClaimEnrollment(session);
  const firstRun = me.next !== "practice";
  const purchase = me.unassignedPurchase;
  const waiting = me.learners.filter((learner) => !learner.entitlement.active);
  useEffect(() => {
    if (!mine) draft.set(session.accountId, "");
  }, [session.accountId]);
  useEffect(() => {
    if (location.pathname === "/start/birth-year" && !name.trim())
      void navigate({ to: "/start/name", replace: true });
  }, [location.pathname, name]);
  if (storedTrial()) return <Navigate to="/" replace />;
  const busy = create.isPending || claim.isPending;
  const practice = (learnerId: string) => {
    useLearnerStore.getState().select(learnerId);
    draft.clear();
    void navigate({ to: "/$", params: { _splat: "practice" }, replace: true });
  };
  const assign = (learnerId: string) =>
    purchase
      ? claim.mutate(
          { purchaseId: purchase.id, learnerId },
          { onSuccess: () => practice(learnerId) },
        )
      : practice(learnerId);
  const toast = (
    <Toast
      message={create.error?.message ?? claim.error?.message ?? ""}
      onDismiss={() => {
        create.reset();
        claim.reset();
      }}
    />
  );
  if (location.pathname === "/start/birth-year" && name.trim())
    return (
      <>
        {toast}
        <BirthYearPrompt
          embedded={{
            className: `${frameCard} ${styles.step}`,
            header: firstRun ? <Progress step={4} /> : undefined,
          }}
          name={name.trim()}
          birthYear={null}
          busy={busy}
          cancel={() => void navigate({ to: "/start/name" })}
          saveBirthYear={(year) => {
            claim.reset();
            // The learner already exists if only the claim failed: retry that.
            if (mine && draft.learnerId) return assign(draft.learnerId);
            create.mutate(
              { name: name.trim(), birthYear: year },
              {
                onSuccess: (learner) => {
                  draft.saved(session.accountId, learner.id);
                  assign(learner.id);
                },
              },
            );
          }}
        />
      </>
    );
  return (
    <section className={`${frameCard} ${styles.step}`}>
      {toast}
      {firstRun ? (
        <Progress step={3} />
      ) : (
        <div className={styles.progress}>
          <span>New learner</span>
          <span>1 / 2</span>
        </div>
      )}
      <h1>Who’s learning?</h1>
      <p>
        A first name or nickname helps you keep each learner’s practice
        separate.
      </p>
      {purchase && waiting.length > 0 && (
        <div className={styles.claim}>
          {waiting.map((learner) => (
            <Button
              key={learner.id}
              variant="secondary"
              disabled={busy}
              onClick={() => {
                claim.reset();
                assign(learner.id);
              }}
            >
              Continue with {learner.name}
            </Button>
          ))}
          <p className={styles.divider}>or add a new learner</p>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) void navigate({ to: "/start/birth-year" });
        }}
      >
        <TextField
          label="Learner name"
          autoComplete="off"
          value={name}
          maxLength={60}
          required
          onChange={(event) => draft.set(session.accountId, event.target.value)}
        />
        <Button variant="primary" disabled={busy || !name.trim()}>
          Continue
        </Button>
        {!firstRun && (
          <Link
            className={`${buttonClass("quiet")} ${styles.textLink}`}
            to="/$"
            params={{ _splat: "family/learners" }}
          >
            Back to family
          </Link>
        )}
      </form>
    </section>
  );
}
