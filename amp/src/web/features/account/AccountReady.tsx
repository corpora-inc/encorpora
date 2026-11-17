import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { signInTarget } from "../../app/sign-in-gate";
import { meOptions } from "../../lib/query";
import { useSession } from "../../lib/session";
import { PageFrame, FrameBrand, frameCard } from "../../ui/PageFrame";
import { Button, buttonClass } from "../../ui/Button";
import styles from "./Account.module.css";

/** A successful account creation has an explicit, useful landing screen.
 * Its route signs in first and sends a waiting gift to /access in its one
 * hop (app/router.tsx, `accountReady`), so here there is always a session. */
export function AccountReady() {
  const session = useSession();
  const location = useLocation();
  const me = useQuery(meOptions(session));
  const account =
    me.data?.signedIn && me.data.account.id === session.accountId
      ? me.data
      : null;
  const active = account?.learners.some(
    (learner) => learner.entitlement.active,
  );
  return (
    <PageFrame>
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
                // The sign-in gate's address: back here, with what this
                // sign-up carried.
                {...signInTarget(location)}
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
                  // The arrival's program and campaign are the tab's
                  // (lib/program-choice.ts); the first run reads them.
                  className={buttonClass("primary")}
                  to="/start"
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
