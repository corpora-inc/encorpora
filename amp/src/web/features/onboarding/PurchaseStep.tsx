import { useMetaPurchaseContext } from "../privacy/useMetaPurchaseContext";
import type { PurchaseMeasurement } from "../../../advertising/permission-contracts";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import type { EnrollmentPhase } from "../../../billing/stripe/enrollment-contracts";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { Button, buttonClass } from "../../ui/Button";
import { FrameBrand, frameCard } from "../../ui/PageFrame";
import { Toast } from "../../ui/Toast";
import {
  enrollmentOptions,
  paymentUrl,
  refreshMeAfter,
  useBillingPortal,
  useClaimEnrollment,
} from "../billing";
import { continuationPaid, readContinuation } from "../continue/memory";
import { Progress } from "./Progress";
import styles from "./Start.module.css";
import { trackOnce } from "../../lib/analytics";

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
export function PurchaseStep({
  session,
  metaPermission,
}: {
  session: AuthSession;
  metaPermission?: PurchaseMeasurement;
}) {
  const params = new URLSearchParams(useLocation().searchStr);
  const left = params.get("billing") === "canceled";
  const returned = params.get("billing");
  const returnedFrom = params.get("purchase");
  useEffect(() => {
    if (returnedFrom && (returned === "processing" || returned === "canceled"))
      trackOnce(
        `checkout_return.${returnedFrom}.${returned}`,
        "checkout_return",
        {
          outcome: returned === "processing" ? "success" : "cancel",
        },
      );
  }, [returned, returnedFrom]);
  const enrollment = useQuery(enrollmentOptions(session, !left));
  const portal = useBillingPortal(session);
  const navigate = useNavigate();
  const view = enrollment.data;
  const phase = view?.purchase?.phase;
  // "Continue with AMP" for one learner: the paid plan becomes theirs, and
  // they go back to the screen it was opened from.
  const continuation = readContinuation(session.accountId);
  const claim = useClaimEnrollment(session);
  const claimed = useRef<string | null>(null);
  const back = (target: string) =>
    void navigate({ href: target, replace: true });
  useEffect(() => {
    if (!continuation || !view?.purchase) return;
    if (phase === "assigned") {
      continuationPaid(session.accountId);
      back(continuation.returnTo);
    } else if (phase === "paid" && claimed.current !== view.purchase.id) {
      claimed.current = view.purchase.id;
      claim.mutate(
        { purchaseId: view.purchase.id, learnerId: continuation.learnerId },
        {
          onSuccess: () => {
            continuationPaid(session.accountId);
            back(continuation.returnTo);
          },
          onError: (error) =>
            console.error("The paid plan wasn’t assigned", error),
        },
      );
    }
  }, [phase, view?.purchase?.id]);
  const plans = continuation
    ? ({
        to: "/continue/$learnerId",
        params: { learnerId: continuation.learnerId },
      } as const)
    : ({ to: "/start/plan" } as const);
  useMetaPurchaseContext(
    session,
    view?.purchase?.id,
    phase,
    metaPermission,
    returnedFrom,
    returned,
  );
  useEffect(() => {
    if (view) refreshMeAfter(session, view);
  }, [phase]);
  if (view && (!view.purchase || phase === "ready"))
    return <Navigate {...plans} replace />;
  // Leaving Stripe without paying returns to the plan with the same plan
  // selected, and says nothing more.
  if (left && view?.purchase && phase === "checkout-open")
    return (
      <Navigate
        {...plans}
        search={{ interval: view.purchase.interval }}
        replace
      />
    );
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
      title: "Your checkout is still open",
      body: "Payment isn’t complete yet. Continue checkout to finish.",
      action: resume ? (
        <a className={buttonClass("primary")} href={resume}>
          Resume checkout
        </a>
      ) : (
        <Link {...plans} className={buttonClass("primary")}>
          Back to plans
        </Link>
      ),
    },
    paid: continuation
      ? {
          title: "Payment confirmed",
          body: claim.isError
            ? `${claim.error.message} Your payment is safe.`
            : "Thank you. One moment while access starts.",
          action: claim.isError ? (
            <Button
              variant="primary"
              onClick={() => {
                claimed.current = null;
                claim.reset();
                void enrollment.refetch();
              }}
            >
              Try again
            </Button>
          ) : (
            <Button variant="primary" disabled aria-busy>
              Starting access…
            </Button>
          ),
        }
      : {
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
        <Link {...plans} className={buttonClass("primary")}>
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
      <FrameBrand expanded />
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
