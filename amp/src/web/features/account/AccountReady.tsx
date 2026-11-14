import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Navigate, useSearch } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { continuationSearch } from "../../lib/funded-entry";
import { PageFrame, FrameBrand, frameCard } from "../../ui/PageFrame";
import { Button, buttonClass } from "../../ui/Button";
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
  if (account?.availableAccessGrant || carry.return === "access")
    return <Navigate to="/access" replace />;
  const active = account?.learners.some(
    (learner) => learner.entitlement.active,
  );
  return (
    <PageFrame centered>
      <section
        data-account-ready
        className={`${frameCard} ${styles.ready}`}
        aria-busy={me.isPending}
      >
        <div className={styles.readyHeader}>
          <FrameBrand expanded />
        </div>
        <h1>Your account is ready</h1>
        {account?.account.email && (
          <p className={styles.email}>
            Signed in as{" "}
            <span className={styles.address}>{account.account.email}</span>
          </p>
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
                : "Your sign-in is saved. One question, and you’re practicing."}
            </p>
            <div className={styles.actions}>
              {active ? (
                <Link
                  className={buttonClass("primary")}
                  to="/$"
                  params={{ _splat: "practice" }}
                >
                  Continue learning →
                </Link>
              ) : (
                <Link
                  className={buttonClass("primary")}
                  to="/start"
                  search={carry}
                >
                  Continue →
                </Link>
              )}
              {!active && (
                <Link to="/access" className={buttonClass("quiet")}>
                  Check an invitation
                </Link>
              )}
              <Link
                className={buttonClass("quiet")}
                to="/$"
                params={{ _splat: "account/security" }}
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
