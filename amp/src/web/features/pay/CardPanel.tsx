import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import type { SignedInMe } from "../../../account/contracts";
import { AppError } from "../../lib/AppError";
import { track } from "../../lib/analytics";
import { forgetPlanChoice } from "../../lib/pending-trial";
import { Button, buttonClass } from "../../ui/Button";
import { Toast } from "../../ui/Toast";
import {
  emailConsentOptions,
  enrollmentOptions,
  NoticeSummary,
  offerOptions,
  useEnrollmentCheckout,
} from "../billing";
import { paymentUrl } from "../billing/payment-url";
import {
  purchaseStatusOptions,
  startOwnPractice,
  useLearnerCheckout,
  type PurchasePhase,
} from "./api";
import { cardDonePath } from "./paths";
import { usePay, type PayLearner } from "./context";
import { PlanPicker, useChosenInterval } from "./PlanPicker";
import { usePayStore, type CheckoutKind, type PayInterval } from "./store";
import styles from "./Pay.module.css";

type Learner = PayLearner;

/**
 * Which checkout a learner's card purchase uses. A child of a family
 * without verified consent pays through the enrollment checkout: its
 * verified card payment is the parent's consent (16 CFR 312.5(b)(2)(ii)),
 * so the direct notice comes first (16 CFR 312.4(b), (c)). A consented
 * family and an adult buying for their own practice check out for the
 * learner, with no notice: nothing more is collected (`purchaseConsentSatisfied`).
 */
export function checkoutKind(me: SignedInMe, learner: Learner): CheckoutKind {
  return learner.adult || me.consent.status === "active"
    ? "learner"
    : "enrollment";
}

/** The card tab: the plan, then Stripe. */
export function CardPanel() {
  const { me, learner } = usePay();
  return checkoutKind(me, learner) === "learner" ? (
    <LearnerCheckout />
  ) : (
    <EnrollmentCheckout />
  );
}

function LearnerCheckout() {
  const { session, learner } = usePay();
  const chosen = useChosenInterval();
  // A practice profile of an account with no learner of its own yet: the
  // adult's own learner starts when they check out (docs/families.md).
  const own = learner.simulation ? null : learner.id;
  const offers = useQuery(offerOptions(session));
  const status = useQuery({
    ...purchaseStatusOptions(session, learner.id),
    enabled: !!own,
  });
  const checkout = useLearnerCheckout(session);
  const opened = usePayStore((state) => state.checkoutOpened);
  const requests = useRef<Partial<Record<PayInterval, string>>>({});
  const phase: PurchasePhase | undefined = own ? status.data?.phase : "ready";
  const tier = own ? status.data?.tier : "full";
  const failed = offers.error ?? (own ? status.error : null);
  if (failed)
    return (
      <Retry
        error={failed}
        onRetry={() => {
          void offers.refetch();
          if (own) void status.refetch();
        }}
      />
    );
  if (!offers.data || !phase) return <PlanSkeleton />;
  const plans =
    tier === "extra" && offers.data.extraOffers.length
      ? offers.data.extraOffers
      : offers.data.offers;
  const interval = chosen;
  const offer = plans.find((entry) => entry.interval === interval) ?? plans[0];
  if (phase === "licensed" || phase === "scheduled")
    return (
      <Panel
        text={
          phase === "licensed"
            ? "Your plan is active."
            : "Your next plan is already paid for."
        }
        action={
          <Link to="/account/billing" className={buttonClass("primary")}>
            View billing
          </Link>
        }
      />
    );
  if (phase === "payment-processing" || phase === "awaiting-payment")
    return (
      <Panel
        text="Your payment is being confirmed. This usually takes a few seconds."
        action={
          <Link
            to={cardDonePath(learner.id) as never}
            className={buttonClass("primary")}
          >
            See your payment
          </Link>
        }
      />
    );
  if (phase === "needs-review" || phase === "consent-required" || phase === "deleted")
    return (
      <Panel text="This purchase needs a billing review before it can start. Write to support@corpora.inc and we’ll sort it out." />
    );
  if (!offers.data.available || !offer)
    return <Panel text="Card checkout isn’t available right now. Education funds still work." />;
  const resume = phase === "checkout-open" && offer.interval === status.data?.interval;
  const busy = checkout.isPending || checkout.isSuccess;
  return (
    <>
      <Toast message={checkout.error?.message ?? ""} onDismiss={() => checkout.reset()} />
      <PlanPicker
        offers={plans}
        extra={tier === "extra" ? undefined : offers.data.extraOffers}
        disabled={busy}
      />
      <div className={styles.actions}>
        <Button
          variant="primary"
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={() => {
            track("checkout_start", { interval: offer.interval });
            checkout.mutate(
              {
                learnerId: own ?? (() => startOwnPractice(session)),
                offer,
                requestId: () => (requests.current[offer.interval] ??= crypto.randomUUID()),
                renewRequestId: () => (requests.current[offer.interval] = crypto.randomUUID()),
              },
              { onSuccess: forgetPlanChoice },
            );
            opened(session.accountId, { learnerId: learner.id, kind: "learner" });
          }}
        >
          {busy ? "Opening secure checkout…" : resume ? "Resume checkout" : "Continue to Stripe"}
        </Button>
        <p className={styles.fine}>Stripe handles payment. You’ll come back here right after.</p>
      </div>
    </>
  );
}

