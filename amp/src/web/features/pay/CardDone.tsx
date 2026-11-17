import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { trackOnce } from "../../lib/analytics";
import { invalidateAccount } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { enrollmentOptions, useClaimEnrollment } from "../billing";
import { useMetaPurchaseContext } from "../privacy/useMetaPurchaseContext";
import { purchaseStatusOptions } from "./api";
import { checkoutKind, Panel } from "./CardPanel";
import { usePayAddress, usePayClose } from "./context";
import type { PayLearner } from "./context";
import {
  payState,
  usePayStore,
  useCheckoutReturn,
  type CheckoutKind,
} from "./store";
import styles from "./Pay.module.css";
import { useSession } from "../../lib/session";
import { useSettingsHref } from "../spaces/settings-hub";

type Learner = PayLearner;

/** What the confirmation shows: access, still confirming, or what's wrong. */
export type CardOutcome =
  | { state: "active" }
  | { state: "confirming" }
  | { state: "open"; resume: boolean }
  | { state: "review"; text: string }
  | { state: "failed"; error: unknown };

/**
 * Back from Stripe. Returning never confirms payment: this follows the
 * server's verified state until the learner has access (`/me`), and for an
 * enrollment checkout, connects the paid plan to this learner first.
 */
export function useCardOutcome(
  session: AuthSession,
  me: SignedInMe,
  learner: Learner,
): { kind: CheckoutKind; outcome: CardOutcome; retry: () => void } {
  const returned = useCheckoutReturn(session.accountId, learner.id);
  const kind = returned?.kind ?? checkoutKind(me, learner);
  const active = !!learner.hasAccess;
  const status = useQuery({
    ...purchaseStatusOptions(session, learner.id, !active),
    enabled: kind === "learner" && !learner.simulation,
  });
  const enrollment = useQuery({
    ...enrollmentOptions(session, !active),
    enabled: kind === "enrollment",
  });
  const claim = useClaimEnrollment(session);
  const claimed = useRef<string | null>(null);
  const purchase = enrollment.data?.purchase;
  const learnerPhase = status.data?.phase;
  // A verified result changes what `/me` says: refresh it once it lands.
  const settled =
    learnerPhase === "licensed" ||
    learnerPhase === "scheduled" ||
    purchase?.phase === "assigned";
  useEffect(() => {
    if (settled && !active) void invalidateAccount(session.accountId);
  }, [settled, active]);
  // The paid enrollment becomes this learner's: once, for this purchase.
  useEffect(() => {
    if (kind !== "enrollment" || purchase?.phase !== "paid") return;
    if (claimed.current === purchase.id) return;
    claimed.current = purchase.id;
    claim.mutate(
      { purchaseId: purchase.id, learnerId: learner.id },
      {
        onError: (error) =>
          console.error("The paid plan wasn’t assigned", error),
      },
    );
  }, [kind, purchase?.phase, purchase?.id]);
  useMetaPurchaseContext(
    session,
    purchase?.id,
    purchase?.phase,
    kind === "enrollment" ? me.family.metaPurchaseMeasurement : undefined,
    returned?.checkoutId ?? null,
    returned ? "processing" : null,
  );
  useEffect(() => {
    if (returned)
      trackOnce(
        `checkout_return.${returned.checkoutId}.processing`,
        "checkout_return",
        {
          outcome: "success",
        },
      );
  }, [returned?.checkoutId]);
  const retry = () => {
    claimed.current = null;
    claim.reset();
    void status.refetch();
    void enrollment.refetch();
  };
  if (active) return { kind, outcome: { state: "active" }, retry };
  const error =
    claim.error ?? (kind === "learner" ? status.error : enrollment.error);
  if (error) return { kind, outcome: { state: "failed", error }, retry };
  const phase = kind === "learner" ? learnerPhase : purchase?.phase;
  if (
    phase === "checkout-open" ||
    phase === "ready" ||
    phase === "checkout-expired" ||
    phase === "expired"
  )
    return {
      kind,
      outcome: { state: "open", resume: phase === "checkout-open" },
      retry,
    };
  if (
    phase === "needs-review" ||
    phase === "requires-review" ||
    phase === "consent-required"
  )
    return {
      kind,
      outcome: {
        state: "review",
        text: "This payment needs a billing review before access can start. You won’t be charged again. Write to support@corpora.inc and we’ll sort it out.",
      },
      retry,
    };
  if (phase === "payment-inactive")
    return {
      kind,
      outcome: {
        state: "review",
        text: "This payment is no longer active, for example after a refund. Billing has the details.",
      },
      retry,
    };
  return { kind, outcome: { state: "confirming" }, retry };
}

/** The confirmation's body for each outcome. */
export function CardDone({
  learner,
  outcome,
  retry,
}: {
  learner: Learner;
  outcome: CardOutcome;
  retry: () => void;
}) {
  const session = useSession();
  const open = usePayStore((state) => state.open);
  const choose = usePayStore((state) => state.choose);
  const { origin, base } = usePayAddress();
  const close = usePayClose();
  const navigate = useNavigate();
  const billing = useSettingsHref("billing");
  if (outcome.state === "active")
    return (
      <div className={styles.panel}>
        <p className={styles.text}>
          Payment received. A receipt is in your email and in Billing.
        </p>
        <div className={styles.actions}>
          <Button
            variant="primary"
            // Back where paying started (the practice the pause was on,
            // recorded when "Continue with AMP" opened this overlay), else
            // the screen behind it. What remains is the optional name
            // (AfterPurchase), offered there.
            onClick={() => {
              const opener = payState(session.accountId).opener;
              const back =
                opener?.learnerId === learner.id ? opener.returnTo : origin;
              open(session.accountId, {
                learnerId: learner.id,
                returnTo: back,
                stage: "naming",
              });
              if (back === origin) close();
              else void navigate({ href: back, replace: true });
            }}
          >
            Done
          </Button>
        </div>
      </div>
    );
  if (outcome.state === "open")
    return (
      <Panel
        text="Payment isn’t complete yet. Nothing was charged."
        action={
          <Link
            to={base as never}
            replace
            className={buttonClass("primary")}
            onClick={() =>
              choose(session.accountId, learner.id, { method: "card" })
            }
          >
            {outcome.resume ? "Return to checkout" : "Choose a plan"}
          </Link>
        }
      />
    );
  if (outcome.state === "review")
    return (
      <Panel
        text={outcome.text}
        action={
          <Link to={billing as never} className={buttonClass("primary")}>
            View billing
          </Link>
        }
      />
    );
  if (outcome.state === "failed")
    return (
      <div className={styles.panel}>
        <p className={styles.text} role="alert">
          {outcome.error instanceof AppError
            ? `${outcome.error.message} Your payment is safe; checking again won’t charge you.`
            : "We couldn’t check your payment. Your payment is safe; checking again won’t charge you."}
        </p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={retry}>
            Check again
          </Button>
        </div>
      </div>
    );
  return (
    <div className={styles.panel} aria-busy="true">
      <p className={styles.text}>
        Your bank is confirming the payment. This usually takes a few seconds.
      </p>
      <div className={styles.actions}>
        <Button variant="primary" disabled aria-busy>
          Confirming payment…
        </Button>
      </div>
    </div>
  );
}
