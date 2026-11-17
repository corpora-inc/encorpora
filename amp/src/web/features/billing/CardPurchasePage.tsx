import { Link, useSearch } from "@tanstack/react-router";
import { Navigate } from "../../nav/Navigate";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { sessionOptions, meOptions } from "../../lib/query";
import { buttonClass } from "../../ui/Button";
import { LoadingScreen, RouteError } from "../../ui/LoadingScreen";
import { AnnualPurchase } from "../../AnnualPurchase";
import { useNavigate } from "@tanstack/react-router";
import { rememberContinuation } from "../continue/memory";
import type { AuthSession } from "../../auth";
import { Page } from "../../ui/Page";
import { PageHeader } from "../../ui/PageHeader";
import styles from "../account/BillingPage.module.css";

/** Older purchase links choose a learner, then use the one checkout screen.
 * Stripe's existing return URL remains valid while a payment is settling. */
export function CardPurchasePage() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const search = useSearch({ strict: false }) as {
    interval?: "year" | "month";
    learner?: string;
  };
  const query = new URLSearchParams();
  if (search.interval === "year" || search.interval === "month")
    query.set("interval", search.interval);
  if (search.learner) query.set("learner", search.learner);
  return session ? (
    <CardEntry session={session} />
  ) : (
    <Navigate
      to="/sign-in"
      search={{ next: `/purchase/annual${query.size ? `?${query}` : ""}` }}
      replace
    />
  );
}
function CardEntry({ session }: { session: AuthSession }) {
  const me = useQuery(meOptions(session));
  const search = useSearch({ strict: false }) as {
    learner?: string;
    interval?: "year" | "month";
    purchase?: string;
    billing?: "processing" | "canceled" | "account";
  };
  const navigate = useNavigate();
  if (me.error)
    return <RouteError error={me.error} reset={() => void me.refetch()} />;
  if (!me.data?.signedIn) return <LoadingScreen />;
  if (search.purchase || search.billing)
    return (
      <AnnualPurchase
        token={session.token}
        identity={session.accountId}
        purchaseId={search.purchase}
        returnState={search.billing}
        onClose={() => void navigate({ to: "/account/billing" })}
      />
    );
  const all = me.data.family.learners.filter(
    (l) => !l.deletedAt && !l.simulation,
  );
  const children = all.filter((l) => !l.adult);
  const learners = children.length ? children : all;
  const learner =
    learners.find((l) => l.id === search.learner) ??
    (learners.length === 1 ? learners[0] : undefined);
  if (learner)
    return (
      <Navigate
        to="/continue/$learnerId"
        params={{ learnerId: learner.id }}
        search={{ interval: search.interval }}
        replace
      />
    );
  if (!learners.length)
    return (
      <Navigate
        to="/start/plan"
        search={{ interval: search.interval }}
        replace
      />
    );
  return (
    <Page className={styles.page}>
      <PageHeader title="Who is this plan for?" />
      <ul className={styles.plans}>
        {learners.map((l) => (
          <li key={l.id} className={styles.planRow}>
            <div>
              <h3>{l.adult ? "Your practice" : l.name}</h3>
              <p>
                {l.hasAccess
                  ? "Already has access"
                  : "Choose annual or monthly"}
              </p>
            </div>
            <Link
              to="/continue/$learnerId"
              params={{ learnerId: l.id }}
              search={{ interval: search.interval }}
              className={buttonClass("secondary")}
              onClick={() =>
                rememberContinuation({
                  accountId: session.accountId,
                  learnerId: l.id,
                  returnTo: "/account/billing",
                })
              }
            >
              {l.hasAccess ? "View access" : "Choose plan"}
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
