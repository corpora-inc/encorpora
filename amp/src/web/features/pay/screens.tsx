import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { AuthSession } from "../../auth";
import { licenseSummary } from "../../family-access";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Page } from "../../ui/Page";
import { PageHeader } from "../../ui/PageHeader";
import { Toast } from "../../ui/Toast";
import { useClaimEnrollment } from "../billing";
import { childPagePath } from "../family/api";
import { fundingOffersOptions, fundingPrograms, fundingRequestOptions } from "./api";
import { CardDone, useCardOutcome } from "./CardDone";
import { CardPanel } from "./CardPanel";
import { usePay, usePayState, type PayContext, type PayLearner } from "./context";
import { EsaPanel, InvoiceDone, invoiceGivesAccess, RowsSkeleton } from "./EsaPanel";
import { forWhom, whoName } from "./paths";
import { MethodTabs, useMethod } from "./PlanPicker";
import { usePayStore } from "./store";
import styles from "./Pay.module.css";

/*
 * The pay flow's screens (paths.ts has the map). Each is one Page at the
 * standard width under one PageHeader: "‹ Back" up to the learner's page,
 * the title, and who it is for. The choosing screen's header never changes
 * between its tabs, so switching never moves anything.
 */

/** The learner's own page: where paying starts from and ends. A child's
 * page is in its family; the adult's is their own record. */
function useLearnerHome(session: AuthSession | null, learner: PayLearner | undefined) {
  const child = !!session && !!learner && !learner.adult && !learner.simulation;
  const page = useQuery({
    queryKey: ["account", session?.accountId, "families", "child-page", learner?.id],
    queryFn: () => childPagePath(session!, learner!.id),
    enabled: child,
  });
  if (!learner || learner.adult || learner.simulation) return "/me";
  return page.data ?? "/family";
}

const hasFull = (learner: PayLearner) =>
  `${whoName(learner)} ${learner.adult ? "have" : "has"} full access`;

/** A pay screen: its header, then its body once the account and learner
 * are known (the header keeps its place while they load). */
function PayFrame({
  title,
  screen,
  children,
}: {
  title: ReactNode | ((context: PayContext) => ReactNode);
  screen: string;
  children: () => ReactNode;
}) {
  const { session, me, account, learner, ready } = usePayState();
  const home = useLearnerHome(session, learner);
  return (
    <Page width="standard" className={styles.step} data-pay={screen}>
      <PageHeader
        // Up to an explicit parent, the learner's page, never a browser
        // Back (founder, 2026-11-16).
        back={home}
        title={typeof title === "function" ? (ready ? title(ready) : " ") : title}
        subtitle={learner ? forWhom(learner) : " "}
      />
      {ready ? (
        children()
      ) : me.error && !account ? (
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
      ) : account && !learner ? (
        <EmptyState
          title="This learner isn’t in your account"
          action={
            <Link to="/account/billing" className={buttonClass("primary")}>
              Open billing
            </Link>
          }
        >
          Billing lists each of your learners and their plans.
        </EmptyState>
      ) : (
        <RowsSkeleton rows={3} />
      )}
    </Page>
  );
}

/* ---------- /pay/<learner>: choose ---------- */

export function PayScreen() {
  return (
    <PayFrame title="Choose your plan" screen="choose">
      {() => <Choose />}
    </PayFrame>
  );
}

function Choose() {
  const { me, learner } = usePay();
  if (learner.hasAccess) return <HasAccess />;
  if (me.unassignedPurchase) return <UsePaidPlan purchaseId={me.unassignedPurchase.id} />;
  return <Methods />;
}

/**
 * The two ways to pay as tabs of this one screen. Both panels are drawn in
 * the same place, the one not chosen hidden, so the area is always the
 * taller one's height and switching moves nothing.
 */
