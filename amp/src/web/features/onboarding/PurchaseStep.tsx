import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useLocation } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import type { EnrollmentPhase } from "../../../billing/stripe/enrollment-contracts";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { Button, buttonClass } from "../../ui/Button";
import { frameCard } from "../../ui/PageFrame";
import { Toast } from "../../ui/Toast";
import {
  enrollmentOptions,
  paymentUrl,
  refreshMeAfter,
  useBillingPortal,
} from "../billing";
import { Progress } from "./Progress";
import styles from "./Start.module.css";

type Shown = EnrollmentPhase | "checking" | "unreachable";
// Action labels stay short enough for one line at 320px with any system
// font: every phase shares the card's size, so a wrap would resize it.
const order: Shown[] = [
  "checking",
  "processing",
  "checkout-open",
  "paid",
  "assigned",
  "expired",
  "payment-inactive",
  "requires-review",
  "unreachable",
];
const tone: Record<Shown, "busy" | "good" | "attention" | "info"> = {
  checking: "busy",
  processing: "busy",
  "checkout-open": "info",
  paid: "good",
  assigned: "good",
  expired: "attention",
  "payment-inactive": "attention",
  "requires-review": "attention",
  unreachable: "attention",
};

/**
 * Stripe's return page. Returning from checkout never confirms payment: this
 * polls the verified enrollment phase. Every phase is drawn in one shared grid
 * cell, so moving between phases never moves or resizes the card.
 */
export function PurchaseStep({ session }: { session: AuthSession }) {
  const params = new URLSearchParams(useLocation().searchStr);
  const left = params.get("billing") === "canceled";
  const enrollment = useQuery(enrollmentOptions(session, !left));
  const portal = useBillingPortal(session);
  const view = enrollment.data;
  const phase = view?.purchase?.phase;
  useEffect(() => {
    if (view) refreshMeAfter(session, view);
  }, [phase]);
  if (view && (!view.purchase || phase === "ready"))
    return <Navigate to="/start/plan" replace />;
  const shown: Shown =
    enrollment.error && !view
      ? "unreachable"
      : !view || phase === "ready" || !phase
        ? "checking"
        : phase;
  const support = view?.notice?.operator.email;
  const resume = view?.purchase?.url ? safe(view.purchase.url) : null;
  const copy: Record<
    Shown,
    { title: string; body: string; action: ReactNode }
  > = {
    checking: {
      title: "Checking your checkout",
      body: "One moment while we look up your payment.",
      action: (
        <Button variant="primary" disabled>
          Checking…
        </Button>
      ),
    },
    processing: {
      title: "Confirming your payment",
      body: "Your bank is confirming the payment. This usually takes a few seconds; keep this page open.",
      action: (
        <Button variant="primary" disabled>
          Confirming payment…
        </Button>
      ),
    },
    "checkout-open": {
      title: left ? "You left checkout" : "Your checkout is still open",
      body: left
        ? "Nothing was charged. Continue where you left off when you’re ready."
        : "Payment isn’t complete yet. Continue checkout to finish.",
      action: resume ? (
        <a className={buttonClass("primary")} href={resume}>
          Resume checkout
        </a>
      ) : (
        <Link to="/start/plan" className={buttonClass("primary")}>
          Back to plans
        </Link>
      ),
    },
    paid: {
      title: "Payment confirmed",
      body: "Thank you. Next, tell us who’s learning. It takes about a minute.",
      action: (
        <Link to="/start/name" className={buttonClass("primary")}>
          Continue
        </Link>
      ),
    },
    assigned: {
      title: "You’re all set",
      body: "Your learner’s plan is active.",
      action: (
        <Link
          to="/$"
          params={{ _splat: "practice" }}
          className={buttonClass("primary")}
        >
          Start practicing
        </Link>
      ),
    },
    expired: {
      title: "This checkout expired",
      body: "No payment was taken. Start again to choose your plan.",
      action: (
        <Link to="/start/plan" className={buttonClass("primary")}>
          Start again
        </Link>
      ),
    },
    "payment-inactive": {
      title: "Payment isn’t active",
      body: "Your enrollment was recorded, but its payment is no longer active, for example after a refund. Open billing to review it.",
      action: (
        <Button
          variant="primary"
          disabled={portal.isPending}
          onClick={() => portal.mutate()}
        >
          Open billing
        </Button>
      ),
    },
    "requires-review": {
      title: "Your purchase needs a review",
      body: `Access can’t start until this payment is reviewed. You won’t be charged again. ${support ? `Email ${support} for help.` : "Contact support for help."}`,
      action: support ? (
        <a className={buttonClass("primary")} href={`mailto:${support}`}>
          Email support
        </a>
      ) : (
        <Button
          variant="primary"
          disabled={portal.isPending}
          onClick={() => portal.mutate()}
        >
          Open billing
        </Button>
      ),
    },
    unreachable: {
      title: "We couldn’t check your payment",
      body:
        enrollment.error instanceof AppError
          ? `${enrollment.error.message} Your payment is safe; checking again won’t charge you.`
          : "Check your connection and try again. Checking again won’t charge you.",
      action: (
        <Button variant="primary" onClick={() => void enrollment.refetch()}>
          Check again
        </Button>
      ),
    },
  };
  return (
    <section
      className={`${frameCard} ${styles.step}`}
      aria-busy={tone[shown] === "busy"}
      data-phase={shown}
    >
      <Toast
        message={portal.error?.message ?? ""}
        onDismiss={() => portal.reset()}
      />
      <Progress step={2} />
      <div className={styles.stack} aria-live="polite">
        {order.map((entry) => (
          <div
            key={entry}
            data-active={entry === shown}
            aria-hidden={entry !== shown}
          >
            <Icon tone={tone[entry]} />
            <h1>{copy[entry].title}</h1>
            <p>{copy[entry].body}</p>
          </div>
        ))}
      </div>
      <div className={`${styles.stack} ${styles.actions}`}>
        {order.map((entry) => (
          <div
            key={entry}
            data-active={entry === shown}
            aria-hidden={entry !== shown}
            inert={entry !== shown}
          >
            {copy[entry].action}
          </div>
        ))}
      </div>
    </section>
  );
}
function Icon({ tone }: { tone: "busy" | "good" | "attention" | "info" }) {
  if (tone === "busy")
    return (
      <span className={styles.icon} aria-hidden="true">
        <span className={styles.spinner} />
      </span>
    );
  return (
    <span
      className={styles.icon}
      data-tone={tone === "info" ? undefined : tone}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24">
        {tone === "good" ? (
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        ) : tone === "attention" ? (
          <path d="M12 7v6m0 4h.01" />
        ) : (
          <path d="M5 12h14m-5-5 5 5-5 5" />
        )}
      </svg>
    </span>
  );
}
function safe(url: string) {
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
