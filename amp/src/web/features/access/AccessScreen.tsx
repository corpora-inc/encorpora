import { useQuery } from "@tanstack/react-query";
import { RootLink } from "../../nav/root";
import { Link, useNavigate } from "@tanstack/react-router";
import { authReturn } from "../../app/auth-links";
import { meOptions } from "../../lib/query";
import { useSession } from "../../lib/session";
import { Button, buttonClass } from "../../ui/Button";
import { FrameBrand, frameCard, PageFrame } from "../../ui/PageFrame";
import { Toast } from "../../ui/Toast";
import { VerifyEmailStep } from "../onboarding/VerifyEmailStep";
import styles from "../onboarding/Start.module.css";
import giftStyles from "./Access.module.css";
import { useActivateGift } from "./api";
import { useStartOwnPractice } from "../me/api";

/** Shareable invitation destination. The URL contains no email or bearer capability. */
export function AccessScreen() {
  // Signed out, the route's guard signs in and comes back here.
  const session = useSession();
  const query = useQuery(meOptions(session));
  const claim = useActivateGift(session);
  const startOwn = useStartOwnPractice(session);
  const navigate = useNavigate();
  const me =
    query.data?.signedIn && query.data.account.id === session.accountId
      ? query.data
      : null;
  // A gift is found by its recipient's address: confirming it binds the
  // gift to this account. It is not consent.
  if (me && !me.account.emailVerified)
    return (
      <PageFrame>
        <VerifyEmailStep me={me} invitation />
      </PageFrame>
    );
  const gift = me?.availableAccessGrant;
  const family = gift?.covers === "family";
  const term = gift?.months === 12 ? "year" : "month";
  const paidSetup = !!me?.unassignedPurchase;
  const active = me?.learners.some((learner) => learner.entitlement.active);
  // A family gift starts here for every child at once; with no child yet,
  // adding the first one starts it. Access is not collection: no consent.
  const startFamily = family && !paidSetup && (me?.learners.length ?? 0) > 0;
  // A one-learner gift may be the account holder's own: an adult uses it for
  // herself, with no child to set up (starting her own learner if she has
  // none). Not when her own learner already has access: a gift neither
  // replaces nor stacks on it.
  const own = me?.adultPractice?.learner ?? null;
  const ownLicensed = !!me?.family.learners.some(
    (learner) =>
      learner.adult &&
      !learner.simulation &&
      !learner.deletedAt &&
      learner.access.some(
        (grant) =>
          grant.status === "active" && Date.parse(grant.endsAt) > Date.now(),
      ),
  );
  const forMe = !!gift && !family && !paidSetup && !ownLicensed;
  const hasChildren = (me?.learners.length ?? 0) > 0;
  // An adult on her own (her own learner, no children) uses it for herself
  // first; anyone else keeps setting it up as before, with "for me" beside.
  const meFirst = forMe && !!own && !hasChildren;
  const busy = claim.isPending || startOwn.isPending;
  const activateForMe = async () => {
    if (!gift) return;
    try {
      const learnerId = own?.id ?? (await startOwn.mutateAsync(undefined));
      claim.mutate(
        { id: gift.id, learnerId },
        {
          onSuccess: () =>
            void navigate({
              to: "/$",
              params: { _splat: "practice" },
              replace: true,
            }),
        },
      );
    } catch (reason) {
      console.error("Own learner did not start for a gift", reason);
    }
  };
  const forMeButton = (variant: "primary" | "secondary") => (
    <Button
      variant={variant}
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={() => void activateForMe()}
    >
      Use it for me
    </Button>
  );
  return (
    <PageFrame>
      <section
        className={`${frameCard} ${styles.step} ${giftStyles.card}`}
        aria-busy={query.isPending}
      >
        <FrameBrand expanded />
        <Toast
          message={claim.error?.message ?? startOwn.error?.message ?? ""}
          onDismiss={() => {
            claim.reset();
            startOwn.reset();
          }}
        />
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
                {...authReturn("sign-in", "access")}
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
              {family
                ? `A ${term} of AMP for your whole family.`
                : gift
                  ? `Your ${term} of AMP is ready.`
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
                    {family
                      ? "Every learner in your family, including anyone you add later."
                      : "One learner."}{" "}
                    Unlimited adaptive practice, lessons, and a growing pathways
                    map.
                  </p>
                </div>
                <p>
                  {paidSetup
                    ? `Your paid plan is ready to assign first. Finish that setup; this gift stays reserved for ${family ? "" : "another learner or "}later use. Your paid plan’s renewal terms are unchanged.`
                    : startFamily
                      ? "It starts for everyone at once, when you begin. No payment details or automatic renewal."
                      : meFirst
                        ? "Use it for yourself, or set it up for your child. Access starts then. No payment details or automatic renewal."
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
                    {family
                      ? "Existing plans are unchanged."
                      : "Existing plans are unchanged. Use this gift for a learner without access, or save it for later."}
                  </p>
                )}
                {startFamily ? (
                  <Button
                    variant="primary"
                    disabled={claim.isPending}
                    onClick={() =>
                      claim.mutate(
                        { id: gift.id },
                        {
                          onSuccess: () =>
                            void navigate({
                              to: "/$",
                              params: { _splat: "practice" },
                              replace: true,
                            }),
                        },
                      )
                    }
                  >
                    Start your family’s {term} →
                  </Button>
                ) : (
                  <>
                    {meFirst && forMeButton("primary")}
                    <Link
                      to="/start/name"
                      className={buttonClass(meFirst ? "secondary" : "primary")}
                    >
                      {paidSetup
                        ? "Finish paid setup →"
                        : meFirst
                          ? "Set it up for a child"
                          : "Continue setup →"}
                    </Link>
                    {forMe && !meFirst && forMeButton("secondary")}
                  </>
                )}
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
                  params={{ _splat: "account/security" }}
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
              <RootLink className={buttonClass("quiet")}>Not now</RootLink>
            ) : null}
          </>
        )}
      </section>
    </PageFrame>
  );
}