function EnrollmentCheckout() {
  const { session, learner } = usePay();
  const chosen = useChosenInterval();
  const enrollment = useQuery(enrollmentOptions(session));
  const available = enrollment.data?.available;
  const offers = useQuery({ ...offerOptions(session), enabled: available === true });
  const emailPlus = useQuery({
    ...emailConsentOptions(session),
    enabled: available === false,
  });
  const checkout = useEnrollmentCheckout(session);
  const opened = usePayStore((state) => state.checkoutOpened);
  const requests = useRef<Partial<Record<PayInterval, string>>>({});
  const failed = enrollment.error ?? (available ? offers.error : emailPlus.error);
  if (failed)
    return (
      <Retry
        error={failed}
        onRetry={() => {
          void enrollment.refetch();
          if (available) void offers.refetch();
          else if (available === false) void emailPlus.refetch();
        }}
      />
    );
  if (available === false && emailPlus.data)
    return emailPlus.data.available ? (
      <Panel
        text="Card enrollment isn’t available for this service. Confirm parent consent by email instead, then choose a plan."
        action={
          <Link to="/$" params={{ _splat: "consent" }} className={buttonClass("primary")}>
            Continue with email
          </Link>
        }
      />
    ) : (
      <Panel text="This AMP service isn’t taking new card enrollments right now. No payment was taken. Education funds still work." />
    );
  const view = enrollment.data;
  const plans = offers.data?.offers ?? [];
  if (!view?.notice || !view.noticeDigest || !plans.length) return <PlanSkeleton notice />;
  const purchase = view.purchase;
  // Paid or settling: the confirmation step says how it is going.
  if (purchase && !["ready", "expired", "checkout-open"].includes(purchase.phase))
    return (
      <Panel
        text="Your payment is being confirmed."
        action={
          <Link
            to={cardDonePath(learner.id) as never}
            className={buttonClass("primary")}
          >
            See your payment
          </Link>
        }
      />
    );
  const open = purchase?.phase === "checkout-open" ? purchase : null;
  const interval = chosen;
  const offer = plans.find((entry) => entry.interval === interval) ?? plans[0]!;
  // Keep an abandoned checkout until the parent picks another plan; the
  // server closes its Stripe session when a new plan is requested.
  const resume = open?.url && open.interval === offer.interval ? safeCheckout(open.url) : null;
  const digest = view.noticeDigest;
  const busy = checkout.isPending || checkout.isSuccess;
  return (
    <>
      <Toast message={checkout.error?.message ?? ""} onDismiss={() => checkout.reset()} />
      <PlanPicker offers={plans} extra={offers.data?.extraOffers} disabled={busy} />
      {/* The direct notice, before the payment that is the parent's
          consent: 16 CFR 312.4(b) (direct notice to the parent) and 312.4(c)
          (its content). Its summary names what is collected and why, with
          the online notice's link (312.4(c)(1)); the rest of the notice
          expands in place, on this page, before the action. */}
      <NoticeSummary notice={view.notice} />
      <div className={styles.actions}>
        {/* The checkout action is the parent's affirmative response, with
            the notice visible above it: 16 CFR 312.5(a)(1), (b)(2)(ii). No
            separate checkbox or screen: none is required. The server keeps
            payment verification. */}
        <p className={styles.fine}>
          By continuing, I confirm I’m {learner.name}’s parent or guardian and
          agree to AMP’s use of their learning information described above and
          the{" "}
          <a href="https://corpora.inc/legal/terms/" target="_blank" rel="noopener noreferrer">
            terms of use
          </a>
          .
        </p>
        <Button
          variant="primary"
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={() => {
            if (resume) {
              opened(session.accountId, { learnerId: learner.id, kind: "enrollment" });
              window.location.assign(resume);
              return;
            }
            track("checkout_start", { interval: offer.interval });
            const requestId = (requests.current[offer.interval] ??= crypto.randomUUID());
            opened(session.accountId, { learnerId: learner.id, kind: "enrollment" });
            checkout.mutate(
              {
                requestId,
                offer,
                noticeDigest: digest,
                renewRequestId: () => (requests.current[offer.interval] = crypto.randomUUID()),
              },
              {
                onSuccess: forgetPlanChoice,
                onError: (error) => {
                  console.error("Checkout didn’t open", error);
                  // A refused request is closed; an ambiguous one may retry.
                  if (error instanceof AppError && ["validation", "permission"].includes(error.kind))
                    delete requests.current[offer.interval];
                },
              },
            );
          }}
        >
          {busy ? "Opening secure checkout…" : resume ? "Resume checkout" : "Continue to Stripe"}
        </Button>
        <p className={styles.fine}>Stripe handles payment. You’ll come back here right after.</p>
      </div>
    </>
  );
}

function safeCheckout(url: string): string | null {
  try {
    return paymentUrl(url, "checkout.stripe.com");
  } catch {
    new AppError("contract", "The checkout link could not be verified.", false).log();
    return null;
  }
}

export function Panel({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className={styles.panel}>
      <p className={styles.text}>{text}</p>
      {action && <div className={styles.actions}>{action}</div>}
    </div>
  );
}

export function Retry({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className={styles.panel}>
      <p className={styles.text} role="alert">
        {error instanceof AppError ? error.message : "This didn’t load. Check your connection, then try again."}
      </p>
      <div className={styles.actions}>
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

/** The plan's place while it loads: the same height as what replaces it. */
export function PlanSkeleton({ notice = false }: { notice?: boolean }) {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Loading plans">
      <span className="amp-skeleton" data-part="plan" />
      <span className="amp-skeleton" data-part="terms" />
      {notice && <span className="amp-skeleton" data-part="notice" />}
      <span className="amp-skeleton" data-part="action" />
    </div>
  );
}
