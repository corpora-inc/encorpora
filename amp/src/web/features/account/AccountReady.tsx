import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Navigate, useSearch } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { continuationSearch } from "../../lib/funded-entry";
import { chosenPlan } from "../../lib/pending-trial";
import { PageFrame, FrameBrand, frameCard } from "../../ui/PageFrame";
import { Button, buttonClass } from "../../ui/Button";
import { AccountMenu } from "./AccountMenu";
import styles from "./Account.module.css";

/** A successful account creation has an explicit, useful landing screen. */
export function AccountReady() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const rawSearch = useSearch({ strict: false });
  const carry = continuationSearch(rawSearch);
  const me = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  });
  if (!session) return <Navigate to="/sign-in" search={carry} replace />;
  const account =
    me.data?.signedIn && me.data.account.id === session.accountId
      ? me.data
      : null;
  const active = account?.learners.some(
    (learner) => learner.entitlement.active,
  );
  const setup = !!account && (account.next !== "try" || !!chosenPlan());
  return (
    <PageFrame centered>
      <section
        data-account-ready
        className={`${frameCard} ${styles.ready}`}
        aria-busy={me.isPending}
      >
        <div className={styles.readyHeader}>
          <FrameBrand expanded />
          <AccountMenu />
        </div>
        <h1>Your account is ready</h1>
        {account?.account.email && (
          <p className={styles.email}>Signed in as {account.account.email}</p>
        )}
        {me.isPending ? (
          <p role="status">Checking your next step…</p>
        ) : !account ? (
          <>
            <p role="alert">Your account details could not be loaded.</p>
            {me.data?.signedIn === false ? (
              <Link
                className={buttonClass("primary")}
                to="/sign-in"
                search={carry}
              >
                Sign in again
              </Link>
            ) : (
              <Button variant="primary" onClick={() => void me.refetch()}>
                Try again
              </Button>
            )}
          </>
        ) : (
          <>
            <p>
              {active
                ? "Your learner profile and learning access are ready."
                : setup
                  ? "Continue your learner setup. Your sign-in is saved."
                  : "Your sign-in is saved. You can continue the free assessment without paying."}
            </p>
            {!active && !setup && (
              <p>
                Assessment progress stays on this device until you save it to a
                learner profile.
              </p>
            )}
            <div className={styles.actions}>
              {active ? (
                <Link
                  className={buttonClass("primary")}
                  to="/$"
                  params={{ _splat: "practice" }}
                >
                  Continue learning →
                </Link>
              ) : setup ? (
                <Link
                  className={buttonClass("primary")}
                  to="/start"
                  search={carry}
                >
                  Continue setup →
                </Link>
              ) : (
                <Link
                  className={buttonClass("primary")}
                  to="/try"
                  search={carry}
                >
                  Continue free assessment →
                </Link>
              )}
              <Link
                className={buttonClass("quiet")}
                to="/$"
                params={{ _splat: "family/security" }}
              >
                Account settings
              </Link>
            </div>
          </>
        )}
      </section>
    </PageFrame>
  );
}
