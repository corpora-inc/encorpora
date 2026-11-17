import { useSettingsFamily } from "../family/account-settings";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Navigate } from "../../nav/Navigate";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { useState } from "react";
import { meOptions, sessionOptions } from "../../lib/query";
import { request } from "../../lib/api";
import { buttonClass, Button } from "../../ui/Button";
import { LoadingScreen, RouteError } from "../../ui/LoadingScreen";
import { paymentUrl } from "../billing";
import { rememberContinuation } from "../continue/memory";
import { licenseSummary } from "../../family-access";
import { FundingInvoices } from "../funding/FundingInvoices";
import { secondParentOnly } from "../second-parent/api";
import { SecondParentNote } from "../second-parent/SecondParentNote";
import { Receipts } from "./Receipts";
import { AccountPageHeader } from "./AccountPageHeader";
import styles from "./BillingPage.module.css";

export function BillingPage() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  if (session?.accountId.startsWith("school:")) return <LoadingScreen />;
  return session ? (
    <Billing key={session.accountId} session={session} />
  ) : (
    <Navigate to="/sign-in" search={{ next: "/account/billing" }} replace />
  );
}
function Billing({ session }: { session: AuthSession }) {
  const settingsFamily = useSettingsFamily();
  const me = useQuery(meOptions(session));
  const search = useSearch({ strict: false }) as { receipt?: string };
  const navigate = useNavigate();
  const [datesFor, setDatesFor] = useState<string | null>(null);
  const portal = useMutation({
    mutationFn: () =>
      request("/billing/portal", z.object({ url: z.string() }), {
        token: session.token,
        body: {},
      }),
    onSuccess: ({ url }) =>
      window.location.assign(paymentUrl(url, "billing.stripe.com")),
  });
  if (me.error)
    return <RouteError error={me.error} reset={() => void me.refetch()} />;
  if (!me.data?.signedIn) return <LoadingScreen />;
  const account = me.data;
  const sharedFamily = secondParentOnly(account);
  const all = account.family.learners.filter(
    (l) => !l.simulation && (!l.deletedAt || l.access.length),
  );
  const children = all.filter((l) => !l.adult);
  const learners = children.length ? children : all;
  const linked = all.some((l) => l.stripeLinked);
  const receipt = (id?: string) =>
    void navigate({
      to: "/account/billing",
      search: id ? { receipt: id } : {},
    });
  return (
    <main
      className={styles.page}
      data-family-settings-detail={settingsFamily ? "" : undefined}
    >
      <AccountPageHeader
        title={search.receipt ? "Receipt" : "Billing"}
        familyId={search.receipt ? null : settingsFamily}
        description={
          !search.receipt && "Manage your plans, education funds and receipts."
        }
        before={
          search.receipt ? (
            <Button variant="quiet" align="start" onClick={() => receipt()}>
              ← Billing
            </Button>
          ) : null
        }
      />
      {!search.receipt && (
        <>
          <section className={styles.section} aria-labelledby="plans-title">
            <div className={styles.sectionHeading}>
              <h2 id="plans-title">Your plans</h2>
              {linked && (
                <Button
                  variant="secondary"
                  aria-busy={portal.isPending || undefined}
                  disabled={portal.isPending}
                  onClick={() => portal.mutate()}
                >
                  Manage subscriptions
                </Button>
              )}
            </div>
            {linked && (
              <p className={styles.muted}>
                Change your payment method or cancel renewal in Stripe.
              </p>
            )}
            {portal.error && (
              <p role="alert">
                Couldn’t open subscription settings. Try again.
              </p>
            )}
            {sharedFamily && <SecondParentNote me={account} />}
            {!learners.length && !sharedFamily && (
              <div className={styles.empty}>
                <p>No plans yet.</p>
                <Link to="/start/plan" className={buttonClass("primary")}>
                  Choose a plan
                </Link>
              </div>
            )}
            <ul className={styles.plans}>
              {learners.map((learner) => {
                const access = licenseSummary(learner.access);
                const label = learner.deletedAt
                  ? "Deleted learner"
                  : learner.adult
                    ? "Your practice"
                    : learner.name;
                return (
                  <li key={learner.id}>
                    <div className={styles.planRow}>
                      <div>
                        <h3>{label}</h3>
                        <p>
                          {access.license
                            ? `${access.kind === "scheduled" ? "Starts" : "Access through"} ${date(access.kind === "scheduled" ? access.license.startsAt : access.license.endsAt)}`
                            : "Free practice"}
                        </p>
                      </div>
                      {access.kind === "none" && !learner.deletedAt ? (
                        <Link
                          to="/continue/$learnerId"
                          params={{ learnerId: learner.id }}
                          className={buttonClass("primary")}
                          onClick={() =>
                            rememberContinuation({
                              accountId: session.accountId,
                              learnerId: learner.id,
                              returnTo: "/account/billing",
                            })
                          }
                        >
                          Choose a plan
                        </Link>
                      ) : learner.access.length > 1 ? (
                        <Button
                          variant="quiet"
                          onClick={() =>
                            setDatesFor(
                              datesFor === learner.id ? null : learner.id,
                            )
                          }
                          aria-expanded={datesFor === learner.id}
                        >
                          Plan history
                        </Button>
                      ) : null}
                    </div>
                    {datesFor === learner.id && (
                      <ul className={styles.dates}>
                        {learner.access.map((entry, i) => (
                          <li key={i}>
                            {date(entry.startsAt)} – {date(entry.endsAt)}
                            {entry.status === "revoked" ? " · Ended" : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className={styles.funding} aria-labelledby="funding-title">
            <div>
              <h2 id="funding-title">Pay with education funds</h2>
              <p>
                Choose your program and plan, then download an invoice to submit
                to your program.
              </p>
            </div>
            <Link to="/purchase/funded" className={buttonClass("secondary")}>
              Get an invoice
            </Link>
          </section>
        </>
      )}
      {!search.receipt && (
        <FundingInvoices
          session={session}
          verified={!account.account.confirmationRequired}
        />
      )}
      <Receipts
        session={session}
        selected={search.receipt}
        onSelect={receipt}
      />
      <footer className={styles.support}>
        Questions about a payment?{" "}
        <a href="mailto:support@corpora.inc">support@corpora.inc</a>
      </footer>
    </main>
  );
}
const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
