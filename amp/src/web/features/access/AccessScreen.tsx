import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Navigate } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { FrameBrand, frameCard, PageFrame } from "../../ui/PageFrame";
import { VerifyEmailStep } from "../onboarding/VerifyEmailStep";
import styles from "../onboarding/Start.module.css";
import giftStyles from "./Access.module.css";

/** Shareable invitation destination. The URL contains no email or bearer capability. */
export function AccessScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const query = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  });
  if (!session)
    return <Navigate to="/sign-in" search={{ return: "access" }} replace />;
  const me =
    query.data?.signedIn && query.data.account.id === session.accountId
      ? query.data
      : null;
  if (me && !me.account.emailVerified)
    return (
      <PageFrame centered>
        <VerifyEmailStep session={session} me={me} invitation />
      </PageFrame>
    );
  const gift = me?.availableAccessGrant;
  const paidSetup = !!me?.unassignedPurchase;
  const active = me?.learners.some((learner) => learner.entitlement.active);
  return (
    <PageFrame centered>
      <section
        className={`${frameCard} ${styles.step} ${giftStyles.card}`}
        aria-busy={query.isPending}
      >
        <FrameBrand expanded />
        {!me ? (
          <>
            <h1>Your AMP access</h1>
            <p role={query.error ? "alert" : "status"}>
              {query.error
                ? "Your access could not be checked. Please try again."
                : "Checking your access…"}
            </p>
            {query.error && (
              <Button variant="primary" onClick={() => void query.refetch()}>
                Try again
              </Button>
            )}
            {query.data?.signedIn === false && (
              <Link
                to="/sign-in"
                search={{ return: "access" }}
                className={buttonClass("primary")}
              >
                Sign in again
              </Link>
            )}
          </>
        ) : (
          <>
            <p className={giftStyles.eyebrow}>
              {gift ? "A gift of learning" : "Your AMP access"}
            </p>
            <h1>
              {gift
                ? `Your ${gift.months === 12 ? "year" : "month"} of AMP is ready.`
                : active
                  ? "You’re ready to learn."
                  : "Let’s find your invitation."}
            </h1>
            <p className={styles.address}>
              {me.account.email ?? "Signed in to your account"}
            </p>
            {gift ? (
              <>
                <div className={giftStyles.offer}>
                  <strong>
                    {gift.months === 12 ? "12 months" : "1 month"}
                    <span>of full access</span>
                  </strong>
                  <p>
                    One learner. Unlimited adaptive practice, lessons, and a
                    growing pathways map.
                  </p>
                </div>
                <p>
                  {paidSetup
                    ? "Your paid plan is ready to assign first. Finish that setup; this gift stays reserved for another learner or later use. Your paid plan’s renewal terms are unchanged."
                    : "Choose who’s learning and finish setup. Your access starts then. No payment details or automatic renewal."}
                </p>
                {gift.claimBy && (
                  <p className={styles.fine}>
                    Activate by{" "}
                    {new Date(gift.claimBy).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    .
                  </p>
                )}
                {active && (
                  <p className={styles.fine}>
                    Existing plans are unchanged. Use this gift for a learner
                    without access, or save it for later.
                  </p>
                )}
                <Link
                  to={
                    me.consent.status === "active"
                      ? "/start/name"
                      : "/start/consent"
                  }
                  search={{ return: "access" }}
                  className={buttonClass("primary")}
                >
                  {paidSetup ? "Finish paid setup →" : "Continue setup →"}
                </Link>
              </>
            ) : active ? (
              <>
                <p>
                  Your learner’s access is active. Continue from where you left
                  off.
                </p>
                <Link
                  to="/$"
                  params={{ _splat: "practice" }}
                  className={buttonClass("primary")}
                >
                  Continue learning →
                </Link>
              </>
            ) : (
              <>
                <p>
                  No complimentary access is waiting for this address. If you
                  were invited, sign in with the email address you shared with
                  us.
                </p>
                <Link
                  to="/$"
                  params={{ _splat: "family/security" }}
                  className={buttonClass("secondary")}
                >
                  Manage your account
                </Link>
              </>
            )}
            {active && gift ? (
              <Link
                to="/$"
                params={{ _splat: "practice" }}
                className={buttonClass("quiet")}
              >
                Continue learning
              </Link>
            ) : !active ? (
              <Link to="/try" className={buttonClass("quiet")}>
                {gift
                  ? "Keep practicing for now"
                  : "Explore the free assessment"}
              </Link>
            ) : null}
          </>
        )}
      </section>
    </PageFrame>
  );
}
