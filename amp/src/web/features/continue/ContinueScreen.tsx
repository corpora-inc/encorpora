import { childPagePath } from "../family/api";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { RootLink } from "../../nav/root";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { Navigate } from "../../nav/Navigate";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { request } from "../../lib/api";
import { analyticsVisitorHeaders, flush } from "../../lib/analytics";
import { meOptions, refreshMe, sessionOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { LoadingScreen } from "../../ui/LoadingScreen";
import { Toast } from "../../ui/Toast";
import {
  offerOptions,
  paymentUrl,
  PlanChoice,
  useClaimEnrollment,
} from "../billing";
import { forgetPlanChoice } from "../../lib/pending-trial";
import {
  PaymentMethodChoice,
  paymentMethodHref,
  type PaymentInterval,
} from "../billing/PaymentMethodChoice";
import { PlanStep } from "../onboarding/PlanStep";
import {
  continuationPaid,
  readContinuation,
  rememberContinuation,
} from "./memory";
import { Included, RecapLine } from "./Recap";
import { Page } from "../../ui/Page";
import { PageHeader } from "../../ui/PageHeader";
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
  // Opened directly (a link, a new tab): it returns to where the learner
  // is, a child to their own page in their family.
  const remembered = readContinuation(session.accountId);
  const page = useQuery({
    queryKey: [
      "account",
      session.accountId,
      "families",
      "child-page",
      learnerId,
    ],
    queryFn: () => childPagePath(session, learnerId),
    enabled: !!learner && !learner.adult && remembered?.learnerId !== learnerId,
  });
  const home = learner?.adult ? "/practice" : (page.data ?? "/");
  const returnTo =
    remembered?.learnerId === learnerId ? remembered.returnTo : home;
  useEffect(() => {
    if (
      learner &&
      remembered?.learnerId !== learnerId &&
      (learner.adult || !page.isPending)
    )
      rememberContinuation({
        accountId: session.accountId,
        learnerId,
        returnTo: home,
      });
  }, [learner?.id, page.isPending, home]);
  if (me.error && !account)
    return (
      <ContinuePage>
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
      </ContinuePage>
    );
  if (!account) return <ContinuePage busy />;
  if (!learner)
    return (
      <ContinuePage>
        <EmptyState
          title="This learner isn’t in your account"
          action={
            <RootLink className={buttonClass("primary")}>Go home</RootLink>
          }
        >
          Choose a learner from your family to continue with AMP.
        </EmptyState>
      </ContinuePage>
    );
  // Access is already active: back where they were, with the name to come.
  if (learner.hasAccess) {
    continuationPaid(session.accountId);
    return <Return href={returnTo} />;
  }
  // A practice profile has no plan of its own (docs/families.md). The
  // family's plan, for its first child without access, covers that child,
  // the adult and every profile, so that is what continues; the adult's own
  // plan only for an account with no children.
  const pausedChild = learner.simulation
    ? account.family.learners.find(
        (entry) => !entry.adult && !entry.deletedAt && !entry.hasAccess,
      )
    : undefined;
  if (pausedChild)
    return (
      <ForChild
        session={session}
        learnerId={pausedChild.id}
        returnTo={returnTo}
        interval={interval}
      />
    );
  if (learner.simulation)
    return (
      <ContinuePage
        subtitle="For your own practice"
        note={
          <p className={styles.covers}>
            It covers practicing as {learner.name} and every level you try.
          </p>
        }
        aside={<Included forChild={false} />}
      >
        <OwnPracticeCheckout
          session={session}
          account={account}
          interval={interval}
          returnTo={returnTo}
        />
      </ContinuePage>
    );
  const adult = learner.adult === true;
  const consented = account.consent.status === "active";
  return (
    <ContinuePage
      subtitle={adult ? "For your own practice" : `For ${learner.name}`}
      aside={
        <>
          <RecapLine learnerId={learner.id} />
          <Included forChild={!adult} />
        </>
      }
    >
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
      ) : (
        <PlanStep
          session={session}
          embedded
          interval={interval}
          paymentMethods={(selected, busy) => (
            <CardPaymentMethods
              learnerId={learner.id}
              interval={selected}
              disabled={busy}
            />
          )}
          onCheckout={() =>
            rememberContinuation({
              accountId: session.accountId,
              learnerId: learner.id,
              returnTo,
            })
          }
        />
      )}
    </ContinuePage>
  );
}

/** Continue with AMP for a child of the family instead, coming back to where
 * the profile's pause was: that plan covers the adult and every profile too. */
