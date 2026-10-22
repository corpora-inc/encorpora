import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { signOut, type AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { chosenPlan, forgetPlanChoice } from "../../lib/pending-trial";
import { Button, buttonClass } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { FrameBrand, frameCard } from "../../ui/PageFrame";
import { Toast } from "../../ui/Toast";
import {
  emailConsentOptions,
  enrollmentOptions,
  NoticeSummary,
  offerOptions,
  paymentUrl,
  PlanChoice,
  refreshEnrollment,
  useEnrollmentCheckout,
} from "../billing";
import type { SignedInMe } from "../../../account/contracts";
import { CheckoutPrivacy } from "./CheckoutPrivacy";
import { Progress } from "./Progress";
import styles from "./Start.module.css";
import { track } from "../../lib/analytics";

const exitFailed =
  "Sign-out didn’t finish. Check your connection and try again.";
const names = { year: "annual", month: "monthly" } as const;

/**
 * Plan choice with the direct notice and an explicit parent acknowledgement.
 * Paying is the verified parental consent; no learner details are asked for.
 */
export function PlanStep({
  session,
  family,
  trial = false,
}: {
  session: AuthSession;
  family: SignedInMe["family"];
  /** The parent has no purchase yet and can return to free practice. */
  trial?: boolean;
}) {
  const search = useSearch({ from: "/start/plan" });
  const enrollment = useQuery(enrollmentOptions(session));
  const available = enrollment.data?.available;
  const offers = useQuery({
    ...offerOptions(session),
    enabled: available === true,
  });
  const emailPlus = useQuery({
    ...emailConsentOptions(session),
    enabled: available === false,
  });
  const checkout = useEnrollmentCheckout(session);
  const savingPrivacy =
    useIsMutating({
      mutationKey: ["account", session.accountId, "purchase-measurement"],
    }) > 0;
  const exit = useMutation({
    mutationFn: signOut,
    onError: () => new AppError("unavailable", exitFailed, true).log(),
  });
  // The plan chosen on the free-trial paywall, if any, stays selected.
  const [interval, chooseInterval] = useState<"year" | "month">(
    () => search.interval ?? chosenPlan() ?? "year",
  );
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const requests = useRef<Partial<Record<"year" | "month", string>>>({});
  useEffect(() => track("plan_view"), []);
  // Back from Stripe restores this page from the browser cache: re-read the
  // enrollment and drop the finished "opening checkout" state.
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      checkout.reset();
      void refreshEnrollment(session);
    };
    addEventListener("pageshow", restored);
    return () => removeEventListener("pageshow", restored);
  }, [session.accountId]);
  const purchase = enrollment.data?.purchase;
  const phase = purchase?.phase;

  if (
    phase &&
    !["ready", "expired", "checkout-open"].includes(phase) &&
    enrollment.data
  )
    return <Navigate to="/start/purchase" replace />;
  const failed =
    enrollment.error ?? (available ? offers.error : emailPlus.error);
  if (failed)
    return (
      <section className={`${frameCard} ${styles.step}`} key="error">
        <FrameBrand expanded />
        <Progress step={1} />
        <h1>Choose your plan</h1>
        <p role="alert">
          {failed instanceof AppError
            ? failed.message
            : "Plans could not be loaded. Try again."}
        </p>
        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={() => {
              void enrollment.refetch();
              if (available) void offers.refetch();
              else if (available === false) void emailPlus.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      </section>
    );
  if (available === false && emailPlus.data)
    return emailPlus.data.available ? (
      <section className={`${frameCard} ${styles.step}`} key="email-plus">
        <FrameBrand expanded />
        <Progress step={1} />
        <h1>Confirm by email first</h1>
        <p>
          Card enrollment isn’t available for this service. Confirm parent
          consent by email instead. Then add your learner and choose a plan.
        </p>
        <div className={styles.actions}>
          <Link to="/start/consent" className={buttonClass("primary")}>
            Continue with email
          </Link>
        </div>
      </section>
    ) : (
      <section className={`${frameCard} ${styles.step}`} key="unavailable">
        <FrameBrand expanded />
        <Toast message={exit.error ? exitFailed : ""} onDismiss={exit.reset} />
        <h1>Enrollment isn’t open yet</h1>
        <p>
          This AMP service isn’t taking new enrollments right now. No payment
          was taken and no learner details were saved.
        </p>
        <p>
          To enroll, contact the support team for the service you signed up
          with.
        </p>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            disabled={exit.isPending}
            onClick={() => exit.mutate()}
          >
            Sign out
          </Button>
        </div>
      </section>
    );
  const notice = enrollment.data?.notice;
  const digest = enrollment.data?.noticeDigest;
  const plans = offers.data?.offers ?? [];
  if (!notice || !digest || !plans.length)
    return (
      <section
        className={`${frameCard} ${styles.step}`}
        key="loading"
        aria-busy="true"
      >
        <FrameBrand expanded />
        <Progress step={1} />
        <h1>Choose your plan</h1>
        <p>Adaptive practice, lessons and printable books for one learner.</p>
        <div className={styles.skeleton} aria-label="Loading plans">
          <span style={{ height: 82 }} />
          <span style={{ height: 112 }} />
          <span style={{ height: 66 }} />
          <span style={{ height: 48 }} />
        </div>
      </section>
    );
  // An open checkout fixes the plan. With a verified Stripe link it resumes;
  // without one (Stripe failed after the reservation) the same plan retries.
  const pending = phase === "checkout-open" ? purchase : null;
  const resume = pending?.url ? safeCheckout(pending.url) : null;
  const open = resume ? pending : null;
  const chosen = pending?.interval ?? interval;
  const offer = plans.find((entry) => entry.interval === chosen) ?? plans[0]!;
  const agreed = acknowledged === digest;
  return (
    <section className={`${frameCard} ${styles.step}`} key="ready">
      <FrameBrand expanded />
      <Toast
        message={checkout.error?.message ?? ""}
        onDismiss={() => checkout.reset()}
      />
      <Progress step={1} />
      <h1>Choose your plan</h1>
      <p>Adaptive practice, lessons and printable books for one learner.</p>
      <PlanChoice
        offers={plans}
        interval={offer.interval}
        disabled={!!pending || checkout.isPending}
        onChange={(next) => {
          track("plan_select", { interval: next });
          chooseInterval(next);
          checkout.reset();
        }}
      />
      <NoticeSummary notice={notice} />
      {open ? (
        <>
          <p className={styles.fine}>
            Your {names[open.interval]} checkout is still open. Continue it to
            finish; nothing is charged until you pay.
          </p>
          <div className={styles.actions}>
            <Button
              variant="primary"
              disabled={savingPrivacy}
              onClick={() => {
                if (resume) window.location.assign(resume);
              }}
            >
              Resume checkout
            </Button>
          </div>
        </>
      ) : (
        <>
          <Checkbox
            checked={agreed}
            disabled={checkout.isPending}
            onChange={(checked) => setAcknowledged(checked ? digest : null)}
          >
            I am this learner’s parent or legal guardian. I have read the parent
            notice and agree to it.
          </Checkbox>
          <div className={styles.actions}>
            <Button
              variant="primary"
              disabled={!agreed || checkout.isPending || savingPrivacy}
              onClick={() => {
                track("checkout_start", { interval: offer.interval });
                const requestId = (requests.current[offer.interval] ??=
                  crypto.randomUUID());
                checkout.mutate(
                  {
                    requestId,
                    offer,
                    noticeDigest: digest,
                    renewRequestId: () =>
                      (requests.current[offer.interval] = crypto.randomUUID()),
                  },
                  {
                    onSuccess: forgetPlanChoice,
                    onError: (error) => {
                      // A refused request is closed; an ambiguous one may retry.
                      if (
                        error instanceof AppError &&
                        ["validation", "permission"].includes(error.kind)
                      ) {
                        delete requests.current[offer.interval];
                        setAcknowledged(null);
                      }
                    },
                  },
                );
              }}
            >
              {checkout.isPending || checkout.isSuccess
                ? "Opening secure checkout…"
                : "Continue to secure checkout"}
            </Button>
          </div>
          <p className={styles.fine}>
            Stripe handles payment. You’ll add your learner right after.
          </p>
          {trial && (
            <Link
              to="/try/map"
              className={`${buttonClass("quiet")} ${styles.textLink}`}
              onClick={forgetPlanChoice}
            >
              Back to free practice
            </Link>
          )}
        </>
      )}
      <CheckoutPrivacy
        key={session.accountId}
        session={session}
        family={family}
        disabled={checkout.isPending || checkout.isSuccess}
      />
    </section>
  );
}
function safeCheckout(url: string): string | null {
  try {
    return paymentUrl(url, "checkout.stripe.com");
  } catch {
    new AppError(
      "contract",
      "The checkout link could not be verified.",
      false,
    ).log();
    return null;
  }
}
