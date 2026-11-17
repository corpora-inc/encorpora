import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { meOptions } from "../../lib/query";
import { request } from "../../lib/api";
import { useSession } from "../../lib/session";
import { Button } from "../../ui/Button";
import { Disclosure } from "../../ui/Disclosure";
import { Loading } from "../../ui/Loading";
import { paymentUrl } from "../billing";
import { rememberContinuation } from "../continue/memory";
import { licenseSummary } from "../../family-access";
import { FundingInvoices } from "../funding/FundingInvoices";
import { secondParentOnly } from "../second-parent/api";
import { SecondParentNote } from "../second-parent/SecondParentNote";
import { Receipts } from "./Receipts";
import { PageSection } from "../../ui/PageSection";
import { useOverlayHub, useReplaceWithPay } from "./AccountOverlay";
import { usePanel } from "./panels";
import styles from "./BillingPage.module.css";

/**
 * Billing (the IA v2 spec, §3.2, BillingPanel), the body of the Billing
 * overlay over a settings hub: each learner's plan, Manage subscriptions
 * (Stripe's portal, which leaves the app on purpose), education-fund
 * invoices, and the receipts, folded, each opening in place. Choose a plan
 * replaces this overlay with Pay over the same hub, so ✕ on Pay returns to
 * the hub. Which part opens first is the account's panel state
 * (features/account/panels.ts), never the address.
 */
export function BillingPanel() {
  const session = useSession();
  const me = useQuery(meOptions(session));
  const hub = useOverlayHub();
  const toPay = useReplaceWithPay();
  const [panel, setPanel] = usePanel(session.accountId, "billing");
  const [receipt, setReceipt] = useState<string | undefined>();
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
    return (
      <p role="alert">
        Billing didn’t load.{" "}
        <Button variant="quiet" onClick={() => void me.refetch()}>
          Try again
        </Button>
      </p>
    );
  if (!me.data?.signedIn) return <Loading>Reading your plans</Loading>;
  const account = me.data;
  const sharedFamily = secondParentOnly(account);
  const all = account.family.learners.filter(
    (l) => !l.simulation && (!l.deletedAt || l.access.length),
  );
  const children = all.filter((l) => !l.adult);
  const learners = children.length ? children : all;
  const linked = all.some((l) => l.stripeLinked);
  return (
    <div className={styles.page} data-billing-panel="">
      {!receipt && (
        <>
          <PageSection
            title="Your plans"
            titleId="plans-title"
            actions={
              linked && (
                <Button
                  variant="secondary"
                  aria-busy={portal.isPending || undefined}
                  disabled={portal.isPending}
                  onClick={() => portal.mutate()}
                >
                  Manage subscriptions
                </Button>
              )
            }
          >
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
                        <Button
                          variant="primary"
                          data-choose-plan={learner.id}
                          onClick={() => {
                            rememberContinuation({
                              accountId: session.accountId,
                              learnerId: learner.id,
                              returnTo: hub,
                            });
                            toPay(learner.id);
                          }}
                        >
                          Choose a plan
                        </Button>
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
          </PageSection>
        </>
      )}
      {!receipt && (
        <FundingInvoices verified={!account.account.confirmationRequired} />
      )}
      {receipt ? (
        <Receipts selected={receipt} onSelect={setReceipt} />
      ) : (
        <Disclosure
          summary="Receipts"
          open={panel === "receipts"}
          onOpenChange={(open) => setPanel(open ? "receipts" : null)}
        >
          <Receipts onSelect={setReceipt} />
        </Disclosure>
      )}
      {/* A line, not a <footer>: style.css gives every bare footer the
          marketing page's rule and margins (an empty band under Receipts). */}
      <p className={styles.support}>
        Questions about a payment? Write to support@corpora.inc
      </p>
    </div>
  );
}
const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