function ForChild({
  session,
  learnerId,
  returnTo,
  interval,
}: {
  session: AuthSession;
  learnerId: string;
  returnTo: string;
  interval?: "year" | "month";
}) {
  const navigate = useNavigate();
  useEffect(() => {
    rememberContinuation({ accountId: session.accountId, learnerId, returnTo });
    void navigate({
      to: "/continue/$learnerId",
      params: { learnerId },
      search: interval ? ({ interval } as never) : undefined,
      replace: true,
    });
  }, [learnerId]);
  return <ContinuePage busy />;
}

/** The adult's own practice, bought for a profile's sake by an account with
 * no children: the same plan and checkout as their own "Continue with AMP".
 * Without a learner of their own yet, it starts only when they check out. */
function OwnPracticeCheckout({
  session,
  account,
  interval,
  returnTo,
}: {
  session: AuthSession;
  account: SignedInMe;
  interval?: "year" | "month";
  returnTo: string;
}) {
  const own = account.family.learners.find(
    (entry) => entry.adult && !entry.simulation && !entry.deletedAt,
  );
  // Starting is idempotent on the server: a second start returns the same.
  const startOwn = async () => {
    const { learnerId } = await request(
      "/me/practice",
      z.object({ learnerId: z.string() }),
      {
        token: session.token,
        body: {
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "America/New_York",
        },
      },
    );
    await refreshMe(session);
    return learnerId;
  };
  if (own?.hasAccess) {
    continuationPaid(session.accountId);
    return <Return href={returnTo} />;
  }
  return account.unassignedPurchase ? (
    <UsePaidPlan
      session={session}
      purchaseId={account.unassignedPurchase.id}
      learner={own ?? { id: null, name: "your own practice" }}
      prepare={startOwn}
      returnTo={returnTo}
    />
  ) : (
    <LearnerCheckout
      session={session}
      learnerId={own?.id ?? null}
      prepare={startOwn}
      interval={interval}
    />
  );
}

/** Back to the screen "Continue with AMP" was opened from. */
function Return({ href }: { href: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ href, replace: true });
  }, [href]);
  return <ContinuePage busy />;
}

/**
 * Continue's page: the way back, "Choose your plan" and who it is for, then
 * what they did and get beside the plan (one column on phones, the plan
 * last).
 */
