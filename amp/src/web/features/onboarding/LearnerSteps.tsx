import { useActivateGift } from "../access/api";
import { CHILD_NAME_MAX, PARENT_ENTRY_LINE } from "../../../learning/nickname";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { SignedInMe } from "../../../account/contracts";
import { BirthYearPrompt } from "../../BirthYearPrompt";
import { selectLearner } from "../../learner-store";
import {
  continuationSearch,
  forgetFundedPurchase,
  fundedPrograms,
  fundedReturnOf,
  isFundedReturn,
} from "../../lib/funded-entry";
import { payHref } from "./pay-link";
import { useSession } from "../../lib/session";
import { Button, buttonClass } from "../../ui/Button";
import { FrameBrand, frameCard } from "../../ui/PageFrame";
import { refreshMe } from "../../lib/query";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { useClaimEnrollment } from "../billing";
import { useCreateLearner, useSetBirthYear } from "./api";
import { Progress } from "./Progress";
import { useDraft } from "./state";
import styles from "./Start.module.css";
import { practiceParams } from "../spaces/identity";

/**
 * Learner name, then birth year. A paid, unassigned enrollment is claimed for
 * the new learner; a learner saved before a failed claim is never duplicated.
 */
export function LearnerSteps({ me }: { me: SignedInMe }) {
  const session = useSession();
  const navigate = useNavigate(),
    location = useLocation();
  // The funded program these steps are for: the address's on arrival, then
  // the one kept for the account (`fundedSetup`).
  const arrival = continuationSearch(location.search).return;
  const fundedProgram = isFundedReturn(arrival)
    ? arrival
    : fundedReturnOf(session.accountId);
  const draft = useDraft(),
    mine = draft.owner === session.accountId;
  const name = mine ? draft.name : "";
  const create = useCreateLearner(session);
  const claim = useClaimEnrollment(session);
  const giftClaim = useActivateGift(session);
  const correct = useSetBirthYear(session);
  const firstRun = me.next !== "practice";
  const funded = !!fundedProgram;
  const purchase = me.unassignedPurchase;
  const gift = !purchase && !funded ? me.availableAccessGrant : undefined;
  const waiting = me.learners.filter(
    (learner) =>
      !(learner.entitlement.licensed ?? learner.entitlement.active) &&
      (!gift ||
        !me.family.learners.find((item) => item.id === learner.id)
          ?.stripeLinked),
  );
  useEffect(() => {
    if (!mine) draft.set(session.accountId, "");
  }, [session.accountId]);
  // `/start/birth-year` with no name yet (a refresh, a saved link) asks the
  // name first, in place.
  const atYear = location.pathname === "/start/birth-year";
  const busy =
    create.isPending ||
    claim.isPending ||
    giftClaim.isPending ||
    correct.isPending;
  const practice = (learnerId: string) => {
    selectLearner(learnerId);
    draft.clear();
    if (fundedProgram) {
      // The learner is set up: paying through the program continues, on
      // its tab of their pay overlay, and the pending setup is done.
      forgetFundedPurchase(session.accountId);
      void payHref(session, learnerId, {
        method: "esa",
        program: fundedPrograms[fundedProgram].id,
      })
        .then((href) => navigate({ href, replace: true }))
        .catch((error: unknown) =>
          console.error("The program's purchase didn’t open", error),
        );
    } else
      void navigate({
        to: "/$",
        params: practiceParams(learnerId),
        replace: true,
      });
  };
  const assign = (learnerId: string) =>
    gift
      ? giftClaim.mutate(
          { id: gift.id, learnerId },
          { onSuccess: () => practice(learnerId) },
        )
      : purchase && !funded
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
        giftClaim.error?.message ??
        correct.error?.message ??
        ""
      }
      onDismiss={() => {
        create.reset();
        claim.reset();
        giftClaim.reset();
        correct.reset();
      }}
    />
  );
  if (atYear && name.trim())
    return (
      <>
        {toast}
        <BirthYearPrompt
          embedded={{
            className: `${frameCard} ${styles.step}`,
            containerClassName: styles.yearContainer,
            header: (
              <>
                <FrameBrand expanded />
                {funded || gift ? (
                  <div className={styles.progress}>
                    <span>Starting point</span>
                  </div>
                ) : (
                  firstRun && <Progress step={4} />
                )}
              </>
            ),
          }}
          name={name.trim()}
          birthYear={mine ? draft.year : null}
          busy={busy}
          cancel={() => void navigate({ to: "/start/name" })}
          saveBirthYear={(year) => {
            claim.reset();
            giftClaim.reset();
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
      <FrameBrand expanded />
      {toast}
      {firstRun && !funded && !gift ? (
        <Progress step={3} />
      ) : (
        <div className={styles.progress}>
          <span>New learner</span>
        </div>
      )}
      <h1>Who’s learning?</h1>
      <p>
        Their first name or nickname keeps each learner’s practice separate.
      </p>
      {(purchase || gift) && waiting.length > 0 && (
        <div className={styles.claim}>
          {waiting.map((learner) => (
            <Button
              key={learner.id}
              variant="secondary"
              disabled={busy}
              onClick={() => {
                claim.reset();
                giftClaim.reset();
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
          void navigate({ to: "/start/birth-year", replace: atYear });
        }}
      >
        {funded && <p>{PARENT_ENTRY_LINE}</p>}
        <TextField
          label="Learner name"
          placeholder="First name or nickname"
          autoComplete="off"
          value={name}
          maxLength={CHILD_NAME_MAX}
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
