import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { Navigate } from "../../nav/Navigate";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut, type AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { chosenPlan, forgetPlanChoice } from "../../lib/pending-trial";
import { Button, buttonClass } from "../../ui/Button";
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
import {
  PaymentMethodChoice,
  paymentMethodHref,
  type PaymentInterval,
} from "../billing/PaymentMethodChoice";
import { Progress } from "./Progress";
import styles from "./Start.module.css";
import { track } from "../../lib/analytics";

const exitFailed =
  "Sign-out didn’t finish. Check your connection and try again.";
const names = { year: "annual", month: "monthly" } as const;

/**
 * Plan choice with the direct notice and an explicit parent acknowledgement.
 * Paying is the verified parental consent; no learner details are asked for.
 * At `/start/plan` it is a step of its own; inside "Continue with AMP" it is
 * that screen's plan for one learner (`embedded`), whose paid enrollment the
 * checkout return assigns to them.
 */
export function PlanStep({
  session,
  embedded = false,
  interval: initialInterval,
  onCheckout,
  paymentMethods,
}: {
  session: AuthSession;
  /** Inside another screen, which has the heading and frame. */
  embedded?: boolean;
  /** The plan to show first. */
  interval?: "year" | "month";
  /** Just before leaving for Stripe. */
  onCheckout?: () => void;
  /** Continue supplies its learner-aware method choice; embedded forms do not add another. */
  paymentMethods?: (interval: PaymentInterval, busy: boolean) => ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const search = useSearch({ strict: false }) as { interval?: unknown };
  const Frame = embedded ? EmbeddedFrame : CardFrame;
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
  const exit = useMutation({
    mutationFn: signOut,
    onError: () => new AppError("unavailable", exitFailed, true).log(),
  });
  // The plan chosen on the free-trial paywall, if any, stays selected.
  const [interval, chooseInterval] = useState<"year" | "month">(
    () =>
      initialInterval ??
      (search.interval === "month" || search.interval === "year"
        ? search.interval
        : null) ??
      chosenPlan() ??
      "year",
  );
  const requests = useRef<Partial<Record<"year" | "month", string>>>({});
  const [changedPlan, setChangedPlan] = useState(
    !!initialInterval ||
      search.interval === "month" ||
      search.interval === "year" ||
      !!chosenPlan(),
  );
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
  const methodChoice = (selected: PaymentInterval) =>
    paymentMethods?.(selected, checkout.isPending || checkout.isSuccess) ??
    (!embedded ? (
      <PaymentMethodChoice
        value="card"
        disabled={checkout.isPending || checkout.isSuccess}
        onChange={(method) => {
          if (method === "education-funds")
            void navigate({ href: paymentMethodHref(method, selected) });
        }}
      />
    ) : null);
  const failed =
    enrollment.error ?? (available ? offers.error : emailPlus.error);
  if (failed)
    return (
      <Frame key="error">
        {!embedded && <h1>Choose your plan</h1>}
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
      </Frame>
    );
  if (available === false && emailPlus.data)
    return emailPlus.data.available ? (
      <Frame key="email-plus">
        {methodChoice(interval)}
        <h1>Confirm by email first</h1>
        <p>
          Card enrollment isn’t available for this service. Confirm parent
          consent by email instead. Then add your learner and choose a plan.
        </p>
        <div className={styles.actions}>
          <Link
            to="/$"
            params={{ _splat: "consent" }}
            className={buttonClass("primary")}
          >
            Continue with email
          </Link>
        </div>
      </Frame>
    ) : (
      <Frame key="unavailable">
        <Toast message={exit.error ? exitFailed : ""} onDismiss={exit.reset} />
        {methodChoice(interval)}
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
      </Frame>
    );
  const notice = enrollment.data?.notice;
  const digest = enrollment.data?.noticeDigest;
  const plans = offers.data?.offers ?? [];
  if (!notice || !digest || !plans.length)
    return (
      <Frame key="loading" busy>
        {!embedded && (
          <>
            <h1>Choose your plan</h1>
            <p>
              Adaptive practice, lessons and printable books for one learner.
            </p>
          </>
        )}
        <div
          className={`${styles.skeleton} amp-skeleton`}
          aria-label="Loading plans"
        >
          <span style={{ height: 82 }} />
          <span style={{ height: 112 }} />
          <span style={{ height: 66 }} />
          <span style={{ height: 48 }} />
        </div>
      </Frame>
    );
  // Keep an abandoned plan selected until the parent chooses another. The
  // server safely closes its open Stripe session when a new plan is requested.
  const pending = phase === "checkout-open" ? purchase : null;
  const resume = pending?.url ? safeCheckout(pending.url) : null;
  const chosen = changedPlan ? interval : (pending?.interval ?? interval);
  const open = resume && pending?.interval === chosen ? pending : null;
  const offer = plans.find((entry) => entry.interval === chosen) ?? plans[0]!;
  return (
    <Frame key="ready">
      <Toast
        message={checkout.error?.message ?? ""}
        onDismiss={() => checkout.reset()}
      />
      {!embedded && (
        <>
          <h1>Choose your plan</h1>
          <p>Adaptive practice, lessons and printable books for one learner.</p>
        </>
      )}
      {methodChoice(offer.interval)}
      <PlanChoice
        offers={plans}
        extra={offers.data?.extraOffers}
        interval={offer.interval}
        disabled={checkout.isPending}
        onChange={(next) => {
          track("plan_select", { interval: next });
          chooseInterval(next);
          const query = new URLSearchParams(location.searchStr);
          query.set("interval", next);
          void navigate({
            href: `${location.pathname}?${query}`,
            replace: true,
          });
          setChangedPlan(true);
          delete requests.current[next];
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
              onClick={() => {
                if (resume) {
                  onCheckout?.();
                  window.location.assign(resume);
                }
              }}
            >
              Resume checkout
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* The checkout action is the affirmative response, with the notice
              visible before it. No separate checkbox is required by
              16 CFR 312.5(a)(1), (b)(2)(ii); payment verification stays server-owned. */}
          <p className={styles.fine}>
            By continuing, I confirm I’m this learner’s parent or guardian and
            agree to AMP’s use of their learning information described above and
            the{" "}
            <a
              href="https://corpora.inc/legal/terms/"
              target="_blank"
              rel="noopener noreferrer"
            >
              terms of use
            </a>
            .
          </p>
          <div className={styles.actions}>
            <Button
              variant="primary"
              disabled={checkout.isPending}
              onClick={() => {
                track("checkout_start", { interval: offer.interval });
                const requestId = (requests.current[offer.interval] ??=
                  crypto.randomUUID());
                onCheckout?.();
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
                      }
                    },
                  },
                );
              }}
            >
              {checkout.isPending || checkout.isSuccess
                ? "Opening secure checkout…"
                : "Continue to Stripe"}
            </Button>
          </div>
          <p className={styles.fine}>
            {embedded
              ? "Stripe handles payment. You’ll come back here right after."
              : "Stripe handles payment. You’ll add your learner right after."}
          </p>
        </>
      )}
    </Frame>
  );
}

function CardFrame({
  children,
  busy,
}: {
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <section
      className={`${frameCard} ${styles.step}`}
      aria-busy={busy || undefined}
    >
      <FrameBrand expanded />
      <Progress step={1} />
      {children}
    </section>
  );
}
function EmbeddedFrame({
  children,
  busy,
}: {
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <div className={styles.step} aria-busy={busy || undefined}>
      {children}
    </div>
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
