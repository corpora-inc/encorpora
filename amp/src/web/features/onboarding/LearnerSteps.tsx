import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { BirthYearPrompt } from "../../BirthYearPrompt";
import { useLearnerStore } from "../../learner-store";
import { AppError } from "../../lib/AppError";
import { clearStoredTrial, storedTrial } from "../../lib/pending-trial";
import { Button, buttonClass } from "../../ui/Button";
import { frameCard } from "../../ui/PageFrame";
import { queryClient, refreshMe } from "../../lib/query";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { useClaimEnrollment } from "../billing";
import { useAdoptTrial, useCreateLearner, useSetBirthYear } from "./api";
import { Progress } from "./Progress";
import { useDraft } from "./state";
import styles from "./Start.module.css";

/**
 * Learner name, then birth year. A paid, unassigned enrollment is claimed for
 * the new learner; a learner saved before a failed claim is never duplicated.
 * Free practice on this device becomes that learner, with every answer and
 * its birth year, so the learner continues where they left off.
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
  const correct = useSetBirthYear(session);
  const adopt = useAdoptTrial(session);
  const [trial, setTrial] = useState(storedTrial);
  const [ended, setEnded] = useState("");
  const dropTrial = () => {
    clearStoredTrial();
    queryClient.removeQueries({ queryKey: ["trial"] });
    setTrial(null);
  };
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
  const busy =
    create.isPending || claim.isPending || correct.isPending || adopt.isPending;
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
      message={
        create.error?.message ??
        claim.error?.message ??
        correct.error?.message ??
        (ended || adopt.error?.message) ??
        ""
      }
      onDismiss={() => {
        create.reset();
        claim.reset();
        correct.reset();
        adopt.reset();
        setEnded("");
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
          birthYear={mine ? draft.year : null}
          busy={busy}
          cancel={() => void navigate({ to: "/start/name" })}
          saveBirthYear={(year) => {
            claim.reset();
            create.reset();
            correct.reset();
            const saved = mine ? draft.learnerId : null;
            // The learner already exists if only the claim failed: retry that,
            // after correcting the year if the parent picked a different one.
            if (saved)
              return draft.year === year
                ? assign(saved)
                : correct.mutate(
                    { learnerId: saved, birthYear: year },
                    {
                      onSuccess: () => {
                        draft.saved(session.accountId, saved, year);
                        assign(saved);
                      },
                    },
                  );
            const known = new Set(me.learners.map((learner) => learner.id));
            create.mutate(
              { name: name.trim(), birthYear: year },
              {
                onSuccess: (learner) => {
                  draft.saved(session.accountId, learner.id, year);
                  assign(learner.id);
                },
                // A lost response may hide a saved learner: find it so the
                // next tap claims it instead of creating a duplicate.
                onError: () =>
                  void refreshMe(session)
                    .then((fresh) => {
                      const created =
                        fresh.signedIn &&
                        fresh.learners.find(
                          (learner) =>
                            !known.has(learner.id) &&
                            learner.name === name.trim(),
                        );
                      if (created)
                        draft.saved(session.accountId, created.id, year);
                    })
                    .catch((cause) =>
                      console.error("Learner check after failed save", cause),
                    ),
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
      <h1>{trial ? "Who’s been practicing?" : "Who’s learning?"}</h1>
      <p>
        {trial
          ? "Their free practice carries over: every answer, the map and the next problem."
          : "A first name or nickname helps you keep each learner’s practice separate."}
      </p>
      {!trial && purchase && waiting.length > 0 && (
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
          if (!name.trim()) return;
          if (!trial) return void navigate({ to: "/start/birth-year" });
          // Saved before a failed claim: claim again, never adopt twice.
          if (mine && draft.learnerId) return assign(draft.learnerId);
          claim.reset();
          const known = new Set(me.learners.map((learner) => learner.id));
          adopt.mutate(
            { token: trial, name: name.trim() },
            {
              onSuccess: (learner) => {
                dropTrial();
                draft.saved(
                  session.accountId,
                  learner.id,
                  learner.birthYear ?? 0,
                );
                assign(learner.id);
              },
              onError: (error) => {
                if (!(error instanceof AppError) || error.kind !== "validation")
                  return;
                // Already saved (a lost response) or ended: find it, or
                // continue as a new learner.
                adopt.reset();
                void refreshMe(session)
                  .then((fresh) => {
                    const saved =
                      fresh.signedIn &&
                      fresh.learners.find(
                        (learner) =>
                          !known.has(learner.id) &&
                          learner.name === name.trim(),
                      );
                    dropTrial();
                    if (saved) {
                      draft.saved(
                        session.accountId,
                        saved.id,
                        saved.birthYear ?? 0,
                      );
                      assign(saved.id);
                    } else
                      setEnded(
                        "That free practice has ended on this device. Continue to add the learner and choose a starting point.",
                      );
                  })
                  .catch((cause) =>
                    console.error("Learner check after trial save", cause),
                  );
              },
            },
          );
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
        {trial && (
          // Keeps the free practice on this device for a later learner.
          <Button
            type="button"
            variant="quiet"
            disabled={busy}
            onClick={() => setTrial(null)}
          >
            Add a different learner
          </Button>
        )}
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