function Methods() {
  const offers = useQuery(fundingOffersOptions);
  const funds = fundingPrograms(offers.data ?? []).length > 0;
  // Tabs while the programs load too, so their row never appears late.
  const tabs = funds || offers.isPending;
  const method = useMethod(funds);
  return (
    <>
      {tabs && <MethodTabs />}
      <div className={styles.panels}>
        <section
          className={styles.panelArea}
          aria-label="Card"
          data-method="card"
          data-active={method === "card"}
          inert={method !== "card"}
          aria-hidden={method !== "card"}
        >
          <CardPanel />
        </section>
        {tabs && (
          <section
            className={styles.panelArea}
            aria-label="Education funds"
            data-method="esa"
            data-active={method === "esa"}
            inert={method !== "esa"}
            aria-hidden={method !== "esa"}
          >
            <EsaPanel />
          </section>
        )}
      </div>
    </>
  );
}

function HasAccess() {
  const { learner } = usePay();
  const access = licenseSummary(learner.access);
  return (
    <div className={styles.panel}>
      <p className={styles.text}>
        {access.license
          ? `${hasFull(learner)} ${access.kind === "scheduled" ? "from" : "through"} ${new Date(
              access.kind === "scheduled" ? access.license.startsAt : access.license.endsAt,
            ).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`
          : `${hasFull(learner)}.`}
      </p>
      <div className={styles.actions}>
        <Link to="/account/billing" className={buttonClass("primary")}>
          View billing
        </Link>
      </div>
    </div>
  );
}

/** A plan already paid for that no learner holds yet: it becomes this
 * learner's, never a second checkout. */
function UsePaidPlan({ purchaseId }: { purchaseId: string }) {
  const { session, learner } = usePay();
  const claim = useClaimEnrollment(session);
  const paid = usePayStore((state) => state.paid);
  return (
    <div className={styles.panel}>
      <Toast message={claim.error?.message ?? ""} onDismiss={() => claim.reset()} />
      <p className={styles.text}>
        Your plan is paid and isn’t anyone’s yet. It can be{" "}
        {learner.adult ? "yours" : `${learner.name}’s`}.
      </p>
      <div className={styles.actions}>
        <Button
          variant="primary"
          aria-busy={claim.isPending || undefined}
          disabled={claim.isPending}
          onClick={() =>
            claim.mutate(
              { purchaseId, learnerId: learner.id },
              {
                onSuccess: () => paid(session.accountId),
                onError: (error) => console.error("The paid plan wasn’t assigned", error),
              },
            )
          }
        >
          Use it for {learner.adult ? "your practice" : learner.name}
        </Button>
      </div>
    </div>
  );
}

/* ---------- /pay/<learner>/card/done ---------- */

export function PayCardDoneScreen() {
  return (
    <PayFrame
      title={({ learner }) => (learner.hasAccess ? hasFull(learner) : "Confirming your payment")}
      screen="card-done"
    >
      {() => <CardDoneBody />}
    </PayFrame>
  );
}
function CardDoneBody() {
  const { session, me, learner } = usePay();
  const { outcome, retry } = useCardOutcome(session, me, learner);
  const home = useLearnerHome(session, learner);
  return (
    <CardDone session={session} learner={learner} outcome={outcome} retry={retry} done={home} />
  );
}

/* ---------- /pay/<learner>/invoice/<invoice> ---------- */

export function PayInvoiceScreen() {
  const { invoiceId } = useParams({ strict: false }) as { invoiceId: string };
  return (
    <PayFrame
      title={(context) => <InvoiceHeading {...context} invoiceId={invoiceId} />}
      screen="invoice"
    >
      {() => <InvoiceDone invoiceId={invoiceId} />}
    </PayFrame>
  );
}
/** "August has full access now", once the invoice's access is live: the
 * same cached answer the body reads. */
function InvoiceHeading({ session, learner, invoiceId }: PayContext & { invoiceId: string }) {
  const record = useQuery(fundingRequestOptions(session, invoiceId)).data;
  return invoiceGivesAccess(record, learner) ? `${hasFull(learner)} now` : "Your invoice is ready";
}
