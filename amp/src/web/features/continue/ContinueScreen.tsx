import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { request } from "../../lib/api";
import { analyticsVisitorHeaders, flush } from "../../lib/analytics";
import { meOptions, sessionOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Loading } from "../../ui/Loading";
import { Toast } from "../../ui/Toast";
import {
  offerOptions,
  paymentUrl,
  PlanChoice,
  useClaimEnrollment,
} from "../billing";
import { forgetPlanChoice } from "../../lib/pending-trial";
import { PlanStep } from "../onboarding/PlanStep";
import { VerifyEmailStep } from "../onboarding/VerifyEmailStep";
import {
  continuationPaid,
  readContinuation,
  rememberContinuation,
} from "./memory";
import styles from "./Continue.module.css";

/** `/continue/$learnerId`: "Continue with AMP" for one learner. The plan,
 * then Stripe, then back to the screen it was opened from. A parent who has
 * not given consent pays through the enrollment checkout, whose verified
 * payment is the consent, with the parent notice; a parent with consent, and
 * an adult buying for their own practice, check out for the learner. */
export function ContinueScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  if (!session) return <Navigate to="/sign-in" replace />;
  return <Continue session={session} />;
}

function Continue({ session }: { session: AuthSession }) {
  const { learnerId } = useParams({ strict: false }) as { learnerId: string };
  const search = useSearch({ strict: false }) as { interval?: unknown };
  const interval =
    search.interval === "month" || search.interval === "year"
      ? search.interval
      : undefined;
  const me = useQuery(meOptions(session));
  const account = me.data?.signedIn ? me.data : null;
  const learner = account?.family.learners.find(
    (entry) => entry.id === learnerId && !entry.deletedAt,
  );
  // Opened directly (a link, Family): it returns to where the learner is.
  const remembered = readContinuation(session.accountId);
  const returnTo =
    remembered?.learnerId === learnerId ? remembered.returnTo : "/";
  useEffect(() => {
    if (learner && remembered?.learnerId !== learnerId)
      rememberContinuation({
        accountId: session.accountId,
        learnerId,
        returnTo: learner.adult ? "/practice" : "/",
      });
  }, [learner?.id]);
  if (me.error && !account)
    return (
      <Page>
        <EmptyState
          title="This didn’t load"
          action={
            <Button variant="primary" onClick={() => void me.refetch()}>
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      </Page>
    );
  if (!account) return <Page busy />;
  if (!learner)
    return (
      <Page>
        <EmptyState
          title="This learner isn’t in your account"
          action={
            <Link to="/" className={buttonClass("primary")}>
              Go home
            </Link>
          }
        >
          Choose a learner from your family to continue with AMP.
        </EmptyState>
      </Page>
    );
  // Access is already active: back where they were, with the name to come.
  if (learner.hasAccess) {
    continuationPaid(session.accountId);
    return <Return href={returnTo} />;
  }
  const adult = learner.adult === true;
  const consented = account.consent.status === "active";
  return (
    <Page>
      <header className={styles.head}>
        <h1 className={styles.title}>Continue with AMP</h1>
        <p className={styles.for}>
          {adult ? "For your own practice" : `For ${learner.name}`}
        </p>
      </header>
      {account.unassignedPurchase ? (
        // Paid and no learner holds it yet: it becomes this learner's, never
        // a second checkout.
        <UsePaidPlan
          session={session}
          purchaseId={account.unassignedPurchase.id}
          learner={learner}
          returnTo={returnTo}
        />
      ) : adult || consented ? (
        <LearnerCheckout
          session={session}
          learnerId={learner.id}
          interval={interval}
        />
      ) : account.account.confirmationRequired ? (
        <VerifyEmailStep session={session} me={account} />
      ) : (
        <PlanStep
          session={session}
          embedded
          interval={interval}
          onCheckout={() =>
            rememberContinuation({
              accountId: session.accountId,
              learnerId: learner.id,
              returnTo,
            })
          }
        />
      )}
      <Link
        to={returnTo.split("?")[0] as never}
        className={`${buttonClass("quiet")} ${styles.back}`}
      >
        Not now
      </Link>
    </Page>
  );
}

/** Back to the screen "Continue with AMP" was opened from. */
function Return({ href }: { href: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ href, replace: true });
  }, [href]);
  return <Page busy />;
}

function Page({
  children,
  busy = false,
}: {
  children?: React.ReactNode;
  busy?: boolean;
}) {
  return (
    <main className={styles.page} aria-busy={busy || undefined}>
      {busy ? <Loading /> : children}
    </main>
  );
}

/** A plan already paid for and not yet anyone's: it becomes this learner's. */
function UsePaidPlan({
  session,
  purchaseId,
  learner,
  returnTo,
}: {
  session: AuthSession;
  purchaseId: string;
  learner: SignedInMe["family"]["learners"][number];
  returnTo: string;
}) {
  const claim = useClaimEnrollment(session);
  const [done, setDone] = useState(false);
  if (done) return <Return href={returnTo} />;
  return (
    <section className={styles.panel}>
      <Toast
        message={claim.error?.message ?? ""}
        onDismiss={() => claim.reset()}
      />
      <p className={styles.text}>
        Your plan is paid and isn’t anyone’s yet. It can be {learner.name}’s.
      </p>
      <Button
        variant="primary"
        className={styles.go}
        aria-busy={claim.isPending || undefined}
        disabled={claim.isPending}
        onClick={() =>
          claim.mutate(
            { purchaseId, learnerId: learner.id },
            {
              onSuccess: () => {
                continuationPaid(session.accountId);
                setDone(true);
              },
            },
          )
        }
      >
        Use it for {learner.name}
      </Button>
    </section>
  );
}