function ContinuePage({
  children,
  busy = false,
  subtitle,
  note,
  aside,
}: {
  children?: React.ReactNode;
  busy?: boolean;
  subtitle?: string;
  /** A line under the header, before the plan. */
  note?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  if (busy || !subtitle)
    return (
      <Page aria-busy={busy || undefined}>
        {busy ? <LoadingScreen overlay /> : children}
      </Page>
    );
  return (
    <Page>
      <PageHeader title="Choose your plan" subtitle={subtitle} />
      {note}
      <div className={styles.columns}>
        <div className={styles.checkout}>{children}</div>
        {aside && <div className={styles.aside}>{aside}</div>}
      </div>
    </Page>
  );
}
/** A plan already paid for and not yet anyone's: it becomes this learner's. */
function UsePaidPlan({
  session,
  purchaseId,
  learner,
  prepare,
  returnTo,
}: {
  session: AuthSession;
  purchaseId: string;
  /** No id yet: the adult's own learner, started by `prepare` on the click. */
  learner: { id: string | null; name: string };
  prepare?: () => Promise<string>;
  returnTo: string;
}) {
  const claim = useClaimEnrollment(session);
  const [preparing, setPreparing] = useState(false);
  const [failed, setFailed] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <Return href={returnTo} />;
  return (
    <section className={styles.panel}>
      <Toast
        message={claim.error?.message ?? failed}
        onDismiss={() => {
          claim.reset();
          setFailed("");
        }}
      />
      <p className={styles.text}>
        {learner.id
          ? `Your plan is paid and isn’t anyone’s yet. It can be ${learner.name}’s.`
          : "Your plan is paid and isn’t anyone’s yet. It can be for your own practice."}
      </p>
      <Button
        variant="primary"
        className={styles.go}
        aria-busy={claim.isPending || preparing || undefined}
        disabled={claim.isPending || preparing}
        onClick={async () => {
          let learnerId = learner.id;
          if (!learnerId) {
            setPreparing(true);
            try {
              learnerId = await prepare!();
            } catch (error) {
              console.error("Own practice did not start", error);
              setFailed(
                "Your own practice didn’t start. Check your connection, then try again.",
              );
              return;
            } finally {
              setPreparing(false);
            }
          }
          claim.mutate(
            { purchaseId, learnerId },
            {
              onSuccess: () => {
                continuationPaid(session.accountId);
                setDone(true);
              },
            },
          );
        }}
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

function CardPaymentMethods({
  learnerId,
  interval,
  disabled = false,
}: {
  learnerId: string | null;
  interval: PaymentInterval;
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <PaymentMethodChoice
      value="card"
      disabled={disabled}
      onChange={(method) => {
        if (method === "education-funds")
          void navigate({
            href: paymentMethodHref(method, interval, learnerId),
          });
      }}
    />
  );
}

/** The plan and Stripe for one learner, at the price the server sells this
 * learner (an additional child's, or the full price). */
function LearnerCheckout({
  session,
  learnerId,
  prepare,
  interval: initial,
}: {
  session: AuthSession;
  /** Null: the adult's own learner, not started yet. `prepare` starts it
   * when they check out, and its plan is always the full price. */
  learnerId: string | null;
  prepare?: () => Promise<string>;
  interval?: "year" | "month";
}) {
  const navigate = useNavigate();
  const offers = useQuery(offerOptions(session));
  const fetched = useQuery({
    queryKey: ["account", session.accountId, "billing", "status", learnerId],
    enabled: !!learnerId,
    queryFn: ({ signal }) =>
      request(
        `/billing/status/${encodeURIComponent(learnerId!)}`,
        statusSchema,
        {
          token: session.token,
          signal,
        },
      ),
  });
  const status = learnerId
    ? fetched
    : {
        ...fetched,
        data: {
          learnerId: "",
          phase: "ready",
          tier: "full",
        } as z.infer<typeof statusSchema>,
        error: null,
      };
  const [interval, setInterval] = useState<"year" | "month" | undefined>(
    initial,
  );
  const requests = useRef<Partial<Record<"year" | "month", string>>>({});
  const checkout = useMutation({
    mutationFn: async (offer: { id: string; interval: "year" | "month" }) => {
      const buyer = learnerId ?? (await prepare!());
      const send = (requestId: string) =>
        request("/billing/checkout", z.object({ url: z.string() }), {
          token: session.token,
          headers: analyticsVisitorHeaders(),
          body: {
            learnerId: buyer,
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
      if (learnerId && error instanceof AppError && error.kind === "validation")
        void fetched.refetch();
    },
  });
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      checkout.reset();
      if (learnerId) void fetched.refetch();
    };
    addEventListener("pageshow", restored);
    return () => removeEventListener("pageshow", restored);
  }, [session.accountId, learnerId]);
  const phase = status.data?.phase;
  const plans =
    status.data?.tier === "extra" && offers.data?.extraOffers.length
      ? offers.data.extraOffers
      : (offers.data?.offers ?? []);
  const chosen =
    plans.find(
      (offer) =>
        offer.interval === (interval ?? status.data?.interval ?? "year"),
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
            if (learnerId) void fetched.refetch();
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
          Continue to Stripe
        </Button>
      </section>
    );
  const canChooseMethod =
    phase === "ready" ||
    phase === "checkout-open" ||
    phase === "checkout-expired";
  const methods = canChooseMethod ? (
    <CardPaymentMethods
      learnerId={learnerId}
      interval={chosen?.interval ?? interval ?? "year"}
      disabled={checkout.isPending || checkout.isSuccess}
    />
  ) : null;
  if (phase === "licensed" || phase === "scheduled")
    return (
      <section className={styles.panel}>
        <p className={styles.text}>
          {phase === "licensed"
            ? "Your plan is active."
            : "Your next plan is already paid for."}
        </p>
        <Link to="/account/billing" className={buttonClass("primary")}>
          View your plan
        </Link>
      </section>
    );
  if (!offers.data.available || !chosen)
    return (
      <section className={styles.panel}>
        {methods}
        <p className={styles.text}>Card checkout isn’t available here.</p>
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
      {methods}
      <PlanChoice
        offers={plans}
        interval={chosen.interval}
        disabled={checkout.isPending || waiting}
        onChange={(next) => {
          setInterval(next);
          if (learnerId)
            void navigate({
              href: paymentMethodHref("card", next, learnerId),
              replace: true,
            });
          delete requests.current[next];
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
          {phase === "checkout-open" &&
          chosen.interval === status.data?.interval
            ? "Resume checkout"
            : "Continue to Stripe"}
        </Button>
      )}
    </section>
  );
}