const statusSchema = z.object({
  learnerId: z.string(),
  phase: z.enum([
    "ready",
    "licensed",
    "scheduled",
    "checkout-open",
    "checkout-expired",
    "payment-processing",
    "needs-review",
    "awaiting-payment",
    "consent-required",
    "deleted",
  ]),
  interval: z.enum(["year", "month"]).optional(),
  tier: z.enum(["full", "extra"]).optional(),
});

/** The plan and Stripe for one learner, at the price the server sells this
 * learner (an additional child's, or the full price). */
function LearnerCheckout({
  session,
  learnerId,
  interval: initial,
}: {
  session: AuthSession;
  learnerId: string;
  interval?: "year" | "month";
}) {
  const offers = useQuery(offerOptions(session));
  const status = useQuery({
    queryKey: ["account", session.accountId, "billing", "status", learnerId],
    queryFn: ({ signal }) =>
      request(
        `/billing/status/${encodeURIComponent(learnerId)}`,
        statusSchema,
        {
          token: session.token,
          signal,
        },
      ),
  });
  const [interval, setInterval] = useState<"year" | "month">(initial ?? "year");
  const requests = useRef<Partial<Record<"year" | "month", string>>>({});
  const checkout = useMutation({
    mutationFn: async (offer: { id: string; interval: "year" | "month" }) => {
      const send = (requestId: string) =>
        request("/billing/checkout", z.object({ url: z.string() }), {
          token: session.token,
          headers: analyticsVisitorHeaders(),
          body: {
            learnerId,
            requestId,
            offerId: offer.id,
            interval: offer.interval,
          },
        });
      let result: { url: string };
      try {
        result = await send(
          (requests.current[offer.interval] ??= crypto.randomUUID()),
        );
      } catch (error) {
        if (
          !(error instanceof AppError) ||
          error.code !== "checkout_expired_retry_with_new_request"
        )
          throw error;
        result = await send(
          (requests.current[offer.interval] = crypto.randomUUID()),
        );
      }
      let destination: string;
      try {
        destination = paymentUrl(result.url, "checkout.stripe.com");
      } catch {
        const failure = new AppError(
          "contract",
          "The payment page could not be verified. Try again.",
          true,
        );
        failure.log();
        throw failure;
      }
      forgetPlanChoice();
      flush();
      window.location.assign(destination);
      return result;
    },
    onError: (error) => {
      console.error("Checkout didn’t open", error);
      if (error instanceof AppError && error.kind === "validation")
        void status.refetch();
    },
  });
  const phase = status.data?.phase;
  const plans =
    status.data?.tier === "extra" && offers.data?.extraOffers.length
      ? offers.data.extraOffers
      : (offers.data?.offers ?? []);
  const chosen =
    plans.find(
      (offer) => offer.interval === (status.data?.interval ?? interval),
    ) ?? plans[0];
  if (offers.error || status.error)
    return (
      <section className={styles.panel}>
        <p className={styles.text} role="alert">
          {(offers.error ?? status.error) instanceof AppError
            ? (offers.error ?? status.error)!.message
            : "Plans could not be loaded. Try again."}
        </p>
        <Button
          variant="primary"
          className={styles.go}
          onClick={() => {
            void offers.refetch();
            void status.refetch();
          }}
        >
          Try again
        </Button>
      </section>
    );
  if (!offers.data || !status.data)
    return (
      <section className={styles.panel} aria-busy="true">
        <div className={`${styles.skeleton} amp-skeleton`} />
        <Button variant="primary" className={styles.go} disabled aria-busy>
          Continue to secure checkout
        </Button>
      </section>
    );
  if (!offers.data.available || !chosen)
    return (
      <section className={styles.panel}>
        <p className={styles.text}>
          Online checkout isn’t open here. No payment can be taken.
        </p>
      </section>
    );
  const waiting =
    phase === "payment-processing" || phase === "awaiting-payment";
  return (
    <section className={styles.panel}>
      <Toast
        message={checkout.error?.message ?? ""}
        onDismiss={() => checkout.reset()}
      />
      <PlanChoice
        offers={plans}
        interval={chosen.interval}
        disabled={phase === "checkout-open" || checkout.isPending || waiting}
        onChange={(next) => {
          setInterval(next);
          checkout.reset();
        }}
      />

      {waiting ? (
        <>
          <p className={styles.text}>
            Your payment is being confirmed. This usually takes a few seconds.
          </p>
          <Button
            variant="primary"
            className={styles.go}
            aria-busy={status.isFetching || undefined}
            disabled={status.isFetching}
            onClick={() => void status.refetch()}
          >
            Check again
          </Button>
        </>
      ) : phase === "needs-review" || phase === "consent-required" ? (
        <p className={styles.text}>
          This purchase needs a billing review before it can start. Write to
          support@corpora.inc and we’ll sort it out.
        </p>
      ) : (
        <Button
          variant="primary"
          className={styles.go}
          aria-busy={checkout.isPending || checkout.isSuccess || undefined}
          disabled={checkout.isPending || checkout.isSuccess}
          onClick={() => checkout.mutate(chosen)}
        >
          {phase === "checkout-open"
            ? "Continue secure checkout"
            : "Continue to secure checkout"}
        </Button>
      )}
    </section>
  );
}
